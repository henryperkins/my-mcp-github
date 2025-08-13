// src/DataTools.ts
import { z } from "zod";
import { formatResponse, normalizeError } from "./utils/response";

type GetClient = () => any;

// Elicitation schema builders for interactive parameter collection
function buildSchemaForBlobDataSource() {
  return {
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
        title: "Description",
        default: ""
      },
      auth: {
        type: "object",
        title: "Authentication",
        properties: {
          connectionString: {
            type: "string",
            title: "Connection string",
            description: "Optional. If omitted, provide an account key instead."
          },
          accountKey: {
            type: "string",
            title: "Account key",
            description: "Optional. Used to construct a connection string if connection string is not provided."
          }
        }
      },
      highWaterMarkColumnName: {
        type: "string",
        title: "High water mark column",
        default: "metadata_storage_last_modified"
      }
    },
    required: ["name", "storageAccount", "containerName"]
  };
}

function buildSchemaForBlobSyncPlan() {
  return {
    type: "object",
    properties: {
      storageAccount: { type: "string", title: "Storage account name" },
      containerName: { type: "string", title: "Blob container name" },
      absoluteRepoPath: { type: "string", title: "Absolute repo path", description: "Optional; defaults to current directory" },
      strategy: {
        type: "string",
        title: "Sync strategy",
        enum: ["localAzCli", "uploadBatch"],
        default: "localAzCli"
      }
    },
    required: ["storageAccount", "containerName"]
  };
}

/**
 * Register data source management and blob sync tools.
 * Tools:
 *  - listDataSources, getDataSource
 *  - createOrUpdateBlobDataSource
 *  - generateBlobSyncPlan
 */
export function registerDataTools(server: any, getClient: GetClient) {
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
        return await formatResponse({ dataSources: names, count: names.length });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "listDataSources" });
        return await formatResponse(insight);
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
        return await formatResponse(ds);
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "getDataSource", name });
        return await formatResponse(insight);
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

        // Local mutable copies for elicitation flow
        let __name = name;
        let __storageAccount = storageAccount;
        let __containerName = containerName;
        let __auth = auth;
        let __description = description;
        let __highWater = highWaterMarkColumnName;

        // If required information is missing, try elicitation (if supported by client)
        const needsAuth = !(__auth?.connectionString || __auth?.accountKey);
        if ((!__name || !__storageAccount || !__containerName || needsAuth) && (server as any)?.server?.elicitInput) {
          try {
            const requestedSchema = buildSchemaForBlobDataSource();
            const elicited = await (server as any).server.elicitInput({
              message: "I'll help you configure an Azure Blob data source connection.",
              requestedSchema
            });
            const a: any = (elicited as any)?.content ?? elicited ?? {};
            __name = __name || a.name;
            __storageAccount = __storageAccount || a.storageAccount;
            __containerName = __containerName || a.containerName;
            __description = (__description ?? a.description) || undefined;
            __highWater = (__highWater ?? a.highWaterMarkColumnName) || "metadata_storage_last_modified";
            __auth = __auth || a.auth || {};
          } catch {
            // Ignore elicitation errors and continue with provided params
          }
        }

        const connectionString =
          __auth?.connectionString ??
          (__auth?.accountKey
            ? `DefaultEndpointsProtocol=https;AccountName=${__storageAccount};AccountKey=${__auth.accountKey};EndpointSuffix=core.windows.net`
            : undefined);

        if (!__name || !__storageAccount || !__containerName || !connectionString) {
          const error = new Error(
            "Missing required parameters. Provide name, storageAccount, containerName, and either auth.connectionString or auth.accountKey."
          );
          const { insight } = normalizeError(error, {
            tool: "createOrUpdateBlobDataSource",
            name: __name,
            storageAccount: __storageAccount,
            containerName: __containerName
          });
          return await formatResponse(insight);
        }

        const dataSourceDefinition = {
          name: __name,
          type: "azureblob",
          description: __description,
          credentials: { connectionString },
          container: { name: __containerName, query: null },
          dataChangeDetectionPolicy: {
            "@odata.type": "#Microsoft.Azure.Search.HighWaterMarkChangeDetectionPolicy",
            highWaterMarkColumnName: __highWater || "metadata_storage_last_modified"
          },
          dataDeletionDetectionPolicy: null
        };

        const result = await client.createOrUpdateDataSource(__name, dataSourceDefinition);

        // Helpful add-on: return a convenience command to create the container if needed
        const createContainerCommand = `az storage container create --account-name ${__storageAccount} --name ${__containerName}`;

        return await formatResponse({
          success: true,
          message: `Data source '${__name}' created/updated.`,
          dataSource: result,
          nextSteps: [`If the container doesn't exist, create it locally:`, createContainerCommand]
        });
      } catch (e) {
        const { insight } = normalizeError(e, {
          tool: "createOrUpdateBlobDataSource",
          name,
          storageAccount,
          containerName
        });
        return await formatResponse(insight);
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
        // Elicit missing info when supported
        let __storageAccount = storageAccount;
        let __containerName = containerName;
        let __absoluteRepoPath = absoluteRepoPath;
        let __strategy = strategy;

        if ((!__storageAccount || !__containerName) && (server as any)?.server?.elicitInput) {
          try {
            const requestedSchema = buildSchemaForBlobSyncPlan();
            const elicited = await (server as any).server.elicitInput({
              message: "I'll help you generate a local sync plan to push this repo to Azure Blob Storage.",
              requestedSchema
            });
            const a: any = (elicited as any)?.content ?? elicited ?? {};
            __storageAccount = __storageAccount || a.storageAccount;
            __containerName = __containerName || a.containerName;
            __absoluteRepoPath = __absoluteRepoPath ?? a.absoluteRepoPath;
            __strategy = __strategy ?? a.strategy ?? "localAzCli";
          } catch {
            // continue with provided params
          }
        }

        if (!__storageAccount || !__containerName) {
          const error = new Error("Missing required parameters: storageAccount and containerName.");
          const { insight } = normalizeError(error, {
            tool: "generateBlobSyncPlan",
            storageAccount: __storageAccount,
            containerName: __containerName,
            strategy: __strategy
          });
          return await formatResponse(insight);
        }

        const repoPath = __absoluteRepoPath || ".";
        const createContainerCmd = `az storage container create --account-name ${__storageAccount} --name ${__containerName}`;
        const localScriptCmd = `AZURE_STORAGE_ACCOUNT=${__storageAccount} AZURE_CONTAINER_NAME=${__containerName} ./sync-to-blob-local.sh`;
        const uploadBatchCmd =
          `az storage blob upload-batch --account-name ${__storageAccount} -d ${__containerName} -s ${repoPath} ` +
          `--pattern "**/*" --no-progress`;

        const planLines = [
          "Prereqs: Azure CLI installed and logged in (az login). Ensure you have Storage Blob Data Contributor permission.",
          "",
          "# 1) Create container if missing",
          createContainerCmd,
          "",
          "# 2) Sync repository files",
          ...(__strategy === "localAzCli"
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
          `az storage blob list --account-name ${__storageAccount} -c ${__containerName} --output table | head -n 20`
        ];

        return await formatResponse({
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
        });
      } catch (e) {
        const { insight } = normalizeError(e, {
          tool: "generateBlobSyncPlan",
          storageAccount,
          containerName,
          strategy
        });
        return await formatResponse(insight);
      }
    }
  );
}