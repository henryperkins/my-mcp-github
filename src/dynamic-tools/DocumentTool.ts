// src/dynamic-tools/DocumentTool.ts
import { z } from "zod";
import { DynamicTool, OperationDefinition } from "./base/DynamicTool";
import type { ToolContext } from "../types";
import {
  DEFAULT_TIMEOUT_MS,
  MAX_SEARCH_RESULTS,
  DEFAULT_SEARCH_RESULTS,
  INDEX_NAME_PATTERN,
  MAX_DOCUMENTS_PER_BATCH
} from "../constants";

export class DocumentTool extends DynamicTool {
  static readonly toolName = "DocumentOperations";
  static readonly description = "Comprehensive document management for Azure Search. Search, retrieve, upload, update, and delete documents.";

  static readonly operations: Record<string, OperationDefinition> = {
    search: {
      description: "Search documents with filters, sorting, pagination, and optional vector search",
      category: 'read',
      supportsPagination: true,
      params: z.object({
        indexName: z.string().regex(INDEX_NAME_PATTERN),
        search: z.string().default("*").describe("Search query (* for all)"),
        filter: z.string().optional().describe("OData filter expression"),
        orderBy: z.string().optional().describe("Sort order (e.g., 'price desc')"),
        // Vector search support for hybrid search
        vectors: z.array(z.object({
          value: z.array(z.number()).describe("Vector embedding values"),
          fields: z.string().describe("Vector field name"),
          k: z.number().optional().default(10).describe("Number of nearest neighbors")
        })).optional().describe("Vector search queries for hybrid search"),
        // Deprecated: prefer cursor-based pagination
        top: z.number().max(MAX_SEARCH_RESULTS).default(DEFAULT_SEARCH_RESULTS).optional(),
        skip: z.number().optional().describe("Deprecated: use cursor instead"),
        // Unified cursor pagination
        pageSize: z.number().max(MAX_SEARCH_RESULTS).default(DEFAULT_SEARCH_RESULTS).optional(),
        cursor: z.string().min(1).optional().describe("Opaque pagination cursor from previous response"),
        select: z.array(z.string()).optional().describe("Fields to return"),
        includeTotalCount: z.boolean().optional(),
        facets: z.array(z.string()).optional().describe("Fields to get facet counts")
      }),
      examples: [
        {
          indexName: "products",
          search: "laptop",
          filter: "price lt 1000",
          orderBy: "rating desc",
          top: 20
        },
        {
          indexName: "documents",
          search: "*",
          facets: ["category", "author"],
          includeTotalCount: true
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Build base search request (skip/top added by pagination path)
        const baseSearchRequest = {
          search: params.search,
          filter: params.filter,
          orderby: params.orderBy, // Azure Search uses 'orderby'
          select: params.select?.join(','),
          count: params.includeTotalCount,
          facets: params.facets,
          // Add vector queries if provided for hybrid search
          vectorQueries: params.vectors?.map((v: any) => ({
            kind: "vector",
            vector: v.value,
            fields: v.fields,
            k: v.k || 10
          }))
        } as Record<string, any>;

        // Log search intent
        helpers.notify("tools/search_initiated", {
          indexName: params.indexName,
          query: params.search,
          filters: params.filter,
          resultSize: params.top
        });

        try {
          let response: any;

          // Cursor-based pagination path
          if (params.pageSize || params.cursor) {
            const { streamPaginate } = await import("../utils/streaming-pagination");
            const pageSize = params.pageSize || DEFAULT_SEARCH_RESULTS;
            const page = await streamPaginate<any>(
              async (skip: number, top: number) => {
                const req = { ...baseSearchRequest, top, skip };
                const res: any = await helpers.withTimeout(
                  client.searchDocuments(params.indexName, req),
                  DEFAULT_TIMEOUT_MS,
                  "searchDocuments"
                );
                return { value: res.value || [], count: res['@odata.count'] };
              },
              { pageSize, cursor: params.cursor }
            );

            response = {
              results: page.items,
              totalCount: page.totalCount,
              nextCursor: page.nextCursor
            };

            // Facets available on first page only typically
            // Try to include facets if present in first fetch
          } else {
            // Legacy skip/top path
            const req = { ...baseSearchRequest, top: params.top ?? DEFAULT_SEARCH_RESULTS, skip: params.skip ?? 0 };
            const results: any = await helpers.withTimeout(
              client.searchDocuments(params.indexName, req),
              DEFAULT_TIMEOUT_MS,
              "searchDocuments"
            );

            response = {
              results: results.value || results,
              count: results.value?.length || results.length,
              totalCount: params.includeTotalCount ? results['@odata.count'] : undefined
            };
            if (results['@search.facets']) {
              response.facets = results['@search.facets'];
            }
          }

          // Summarize if results are large
          if (JSON.stringify(response).length > 20000) {
            const summarizer = context.getSummarizer?.();
            if (summarizer) {
              response._summary = await summarizer(
                `Found ${response.count} results. Top results include: ${
                  response.results.slice(0, 3).map((r: any) =>
                    r.title || r.name || r.id
                  ).join(', ')
                }`,
                500
              );
            }
          }

          return response;
        } catch (error: any) {
          throw new Error(`Search failed: ${error.message}`);
        }
      }
    },

    get: {
      description: "Retrieve a specific document by its key",
      category: 'read',
      params: z.object({
        indexName: z.string().regex(INDEX_NAME_PATTERN),
        key: z.union([z.string(), z.number()]).describe("Document key value"),
        select: z.array(z.string()).optional().describe("Specific fields to retrieve")
      }),
      examples: [
        { indexName: "products", key: "SKU123" },
        { indexName: "documents", key: "doc-001", select: ["title", "content"] }
      ],
      handler: async (client, params, context, helpers) => {
        const result = await helpers.withTimeout(
          client.getDocument(
            params.indexName,
            String(params.key),
            params.select
          ),
          undefined,
          `getDocument:${params.indexName}:${String(params.key)}`
        );

        // Log retrieval
        helpers.notify("tools/document_retrieved", {
          indexName: params.indexName,
          key: params.key
        });

        return result;
      }
    },

    count: {
      description: "Get the total number of documents in an index",
      category: 'read',
      params: z.object({
        indexName: z.string().regex(INDEX_NAME_PATTERN),
        filter: z.string().optional().describe("Optional filter to count subset")
      }),
      examples: [
        { indexName: "products" },
        { indexName: "products", filter: "price lt 100" }
      ],
      handler: async (client, params, context, helpers) => {
        if (params.filter) {
          // Use search with count for filtered counts
          const result: any = await helpers.withTimeout(
            client.searchDocuments(params.indexName, {
              search: "*",
              filter: params.filter,
              top: 0,
              count: true
            }),
            undefined,
            `countDocuments:${params.indexName}`
          );
          return {
            count: result['@odata.count'] || 0,
            filter: params.filter
          };
        }

        const count = await helpers.withTimeout(
          client.getDocumentCount(params.indexName),
          undefined,
          `getDocumentCount:${params.indexName}`
        );
        return { count };
      }
    },

    upload: {
      description: "Upload new documents (will fail if documents exist)",
      category: 'write',
      batchOperation: true,
      params: z.object({
        indexName: z.string().regex(INDEX_NAME_PATTERN),
        documents: z.array(z.any())
          .min(1, "At least one document required")
          .max(MAX_DOCUMENTS_PER_BATCH, `Maximum ${MAX_DOCUMENTS_PER_BATCH} documents per batch`)
          .describe("Array of documents matching index schema")
      }),
      examples: [
        {
          indexName: "products",
          documents: [
            { id: "1", name: "Laptop", price: 999, category: "Electronics" },
            { id: "2", name: "Mouse", price: 29, category: "Electronics" }
          ]
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Validate documents have required key field
        const indexDef: any = await helpers.withTimeout(
          client.getIndex(params.indexName),
          undefined,
          `getIndex:${params.indexName}`
        );
        const keyField = indexDef.fields.find((f: any) => f.key);

        if (!keyField) {
          throw new Error("Index has no key field defined");
        }

        const missingKeys = params.documents.filter((doc: any) => !doc[keyField.name]);
        if (missingKeys.length > 0) {
          throw new Error(`${missingKeys.length} documents missing required key field: ${keyField.name}`);
        }

        // Process in batches
        const results = await helpers.processBatch(
          params.documents,
          1000,
          async (batch) => helpers.withTimeout(
            client.uploadDocuments(params.indexName, batch),
            undefined,
            `uploadDocuments:${params.indexName}`
          )
        );

        // Log upload
        helpers.notify("tools/documents_uploaded", {
          indexName: params.indexName,
          count: params.documents.length,
          batches: results.batches
        });

        // Emit MCP resource updates (documents changed in index)
        helpers.notifyResourceUpdated("indexes");
        helpers.notifyResourceUpdated(`indexes/${params.indexName}`);

        return {
          success: true,
          uploaded: params.documents.length,
          results
        };
      }
    },

    merge: {
      description: "Update existing documents (partial update)",
      category: 'write',
      batchOperation: true,
      params: z.object({
        indexName: z.string().regex(INDEX_NAME_PATTERN),
        documents: z.array(z.any())
          .min(1)
          .max(MAX_DOCUMENTS_PER_BATCH)
          .describe("Documents with fields to update (must include key)")
      }),
      examples: [
        {
          indexName: "products",
          documents: [
            { id: "1", price: 899 },
            { id: "2", inStock: false }
          ]
        }
      ],
      handler: async (client, params, context, helpers) => {
        const results = await helpers.processBatch(
          params.documents,
          1000,
          async (batch) => helpers.withTimeout(
            client.mergeDocuments(params.indexName, batch),
            undefined,
            `mergeDocuments:${params.indexName}`
          )
        );

        helpers.notify("tools/documents_merged", {
          indexName: params.indexName,
          count: params.documents.length,
          batches: results.batches
        });

        // Emit MCP resource updates (documents changed in index)
        helpers.notifyResourceUpdated("indexes");
        helpers.notifyResourceUpdated(`indexes/${params.indexName}`);

        return {
          success: true,
          merged: params.documents.length,
          results
        };
      }
    },

    mergeOrUpload: {
      description: "Update existing documents or create new ones",
      category: 'write',
      batchOperation: true,
      params: z.object({
        indexName: z.string().regex(INDEX_NAME_PATTERN),
        documents: z.array(z.any())
          .min(1)
          .max(MAX_DOCUMENTS_PER_BATCH)
          .describe("Documents to merge or upload")
      }),
      examples: [
        {
          indexName: "products",
          documents: [
            { id: "1", name: "Updated Laptop", price: 899 },
            { id: "3", name: "New Tablet", price: 499 }
          ]
        }
      ],
      handler: async (client, params, context, helpers) => {
        const results = await helpers.processBatch(
          params.documents,
          1000,
          async (batch) => helpers.withTimeout(
            client.mergeOrUploadDocuments(params.indexName, batch),
            undefined,
            `mergeOrUploadDocuments:${params.indexName}`
          )
        );

        helpers.notify("tools/documents_mergeOrUploaded", {
          indexName: params.indexName,
          count: params.documents.length,
          batches: results.batches
        });

        // Emit MCP resource updates (documents changed in index)
        helpers.notifyResourceUpdated("indexes");
        helpers.notifyResourceUpdated(`indexes/${params.indexName}`);

        return {
          success: true,
          processed: params.documents.length,
          results
        };
      }
    },

    delete: {
      description: "Delete documents by their keys",
      category: 'delete',
      requiresConfirmation: true,
      params: z.object({
        indexName: z.string().regex(INDEX_NAME_PATTERN),
        keys: z.array(z.union([z.string(), z.number()]))
          .min(1, "At least one key required")
          .describe("Array of document keys to delete"),
        confirmation: z.literal("DELETE").optional()
      }),
      examples: [
        {
          indexName: "products",
          keys: ["1", "2", "3"],
          confirmation: "DELETE"
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Elicit confirmation for bulk delete
        if (params.keys.length > 10 && params.confirmation !== "DELETE") {
          const response = await helpers.elicit({
            message: `⚠️ This will delete ${params.keys.length} documents. Type 'DELETE' to confirm.`,
            inputType: 'text',
            validation: (input: string) => input === "DELETE" ? null : "Please type 'DELETE' to confirm",
            timeout: 10000
          });

          if (response?.text !== "DELETE") {
            throw new Error("Delete operation cancelled");
          }
        }

        // Get key field name
        const indexDef: any = await helpers.withTimeout(
          client.getIndex(params.indexName),
          undefined,
          `getIndex:${params.indexName}`
        );
        const keyField = indexDef.fields.find((f: any) => f.key);

        if (!keyField) {
          throw new Error("Index has no key field defined");
        }

        // Convert keys to document format
        const keyDocuments = params.keys.map((key: string | number) => ({
          [keyField.name]: key
        }));

        await helpers.withTimeout(
          client.deleteDocuments(params.indexName, keyDocuments),
          undefined,
          `deleteDocuments:${params.indexName}`
        );

        // Log deletion
        helpers.notify("tools/documents_deleted", {
          indexName: params.indexName,
          count: params.keys.length
        });

        // Emit MCP resource updates (documents changed in index)
        helpers.notifyResourceUpdated("indexes");
        helpers.notifyResourceUpdated(`indexes/${params.indexName}`);

        return {
          success: true,
          deleted: params.keys.length
        };
      }
    },

    analyze: {
      description: "Analyze search results and provide insights",
      category: 'analyze',
      params: z.object({
        indexName: z.string().regex(INDEX_NAME_PATTERN),
        field: z.string().describe("Field to analyze"),
        aggregationType: z.enum(["distribution", "topValues", "statistics"])
      }),
      examples: [
        {
          indexName: "products",
          field: "category",
          aggregationType: "topValues"
        },
        {
          indexName: "products",
          field: "price",
          aggregationType: "statistics"
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Use faceted search for analysis
        const results: any = await helpers.withTimeout(
          client.searchDocuments(params.indexName, {
            search: "*",
            top: 0,
            facets: [params.field],
            count: true
          }),
          undefined,
          `analyze:${params.indexName}`
        );

        const facets = results['@search.facets']?.[params.field] || [];

        switch (params.aggregationType) {
          case "distribution":
            return {
              field: params.field,
              distribution: facets,
              totalDocuments: results['@odata.count']
            };

          case "topValues":
            return {
              field: params.field,
              topValues: facets.slice(0, 10),
              uniqueValues: facets.length
            };

          case "statistics":
            // For numeric fields, calculate stats
            const values = facets.map((f: any) => f.value).filter((v: any) => typeof v === 'number');
            if (values.length === 0) {
              return {
                field: params.field,
                error: "No numeric values found for statistics calculation"
              };
            }
            return {
              field: params.field,
              min: Math.min(...values),
              max: Math.max(...values),
              avg: values.reduce((a: number, b: number) => a + b, 0) / values.length,
              count: facets.length
            };

          default:
            return { facets };
        }
      }
    }
  };

  // Resource definitions
  protected static resources = [
    {
      uri: "search://recent",
      description: "Recent search queries and results",
      handler: async (context: ToolContext) => {
        // This would track recent searches in practice
        return {
          recentSearches: [],
          popularFilters: [],
          commonFields: []
        };
      }
    }
  ];

  // Prompt definitions
  protected static prompts = [
    {
      name: "advanced_search",
      description: "Build complex search queries with filters and facets",
      params: z.object({
        indexName: z.string(),
        requirements: z.string().describe("What are you looking for?"),
        includeFilters: z.boolean().default(true)
      }),
      handler: async (params: any, context: ToolContext) => {
        // Analyze requirements and build search
        const searchParams = DocumentTool.buildSearchParams(params.requirements, params.includeFilters);

        return {
          messages: [{
            role: "assistant" as const,
            content: {
              type: "text" as const,
              text: `Executing advanced search:\n${JSON.stringify({
                operation: "search",
                params: { indexName: params.indexName, ...searchParams }
              }, null, 2)}`
            }
          }]
        };
      }
    }
  ];

  // Helper methods
  private static buildSearchParams(requirements: string, includeFilters: boolean): any {
    // Smart parameter building based on natural language
    const params: any = {
      search: requirements,
      top: 20
    };

    // Detect filter intent
    if (includeFilters) {
      if (requirements.match(/under (\d+)|less than (\d+)/i)) {
        const match = requirements.match(/\d+/);
        if (match) {
          params.filter = `price lt ${match[0]}`;
        }
      }
      if (requirements.includes("recent") || requirements.includes("latest")) {
        params.orderBy = "timestamp desc";
      }
      if (requirements.includes("popular") || requirements.includes("best")) {
        params.orderBy = "rating desc";
      }
    }

    return params;
  }
}
