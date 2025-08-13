// src/IndexerTools.ts
import { z } from "zod";
import { formatResponse, normalizeError } from "./utils/response";
import getToolHints from "./utils/toolHints";

type GetClient = () => any;

// Elicitation schema for Blob indexer creation/update
function buildSchemaForBlobIndexer() {
  return {
    type: "object",
    properties: {
      name: { type: "string", title: "Indexer name" },
      dataSourceName: { type: "string", title: "Data source name" },
      targetIndexName: { type: "string", title: "Target index name" },
      scheduleInterval: {
        type: "string",
        title: "Schedule interval",
        description: "ISO-8601 duration (e.g., PT2H)",
        default: "PT2H"
      },
      runNow: { type: "boolean", title: "Run immediately", default: false },
      parsingMode: {
        type: "string",
        title: "Parsing mode",
        enum: ["default", "jsonArray", "delimitedText", "lineSeparated"],
        default: "default"
      },
      indexedFileNameExtensions: {
        type: "string",
        title: "Indexed file extensions",
        default: ".md,.ts,.js,.json,.yml,.yaml,.txt"
      },
      excludedFileNameExtensions: {
        type: "string",
        title: "Excluded file extensions",
        default: ".png,.jpg,.gif,.svg,.ico"
      },
      dataToExtract: {
        type: "string",
        title: "Data to extract",
        enum: ["contentOnly", "contentAndMetadata", "storageMetadata"],
        default: "contentAndMetadata"
      },
      indexStorageMetadataOnlyForOversizedDocuments: {
        type: "boolean",
        title: "Index only metadata for oversized docs",
        default: true
      }
    },
    required: ["name", "dataSourceName", "targetIndexName"]
  };
}

/**
 * Register indexer management tools.
 * Tools:
 *  - listIndexers, getIndexer
 *  - runIndexer, resetIndexer
 *  - getIndexerStatus
 *  - createOrUpdateBlobIndexer
 */
