// src/dynamic-tools/IndexTool.ts
import { z } from "zod";
import { DynamicTool, OperationDefinition } from "./base/DynamicTool";
import type { ToolContext } from "../types";
import {
  INDEX_NAME_PATTERN,
  ERROR_INVALID_INDEX_NAME,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE
} from "../constants";

export class IndexTool extends DynamicTool {
  static readonly toolName = "IndexManagement";
  static readonly description = "Comprehensive index management tool for Azure Search. Handles creation, updates, deletion, and statistics.";

  static readonly operations: Record<string, OperationDefinition> = {
    list: {
      description: "List all indexes with optional statistics",
      category: 'read',
      supportsPagination: true,
      params: z.object({
        includeStats: z.boolean().optional().describe("Include document count and storage size"),
        verbose: z.boolean().optional().describe("Include full index definitions"),
        pageSize: z.number().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE).optional(),
        cursor: z.string().min(1).optional().describe("Opaque pagination cursor from previous response")
      }),
      examples: [
        { includeStats: true, pageSize: 10 },
        { verbose: true },
        { includeStats: true, verbose: false, pageSize: 25 }
      ],
      handler: async (client, params, context, helpers) => {
        try {
          // Fetch all indexes with timeout
          const indexes = await helpers.withTimeout(
            client.listIndexes(),
            undefined,
            "listIndexes"
          );

          // Optionally enrich results
          let items: any[] = indexes as any[];
          if (params.includeStats || params.verbose) {
            items = await Promise.all(
              (indexes as any[]).map(async (idx: any) => {
                const enriched: any = { ...idx, name: idx.name };
                if (params.includeStats) {
                  try {
                    const s: any = await helpers.withTimeout(
                      client.getIndexStats(idx.name),
                      undefined,
                      `getIndexStats:${idx.name}`
                    );
                    enriched.documentCount = s?.documentCount;
                    enriched.storageSize = s?.storageSize;
                    enriched.formattedSize = s?.storageSize !== undefined ? helpers.formatBytes(s.storageSize) : undefined;
                  } catch {
                    // ignore per-index stats errors
                  }
                }
                if (params.verbose) {
                  try {
                    const def: any = await helpers.withTimeout(
                      client.getIndex(idx.name),
                      undefined,
                      `getIndex:${idx.name}`
                    );
                    enriched.definition = def;
                  } catch {
                    // ignore per-index get errors
                  }
                }
                return enriched;
              })
            );
          }

          // Apply pagination if requested
          if (params.pageSize || params.cursor) {
            const paginated = helpers.paginate(items, {
              pageSize: params.pageSize || DEFAULT_PAGE_SIZE,
              cursor: params.cursor
            });

            // Log pagination info
            helpers.notify("tools/index_list", {
              totalCount: paginated.totalCount,
              pageSize: params.pageSize
            });

            return {
              indexes: paginated.items,
              totalCount: paginated.totalCount,
              nextCursor: paginated.nextCursor
            };
          }

          return { indexes: items, count: items.length };
        } catch (error: any) {
          throw new Error(`Failed to list indexes: ${error.message}`);
        }
      }
    },

    get: {
      description: "Retrieve full index definition",
      category: 'read',
      params: z.object({
        indexName: z.string()
          .min(1, "Index name is required")
          .max(128, "Index name must be at most 128 characters")
          .regex(INDEX_NAME_PATTERN, ERROR_INVALID_INDEX_NAME)
      }),
      examples: [
        { indexName: "products" },
        { indexName: "documents" }
      ],
      handler: async (client, params, context, helpers) => {
        const result: any = await helpers.withTimeout(
          client.getIndex(params.indexName),
          undefined,
          `getIndex:${params.indexName}`
        );

        // Log successful retrieval
        helpers.notify("tools/index_retrieved", {
          indexName: params.indexName,
          fieldCount: result.fields?.length || 0
        });

        return result;
      }
    },

