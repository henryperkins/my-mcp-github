// src/ServiceUtilsTools.ts
import { z } from "zod";
import { ResponseFormatter } from "./utils/response";
import type { ToolContext } from "./types";
import { DEFAULT_TIMEOUT_MS } from "./constants";

/**
 * Register service utility and monitoring tools.
 * Tools:
 *  - getServiceStats
 *  - getIndexStatsSummary
 *  - analyzeText
 */
export function registerServiceUtilsTools(server: any, context: ToolContext) {
  const { getClient } = context;
  const rf = new ResponseFormatter(() => {
    const s = context.getSummarizer?.();
    if (!s) return null;
    return (text: string, maxTokens?: number) => s(text, maxTokens ?? 800);
  });

  // ---------------- SERVICE UTILITIES ----------------
  
  server.tool(
    "getServiceStats",
    "Get service-level statistics including counters, quotas, and resource usage. Shows index count, document count, storage usage, and service limits.",
    {},
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async () => {
      const client = getClient();
      return rf.executeWithTimeout(
        client.getServiceStatistics().then((stats: any) => {
          // Format the stats for better readability
          if (stats?.counters) {
            const counters = stats.counters;
            const formatted: any = {
              service: stats.name || "unknown",
              type: stats.type || "unknown",
              summary: {
                indexes: `${counters.indexCounter?.count || 0} / ${counters.indexCounter?.quota || "unlimited"}`,
                documents: `${counters.documentCounter?.count || 0} / ${counters.documentCounter?.quota || "unlimited"}`,
                indexers: `${counters.indexerCounter?.count || 0} / ${counters.indexerCounter?.quota || "unlimited"}`,
                synonymMaps: `${counters.synonymMapCounter?.count || 0} / ${counters.synonymMapCounter?.quota || "unlimited"}`,
                skillsets: `${counters.skillsetCounter?.count || 0} / ${counters.skillsetCounter?.quota || "unlimited"}`,
                dataSources: `${counters.dataSourceCounter?.count || 0} / ${counters.dataSourceCounter?.quota || "unlimited"}`
              },
              storage: {
                used: counters.storageSize?.current || 0,
                limit: counters.storageSize?.limit || 0,
                usage: `${((counters.storageSize?.usage || 0) * 100).toFixed(1)}%`,
                vectorStorage: {
                  used: counters.vectorStorageSize?.current || 0,
                  limit: counters.vectorStorageSize?.limit || 0,
                  usage: `${((counters.vectorStorageSize?.usage || 0) * 100).toFixed(1)}%`
                }
              },
              rawCounters: counters
            };
            return formatted;
          }
          return stats;
        }),
        DEFAULT_TIMEOUT_MS,
        "getServiceStats",
        { tool: "getServiceStats" }
      );
    }
  );

  server.tool(
    "getIndexStatsSummary",
    "Get aggregate statistics for all indexes in the service. Returns document counts and storage sizes for each index in a single call.",
    {},
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async () => {
      const client = getClient();
      return rf.executeWithTimeout(
        client.getIndexStatsSummary().then((summary: any) => {
          // Format the summary for better readability
          if (summary?.value && Array.isArray(summary.value)) {
            const indexes = summary.value.map((idx: any) => ({
              name: idx.name,
              documentCount: idx.documentCount || 0,
              storageSize: idx.storageSize || 0,
              vectorIndexSize: idx.vectorIndexSize || 0,
              storageUtilization: idx.storageSize ? 
                `${(idx.storageSize / (1024 * 1024)).toFixed(2)} MB` : "0 MB",
              vectorUtilization: idx.vectorIndexSize ? 
                `${(idx.vectorIndexSize / (1024 * 1024)).toFixed(2)} MB` : "0 MB"
            }));
            
            const totalDocs = indexes.reduce((sum: number, idx: any) => sum + idx.documentCount, 0);
            const totalStorage = indexes.reduce((sum: number, idx: any) => sum + idx.storageSize, 0);
            const totalVectorStorage = indexes.reduce((sum: number, idx: any) => sum + idx.vectorIndexSize, 0);
            
            return {
              summary: {
                indexCount: indexes.length,
                totalDocuments: totalDocs,
                totalStorage: `${(totalStorage / (1024 * 1024)).toFixed(2)} MB`,
                totalVectorStorage: `${(totalVectorStorage / (1024 * 1024)).toFixed(2)} MB`
              },
              indexes,
              "@odata.context": summary["@odata.context"]
            };
          }
          return summary;
        }),
        DEFAULT_TIMEOUT_MS,
        "getIndexStatsSummary",
        { tool: "getIndexStatsSummary" }
      );
    }
  );

  const AnalyzeTextParams = {
    indexName: z.string().describe("Name of the index to test the analyzer against"),
    text: z.string().describe("Text to analyze"),
    analyzer: z.string().optional().describe("Analyzer name (e.g., 'standard.lucene', 'en.microsoft', 'whitespace')"),
    tokenizer: z.string().optional().describe("Tokenizer name (alternative to analyzer)"),
    tokenFilters: z.array(z.string()).optional().describe("Token filters to apply"),
    charFilters: z.array(z.string()).optional().describe("Character filters to apply")
  } as const;

  server.tool(
    "analyzeText",
    "Test how text is tokenized and processed by analyzers. Useful for debugging search behavior and understanding text processing. Either specify an analyzer or provide tokenizer with optional filters.",
    AnalyzeTextParams,
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async (params: any) => {
      const { indexName, text, analyzer, tokenizer, tokenFilters, charFilters } = params;
      const client = getClient();
      
      // Build the analyze request body
      const body: any = { text };
      
      if (analyzer) {
        body.analyzer = analyzer;
      } else if (tokenizer) {
        body.tokenizer = tokenizer;
        if (tokenFilters && tokenFilters.length > 0) {
          body.tokenFilters = tokenFilters;
        }
        if (charFilters && charFilters.length > 0) {
          body.charFilters = charFilters;
        }
      } else {
        // Default to standard.lucene if nothing specified
        body.analyzer = "standard.lucene";
      }
      
      return rf.executeWithTimeout(
        client.analyzeText(indexName, body).then((result: any) => {
          // Format the tokens for better readability
          if (result?.tokens && Array.isArray(result.tokens)) {
            const formatted = {
              originalText: text,
              analyzer: analyzer || `custom (tokenizer: ${tokenizer || "none"})`,
              tokenCount: result.tokens.length,
              tokens: result.tokens.map((t: any) => ({
                token: t.token,
                position: t.position,
                startOffset: t.startOffset,
                endOffset: t.endOffset,
                type: t.type || "word"
              })),
              tokenList: result.tokens.map((t: any) => t.token).join(", ")
            };
            return formatted;
          }
          return result;
        }),
        DEFAULT_TIMEOUT_MS,
        "analyzeText",
        { tool: "analyzeText", indexName, text: text.substring(0, 50) + "..." }
      );
    }
  );
}