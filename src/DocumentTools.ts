// src/DocumentTools.ts
import { z } from "zod";
import { ResponseFormatter } from "./utils/response-helper";
import getToolHints from "./utils/toolHints";
import { ToolElicitationBuilder } from "./tool-elicitation";
import { elicitIfNeeded } from "./utils/elicitation-integration";
import type { ToolContext } from "./types";
import { SearchResultsSchema } from "./schemas";
import {
  DEFAULT_TIMEOUT_MS,
  MAX_SEARCH_RESULTS,
  DEFAULT_SEARCH_RESULTS,
  INDEX_NAME_PATTERN,
  ERROR_INVALID_INDEX_NAME,
  ERROR_EMPTY_BATCH,
  ERROR_BATCH_TOO_LARGE,
  MAX_DOCUMENTS_PER_BATCH,
} from "./constants";

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

  // Note: pass raw Zod shape (not z.object) so MCP can register params
  server.tool(
    "searchDocuments",
    "Search for documents using keywords, filters, and sorting. Supports OData filter syntax, pagination (max 50 results per request), field selection, and relevance scoring. Use '*' to retrieve all documents.",
    {
      indexName: z
        .string()
        .min(1, "Index name is required")
        .max(128, "Index name must be at most 128 characters")
        .regex(INDEX_NAME_PATTERN, ERROR_INVALID_INDEX_NAME),
      search: z.string().default("*").optional(),
      top: z
        .number()
        .int()
        .positive()
        .max(MAX_SEARCH_RESULTS)
        .default(DEFAULT_SEARCH_RESULTS)
        .describe(`Max ${MAX_SEARCH_RESULTS} to prevent large responses`),
      skip: z.number().int().nonnegative().default(0).describe("Skip N results for pagination"),
      select: z.array(z.string()).optional().describe("Fields to return (reduces response size)"),
      filter: z
        .string()
        .optional()
        .refine((val) => !val || !val.includes(";"), "Filter cannot contain semicolons for security"),
      orderBy: z.string().optional(),
      // Accept lowercase alias for convenience
      orderby: z.string().optional(),
      includeTotalCount: z.boolean().default(true),
    },
    // Annotations must be before the callback per MCP SDK API
    { ...getToolHints("POST") },
    async (params: any) => {
      let { indexName, search, top, skip, select, filter, orderBy, orderby, includeTotalCount } = params;
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
        ...(orderby && { orderby }),
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
        { indexName, search, top, skip, select, filter, orderBy: orderBy || orderby, includeTotalCount } as any,
        () => client.searchDocuments(indexName, body),
        { tool: "searchDocuments", indexName, ...body },
      );
    },
  );

  server.tool(
    "getDocument",
    "Lookup a document by its primary key.",
    {
      indexName: z
        .string()
        .min(1, "Index name is required")
        .max(128, "Index name must be at most 128 characters")
        .regex(INDEX_NAME_PATTERN, ERROR_INVALID_INDEX_NAME),
      key: z.union([z.string().min(1, "Document key cannot be empty"), z.number()]).transform(String),
      select: z.array(z.string()).optional(),
    },
    getToolHints("GET"),
    async (params: any) => {
      const { indexName, key } = params;
      const client = getClient();
      const exec = rf.createToolExecutor<typeof params>("getDocument", DEFAULT_TIMEOUT_MS);
      return exec(params, (p) => client.getDocument(p.indexName, p.key, p.select), { tool: "getDocument", indexName, key });
    },
  );

  server.tool(
    "countDocuments",
    "Return document count.",
    {
      indexName: z
        .string()
        .min(1, "Index name is required")
        .max(128, "Index name must be at most 128 characters")
        .regex(INDEX_NAME_PATTERN, ERROR_INVALID_INDEX_NAME),
    },
    { ...getToolHints("GET"), /* outputSchema intentionally omitted */ },
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
  );

  // ---------------- DOCUMENT OPERATIONS ----------------
  server.tool(
    "uploadDocuments",
    "Upload new documents to an index. Documents must match the index schema. Maximum 1000 documents per batch. For existing documents, use mergeDocuments instead.",
    {
      indexName: z
        .string()
        .min(1, "Index name is required")
        .max(128, "Index name must be at most 128 characters")
        .regex(INDEX_NAME_PATTERN, ERROR_INVALID_INDEX_NAME),
      documents: z
        .array(
          z
            .object({
              "@search.action": z.enum(["upload", "merge", "mergeOrUpload", "delete"]).optional(),
            })
            .catchall(z.unknown()),
        )
        .min(1, ERROR_EMPTY_BATCH)
        .max(MAX_DOCUMENTS_PER_BATCH, ERROR_BATCH_TOO_LARGE)
        .describe("Array of documents to upload"),
    },
    getToolHints("POST"),
    async (params: any) => {
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
  );

  server.tool(
    "mergeDocuments",
    "Merge documents in an index (updates existing documents).",
    {
      indexName: z
        .string()
        .min(1, "Index name is required")
        .max(128, "Index name must be at most 128 characters")
        .regex(INDEX_NAME_PATTERN, ERROR_INVALID_INDEX_NAME),
      documents: z
        .array(
          z
            .object({
              "@search.action": z.enum(["upload", "merge", "mergeOrUpload", "delete"]).optional(),
            })
            .catchall(z.unknown()),
        )
        .min(1, ERROR_EMPTY_BATCH)
        .max(MAX_DOCUMENTS_PER_BATCH, ERROR_BATCH_TOO_LARGE)
        .describe("Array of documents to merge"),
    },
    getToolHints("POST"),
    async (params: any) => {
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
  );

  server.tool(
    "mergeOrUploadDocuments",
    "Merge or upload documents (updates existing or creates new).",
    {
      indexName: z
        .string()
        .min(1, "Index name is required")
        .max(128, "Index name must be at most 128 characters")
        .regex(INDEX_NAME_PATTERN, ERROR_INVALID_INDEX_NAME),
      documents: z
        .array(
          z
            .object({
              "@search.action": z.enum(["upload", "merge", "mergeOrUpload", "delete"]).optional(),
            })
            .catchall(z.unknown()),
        )
        .min(1, ERROR_EMPTY_BATCH)
        .max(MAX_DOCUMENTS_PER_BATCH, ERROR_BATCH_TOO_LARGE)
        .describe("Array of documents to merge or upload"),
    },
    getToolHints("POST"),
    async (params: any) => {
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
  );

  server.tool(
    "deleteDocuments",
    "⚠️ Delete specific documents from an index by their key values. This is permanent and cannot be undone. Provide an array of document objects with the key field(s) set (e.g., [{\"id\": \"123\"}] where \"id\" is the index's key field).",
    {
      indexName: z
        .string()
        .min(1, "Index name is required")
        .max(128, "Index name must be at most 128 characters")
        .regex(INDEX_NAME_PATTERN, ERROR_INVALID_INDEX_NAME),
      keyDocuments: z
        .array(z.record(z.unknown()))
        .min(1, "At least one document must be provided")
        .describe(
          "Array of document objects with key field(s) set (e.g., [{\"id\": \"123\"}] where \"id\" is the key field)",
        ),
    },
    getToolHints("DELETE"),
    async (params: any) => {
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
  );
}