    create: {
      description: "Create a new search index",
      category: 'write',
      params: z.object({
        indexName: z.string()
          .min(1)
          .max(128)
          .regex(INDEX_NAME_PATTERN, ERROR_INVALID_INDEX_NAME),
        template: z.enum(['documentSearch', 'productCatalog', 'hybridSearch', 'knowledgeBase', 'custom'])
          .optional()
          .describe("Pre-built template for common scenarios"),
        indexDefinition: z.any().optional().describe("Custom index definition (required if template is 'custom')"),
        language: z.string().optional().describe("Language for text analysis"),
        vectorDimensions: z.number().optional().describe("Vector dimensions for hybrid search"),
        validate: z.boolean().default(true).describe("Validate definition before creation")
      }),
      examples: [
        {
          indexName: "products",
          template: "productCatalog",
          language: "english"
        },
        {
          indexName: "documents",
          template: "documentSearch"
        },
        {
          indexName: "knowledge",
          template: "hybridSearch",
          vectorDimensions: 1536
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Use elicitation if missing required info
        if (!params.template && !params.indexDefinition) {
          const response = await helpers.elicit({
            message: "Index creation requires either a template or custom definition. Which would you prefer?",
            inputType: 'choice',
            choices: [
              { value: "documentSearch", label: "Document Search - For text documents" },
              { value: "productCatalog", label: "Product Catalog - For e-commerce" },
              { value: "hybridSearch", label: "Hybrid Search - Text + vector search" },
              { value: "knowledgeBase", label: "Knowledge Base - Q&A systems" },
              { value: "custom", label: "Custom - Provide your own definition" }
            ],
            timeout: 5000
          });

          if (response?.choice) {
            params.template = response.choice as any;
          }
        }

        // Build index definition based on template
        let definition: any;
        if (params.template && params.template !== 'custom') {
          definition = IndexTool.buildTemplateIndex(params.template, params);
        } else {
          definition = params.indexDefinition;
        }

        if (!definition) {
          throw new Error("Index definition is required for custom template");
        }

        definition.name = params.indexName;

        // Validate if requested
        if (params.validate) {
          const errors = IndexTool.validateIndexDefinition(definition);
          if (errors.length > 0) {
            throw new Error(`Validation failed:\n${errors.join('\n')}`);
          }
        }

        const result = await helpers.withTimeout(
          client.createIndex(definition),
          undefined,
          `createIndex:${params.indexName}`
        );

        // Log creation
        helpers.notify("tools/index_created", {
          indexName: params.indexName,
          template: params.template,
          fieldCount: definition.fields?.length
        });

        // Emit MCP resource updates
        helpers.notifyResourceUpdated("indexes");
        helpers.notifyResourceUpdated(`indexes/${params.indexName}`);

        return result;
      }
    },

    update: {
      description: "Update an existing index (add fields, modify settings)",
      category: 'write',
      params: z.object({
        indexName: z.string().regex(INDEX_NAME_PATTERN),
        addFields: z.array(z.object({
          name: z.string(),
          type: z.string(),
          searchable: z.boolean().optional(),
          filterable: z.boolean().optional(),
          sortable: z.boolean().optional(),
          facetable: z.boolean().optional(),
          analyzer: z.string().optional()
        })).optional().describe("Fields to add to the index"),
        updateSemanticConfig: z.object({
          titleField: z.string(),
          contentFields: z.array(z.string()),
          keywordFields: z.array(z.string()).optional()
        }).optional().describe("Update semantic search configuration"),
        mergeWithExisting: z.boolean().default(true),
        validate: z.boolean().default(true)
      }),
      examples: [
        {
          indexName: "products",
          addFields: [
            { name: "brand", type: "Edm.String", filterable: true, facetable: true }
          ]
        },
        {
          indexName: "documents",
          updateSemanticConfig: {
            titleField: "title",
            contentFields: ["content", "summary"],
            keywordFields: ["tags"]
          }
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Get existing index first
        const existing: any = await helpers.withTimeout(
          client.getIndex(params.indexName),
          undefined,
          `getIndex:${params.indexName}`
        );

        // Merge changes
        if (params.addFields) {
          existing.fields = [...existing.fields, ...params.addFields];
        }

        if (params.updateSemanticConfig) {
          existing.semantic = {
            configurations: [{
              name: "default",
              prioritizedFields: params.updateSemanticConfig
            }]
          };
        }

        if (params.validate) {
          const errors = IndexTool.validateIndexDefinition(existing);
          if (errors.length > 0) {
            throw new Error(`Validation failed:\n${errors.join('\n')}`);
          }
        }

        const result = await helpers.withTimeout(
          client.createOrUpdateIndex(params.indexName, existing),
          undefined,
          `createOrUpdateIndex:${params.indexName}`
        );

        helpers.notify("tools/index_updated", {
          indexName: params.indexName,
          fieldsAdded: params.addFields?.length || 0,
          semanticUpdated: !!params.updateSemanticConfig
        });

        // Emit MCP resource updates
        helpers.notifyResourceUpdated("indexes");
        helpers.notifyResourceUpdated(`indexes/${params.indexName}`);

        return result;
      }
    },

    delete: {
      description: "Permanently delete an index and all its documents",
      category: 'delete',
      requiresConfirmation: true,
      params: z.object({
        indexName: z.string().regex(INDEX_NAME_PATTERN),
        confirmation: z.literal("DELETE").optional().describe("Type 'DELETE' to confirm")
      }),
      examples: [
        {
          indexName: "old-index",
          confirmation: "DELETE"
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Use elicitation for confirmation if not provided
        if (params.confirmation !== "DELETE") {
          const response = await helpers.elicit({
            message: `⚠️ This will permanently delete index '${params.indexName}' and all its documents. This cannot be undone. Type 'DELETE' to confirm.`,
            inputType: 'text',
            validation: (input: string) => input === "DELETE" ? null : "Please type 'DELETE' to confirm",
            timeout: 10000
          });

          if (response?.text !== "DELETE") {
            throw new Error("Delete operation cancelled");
          }
        }

        await helpers.withTimeout(
          client.deleteIndex(params.indexName),
          undefined,
          `deleteIndex:${params.indexName}`
        );

        // Log deletion
        helpers.notify("tools/index_deleted", {
          indexName: params.indexName,
          timestamp: new Date().toISOString()
        });

        // Emit MCP resource updates
        helpers.notifyResourceUpdated("indexes");
        helpers.notifyResourceUpdated(`indexes/${params.indexName}`);

        return {
          success: true,
          message: `Index '${params.indexName}' has been permanently deleted`
        };
      }
    },

    stats: {
      description: "Get detailed statistics for an index",
      category: 'read',
      params: z.object({
        indexName: z.string().regex(INDEX_NAME_PATTERN)
      }),
      examples: [
        { indexName: "products" },
        { indexName: "documents" }
      ],
      handler: async (client, params, context, helpers) => {
        const stats: any = await helpers.withTimeout(
          client.getIndexStats(params.indexName),
          undefined,
          `getIndexStats:${params.indexName}`
        );
        return {
          indexName: params.indexName,
          documentCount: stats.documentCount,
          storageSize: stats.storageSize,
          formattedSize: helpers.formatBytes(stats.storageSize)
        };
      }
    },
    // Alias operations
    aliasList: {
      description: "List all index aliases",
      category: 'read',
      params: z.object({}),
      examples: [],
      handler: async (client, _params, _context, helpers) => {
        const aliases = (await helpers.withTimeout(
          client.listAliases(),
          undefined,
          "listAliases"
        )) as Array<any>;

        return {
          aliases: (aliases || []).map((a: any) => ({ name: a.name, indexes: a.indexes })),
          count: (aliases || []).length
        };
      }
    },

    aliasGet: {
      description: "Get a specific index alias",
      category: 'read',
      params: z.object({
        aliasName: z.string().min(1).max(128)
      }),
      examples: [{ aliasName: "search-live" }],
      handler: async (client, params, _context, helpers) => {
        const alias = await helpers.withTimeout(
          client.getAlias(params.aliasName),
          undefined,
          `getAlias:${params.aliasName}`
        );
        return alias;
      }
    },

    aliasCreate: {
      description: "Create a new index alias",
      category: 'write',
      params: z.object({
        aliasName: z.string().min(1).max(128),
        indexName: z.string().min(1).max(128)
      }),
      examples: [
        { aliasName: "search-live", indexName: "products-v2" }
      ],
      handler: async (client, params, _context, helpers) => {
        // API expects body { name, indexes: [string] }
        const result = await helpers.withTimeout(
          client.createAlias({ name: params.aliasName, indexes: [params.indexName] }),
          undefined,
          `createAlias:${params.aliasName}`
        );

        helpers.notify("tools/alias_created", {
          aliasName: params.aliasName,
          indexName: params.indexName
        });

        helpers.notifyResourceUpdated("aliases");
        helpers.notifyResourceUpdated(`aliases/${params.aliasName}`);

        return {
          success: true,
          message: `Alias '${params.aliasName}' created for index '${params.indexName}'`,
          alias: result
        };
      }
    },

    aliasUpdate: {
      description: "Update an existing index alias to point to a different index",
      category: 'write',
      params: z.object({
        aliasName: z.string().min(1).max(128),
        indexName: z.string().min(1).max(128),
        ifMatch: z.string().optional(),
        ifNoneMatch: z.string().optional()
      }),
      examples: [
        { aliasName: "search-live", indexName: "products-v3" }
      ],
      handler: async (client, params, _context, helpers) => {
        const result = await helpers.withTimeout(
          client.createOrUpdateAlias(params.aliasName, { indexes: [params.indexName] }, {
            ifMatch: params.ifMatch,
            ifNoneMatch: params.ifNoneMatch
          }),
          undefined,
          `updateAlias:${params.aliasName}`
        );

        helpers.notify("tools/alias_updated", {
          aliasName: params.aliasName,
          indexName: params.indexName
        });

        helpers.notifyResourceUpdated("aliases");
        helpers.notifyResourceUpdated(`aliases/${params.aliasName}`);

        return {
          success: true,
          message: `Alias '${params.aliasName}' now points to index '${params.indexName}'`,
          alias: result
        };
      }
    },

    aliasDelete: {
      description: "Delete an index alias",
      category: 'delete',
      requiresConfirmation: true,
      params: z.object({
        aliasName: z.string().min(1).max(128),
        confirmation: z.literal("DELETE").optional()
      }),
      examples: [
        { aliasName: "old-alias", confirmation: "DELETE" }
      ],
      handler: async (client, params, _context, helpers) => {
        if (params.confirmation !== "DELETE") {
          const resp = await helpers.elicit({
            message: `⚠️ This will delete alias '${params.aliasName}'. Type 'DELETE' to confirm.`,
            inputType: 'text',
            validation: (input: string) => input === "DELETE" ? null : "Please type 'DELETE' to confirm",
            timeout: 10000
          });
          if (resp?.text !== "DELETE") throw new Error("Delete operation cancelled");
        }

        await helpers.withTimeout(
          client.deleteAlias(params.aliasName),
          undefined,
          `deleteAlias:${params.aliasName}`
        );

        helpers.notify("tools/alias_deleted", {
          aliasName: params.aliasName,
          timestamp: new Date().toISOString()
        });

        helpers.notifyResourceUpdated("aliases");
        helpers.notifyResourceUpdated(`aliases/${params.aliasName}`);

        return { success: true, message: `Alias '${params.aliasName}' deleted` };
      }
    }
  };

  // Resource definitions
  protected static resources = [
    {
      uri: "indexes://list",
      description: "Real-time list of all search indexes",
      handler: async (context: ToolContext) => {
        const client = context.getClient();
        const indexes = await client.listIndexes();

        return {
          count: indexes.length,
          indexes: indexes.map((idx: any) => ({
            name: idx.name,
            fields: idx.fields?.length || 0,
            documentCount: idx.documentCount || 0,
            storageSize: idx.storageSize || 0
          }))
        };
      }
    }
  ];

  // Prompt definitions
  protected static prompts = [
    {
      name: "create_optimal_index",
      description: "Interactive index creation with best practices",
      params: z.object({
        use_case: z.string().describe("What will you search for?"),
        expected_volume: z.enum(["small", "medium", "large"]).describe("Expected data volume"),
        need_ai: z.boolean().describe("Need AI enrichment?")
      }),
      handler: async (params: any, context: ToolContext) => {
        const analysis = IndexTool.analyzeRequirements(
          params.use_case,
          params.expected_volume,
          params.need_ai
        );

        const messages = [
          {
            role: "assistant" as const,
            content: {
              type: "text" as const,
              text: `Based on your requirements, I recommend:\n\n${analysis.recommendation}\n\nShall I create this index configuration for you?`
            }
          },
          {
            role: "assistant" as const,
            content: {
              type: "text" as const,
              text: `Use IndexManagement tool:\n${JSON.stringify({
                operation: "create",
                params: analysis.params
              }, null, 2)}`
            }
          }
        ];

        return { messages };
      }
    }
  ];

  // Helper methods
  private static validateIndexDefinition(def: any): string[] {
    const errors: string[] = [];

    if (!def?.fields || def.fields.length === 0) {
      errors.push("Index must have at least one field");
    }

    const keyFields = def.fields?.filter((f: any) => f.key) || [];
    if (keyFields.length !== 1) {
      errors.push("Index must have exactly one key field");
    }

    // Check for duplicate field names
    const fieldNames = new Set<string>();
    for (const field of def.fields || []) {
      if (fieldNames.has(field.name)) {
        errors.push(`Duplicate field name: ${field.name}`);
      }
      fieldNames.add(field.name);
    }

    // Validate field types
    const validTypes = [
      'Edm.String', 'Edm.Boolean', 'Edm.Int32', 'Edm.Int64',
      'Edm.Double', 'Edm.DateTimeOffset', 'Edm.GeographyPoint',
      'Collection(Edm.String)', 'Collection(Edm.Int32)', 'Collection(Edm.Double)',
      'Collection(Edm.Single)'
    ];

    for (const field of def.fields || []) {
      if (!validTypes.includes(field.type)) {
        errors.push(`Invalid field type for ${field.name}: ${field.type}`);
      }
    }

    return errors;
  }

  private static buildTemplateIndex(template: string, params: any): any {
    const templates: Record<string, any> = {
      documentSearch: {
        fields: [
          { name: "id", type: "Edm.String", key: true },
          { name: "title", type: "Edm.String", searchable: true, analyzer: params.language || "standard.lucene" },
          { name: "content", type: "Edm.String", searchable: true, analyzer: params.language || "standard.lucene" },
          { name: "timestamp", type: "Edm.DateTimeOffset", filterable: true, sortable: true },
          { name: "tags", type: "Collection(Edm.String)", filterable: true, facetable: true }
        ]
      },
      productCatalog: {
        fields: [
          { name: "productId", type: "Edm.String", key: true },
          { name: "name", type: "Edm.String", searchable: true, analyzer: params.language || "standard.lucene" },
          { name: "description", type: "Edm.String", searchable: true, analyzer: params.language || "standard.lucene" },
          { name: "price", type: "Edm.Double", filterable: true, sortable: true, facetable: true },
          { name: "category", type: "Edm.String", filterable: true, facetable: true },
          { name: "brand", type: "Edm.String", filterable: true, facetable: true },
          { name: "inStock", type: "Edm.Boolean", filterable: true },
          { name: "rating", type: "Edm.Double", filterable: true, sortable: true }
        ]
      },
      hybridSearch: {
        fields: [
          { name: "id", type: "Edm.String", key: true },
          { name: "title", type: "Edm.String", searchable: true },
          { name: "content", type: "Edm.String", searchable: true },
          { name: "contentVector", type: "Collection(Edm.Single)", searchable: true, dimensions: params.vectorDimensions || 1536 },
          { name: "metadata", type: "Edm.String" },
          { name: "timestamp", type: "Edm.DateTimeOffset", filterable: true }
        ],
        vectorSearch: {
          algorithms: [
            {
              name: "hnsw",
              kind: "hnsw",
              hnswParameters: {
                metric: "cosine",
                m: 4,
                efConstruction: 400,
                efSearch: 500
              }
            }
          ],
          profiles: [
            {
              name: "vector-profile",
              algorithm: "hnsw"
            }
          ]
        }
      },
      knowledgeBase: {
        fields: [
          { name: "id", type: "Edm.String", key: true },
          { name: "question", type: "Edm.String", searchable: true },
          { name: "answer", type: "Edm.String", searchable: true },
          { name: "category", type: "Edm.String", filterable: true, facetable: true },
          { name: "source", type: "Edm.String", filterable: true },
          { name: "confidence", type: "Edm.Double", filterable: true, sortable: true },
          { name: "lastUpdated", type: "Edm.DateTimeOffset", filterable: true, sortable: true }
        ]
      }
    };

    return templates[template] || templates.documentSearch;
  }

  private static analyzeRequirements(useCase: string, volume: string, needAI: boolean): any {
    // Smart analysis logic
    const indexName = useCase.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 128);

    let template = 'documentSearch';
    if (useCase.toLowerCase().includes('product') || useCase.toLowerCase().includes('catalog')) {
      template = 'productCatalog';
    } else if (useCase.toLowerCase().includes('question') || useCase.toLowerCase().includes('faq')) {
      template = 'knowledgeBase';
    } else if (needAI || useCase.toLowerCase().includes('vector') || useCase.toLowerCase().includes('embedding')) {
      template = 'hybridSearch';
    }

    const recommendation = `
- Index Type: ${template}
- Estimated Storage: ${volume === 'large' ? '> 1GB' : volume === 'medium' ? '100MB - 1GB' : '< 100MB'}
- AI Enrichment: ${needAI ? 'Enabled with skillsets' : 'Not required'}
- Optimization: ${volume === 'large' ? 'Partitioned with replicas' : 'Standard configuration'}
    `.trim();

    return {
      recommendation,
      params: {
        indexName,
        template,
        language: 'english',
        ...(template === 'hybridSearch' && { vectorDimensions: 1536 })
      }
    };
  }
}
