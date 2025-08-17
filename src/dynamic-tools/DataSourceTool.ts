// src/dynamic-tools/DataSourceTool.ts
import { z } from "zod";
import { DynamicTool, OperationDefinition } from "./base/DynamicTool";
import type { ToolContext } from "../types";

export class DataSourceTool extends DynamicTool {
  static readonly toolName = "DataSourceManagement";
  static readonly description = "Manage Azure Search data sources for indexing external content from Azure Blob Storage, Azure SQL, Cosmos DB, ADLS Gen2, and other supported sources.";

  static readonly operations: Record<string, OperationDefinition> = {
    list: {
      description: "List all data source connection names",
      category: 'read',
      params: z.object({
        select: z.string().optional()
          .describe("Use OData $select to reduce payload (e.g., 'name,type,container')")
      }),
      examples: [
        {},
        { select: "name,type,container" }
      ],
      handler: async (client, params, context, helpers) => {
        const dataSources = await helpers.withTimeout(
          client.listDataSources(params.select),
          undefined,
          "listDataSources"
        );
        const names = (dataSources as Array<{ name?: string }>).map(ds => ds.name || "").filter(Boolean);
        return { dataSources: names, count: names.length };
      }
    },

    get: {
      description: "Get data source connection details",
      category: 'read',
      params: z.object({
        name: z.string().describe("Data source name")
      }),
      examples: [
        { name: "blob-datasource" }
      ],
      handler: async (client, params, context, helpers) => {
        return await helpers.withTimeout(
          client.getDataSource(params.name),
          undefined,
          `getDataSource:${params.name}`
        );
      }
    },

    createBlob: {
      description: "Create a new Azure Blob Storage data source connection",
      category: 'write',
      params: z.object({
        name: z.string().describe("Data source name (unique within the Search service)"),
        storageAccount: z.string().describe("Azure Storage account name"),
        containerName: z.string().describe("Blob container name"),
        auth: z.object({
          connectionString: z.string().optional()
            .describe("Full connection string, e.g. DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net"),
          accountKey: z.string().optional()
            .describe("Storage account key (will construct connection string from storageAccount + accountKey)")
        }).optional().describe("Authentication credentials"),
        description: z.string().optional(),
        highWaterMarkColumnName: z.string().optional().default("metadata_storage_last_modified")
          .describe("Column for change detection")
      }),
      examples: [
        {
          name: "repo-datasource",
          storageAccount: "myaccount",
          containerName: "documents",
          auth: { accountKey: "your-key-here" },
          description: "Documents from blob storage"
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Check if we need to elicit auth credentials
        const needsAuth = !(params.auth?.connectionString || params.auth?.accountKey);
        if (needsAuth) {
          const response = await helpers.elicit({
            message: "Azure Blob Storage authentication is required. Please provide either a connection string or account key.",
            inputType: 'text',
            timeout: 30000
          });

          if (response?.text) {
            // Try to detect if it's a connection string or account key
            if (response.text.includes("DefaultEndpointsProtocol")) {
              params.auth = { connectionString: response.text };
            } else {
              params.auth = { accountKey: response.text };
            }
          } else {
            throw new Error("Authentication credentials are required to create a data source");
          }
        }

        // Build connection string if needed
        const connectionString = params.auth?.connectionString ||
          (params.auth?.accountKey
            ? `DefaultEndpointsProtocol=https;AccountName=${params.storageAccount};AccountKey=${params.auth.accountKey};EndpointSuffix=core.windows.net`
            : undefined);

        if (!connectionString) {
          throw new Error("Either auth.connectionString or auth.accountKey is required");
        }

        const dataSourceDefinition = {
          name: params.name,
          type: "azureblob" as const,
          description: params.description,
          credentials: { connectionString },
          container: { name: params.containerName, query: undefined },
          dataChangeDetectionPolicy: {
            "@odata.type": "#Microsoft.Azure.Search.HighWaterMarkChangeDetectionPolicy",
            highWaterMarkColumnName: params.highWaterMarkColumnName
          },
          dataDeletionDetectionPolicy: null
        };

        const result = await helpers.withTimeout(
          client.createOrUpdateDataSource(params.name, dataSourceDefinition),
          undefined,
          "createBlobDataSource"
        );

        helpers.notify("tools/datasource_created", {
          name: params.name,
          type: "azureblob",
          container: params.containerName
        });

        // Emit MCP resource updates
        helpers.notifyResourceUpdated("datasources");
        helpers.notifyResourceUpdated(`datasources/${params.name}`);

        return {
          success: true,
          message: `Data source '${params.name}' created successfully`,
          dataSource: result,
          nextSteps: [
            `Container creation command if needed:`,
            `az storage container create --account-name ${params.storageAccount} --name ${params.containerName}`
          ]
        };
      }
    },

    update: {
      description: "Update an existing data source of any type",
      category: 'write',
      params: z.object({
        name: z.string().describe("Data source name to update"),
        description: z.string().optional().describe("Updated description"),
        connectionString: z.string().optional()
          .describe("Updated connection string (be careful with credentials)"),
        containerName: z.string().optional()
          .describe("Updated container/table/collection name"),
        query: z.string().nullable().optional()
          .describe("Updated query (use null to remove)"),
        dataChangeDetectionPolicy: z.any().optional()
          .describe("Updated change detection policy"),
        dataDeletionDetectionPolicy: z.any().optional()
          .describe("Updated deletion detection policy")
      }),
      examples: [
        {
          name: "my-datasource",
          description: "Updated description",
          query: "SELECT * FROM Products WHERE Active = 1"
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Get existing data source
        const existing: any = await helpers.withTimeout(
          client.getDataSource(params.name),
          undefined,
          `getDataSource:${params.name}`
        );

        // Merge updates
        if (params.description !== undefined) {
          existing.description = params.description;
        }

        if (params.connectionString !== undefined) {
          existing.credentials.connectionString = params.connectionString;
        }

        if (params.containerName !== undefined) {
          existing.container.name = params.containerName;
        }

        if (params.query !== undefined) {
          existing.container.query = params.query;
        }

        if (params.dataChangeDetectionPolicy !== undefined) {
          existing.dataChangeDetectionPolicy = params.dataChangeDetectionPolicy;
        }

        if (params.dataDeletionDetectionPolicy !== undefined) {
          existing.dataDeletionDetectionPolicy = params.dataDeletionDetectionPolicy;
        }

        const result = await helpers.withTimeout(
          client.createOrUpdateDataSource(params.name, existing),
          undefined,
          "updateDataSource"
        );

        helpers.notify("tools/datasource_updated", {
          name: params.name,
          type: existing.type
        });

        helpers.notifyResourceUpdated("datasources");
        helpers.notifyResourceUpdated(`datasources/${params.name}`);

        return {
          success: true,
          message: `Data source '${params.name}' (${existing.type}) updated successfully`,
          dataSource: result
        };
      }
    },

    delete: {
      description: "Delete a data source connection",
      category: 'delete',
      requiresConfirmation: true,
      params: z.object({
        name: z.string().describe("Data source name to delete"),
        confirmation: z.literal("DELETE").optional().describe("Type 'DELETE' to confirm")
      }),
      examples: [
        { name: "old-datasource", confirmation: "DELETE" }
      ],
      handler: async (client, params, context, helpers) => {
        // Elicit confirmation if not provided
        if (params.confirmation !== "DELETE") {
          const response = await helpers.elicit({
            message: `⚠️ This will delete data source '${params.name}'. Any indexers using this data source will fail. Type 'DELETE' to confirm.`,
            inputType: 'text',
            validation: (input: string) => input === "DELETE" ? null : "Please type 'DELETE' to confirm",
            timeout: 10000
          });

          if (response?.text !== "DELETE") {
            throw new Error("Delete operation cancelled");
          }
        }

        await helpers.withTimeout(
          client.deleteDataSource(params.name),
          undefined,
          "deleteDataSource"
        );

        helpers.notify("tools/datasource_deleted", {
          name: params.name,
          timestamp: new Date().toISOString()
        });

        // Emit MCP resource updates
        helpers.notifyResourceUpdated("datasources");
        helpers.notifyResourceUpdated(`datasources/${params.name}`);

        return {
          success: true,
          message: `Data source '${params.name}' has been deleted`
        };
      }
    },

    createSql: {
      description: "Create a new Azure SQL Database data source connection",
      category: 'write',
      params: z.object({
        name: z.string().describe("Data source name (unique within the Search service)"),
        connectionString: z.string()
          .describe("SQL connection string, e.g. Server=tcp:myserver.database.windows.net,1433;Database=mydb;User ID=myuser;Password=mypass;Encrypt=true;"),
        tableName: z.string().describe("Table or view name (e.g., 'dbo.Products')"),
        query: z.string().optional().describe("Optional SQL query to filter data"),
        description: z.string().optional(),
        changeDetectionPolicy: z.enum(["sql-integrated", "high-watermark"]).optional()
          .describe("Change detection: 'sql-integrated' for SQL change tracking, 'high-watermark' for timestamp column"),
        highWaterMarkColumnName: z.string().optional()
          .describe("Column name for high watermark change detection (e.g., 'LastModified')"),
        softDeleteColumnName: z.string().optional()
          .describe("Column name for soft deletes (e.g., 'IsDeleted')"),
        softDeleteMarkerValue: z.string().optional()
          .describe("Value indicating soft delete (e.g., 'true', '1')")
      }),
      examples: [
        {
          name: "sql-products",
          connectionString: "Server=tcp:myserver.database.windows.net,1433;Database=mydb;User ID=myuser;Password=mypass;Encrypt=true;",
          tableName: "dbo.Products",
          changeDetectionPolicy: "sql-integrated",
          description: "Products from Azure SQL"
        }
      ],
      handler: async (client, params, context, helpers) => {
        const dataSourceDefinition: any = {
          name: params.name,
          type: "azuresql",
          description: params.description,
          credentials: { connectionString: params.connectionString },
          container: {
            name: params.tableName,
            query: params.query || null
          }
        };

        // Add change detection policy
        if (params.changeDetectionPolicy === "sql-integrated") {
          dataSourceDefinition.dataChangeDetectionPolicy = {
            "@odata.type": "#Microsoft.Azure.Search.SqlIntegratedChangeTrackingPolicy"
          };
        } else if (params.changeDetectionPolicy === "high-watermark" && params.highWaterMarkColumnName) {
          dataSourceDefinition.dataChangeDetectionPolicy = {
            "@odata.type": "#Microsoft.Azure.Search.HighWaterMarkChangeDetectionPolicy",
            highWaterMarkColumnName: params.highWaterMarkColumnName
          };
        }

        // Add soft delete detection policy
        if (params.softDeleteColumnName && params.softDeleteMarkerValue) {
          dataSourceDefinition.dataDeletionDetectionPolicy = {
            "@odata.type": "#Microsoft.Azure.Search.SoftDeleteColumnDeletionDetectionPolicy",
            softDeleteColumnName: params.softDeleteColumnName,
            softDeleteMarkerValue: params.softDeleteMarkerValue
          };
        }

        const result = await helpers.withTimeout(
          client.createOrUpdateDataSource(params.name, dataSourceDefinition),
          undefined,
          "createSqlDataSource"
        );

        helpers.notify("tools/datasource_created", {
          name: params.name,
          type: "azuresql",
          table: params.tableName
        });

        helpers.notifyResourceUpdated("datasources");
        helpers.notifyResourceUpdated(`datasources/${params.name}`);

        return {
          success: true,
          message: `SQL data source '${params.name}' created successfully`,
          dataSource: result,
          tips: [
            params.changeDetectionPolicy === "sql-integrated"
              ? "Ensure SQL change tracking is enabled on the table"
              : "Ensure the high watermark column is indexed for performance"
          ]
        };
      }
    },

    createCosmosDb: {
      description: "Create a new Azure Cosmos DB data source connection",
      category: 'write',
      params: z.object({
        name: z.string().describe("Data source name (unique within the Search service)"),
        connectionString: z.string()
          .describe("Cosmos DB connection string, e.g. AccountEndpoint=https://myaccount.documents.azure.com;AccountKey=mykey;Database=mydb;"),
        containerName: z.string().describe("Cosmos DB container name"),
        query: z.string().optional()
          .describe("Optional query to filter documents (e.g., 'SELECT * FROM c WHERE c._ts > @HighWaterMark')"),
        description: z.string().optional(),
        useChangeDetection: z.boolean().default(true)
          .describe("Enable change detection using _ts timestamp"),
        partitionKey: z.string().optional()
          .describe("Partition key path if using partitioned collection")
      }),
      examples: [
        {
          name: "cosmos-products",
          connectionString: "AccountEndpoint=https://myaccount.documents.azure.com;AccountKey=mykey;Database=mydb;",
          containerName: "products",
          useChangeDetection: true,
          description: "Product catalog from Cosmos DB"
        }
      ],
      handler: async (client, params, context, helpers) => {
        const dataSourceDefinition: any = {
          name: params.name,
          type: "cosmosdb",
          description: params.description,
          credentials: { connectionString: params.connectionString },
          container: {
            name: params.containerName,
            query: params.query || (params.useChangeDetection ? "SELECT * FROM c WHERE c._ts > @HighWaterMark" : null)
          }
        };

        // Add change detection using _ts timestamp
        if (params.useChangeDetection) {
          dataSourceDefinition.dataChangeDetectionPolicy = {
            "@odata.type": "#Microsoft.Azure.Search.HighWaterMarkChangeDetectionPolicy",
            highWaterMarkColumnName: "_ts"
          };
        }

        const result = await helpers.withTimeout(
          client.createOrUpdateDataSource(params.name, dataSourceDefinition),
          undefined,
          "createCosmosDbDataSource"
        );

        helpers.notify("tools/datasource_created", {
          name: params.name,
          type: "cosmosdb",
          container: params.containerName
        });

        helpers.notifyResourceUpdated("datasources");
        helpers.notifyResourceUpdated(`datasources/${params.name}`);

        return {
          success: true,
          message: `Cosmos DB data source '${params.name}' created successfully`,
          dataSource: result,
          tips: [
            "Cosmos DB indexing may incur RU charges",
            params.useChangeDetection ? "Change detection enabled using _ts timestamp" : "No change detection configured"
          ]
        };
      }
    },

    createAdlsGen2: {
      description: "Create a new Azure Data Lake Storage Gen2 data source connection",
      category: 'write',
      params: z.object({
        name: z.string().describe("Data source name (unique within the Search service)"),
        storageAccount: z.string().describe("ADLS Gen2 storage account name"),
        fileSystem: z.string().describe("File system (container) name"),
        folderPath: z.string().optional().describe("Specific folder path to index"),
        auth: z.object({
          connectionString: z.string().optional()
            .describe("Full connection string"),
          accountKey: z.string().optional()
            .describe("Storage account key")
        }).optional().describe("Authentication credentials"),
        description: z.string().optional(),
        fileExtensions: z.array(z.string()).optional()
          .describe("File extensions to include (e.g., ['.json', '.csv'])"),
        softDeleteColumnName: z.string().optional()
          .describe("Column name for soft deletes"),
        softDeleteMarkerValue: z.string().optional()
          .describe("Value indicating soft delete")
      }),
      examples: [
        {
          name: "adls-data",
          storageAccount: "myadls",
          fileSystem: "data",
          folderPath: "documents",
          auth: { accountKey: "your-key" },
          fileExtensions: [".json", ".csv"],
          description: "Data from ADLS Gen2"
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Check if we need to elicit auth credentials
        const needsAuth = !(params.auth?.connectionString || params.auth?.accountKey);
        if (needsAuth) {
          const response = await helpers.elicit({
            message: "ADLS Gen2 authentication is required. Please provide either a connection string or account key.",
            inputType: 'text',
            timeout: 30000
          });

          if (response?.text) {
            if (response.text.includes("DefaultEndpointsProtocol")) {
              params.auth = { connectionString: response.text };
            } else {
              params.auth = { accountKey: response.text };
            }
          } else {
            throw new Error("Authentication credentials are required");
          }
        }

        const connectionString = params.auth?.connectionString ||
          (params.auth?.accountKey
            ? `DefaultEndpointsProtocol=https;AccountName=${params.storageAccount};AccountKey=${params.auth.accountKey};EndpointSuffix=core.windows.net`
            : undefined);

        if (!connectionString) {
          throw new Error("Either auth.connectionString or auth.accountKey is required");
        }

        const dataSourceDefinition: any = {
          name: params.name,
          type: "adlsgen2",
          description: params.description,
          credentials: { connectionString },
          container: {
            name: params.fileSystem,
            query: params.folderPath ? `folder_path = '${params.folderPath}'` : null
          },
          dataChangeDetectionPolicy: {
            "@odata.type": "#Microsoft.Azure.Search.HighWaterMarkChangeDetectionPolicy",
            highWaterMarkColumnName: "metadata_storage_last_modified"
          }
        };

        // Add soft delete detection policy if specified
        if (params.softDeleteColumnName && params.softDeleteMarkerValue) {
          dataSourceDefinition.dataDeletionDetectionPolicy = {
            "@odata.type": "#Microsoft.Azure.Search.SoftDeleteColumnDeletionDetectionPolicy",
            softDeleteColumnName: params.softDeleteColumnName,
            softDeleteMarkerValue: params.softDeleteMarkerValue
          };
        }

        const result = await helpers.withTimeout(
          client.createOrUpdateDataSource(params.name, dataSourceDefinition),
          undefined,
          "createAdlsGen2DataSource"
        );

        helpers.notify("tools/datasource_created", {
          name: params.name,
          type: "adlsgen2",
          fileSystem: params.fileSystem
        });

        helpers.notifyResourceUpdated("datasources");
        helpers.notifyResourceUpdated(`datasources/${params.name}`);

        return {
          success: true,
          message: `ADLS Gen2 data source '${params.name}' created successfully`,
          dataSource: result,
          tips: [
            "ADLS Gen2 supports hierarchical namespace",
            params.folderPath ? `Indexing folder: ${params.folderPath}` : "Indexing entire file system"
          ]
        };
      }
    },

    createGeneric: {
      description: "Create a data source with full control over the definition (advanced)",
      category: 'write',
      params: z.object({
        name: z.string().describe("Data source name"),
        type: z.enum(["azureblob", "azuresql", "cosmosdb", "azuretable", "mysql", "adlsgen2", "onelake"])
          .describe("Data source type"),
        credentials: z.object({
          connectionString: z.string()
        }).describe("Connection credentials"),
        container: z.object({
          name: z.string().describe("Container/table/collection name"),
          query: z.string().nullable().optional().describe("Optional query")
        }),
        description: z.string().optional(),
        dataChangeDetectionPolicy: z.any().optional()
          .describe("Change detection policy object"),
        dataDeletionDetectionPolicy: z.any().optional()
          .describe("Deletion detection policy object"),
        encryptionKey: z.any().optional()
          .describe("Customer-managed encryption key")
      }),
      examples: [
        {
          name: "custom-datasource",
          type: "azuresql",
          credentials: { connectionString: "Server=..." },
          container: { name: "dbo.CustomTable", query: null },
          dataChangeDetectionPolicy: {
            "@odata.type": "#Microsoft.Azure.Search.SqlIntegratedChangeTrackingPolicy"
          }
        }
      ],
      handler: async (client, params, context, helpers) => {
        const result = await helpers.withTimeout(
          client.createOrUpdateDataSource(params.name, params),
          undefined,
          "createGenericDataSource"
        );

        helpers.notify("tools/datasource_created", {
          name: params.name,
          type: params.type,
          container: params.container.name
        });

        helpers.notifyResourceUpdated("datasources");
        helpers.notifyResourceUpdated(`datasources/${params.name}`);

        return {
          success: true,
          message: `Data source '${params.name}' (${params.type}) created successfully`,
          dataSource: result
        };
      }
    },

    generateSyncPlan: {
      description: "Generate a local sync plan to push repository files to Azure Blob Storage",
      category: 'analyze',
      params: z.object({
        storageAccount: z.string().describe("Azure Storage account name"),
        containerName: z.string().describe("Blob container name"),
        absoluteRepoPath: z.string().optional()
          .describe("Absolute path to repo root (defaults to current directory)"),
        strategy: z.enum(["localAzCli", "uploadBatch"])
          .default("localAzCli")
          .describe("Sync strategy: localAzCli uses helper script, uploadBatch uses direct Azure CLI")
      }),
      examples: [
        {
          storageAccount: "myaccount",
          containerName: "repo-content",
          strategy: "localAzCli"
        }
      ],
      handler: async (client, params, context, helpers) => {
        const repoPath = params.absoluteRepoPath || ".";

        const createContainerCmd = `az storage container create --account-name ${params.storageAccount} --name ${params.containerName}`;
        const localScriptCmd = `AZURE_STORAGE_ACCOUNT=${params.storageAccount} AZURE_CONTAINER_NAME=${params.containerName} ./sync-to-blob-local.sh`;
        const uploadBatchCmd =
          `az storage blob upload-batch --account-name ${params.storageAccount} -d ${params.containerName} -s ${repoPath} ` +
          `--pattern "**/*" --no-progress`;

        const planLines = [
          "Prerequisites: Azure CLI installed and logged in (az login). Ensure you have Storage Blob Data Contributor permission.",
          "",
          "# 1) Create container if missing",
          createContainerCmd,
          "",
          "# 2) Sync repository files",
          ...(params.strategy === "localAzCli"
            ? [
                "# Uses your repo's helper script which filters out build artifacts and adds repo-metadata.json",
                localScriptCmd
              ]
            : [
                "# Direct upload using Azure CLI; customize --pattern to exclude build artifacts if desired",
                uploadBatchCmd
              ]
          ),
          "",
          "# 3) Optional: verify upload",
          `az storage blob list --account-name ${params.storageAccount} -c ${params.containerName} --output table | head -n 20`,
          "",
          "# 4) Optional: create or update data source in Azure Search",
          "# Use DataSourceManagement.createBlob operation after sync completes"
        ];

        helpers.notify("tools/sync_plan_generated", {
          storageAccount: params.storageAccount,
          containerName: params.containerName,
          strategy: params.strategy
        });

        return {
          success: true,
          message: "Local sync plan generated successfully",
          plan: planLines.join("\n"),
          notes: [
            "This MCP runs in a server/worker environment and cannot access your local filesystem or run az CLI.",
            "Run the above commands in your terminal from the repo root.",
            "After syncing, create a data source using the createBlob operation."
          ],
          availableScripts: [
            "./sync-to-blob-local.sh",
            "./quick-setup-azure-sync.sh",
            "./sync-with-key.sh"
          ]
        };
      }
    }
  };

  // Resource definitions
  protected static resources = [
    {
      uri: "datasources://list",
      description: "List of configured data sources",
      handler: async (context: ToolContext) => {
        const client = context.getClient();
        const dataSources = await client.listDataSources();

        return {
          count: dataSources.length,
          dataSources: dataSources.map((ds: any) => ({
            name: ds.name,
            type: ds.type,
            container: ds.container?.name,
            description: ds.description
          }))
        };
      }
    }
  ];

  // Prompt definitions
  protected static prompts = [
    {
      name: "setup_datasource",
      description: "Interactive setup wizard for any data source type",
      params: z.object({
        sourceType: z.enum(["blob", "sql", "cosmosdb", "adlsgen2", "unsure"])
          .describe("What type of data source do you want to connect?"),
        purpose: z.string().describe("What content will you be indexing?"),
        updateFrequency: z.enum(["realtime", "hourly", "daily", "manual"])
          .describe("How often will content change?")
      }),
      handler: async (params: any, _context: ToolContext) => {
        let recommendation: any;

        if (params.sourceType === "unsure") {
          recommendation = DataSourceTool.recommendSourceType(params.purpose);
        } else {
          recommendation = DataSourceTool.getSourceTypeConfiguration(
            params.sourceType,
            params.purpose,
            params.updateFrequency
          );
        }

        return {
          messages: [
            {
              role: "assistant" as const,
              content: {
                type: "text" as const,
                text: recommendation.text
              }
            }
          ]
        };
      }
    },
    {
      name: "compare_datasource_types",
      description: "Compare different data source types for your use case",
      params: z.object({
        useCase: z.string().describe("Describe your use case")
      }),
      handler: async (params: any, _context: ToolContext) => {
        const comparison = DataSourceTool.compareDataSourceTypes(params.useCase);

        return {
          messages: [
            {
              role: "assistant" as const,
              content: {
                type: "text" as const,
                text: comparison
              }
            }
          ]
        };
      }
    }
  ];

  // Helper methods
  private static recommendSourceType(purpose: string): any {
    const purposeLower = purpose.toLowerCase();
    let sourceType = "blob";
    let reasoning = "";

    if (purposeLower.includes("database") || purposeLower.includes("sql") || purposeLower.includes("table")) {
      sourceType = "sql";
      reasoning = "Your use case mentions database/SQL data, Azure SQL is recommended for structured relational data.";
    } else if (purposeLower.includes("cosmos") || purposeLower.includes("document") || purposeLower.includes("nosql")) {
      sourceType = "cosmosdb";
      reasoning = "Your use case suggests document/NoSQL data, Cosmos DB is ideal for flexible schemas.";
    } else if (purposeLower.includes("lake") || purposeLower.includes("adls") || purposeLower.includes("big data")) {
      sourceType = "adlsgen2";
      reasoning = "Your use case mentions data lake/big data, ADLS Gen2 is optimized for analytics workloads.";
    } else {
      sourceType = "blob";
      reasoning = "Azure Blob Storage is recommended as a general-purpose storage solution for files and unstructured data.";
    }

    return {
      text: `## Recommended Data Source Type: ${sourceType.toUpperCase()}\n\n${reasoning}\n\nTo create this data source, use:\n\`\`\`\nDataSourceManagement.create${sourceType === 'sql' ? 'Sql' : sourceType === 'cosmosdb' ? 'CosmosDb' : sourceType === 'adlsgen2' ? 'AdlsGen2' : 'Blob'}\n\`\`\``
    };
  }

  private static getSourceTypeConfiguration(sourceType: string, purpose: string, updateFrequency: string): any {
    const configs: Record<string, any> = {
      blob: {
        operation: "createBlob",
        params: {
          name: purpose.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50) + "-blob-ds",
          description: `Blob storage for ${purpose}`,
          highWaterMarkColumnName: "metadata_storage_last_modified"
        },
        tips: [
          "Supports various file formats (PDF, DOCX, JSON, etc.)",
          "Best for unstructured data and documents",
          updateFrequency === "realtime" ? "Consider using Event Grid for real-time updates" : ""
        ]
      },
      sql: {
        operation: "createSql",
        params: {
          name: purpose.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50) + "-sql-ds",
          description: `SQL database for ${purpose}`,
          changeDetectionPolicy: updateFrequency === "realtime" ? "sql-integrated" : "high-watermark"
        },
        tips: [
          "Best for structured relational data",
          "Enable SQL change tracking for efficient incremental updates",
          "Consider indexing your high watermark column"
        ]
      },
      cosmosdb: {
        operation: "createCosmosDb",
        params: {
          name: purpose.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50) + "-cosmos-ds",
          description: `Cosmos DB for ${purpose}`,
          useChangeDetection: true
        },
        tips: [
          "Ideal for globally distributed data",
          "Uses _ts timestamp for change detection",
          "Be aware of RU consumption during indexing"
        ]
      },
      adlsgen2: {
        operation: "createAdlsGen2",
        params: {
          name: purpose.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50) + "-adls-ds",
          description: `ADLS Gen2 for ${purpose}`
        },
        tips: [
          "Optimized for big data analytics",
          "Supports hierarchical namespace",
          "Can handle massive file volumes"
        ]
      }
    };

