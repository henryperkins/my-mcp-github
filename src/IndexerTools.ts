// src/IndexerTools.ts
import { z } from "zod";
import { ResponseFormatter } from "./utils/response";
import getToolHints from "./utils/toolHints";
import type { ToolContext } from "./types";
import { DEFAULT_TIMEOUT_MS } from "./constants";
import type { ElicitationRequest } from "./tool-elicitation";
import { elicitIfNeeded, needsElicitation } from "./utils/elicitation-integration";

// Elicitation schema for Blob indexer creation/update
function createBlobIndexerElicitation(): ElicitationRequest {
  return {
    message: "Let's set up a Blob indexer. I can collect the required details.",
    requestedSchema: {
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
    },
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
  server.tool("listIndexers", "List indexer names.", {}, getToolHints("GET" as const), async () => {
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

  server.tool("getIndexer", "Get an indexer.", { name: z.string() }, getToolHints("GET" as const), async ({ name }: { name: string }) => {
    const client = getClient();
    return rf.executeWithTimeout(client.getIndexer(name), DEFAULT_TIMEOUT_MS, "getIndexer", { tool: "getIndexer", name });
  });

  server.tool("runIndexer", "Run an indexer now.", { name: z.string() }, getToolHints("POST" as const), async ({ name }: { name: string }) => {
    try {
      const client = getClient();
      await rf.executeWithTimeout(client.runIndexer(name), DEFAULT_TIMEOUT_MS, "runIndexer", { tool: "runIndexer", name });
      return rf.formatSuccess({ success: true, message: `Indexer ${name} started` });
    } catch (e) {
      return rf.formatError(e, { tool: "runIndexer", name });
    }
  });

  server.tool("resetIndexer", "Reset change tracking for an indexer (full re-crawl).", { name: z.string() }, getToolHints("POST" as const), async ({ name }: { name: string }) => {
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
    getToolHints("GET" as const),
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
  const CreateOrUpdateBlobIndexerParams = {
    name: z.string().optional().describe("Indexer name"),
    dataSourceName: z
      .string()
      .optional()
      .describe("Existing data source connection name (e.g. from createOrUpdateBlobDataSource)"),
    targetIndexName: z.string().optional().describe("Target search index name"),
    scheduleInterval: z.string().optional().default("PT2H").describe("ISO-8601 duration (e.g., PT2H)"),
    runNow: z.boolean().optional().default(false),
    parsingMode: z.enum(["default", "jsonArray", "delimitedText", "lineSeparated"]).optional().default("default"),
    indexedFileNameExtensions: z.string().optional().default(".md,.ts,.js,.json,.yml,.yaml,.txt"),
    excludedFileNameExtensions: z.string().optional().default(".png,.jpg,.gif,.svg,.ico"),
    dataToExtract: z.enum(["contentOnly", "contentAndMetadata", "storageMetadata"]).optional().default("contentAndMetadata"),
    indexStorageMetadataOnlyForOversizedDocuments: z.boolean().optional().default(true),
    // Fix #6: Allow custom field mappings instead of hard-coding
    fieldMappings: z
      .array(
        z.object({
          sourceFieldName: z.string(),
          targetFieldName: z.string(),
          mappingFunction: z.object({ name: z.string() }).nullable().optional(),
        }),
      )
      .optional()
      .describe("Custom field mappings from source to index fields"),
  } as const;

  server.tool(
    "createOrUpdateBlobIndexer",
    "Create or update an indexer for Azure Blob data source to a target index. Optionally run immediately.",
    CreateOrUpdateBlobIndexerParams,
    getToolHints("POST" as const),
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

        if (needsElicitation({ name: __name, dataSourceName: __dataSourceName, targetIndexName: __targetIndexName }, ["name", "dataSourceName", "targetIndexName"])) {
          try {
            const elicited = await elicitIfNeeded(context.agent || server, createBlobIndexerElicitation());
            if (elicited) {
              __name = __name || elicited.name;
              __dataSourceName = __dataSourceName || elicited.dataSourceName;
              __targetIndexName = __targetIndexName || elicited.targetIndexName;
              __scheduleInterval = __scheduleInterval ?? elicited.scheduleInterval ?? "PT2H";
              __runNow = __runNow ?? elicited.runNow ?? false;
              __parsingMode = __parsingMode ?? elicited.parsingMode ?? "default";
              __indexedFileNameExtensions =
                __indexedFileNameExtensions ?? elicited.indexedFileNameExtensions ?? ".md,.ts,.js,.json,.yml,.yaml,.txt";
              __excludedFileNameExtensions =
                __excludedFileNameExtensions ?? elicited.excludedFileNameExtensions ?? ".png,.jpg,.gif,.svg,.ico";
              __dataToExtract = __dataToExtract ?? elicited.dataToExtract ?? "contentAndMetadata";
              __indexStorageMetadataOnlyForOversizedDocuments =
                __indexStorageMetadataOnlyForOversizedDocuments ?? elicited.indexStorageMetadataOnlyForOversizedDocuments ?? true;
            }
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

        const indexerDefinition: any = {
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
          description: `Indexer for '${__dataSourceName}' to '${__targetIndexName}'`,
        };

        // Fix #6: Use custom field mappings if provided, otherwise minimal default
        // Clean up mappings to remove null values
        if (fieldMappings && fieldMappings.length > 0) {
          indexerDefinition.fieldMappings = fieldMappings.map((fm: any) => {
            const cleaned: any = {
              sourceFieldName: fm.sourceFieldName,
              targetFieldName: fm.targetFieldName,
            };
            // Only include mappingFunction if it's not null
            if (fm.mappingFunction) {
              cleaned.mappingFunction = fm.mappingFunction;
            }
            return cleaned;
          });
        } else {
          // Minimal default mapping - only map content which most indexes have
          indexerDefinition.fieldMappings = [
            {
              sourceFieldName: "content",
              targetFieldName: "content",
            },
          ];
        }
        
        // Don't include outputFieldMappings unless we have some
        // Azure Search REST API rejects empty arrays

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
          const status = lr?.status ?? s?.status ?? "unknown";

          // Work counters
          const itemsProcessed = Number(lr?.itemsProcessed ?? lr?.itemCount ?? 0);
          const itemsFailed = Number(lr?.itemsFailed ?? lr?.failedItemCount ?? 0);
          const processedSoFar = itemsProcessed + itemsFailed;

          // Heuristic total: use last successful run's item count if available
          const history = Array.isArray(s?.executionHistory) ? s.executionHistory : [];
          const historyTotals = history
            .filter((e: any) => e?.status === "success")
            .map((e: any) => Number(e?.itemsProcessed ?? e?.itemCount ?? 0))
            .filter((n: number) => Number.isFinite(n) && n > 0);

          const baselineTotal = historyTotals.length > 0 ? Math.max(...historyTotals) : 0;

          // Compute progress with clear basis and without misleading caps
          let basis: "final" | "estimatedTotalFromHistory" | "timeBased" | "unknown" = "unknown";
          let indeterminate = false;
          let percentageNum: number | null = null;
          let totalEstimated: number | null = null;
          let remainingEstimated: number | null = null;

          if (status === "success") {
            basis = "final";
            indeterminate = false;
            percentageNum = 100;
            totalEstimated = Math.max(baselineTotal, processedSoFar);
            remainingEstimated = 0;
          } else if (baselineTotal > 0) {
            basis = "estimatedTotalFromHistory";
            totalEstimated = baselineTotal;
            const fraction = processedSoFar / baselineTotal;
            const pct = Math.max(0.01, Math.min(0.99, Number.isFinite(fraction) ? fraction : 0));
            percentageNum = Math.round(pct * 100);
            remainingEstimated = Math.max(0, baselineTotal - processedSoFar);
          } else {
            // No reliable total is known; provide a conservative, time-based estimate
            basis = "timeBased";
            indeterminate = true;
            const pct = Math.min(95, Math.max(5, Math.round((attempts / max) * 90)));
            percentageNum = pct;
          }

          progressUpdates.push({
            attempt: attempts,
            status,
            percentage: percentageNum,
            indeterminate,
            basis,
            itemsProcessed,
            itemsFailed,
            processedSoFar,
            totalEstimated,
            remainingEstimated,
            timestamp: new Date().toISOString(),
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
