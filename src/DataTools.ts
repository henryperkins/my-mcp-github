// src/DataTools.ts
import { z } from "zod";
import { formatResponse, formatToolError, normalizeError } from "./utils/response";
import { ElicitationRequest } from "./tool-elicitation";
import { elicitIfNeeded, mergeElicitedParams, needsElicitation } from "./utils/elicitation-integration";
import type { ToolContext } from "./types";

// MCP-compliant elicitation builders
function createBlobDataSourceElicitation(): ElicitationRequest {
  return {
    message: "Configure Azure Blob Storage data source connection",
    requestedSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          title: "Data source name",
          description: "Unique within the Search service"
        },
        storageAccount: {
          type: "string",
          title: "Storage account name"
        },
        containerName: {
          type: "string",
          title: "Blob container name"
        },
        description: {
          type: "string",
          title: "Description"
        },
        connectionString: {
          type: "string",
          title: "Connection string",
          description: "Full connection string (optional if providing account key)"
        },
        accountKey: {
          type: "string",
          title: "Account key",
          description: "Storage account key (optional if providing connection string)"
        },
        highWaterMarkColumnName: {
          type: "string",
          title: "High water mark column",
          description: "Column for change detection (default: metadata_storage_last_modified)"
        }
      },
      required: ["name", "storageAccount", "containerName"]
    }
  };
}

function createBlobSyncPlanElicitation(): ElicitationRequest {
  return {
    message: "Generate a local sync plan to push repository to Azure Blob Storage",
    requestedSchema: {
      type: "object",
      properties: {
        storageAccount: {
          type: "string",
          title: "Storage account name"
        },
        containerName: {
          type: "string",
          title: "Blob container name"
        },
        absoluteRepoPath: {
          type: "string",
          title: "Absolute repo path",
          description: "Optional; defaults to current directory"
        },
        strategy: {
          type: "string",
          title: "Sync strategy",
          description: "localAzCli uses helper script, uploadBatch uses direct Azure CLI",
          enum: ["localAzCli", "uploadBatch"],
          enumNames: ["Use helper script (filters artifacts)", "Direct Azure CLI upload"]
        }
      },
      required: ["storageAccount", "containerName"]
    }
  };
}

/**
 * Register data source management and blob sync tools.
 * Tools:
 *  - listDataSources, getDataSource
 *  - createOrUpdateBlobDataSource
 *  - generateBlobSyncPlan
 */