export function registerIndexerTools(server: any, getClient: GetClient) {
  // ---------------- INDEXERS ----------------
  server.tool(
    "listIndexers",
    "List indexer names.",
    {},
    async () => {
      try {
        const client = getClient();
        const indexers = await client.listIndexers();
        const names = indexers.map((ix: any) => ix.name);
        return await formatResponse({ indexers: names, count: names.length });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "listIndexers" });
        return await formatResponse(insight);
      }
    }
  );

  server.tool(
    "getIndexer",
    "Get an indexer.",
    { name: z.string() },
    async ({ name }: any) => {
      try {
        const client = getClient();
        const ix = await client.getIndexer(name);
        return await formatResponse(ix);
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "getIndexer", name });
        return await formatResponse(insight);
      }
    }
  );

  server.tool(
    "runIndexer",
    "Run an indexer now.",
    { name: z.string() },
    async ({ name }: any) => {
      try {
        const client = getClient();
        await client.runIndexer(name);
        return await formatResponse({ success: true, message: `Indexer ${name} started` });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "runIndexer", name });
        return await formatResponse(insight);
      }
    }
  );

  server.tool(
    "resetIndexer",
    "Reset change tracking for an indexer (full re-crawl).",
    { name: z.string() },
    async ({ name }: any) => {
      try {
        const client = getClient();
        await client.resetIndexer(name);
        return await formatResponse({ success: true, message: `Indexer ${name} reset` });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "resetIndexer", name });
        return await formatResponse(insight);
      }
    }
  );

  server.tool(
    "getIndexerStatus",
    "Get execution history/status for an indexer.",
    {
      name: z.string(),
      historyLimit: z
        .number()
        .int()
        .positive()
        .max(50)
        .default(5)
        .describe("Limit execution history entries")
    },
    async ({ name, historyLimit }: any) => {
      try {
        const client = getClient();
        const status: any = await client.getIndexerStatus(name);

        // Limit execution history to prevent large responses
        if (status.executionHistory && Array.isArray(status.executionHistory)) {
          status.executionHistory = status.executionHistory.slice(0, historyLimit);
          if (status.executionHistory.length < historyLimit) {
            status.historyComplete = true;
          } else {
            status.historyTruncated = true;
            status.message = `Showing first ${historyLimit} execution history entries. Increase historyLimit to see more.`;
          }
        }

        return await formatResponse(status);
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "getIndexerStatus", name, historyLimit });
        return await formatResponse(insight);
      }
    }
  );

  // NEW: Create or update a Blob indexer pointing to the given data source and index
  server.tool(
    "createOrUpdateBlobIndexer",
    "Create or update an indexer for Azure Blob data source to a target index. Optionally run immediately.",
    {
      name: z.string().describe("Indexer name"),
      dataSourceName: z
        .string()
        .describe("Existing data source connection name (e.g. from createOrUpdateBlobDataSource)"),
      targetIndexName: z.string().describe("Target search index name"),
      scheduleInterval: z
        .string()
        .optional()
        .default("PT2H")
        .describe("ISO-8601 duration (e.g., PT2H)"),
      runNow: z.boolean().optional().default(false),
      // Basic knobs for file parsing; defaults mirror your shell script
      parsingMode: z
        .enum(["default", "jsonArray", "delimitedText", "lineSeparated"])
        .optional()
        .default("default"),
      indexedFileNameExtensions: z
        .string()
        .optional()
        .default(".md,.ts,.js,.json,.yml,.yaml,.txt"),
      excludedFileNameExtensions: z.string().optional().default(".png,.jpg,.gif,.svg,.ico"),
      dataToExtract: z
        .enum(["contentOnly", "contentAndMetadata", "storageMetadata"])
        .optional()
        .default("contentAndMetadata"),
      indexStorageMetadataOnlyForOversizedDocuments: z.boolean().optional().default(true)
    },
    async ({
      name,
      dataSourceName,
      targetIndexName,
      scheduleInterval,
      runNow,
      parsingMode,
      indexedFileNameExtensions,
      excludedFileNameExtensions,
      dataToExtract,
      indexStorageMetadataOnlyForOversizedDocuments
    }: any) => {
      try {
        const client = getClient();

        // Local mutable copies for elicitation
        let __name = name;
        let __dataSourceName = dataSourceName;
        let __targetIndexName = targetIndexName;
        let __scheduleInterval = scheduleInterval;
        let __runNow = runNow;
        let __parsingMode = parsingMode;
        let __indexedFileNameExtensions = indexedFileNameExtensions;
        let __excludedFileNameExtensions = excludedFileNameExtensions;
        let __dataToExtract = dataToExtract;
        let __indexStorageMetadataOnlyForOversizedDocuments = indexStorageMetadataOnlyForOversizedDocuments;

        if ((!__name || !__dataSourceName || !__targetIndexName) && (server as any)?.server?.elicitInput) {
          try {
            const requestedSchema = buildSchemaForBlobIndexer();
            const elicited = await (server as any).server.elicitInput({
              message: "Let's set up a Blob indexer. I can collect the required details.",
              requestedSchema
            });
            const a: any = (elicited as any)?.content ?? elicited ?? {};
            __name = __name || a.name;
            __dataSourceName = __dataSourceName || a.dataSourceName;
            __targetIndexName = __targetIndexName || a.targetIndexName;
            __scheduleInterval = __scheduleInterval ?? a.scheduleInterval ?? "PT2H";
            __runNow = __runNow ?? a.runNow ?? false;
            __parsingMode = __parsingMode ?? a.parsingMode ?? "default";
            __indexedFileNameExtensions = __indexedFileNameExtensions ?? a.indexedFileNameExtensions ?? ".md,.ts,.js,.json,.yml,.yaml,.txt";
            __excludedFileNameExtensions = __excludedFileNameExtensions ?? a.excludedFileNameExtensions ?? ".png,.jpg,.gif,.svg,.ico";
            __dataToExtract = __dataToExtract ?? a.dataToExtract ?? "contentAndMetadata";
            __indexStorageMetadataOnlyForOversizedDocuments =
              __indexStorageMetadataOnlyForOversizedDocuments ?? a.indexStorageMetadataOnlyForOversizedDocuments ?? true;
          } catch {
            // continue with provided params
          }
        }

        if (!__name || !__dataSourceName || !__targetIndexName) {
          const error = new Error("Missing required parameters: name, dataSourceName, targetIndexName.");
          const { insight } = normalizeError(error, {
            tool: "createOrUpdateBlobIndexer",
            name: __name,
            dataSourceName: __dataSourceName,
            targetIndexName: __targetIndexName
          });
          return await formatResponse(insight);
        }

        const indexerDefinition = {
          name: __name,
          dataSourceName: __dataSourceName,
          targetIndexName: __targetIndexName,
          schedule: __scheduleInterval ? { interval: __scheduleInterval } : undefined,
          parameters: {
            configuration: {
              parsingMode: __parsingMode,
              indexedFileNameExtensions: __indexedFileNameExtensions,
              excludedFileNameExtensions: __excludedFileNameExtensions,
              dataToExtract: __dataToExtract,
              indexStorageMetadataOnlyForOversizedDocuments: __indexStorageMetadataOnlyForOversizedDocuments
            },
            batchSize: 10,
            maxFailedItems: 10,
            maxFailedItemsPerBatch: 5
          },
          // These mappings assume a typical index: title, content, source, lastModified
          fieldMappings: [
            {
              sourceFieldName: "metadata_storage_name",
              targetFieldName: "title",
              mappingFunction: null
            },
            { sourceFieldName: "content", targetFieldName: "content", mappingFunction: null },
            {
              sourceFieldName: "metadata_storage_path",
              targetFieldName: "source",
              mappingFunction: null
            },
            {
              sourceFieldName: "metadata_storage_last_modified",
              targetFieldName: "lastModified",
              mappingFunction: null
            }
          ],
          outputFieldMappings: [],
          description: `Indexer for '${__dataSourceName}' to '${__targetIndexName}'`
        };

        const created = await client.createOrUpdateIndexer(__name, indexerDefinition);
        if (__runNow) {
          try {
            await client.runIndexer(__name);
          } catch (runErr) {
            // Return indexer details even if run fails
            return await formatResponse({
              success: false,
              message: `Indexer created/updated, but run failed: ${String(runErr)}`,
              indexer: created
            });
          }
        }

        return await formatResponse({
          success: true,
          message: `Indexer '${__name}' created/updated${__runNow ? " and started" : ""}.`,
          indexer: created
        });
      } catch (e) {
        const { insight } = normalizeError(e, {
          tool: "createOrUpdateBlobIndexer",
          name,
          dataSourceName,
          targetIndexName
        });
        return await formatResponse(insight);
      }
    }
  );

  // Progress-emitting run
  server.tool(
    "runIndexerWithProgress",
    "Run an indexer and emit progress notifications until done.",
    {
      indexerName: z.string(),
      clientRequestId: z.string().uuid().optional(),
      pollSeconds: z.number().int().positive().max(30).default(5),
      maxAttempts: z.number().int().positive().max(600).default(60),
    },
    async ({ indexerName, clientRequestId, pollSeconds, maxAttempts }: any) => {
      try {
        const c = getClient();
        const headers = clientRequestId
          ? { "x-ms-client-request-id": clientRequestId }
          : {};
        await c.runIndexer(indexerName, { headers });
        // await server.notification("progress", {
        //   operation: `indexer:${indexerName}`,
        //   progress: 0.1,
        //   message: "started",
        // });

        let done = false, attempts = 0;
        while (!done && attempts++ < maxAttempts) {
          await new Promise(r => setTimeout(r, (pollSeconds ?? 5) * 1000));
          const s = await c.getIndexerStatus(indexerName);
          const lr = s?.lastResult;
          const status = lr?.status ?? "unknown";
          const itemsProcessed = lr?.itemsProcessed ?? lr?.itemCount ?? 0;
          const itemsFailed = lr?.itemsFailed ?? lr?.failedItemCount ?? 0;
          const denom = Math.max(1, itemsProcessed + itemsFailed);
          const pct =
            status === "success" ? 1 :
            status === "inProgress" ? Math.min(0.9, itemsProcessed / denom) :
            status === "transientFailure" ? 0 :
            0.1;
          // await server.notification("progress", {
          //   operation: `indexer:${indexerName}`,
          //   progress: pct,
          //   message: status,
          // });
          done = status === "success" || status === "transientFailure";
        }
        const finalStatus = await c.getIndexerStatus(indexerName);
        return await formatResponse({
          indexerName,
          status: finalStatus?.lastResult?.status ?? "unknown",
          documentsProcessed: finalStatus?.lastResult?.itemsProcessed ?? finalStatus?.lastResult?.itemCount ?? 0,
          clientRequestId,
        });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "runIndexerWithProgress", indexerName });
        return await formatResponse(insight);
      }
    },
    getToolHints("POST")
  );
}