    const config = configs[sourceType] || configs.blob;

    return {
      text: `## Configuration for ${sourceType.toUpperCase()} Data Source\n\n**Purpose**: ${purpose}\n**Update Frequency**: ${updateFrequency}\n\n### Recommended Configuration:\n\`\`\`json\n${JSON.stringify(config.params, null, 2)}\n\`\`\`\n\n### Tips:\n${config.tips.filter((t: string) => t).map((t: string) => `- ${t}`).join('\n')}\n\n### Next Steps:\n1. Use \`DataSourceManagement.${config.operation}\` with the above configuration\n2. Create an indexer to start ingesting data\n3. Monitor indexing status and adjust settings as needed`
    };
  }

  private static compareDataSourceTypes(useCase: string): string {
    return `## Data Source Type Comparison for: ${useCase}\n\n### Azure Blob Storage\n**Best for**: Documents, images, unstructured files\n**Pros**: Simple setup, supports many formats, cost-effective\n**Cons**: No query filtering, limited metadata\n**Change Detection**: Last modified timestamp\n\n### Azure SQL Database\n**Best for**: Structured relational data, transactional systems\n**Pros**: SQL queries, joins, integrated change tracking\n**Cons**: Requires database setup, more complex\n**Change Detection**: SQL change tracking or timestamp column\n\n### Cosmos DB\n**Best for**: Semi-structured data, globally distributed apps\n**Pros**: Flexible schema, global replication, fast\n**Cons**: Higher cost, RU consumption\n**Change Detection**: _ts timestamp field\n\n### ADLS Gen2\n**Best for**: Data lakes, big data, analytics\n**Pros**: Hierarchical namespace, massive scale, integrated with Azure analytics\n**Cons**: More complex setup, optimized for batch processing\n**Change Detection**: Last modified timestamp\n\n### Recommendation\nBased on your use case, consider:\n1. **For documents/files**: Azure Blob Storage\n2. **For structured data**: Azure SQL\n3. **For flexible schemas**: Cosmos DB\n4. **For big data**: ADLS Gen2`;
  }

  // Legacy method kept for backward compatibility
  private static _recommendConfiguration(purpose: string, hasStorageAccount: boolean, updateFrequency: string): any {
    const config: any = {
      operation: "createBlob",
      params: {
        name: purpose.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 63) + "-datasource",
        description: `Data source for ${purpose}`,
        highWaterMarkColumnName: "metadata_storage_last_modified"
      }
    };

    let explanation = "";

    if (!hasStorageAccount) {
      explanation += "First, you'll need to create an Azure Storage account. ";
      explanation += "Use the Azure Portal or CLI: `az storage account create --name <name> --resource-group <rg> --location <region> --sku Standard_LRS`\n\n";
    }

    switch (updateFrequency) {
      case "realtime":
        explanation += "For real-time updates, consider using Azure Event Grid with the indexer for immediate processing.";
        break;
      case "hourly":
        explanation += "Set up an indexer with PT1H schedule interval for hourly updates.";
        break;
      case "daily":
        explanation += "Configure an indexer with P1D schedule interval for daily processing.";
        break;
      case "manual":
        explanation += "You can manually trigger indexer runs when needed using IndexerManagement.run operation.";
        break;
    }

    if (purpose.toLowerCase().includes("document") || purpose.toLowerCase().includes("file")) {
      config.params.containerName = "documents";
      explanation += "\n\nFor document indexing, ensure your index has fields for content, metadata, and timestamps.";
    } else if (purpose.toLowerCase().includes("log") || purpose.toLowerCase().includes("audit")) {
      config.params.containerName = "logs";
      explanation += "\n\nFor log data, consider using line-separated JSON parsing mode in the indexer.";
    } else {
      config.params.containerName = "content";
    }

    return { config, explanation };
  }
}
