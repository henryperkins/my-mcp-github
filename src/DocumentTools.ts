// src/DocumentTools.ts
import { z } from "zod";
import { ResponseFormatter } from "./utils/response-helper";
import getToolHints from "./utils/toolHints";
import { ToolElicitationBuilder } from "./tool-elicitation";
import { elicitIfNeeded } from "./utils/elicitation-integration";
import type { ToolContext } from "./types";
import { SearchParamsSchema, IndexNameSchema, DocumentKeySchema, DocumentBatchSchema, SearchResultsSchema } from "./schemas";
import { DEFAULT_TIMEOUT_MS } from "./constants";

/**
 * Register document search and CRUD tools.
 * Tools:
 *  - searchDocuments, getDocument, countDocuments
 *  - uploadDocuments, mergeDocuments, mergeOrUploadDocuments, deleteDocuments
 */
export function registerDocumentTools(server: any, context: ToolContext) {
  const { getClient, getSummarizer } = context;
  const rf = new ResponseFormatter(() => {
    const s = context.getSummarizer?.();
    if (!s) return null;
    return (text: string, maxTokens?: number) => s(text, maxTokens ?? 800);
  });

  server.tool(
    "searchDocuments",
    "Search for documents using keywords, filters, and sorting. Supports OData filter syntax, pagination (max 50 results per request), field selection, and relevance scoring. Use '*' to retrieve all documents.",
    SearchParamsSchema,
    async (params: z.infer<typeof SearchParamsSchema>) => {
      let { indexName, search, top, skip, select, filter, orderBy, includeTotalCount } = params;
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

      const body = {
        search: search || "*",
        top,
        skip,
        ...(select && { select: select.join(",") }),
        ...(filter && { filter }),
        // Azure Search expects 'orderby' (no $) in POST body
        ...(orderBy && { orderby: orderBy }),
        ...(includeTotalCount && { count: true }),
      };

      if (!indexName) {
        return rf.formatError(new Error("Missing required parameter: indexName"), {
          tool: "searchDocuments",
          ...body,
        });
      }

      const exec = rf.createToolExecutor<typeof params>("searchDocuments", DEFAULT_TIMEOUT_MS);
      return exec(
        { indexName, search, top, skip, select, filter, orderBy, includeTotalCount } as any,
        () => client.searchDocuments(indexName, body),
        { tool: "searchDocuments", indexName, ...body },
      );
    },
    { ...getToolHints("POST"), outputSchema: SearchResultsSchema },
  );

  const GetDocumentSchema = z.object({
    indexName: IndexNameSchema,
    key: DocumentKeySchema.transform(String),
    select: z.array(z.string()).optional(),
  });

  server.tool(
    "getDocument",
    "Lookup a document by its primary key.",
    GetDocumentSchema,
    async (params: z.infer<typeof GetDocumentSchema>) => {
      const { indexName, key } = params;
      const client = getClient();
      const exec = rf.createToolExecutor<typeof params>("getDocument", DEFAULT_TIMEOUT_MS);
      return exec(params, (p) => client.getDocument(p.indexName, p.key, p.select), { tool: "getDocument", indexName, key });
    },
    getToolHints("GET"),
  );

  server.tool(
    "countDocuments",
    "Return document count.",
    z.object({ indexName: IndexNameSchema }),
    async ({ indexName }: { indexName: string }) => {
      const client = getClient();
      const exec = rf.createToolExecutor<{ indexName: string }>("countDocuments", DEFAULT_TIMEOUT_MS);
      return exec(
        { indexName },
        async (p) => {
          const count = await client.getDocumentCount(p.indexName);
          return { count };
        },
        { tool: "countDocuments", indexName },
      );
    },
    { ...getToolHints("GET"), outputSchema: z.object({ count: z.number() }) },
  );

  // ---------------- DOCUMENT OPERATIONS ----------------
  const UploadDocumentsSchema = z.object({
    indexName: IndexNameSchema.optional(),
    documents: DocumentBatchSchema.optional().describe("Array of documents to upload"),
  });

  server.tool(
    "uploadDocuments",
    "Upload new documents to an index. Documents must match the index schema. Maximum 1000 documents per batch. For existing documents, use mergeDocuments instead.",
    UploadDocumentsSchema,
    async (params: z.infer<typeof UploadDocumentsSchema>) => {
      let { indexName, documents } = params;
      const client = getClient();

      // Elicit upload parameters if missing
      if (!indexName || !documents || documents.length === 0) {
        const elicited = await elicitIfNeeded(context.agent || server, ToolElicitationBuilder.uploadDocumentsElicitation());
        if (elicited) {
          indexName = elicited.indexName || indexName;
        }
      }

      if (!indexName || !documents || documents.length === 0) {
        return rf.formatError(new Error("Missing required parameters: indexName and documents"), {
          tool: "uploadDocuments",
          indexName,
          documentCount: documents?.length,
        });
      }

      const exec = rf.createToolExecutor<typeof params>("uploadDocuments", DEFAULT_TIMEOUT_MS);
      return exec({ indexName, documents }, () => client.uploadDocuments(indexName, documents), {
        tool: "uploadDocuments",
        indexName,
        documentCount: documents.length,
      });
    },
    getToolHints("POST"),
  );

  const MergeDocumentsSchema = z.object({
    indexName: IndexNameSchema.optional(),
    documents: DocumentBatchSchema.optional().describe("Array of documents to merge"),
  });

  server.tool(
    "mergeDocuments",
    "Merge documents in an index (updates existing documents).",
    MergeDocumentsSchema,
    async (params: z.infer<typeof MergeDocumentsSchema>) => {
      const { indexName, documents } = params;
      const client = getClient();
      
      if (!indexName || !documents || documents.length === 0) {
        return rf.formatError(new Error("Missing required parameters: indexName and documents"), {
          tool: "mergeDocuments",
          indexName,
          documentCount: documents?.length,
        });
      }

      const exec = rf.createToolExecutor<typeof params>("mergeDocuments", DEFAULT_TIMEOUT_MS);
      return exec({ indexName, documents }, (p) => client.mergeDocuments(p.indexName!, p.documents!), {
        tool: "mergeDocuments",
        indexName,
        documentCount: documents.length,
      });
    },
    getToolHints("POST"),
  );

  const MergeOrUploadDocumentsSchema = z.object({
    indexName: IndexNameSchema.optional(),
    documents: DocumentBatchSchema.optional().describe("Array of documents to merge or upload"),
  });

  server.tool(
    "mergeOrUploadDocuments",
    "Merge or upload documents (updates existing or creates new).",
    MergeOrUploadDocumentsSchema,
    async (params: z.infer<typeof MergeOrUploadDocumentsSchema>) => {
      const { indexName, documents } = params;
      const client = getClient();
      
      if (!indexName || !documents || documents.length === 0) {
        return rf.formatError(new Error("Missing required parameters: indexName and documents"), {
          tool: "mergeOrUploadDocuments",
          indexName,
          documentCount: documents?.length,
        });
      }

      const exec = rf.createToolExecutor<typeof params>("mergeOrUploadDocuments", DEFAULT_TIMEOUT_MS);
      return exec({ indexName, documents }, (p) => client.mergeOrUploadDocuments(p.indexName!, p.documents!), {
        tool: "mergeOrUploadDocuments",
        indexName,
        documentCount: documents.length,
      });
    },
    getToolHints("POST"),
  );

  const DeleteDocumentsSchema = z.object({
    indexName: IndexNameSchema.optional(),
    keyDocuments: z
      .array(z.record(z.unknown()))
      .min(1, "At least one document must be provided")
      .optional()
      .describe("Array of document objects with key field(s) set (e.g., [{\"id\": \"123\"}] where \"id\" is the key field)"),
  });

  server.tool(
    "deleteDocuments",
    "⚠️ Delete specific documents from an index by their key values. This is permanent and cannot be undone. Provide an array of document objects with the key field(s) set (e.g., [{\"id\": \"123\"}] where \"id\" is the index's key field).",
    DeleteDocumentsSchema,
    async (params: z.infer<typeof DeleteDocumentsSchema>) => {
      const { indexName, keyDocuments } = params;
      const client = getClient();
      
      if (!indexName || !keyDocuments || keyDocuments.length === 0) {
        return rf.formatError(new Error("Missing required parameters: indexName and keyDocuments"), {
          tool: "deleteDocuments",
          indexName,
          documentCount: keyDocuments?.length,
        });
      }

      const exec = rf.createToolExecutor<typeof params>("deleteDocuments", DEFAULT_TIMEOUT_MS);
      return exec({ indexName, keyDocuments }, (p) => client.deleteDocuments(p.indexName!, p.keyDocuments!), {
        tool: "deleteDocuments",
        indexName,
        documentCount: keyDocuments.length,
      });
    },
    getToolHints("DELETE"),
  );
}
