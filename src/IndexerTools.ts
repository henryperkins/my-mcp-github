// src/IndexerTools.ts
import { z } from "zod";
import { ResponseFormatter } from "./utils/response-helper";
import getToolHints from "./utils/toolHints";
import type { ToolContext } from "./types";
import { DEFAULT_TIMEOUT_MS } from "./constants";

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
        default: "PT2H",
      },
      runNow: { type: "boolean", title: "Run immediately", default: false },
      parsingMode: {
        type: "string",
        title: "Parsing mode",
        enum: ["default", "jsonArray", "delimitedText", "lineSeparated"],
        default: "default",
      },
      indexedFileNameExtensions: {
        type: "string",
        title: "Indexed file extensions",
        default: ".md,.ts,.js,.json,.yml,.yaml,.txt",
      },
      excludedFileNameExtensions: {
        type: "string",
        title: "Excluded file extensions",
        default: ".png,.jpg,.gif,.svg,.ico",
      },
      dataToExtract: {
        type: "string",
        title: "Data to extract",
        enum: ["contentOnly", "contentAndMetadata", "storageMetadata"],
        default: "contentAndMetadata",
      },
      indexStorageMetadataOnlyForOversizedDocuments: {
        type: "boolean",
        title: "Index only metadata for oversized docs",
        default: true,
      },
    },
    required: ["name", "dataSourceName", "targetIndexName"],
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
export function registerIndexerTools(server: any, context: ToolContext) {
  const { getClient } = context;
  const rf = new ResponseFormatter(() => {
    const s = context.getSummarizer?.();
    if (!s) return null;
    return (text: string, maxTokens?: number) => s(text, maxTokens ?? 800);
  });
  // ---------------- INDEXERS ----------------
  server.tool("listIndexers", "List indexer names.", {}, async () => {
    const client = getClient();
    return rf.executeWithTimeout(
      client.listIndexers().then((indexers: unknown[]) => {
        const names = (indexers as Array<{ name?: string }>).map(ix => ix.name || "").filter(Boolean);
        return { indexers: names, count: names.length };
      }),
      DEFAULT_TIMEOUT_MS,
      "listIndexers",
      { tool: "listIndexers" },
    );
  });

  server.tool("getIndexer", "Get an indexer.", { name: z.string() }, async ({ name }: { name: string }) => {
    const client = getClient();
    return rf.executeWithTimeout(client.getIndexer(name), DEFAULT_TIMEOUT_MS, "getIndexer", { tool: "getIndexer", name });
  });

  server.tool("runIndexer", "Run an indexer now.", { name: z.string() }, async ({ name }: { name: string }) => {
    try {
      const client = getClient();
      await rf.executeWithTimeout(client.runIndexer(name), DEFAULT_TIMEOUT_MS, "runIndexer", { tool: "runIndexer", name });
      return rf.formatSuccess({ success: true, message: `Indexer ${name} started` });
    } catch (e) {
      return rf.formatError(e, { tool: "runIndexer", name });
    }
  });

  server.tool("resetIndexer", "Reset change tracking for an indexer (full re-crawl).", { name: z.string() }, async ({ name }: { name: string }) => {
    try {
      const client = getClient();
      await rf.executeWithTimeout(client.resetIndexer(name), DEFAULT_TIMEOUT_MS, "resetIndexer", { tool: "resetIndexer", name });
      return rf.formatSuccess({ success: true, message: `Indexer ${name} reset` });
    } catch (e) {
      return rf.formatError(e, { tool: "resetIndexer", name });
    }
  });

  server.tool(
    "getIndexerStatus",
    "Get execution history/status for an indexer.",
    {
      name: z.string(),
      historyLimit: z.number().int().positive().max(50).default(5).describe("Limit execution history entries"),
    },
    async ({ name, historyLimit }: { name: string; historyLimit: number }) => {
      const client = getClient();
      return rf.executeWithTimeout(
        client.getIndexerStatus(name).then((status: any) => {
          if (status.executionHistory && Array.isArray(status.executionHistory)) {
            status.executionHistory = status.executionHistory.slice(0, historyLimit);
            if (status.executionHistory.length < historyLimit) {
              status.historyComplete = true;
            } else {
              status.historyTruncated = true;
              status.message = `Showing first ${historyLimit} execution history entries. Increase historyLimit to see more.`;
            }
          }
          return status;
        }),
        DEFAULT_TIMEOUT_MS,
        "getIndexerStatus",
        { tool: "getIndexerStatus", name, historyLimit },
      );
    },
  );

  // NEW: Create or update a Blob indexer pointing to the given data source and index
  const CreateOrUpdateBlobIndexerSchema = z.object({
    name: z.string().optional().describe("Indexer name"),
    dataSourceName: z.string().optional().describe("Existing data source connection name (e.g. from createOrUpdateBlobDataSource)"),
    targetIndexName: z.string().optional().describe("Target search index name"),
    scheduleInterval: z.string().optional().default("PT2H").describe("ISO-8601 duration (e.g., PT2H)"),
    runNow: z.boolean().optional().default(false),
    parsingMode: z.enum(["default", "jsonArray", "delimitedText", "lineSeparated"]).optional().default("default"),
    indexedFileNameExtensions: z.string().optional().default(".md,.ts,.js,.json,.yml,.yaml,.txt"),
    excludedFileNameExtensions: z.string().optional().default(".png,.jpg,.gif,.svg,.ico"),
    dataToExtract: z.enum(["contentOnly", "contentAndMetadata", "storageMetadata"]).optional().default("contentAndMetadata"),
    indexStorageMetadataOnlyForOversizedDocuments: z.boolean().optional().default(true),
    // Fix #6: Allow custom field mappings instead of hard-coding
    fieldMappings: z.array(z.object({
      sourceFieldName: z.string(),
      targetFieldName: z.string(),
      mappingFunction: z.object({ name: z.string() }).nullable().optional(),
    })).optional().describe("Custom field mappings from source to index fields"),
  });

  server.tool(
    "createOrUpdateBlobIndexer",
    "Create or update an indexer for Azure Blob data source to a target index. Optionally run immediately.",
    CreateOrUpdateBlobIndexerSchema,
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
      indexStorageMetadataOnlyForOversizedDocuments,
      fieldMappings,
    }: z.infer<typeof CreateOrUpdateBlobIndexerSchema>) => {
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
              requestedSchema,
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
          return rf.formatError(error, {
            tool: "createOrUpdateBlobIndexer",
            name: __name,
            dataSourceName: __dataSourceName,
            targetIndexName: __targetIndexName,
          });
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
              indexStorageMetadataOnlyForOversizedDocuments: __indexStorageMetadataOnlyForOversizedDocuments,
            },
            batchSize: 10,
            maxFailedItems: 10,
            maxFailedItemsPerBatch: 5,
          },
          // Fix #6: Use custom field mappings if provided, otherwise minimal default
          fieldMappings: fieldMappings || [
            // Minimal default mapping - only map content which most indexes have
            {
              sourceFieldName: "content",
              targetFieldName: "content",
              mappingFunction: null,
            },
          ],
          outputFieldMappings: [],
          description: `Indexer for '${__dataSourceName}' to '${__targetIndexName}'`,
        };

        return rf.executeWithTimeout(
          (async () => {
            const created = await client.createOrUpdateIndexer(__name, indexerDefinition);
            if (__runNow) {
              try {
                await client.runIndexer(__name);
              } catch (runErr) {
                return {
                  success: false,
                  message: `Indexer created/updated, but run failed: ${String(runErr)}`,
                  indexer: created,
                };
              }
            }
            return {
              success: true,
              message: `Indexer '${__name}' created/updated${__runNow ? " and started" : ""}.`,
              indexer: created,
            };
          })(),
          DEFAULT_TIMEOUT_MS,
          "createOrUpdateBlobIndexer",
          { tool: "createOrUpdateBlobIndexer", name: __name, dataSourceName: __dataSourceName, targetIndexName: __targetIndexName },
        );
      } catch (e) {
        return rf.formatError(e, {
          tool: "createOrUpdateBlobIndexer",
          name,
          dataSourceName,
          targetIndexName,
        });
      }
    },
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
    async ({ indexerName, clientRequestId, pollSeconds, maxAttempts }: { indexerName: string; clientRequestId?: string; pollSeconds?: number; maxAttempts?: number }) => {
      try {
        const c = getClient();
        await c.runIndexer(indexerName);

        let done = false,
          attempts = 0;
        const max = maxAttempts ?? 60;
        const progressUpdates: any[] = [];
        
        while (!done && attempts++ < max) {
          await new Promise((r) => setTimeout(r, (pollSeconds ?? 5) * 1000));
          const s: any = await c.getIndexerStatus(indexerName);
          const lr = s?.lastResult;
          const status = lr?.status ?? "unknown";
          const itemsProcessed = lr?.itemsProcessed ?? lr?.itemCount ?? 0;
          const itemsFailed = lr?.itemsFailed ?? lr?.failedItemCount ?? 0;
          const denom = Math.max(1, itemsProcessed + itemsFailed);
          
          // Fix #11: Compute and emit percentage progress
          const pct =
            status === "success"
              ? 1
              : status === "inProgress"
                ? Math.min(0.9, itemsProcessed / denom)
                : status === "transientFailure"
                  ? 0
                  : 0.1;
          
          progressUpdates.push({
            attempt: attempts,
            status,
            percentage: Math.round(pct * 100),
            itemsProcessed,
            itemsFailed,
          });
          
          done = status === "success" || status === "transientFailure";
        }
        
        const finalStatus: any = await c.getIndexerStatus(indexerName);
        return rf.formatSuccess({
          indexerName,
          status: finalStatus?.lastResult?.status ?? "unknown",
          documentsProcessed: finalStatus?.lastResult?.itemsProcessed ?? finalStatus?.lastResult?.itemCount ?? 0,
          clientRequestId,
          progressHistory: progressUpdates,
        });
      } catch (e) {
        return rf.formatError(e, { tool: "runIndexerWithProgress", indexerName });
      }
    },
    getToolHints("POST"),
  );
}
