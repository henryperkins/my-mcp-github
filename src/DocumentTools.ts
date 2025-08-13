// src/DocumentTools.ts
import { z } from "zod";
import { formatResponse, normalizeError } from "./utils/response";

type GetClient = () => any;

/**
 * Register document search and CRUD tools.
 * Tools:
 *  - searchDocuments, getDocument, countDocuments
 *  - uploadDocuments, mergeDocuments, mergeOrUploadDocuments, deleteDocuments
 */
export function registerDocumentTools(server: any, getClient: GetClient) {
  // ---------------- DOCUMENTS ----------------
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
        const searchParams = {
          search,
          top,
          skip,
          ...(select && { select: select.join(",") }),
          ...(filter && { filter }),
          ...(orderBy && { orderBy }),
          ...(includeTotalCount && { count: true })
        };
        const results = await client.searchDocuments(indexName, searchParams);
        return await formatResponse(results);
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "searchDocuments", indexName });
        return await formatResponse(insight);
      }
    }
  );

  server.tool(
    "getDocument",
    "Lookup a document by its primary key.",
    { indexName: z.string(), key: z.string(), select: z.array(z.string()).optional() },
    async ({ indexName, key, select }: any) => {
      try {
        const client = getClient();
        const doc = await client.getDocument(indexName, key, select);
        return await formatResponse(doc);
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "getDocument", indexName, key });
        return await formatResponse(insight);
      }
    }
  );

  server.tool(
    "countDocuments",
    "Return document count.",
    { indexName: z.string() },
    async ({ indexName }: any) => {
      try {
        const client = getClient();
        const count = await client.getDocumentCount(indexName);
        return await formatResponse({ count });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "countDocuments", indexName });
        return await formatResponse(insight);
      }
    }
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
        const result = await client.uploadDocuments(indexName, documents);
        return await formatResponse(result);
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "uploadDocuments", indexName });
        return await formatResponse(insight);
      }
    }
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
        return await formatResponse(result);
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "mergeDocuments", indexName });
        return await formatResponse(insight);
      }
    }
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
        return await formatResponse(result);
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "mergeOrUploadDocuments", indexName });
        return await formatResponse(insight);
      }
    }
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
        return await formatResponse(result);
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "deleteDocuments", indexName });
        return await formatResponse(insight);
      }
    }
  );
}