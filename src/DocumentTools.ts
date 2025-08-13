// src/DocumentTools.ts
import { z } from "zod";
import { formatResponse, formatToolError, normalizeError } from "./utils/response";
import getToolHints from "./utils/toolHints";
import { ToolElicitationBuilder } from "./tool-elicitation";
import { elicitIfNeeded } from "./utils/elicitation-integration";
import type { ToolContext } from "./types";

/**
 * Register document search and CRUD tools.
 * Tools:
 *  - searchDocuments, getDocument, countDocuments
 *  - uploadDocuments, mergeDocuments, mergeOrUploadDocuments, deleteDocuments
 */
export function registerDocumentTools(server: any, context: ToolContext) {
  const { getClient, getSummarizer } = context;
  // ---------------- DOCUMENTS ----------------
  const SearchResultsSchema = z.object({
    value: z.array(z.any()),
    "@odata.count": z.number().optional(),
    "@search.nextPageParameters": z.any().optional(),
  }).strict();

  server.tool(
    "searchDocuments",
    "Search for documents using keywords, filters, and sorting. Supports OData filter syntax, pagination (max 50 results per request), field selection, and relevance scoring. Use '*' to retrieve all documents.",
    {
      indexName: z.string(),
      search: z.string().default("*"),
      top: z
        .number()
        .int()
        .positive()
        .max(50)
        .default(10)
        .describe("Max 50 to prevent large responses"),
      skip: z.number().int().nonnegative().default(0).describe("Skip N results for pagination"),
      select: z.array(z.string()).optional().describe("Fields to return (reduces response size)"),
      filter: z.string().optional(),
      orderBy: z.string().optional(),
      includeTotalCount: z.boolean().default(true)
    },
    async ({ indexName, search, top, skip, select, filter, orderBy, includeTotalCount }: any) => {
      try {
        const client = getClient();
        
        // Elicit search parameters if index not provided
        if (!indexName) {
          const elicited = await elicitIfNeeded(context.agent || server, ToolElicitationBuilder.searchDocumentsElicitation());
          if (elicited) {
            indexName = elicited.indexName || indexName;
            search = elicited.searchQuery || search || "*";
            top = elicited.top || top;
            includeTotalCount = elicited.includeTotalCount ?? includeTotalCount;
          }
        }
        const searchParams = {
          search,
          top,
          skip,
          ...(select && { select: select.join(",") }),
          ...(filter && { filter }),
          // Azure Search expects 'orderby' (no $) in POST body
          ...(orderBy && { orderby: orderBy }),
          ...(includeTotalCount && { count: true })
        };
        const result = await client.searchDocuments(indexName, searchParams);
        return await formatResponse(result, {
          summarizer: getSummarizer?.() || undefined,
          structuredContent: result
        });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "searchDocuments", indexName });
        return formatToolError(insight);
      }
    },
    { ...getToolHints("POST"), outputSchema: SearchResultsSchema }
  );

  server.tool(
    "getDocument",
    "Lookup a document by its primary key.",
    { indexName: z.string(), key: z.string(), select: z.array(z.string()).optional() },
    async ({ indexName, key, select }: any) => {
      try {
        const client = getClient();
        const doc = await client.getDocument(indexName, key, select);
        return await formatResponse(doc, {
          summarizer: getSummarizer?.() || undefined,
          structuredContent: doc
        });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "getDocument", indexName, key });
        return formatToolError(insight);
      }
    },
    getToolHints("GET")
  );

  server.tool(
    "countDocuments",
    "Return document count.",
    { indexName: z.string() },
    async ({ indexName }: any) => {
      try {
        const client = getClient();
        const count = await client.getDocumentCount(indexName);
        const structuredData = { count };
        return await formatResponse(structuredData, {
          summarizer: getSummarizer?.() || undefined,
          structuredContent: structuredData
        });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "countDocuments", indexName });
        return formatToolError(insight);
      }
    },
    { ...getToolHints("GET"), outputSchema: z.object({ count: z.number() }) }
  );

  // ---------------- DOCUMENT OPERATIONS ----------------
  server.tool(
    "uploadDocuments",
    "Upload new documents to an index. Documents must match the index schema. Maximum 1000 documents per batch. For existing documents, use mergeDocuments instead.",
    {
      indexName: z.string(),
      documents: z.array(z.any()).describe("Array of documents to upload")
    },
    async ({ indexName, documents }: any) => {
      try {
        const client = getClient();
        
        // Elicit upload parameters if missing
        if (!indexName || !documents || documents.length === 0) {
          const elicited = await elicitIfNeeded(context.agent || server, ToolElicitationBuilder.uploadDocumentsElicitation());
          if (elicited) {
            indexName = elicited.indexName || indexName;
            // Note: documents would need to be provided separately
            // This elicitation just helps with configuration
          }
        }
        const result = await client.uploadDocuments(indexName, documents);
        return await formatResponse(result, {
          summarizer: getSummarizer?.() || undefined,
          structuredContent: result
        });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "uploadDocuments", indexName });
        return formatToolError(insight);
      }
    },
    getToolHints("POST")
  );

  server.tool(
    "mergeDocuments",
    "Merge documents in an index (updates existing documents).",
    {
      indexName: z.string(),
      documents: z.array(z.any()).describe("Array of documents to merge")
    },
    async ({ indexName, documents }: any) => {
      try {
        const client = getClient();
        const result = await client.mergeDocuments(indexName, documents);
        return await formatResponse(result, {
          summarizer: getSummarizer?.() || undefined,
          structuredContent: result
        });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "mergeDocuments", indexName });
        return formatToolError(insight);
      }
    },
    getToolHints("POST")
  );

  server.tool(
    "mergeOrUploadDocuments",
    "Merge or upload documents (updates existing or creates new).",
    {
      indexName: z.string(),
      documents: z.array(z.any()).describe("Array of documents to merge or upload")
    },
    async ({ indexName, documents }: any) => {
      try {
        const client = getClient();
        const result = await client.mergeOrUploadDocuments(indexName, documents);
        return await formatResponse(result, {
          summarizer: getSummarizer?.() || undefined,
          structuredContent: result
        });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "mergeOrUploadDocuments", indexName });
        return formatToolError(insight);
      }
    },
    getToolHints("POST")
  );

  server.tool(
    "deleteDocuments",
    "⚠️ Delete specific documents from an index by their key values. This is permanent and cannot be undone. Provide an array of document keys to delete.",
    {
      indexName: z.string(),
      keys: z.array(z.any()).describe("Array of document keys to delete")
    },
    async ({ indexName, keys }: any) => {
      try {
        const client = getClient();
        const result = await client.deleteDocuments(indexName, keys);
        return await formatResponse(result, {
          summarizer: getSummarizer?.() || undefined,
          structuredContent: result
        });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "deleteDocuments", indexName });
        return formatToolError(insight);
      }
    },
    getToolHints("DELETE")
  );
}