export function registerDataTools(server: any, context: ToolContext) {
  const { getClient, getSummarizer } = context;
  // ---------------- DATA SOURCES ----------------
  server.tool(
    "listDataSources",
    "List data source connection names.",
    {},
    async () => {
      try {
        const client = getClient();
        const dataSources = await client.listDataSources();
        const names = dataSources.map((ds: any) => ds.name);
        const structuredData = { dataSources: names, count: names.length };
        return await formatResponse(structuredData, {
          summarizer: getSummarizer?.() || undefined,
          structuredContent: structuredData
        });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "listDataSources" });
        return formatToolError(insight);
      }
    }
  );

  server.tool(
    "getDataSource",
    "Get a data source connection.",
    { name: z.string() },
    async ({ name }: any) => {
      try {
        const client = getClient();
        const ds = await client.getDataSource(name);
        return await formatResponse(ds, {
          summarizer: getSummarizer?.() || undefined,
          structuredContent: ds
        });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "getDataSource", name });
        return formatToolError(insight);
      }
    }
  );

  // NEW: Create or update an Azure Blob data source
  server.tool(
    "createOrUpdateBlobDataSource",
    "Create or update an Azure Blob Storage data source connection. Provide a connectionString or accountKey.",
    {
      name: z.string().describe("Data source name (unique within the Search service)"),
      storageAccount: z.string().describe("Azure Storage account name"),
      containerName: z.string().describe("Blob container name"),
      auth: z
        .object({
          connectionString: z
            .string()
            .optional()
            .describe(
              "Full connection string, e.g. DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net"
            ),
          accountKey: z
            .string()
            .optional()
            .describe(
              "If provided, a connection string will be constructed from storageAccount + accountKey"
            )
        })
        .optional(),
      description: z.string().optional(),
      highWaterMarkColumnName: z.string().optional().default("metadata_storage_last_modified")
    },
    async ({ name, storageAccount, containerName, auth, description, highWaterMarkColumnName }: any) => {
      try {
        const client = getClient();

        // Check if we need to elicit missing parameters
        const needsAuth = !(auth?.connectionString || auth?.accountKey);
        if (needsElicitation({ name, storageAccount, containerName }, ["name", "storageAccount", "containerName"]) || needsAuth) {
          const elicited = await elicitIfNeeded(context.agent || server, createBlobDataSourceElicitation());
          if (elicited) {
            name = name || elicited.name;
            storageAccount = storageAccount || elicited.storageAccount;
            containerName = containerName || elicited.containerName;
            description = description ?? elicited.description;
            highWaterMarkColumnName = highWaterMarkColumnName ?? elicited.highWaterMarkColumnName ?? "metadata_storage_last_modified";
            
            // Handle auth from elicitation
            if (!auth) {
              auth = {};
              if (elicited.connectionString) {
                auth.connectionString = elicited.connectionString;
              } else if (elicited.accountKey) {
                auth.accountKey = elicited.accountKey;
              }
            }
          }
        }

        const connectionString =
          auth?.connectionString ??
          (auth?.accountKey
            ? `DefaultEndpointsProtocol=https;AccountName=${storageAccount};AccountKey=${auth.accountKey};EndpointSuffix=core.windows.net`
            : undefined);

        if (!name || !storageAccount || !containerName || !connectionString) {
          const error = new Error(
            "Missing required parameters. Provide name, storageAccount, containerName, and either auth.connectionString or auth.accountKey."
          );
          const { insight } = normalizeError(error, {
            tool: "createOrUpdateBlobDataSource",
            name,
            storageAccount,
            containerName
          });
          return formatToolError(insight);
        }

        const dataSourceDefinition = {
          name,
          type: "azureblob",
          description,
          credentials: { connectionString },
          container: { name: containerName, query: null },
          dataChangeDetectionPolicy: {
            "@odata.type": "#Microsoft.Azure.Search.HighWaterMarkChangeDetectionPolicy",
            highWaterMarkColumnName: highWaterMarkColumnName || "metadata_storage_last_modified"
          },
          dataDeletionDetectionPolicy: null
        };

        const result = await client.createOrUpdateDataSource(name, dataSourceDefinition);

        // Helpful add-on: return a convenience command to create the container if needed
        const createContainerCommand = `az storage container create --account-name ${storageAccount} --name ${containerName}`;

        const structuredData = {
          success: true,
          message: `Data source '${name}' created/updated.`,
          dataSource: result,
          nextSteps: [`If the container doesn't exist, create it locally:`, createContainerCommand]
        };
        return await formatResponse(structuredData, {
          summarizer: getSummarizer?.() || undefined,
          structuredContent: structuredData
        });
      } catch (e) {
        const { insight } = normalizeError(e, {
          tool: "createOrUpdateBlobDataSource",
          name,
          storageAccount,
          containerName
        });
        return formatToolError(insight);
      }
    }
  );

  // ---------------- SYNC PLAN (LOCAL) ----------------
  // Generates safe, copy-paste commands leveraging local Azure CLI and the repo's existing scripts.
  server.tool(
    "generateBlobSyncPlan",
    "Generate a local sync plan to push this repo to an Azure Blob container using Azure CLI.",
    {
      storageAccount: z.string(),
      containerName: z.string(),
      absoluteRepoPath: z
        .string()
        .optional()
        .describe(
          "Optional absolute path to the repo root for upload-batch; if omitted, use current directory"
        ),
      strategy: z
        .enum(["localAzCli", "uploadBatch"])
        .default("localAzCli")
        .describe(
          "localAzCli uses sync-to-blob-local.sh; uploadBatch shows az storage blob upload-batch directly"
        )
    },
    async ({ storageAccount, containerName, absoluteRepoPath, strategy }: any) => {
      try {
        // Check if we need to elicit missing parameters
        if (needsElicitation({ storageAccount, containerName }, ["storageAccount", "containerName"])) {
          const elicited = await elicitIfNeeded(context.agent || server, createBlobSyncPlanElicitation());
          if (elicited) {
            storageAccount = storageAccount || elicited.storageAccount;
            containerName = containerName || elicited.containerName;
            absoluteRepoPath = absoluteRepoPath ?? elicited.absoluteRepoPath;
            strategy = strategy ?? elicited.strategy ?? "localAzCli";
          }
        }

        if (!storageAccount || !containerName) {
          const error = new Error("Missing required parameters: storageAccount and containerName.");
          const { insight } = normalizeError(error, {
            tool: "generateBlobSyncPlan",
            storageAccount,
            containerName,
            strategy
          });
          return formatToolError(insight);
        }

        const repoPath = absoluteRepoPath || ".";
        const createContainerCmd = `az storage container create --account-name ${storageAccount} --name ${containerName}`;
        const localScriptCmd = `AZURE_STORAGE_ACCOUNT=${storageAccount} AZURE_CONTAINER_NAME=${containerName} ./sync-to-blob-local.sh`;
        const uploadBatchCmd =
          `az storage blob upload-batch --account-name ${storageAccount} -d ${containerName} -s ${repoPath} ` +
          `--pattern "**/*" --no-progress`;

        const planLines = [
          "Prereqs: Azure CLI installed and logged in (az login). Ensure you have Storage Blob Data Contributor permission.",
          "",
          "# 1) Create container if missing",
          createContainerCmd,
          "",
          "# 2) Sync repository files",
          ...(strategy === "localAzCli"
            ? [
                "# Uses your repo's helper script which filters out build artifacts and adds repo-metadata.json",
                localScriptCmd
              ]
            : [
                "# Direct upload using Azure CLI; customize --pattern to exclude build artifacts if desired",
                uploadBatchCmd
              ]),
          "",
          "# Optional: verify",
          `az storage blob list --account-name ${storageAccount} -c ${containerName} --output table | head -n 20`
        ];

        const structuredData = {
          success: true,
          message: "Local sync plan generated.",
          plan: planLines.join("\n"),
          notes: [
            "This MCP runs in a server/worker environment and cannot access your local filesystem or run az CLI.",
            "Run the above commands in your terminal from the repo root."
          ],
          scriptsAvailable: [
            "./sync-to-blob-local.sh",
            "./quick-setup-azure-sync.sh",
            "./sync-with-key.sh"
          ]
        };
        return await formatResponse(structuredData, {
          summarizer: getSummarizer?.() || undefined,
          structuredContent: structuredData
        });
      } catch (e) {
        const { insight } = normalizeError(e, {
          tool: "generateBlobSyncPlan",
          storageAccount,
          containerName,
          strategy
        });
        return formatToolError(insight);
      }
    }
  );
}