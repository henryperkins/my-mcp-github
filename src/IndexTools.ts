// src/IndexTools.ts
import { z } from "zod";
import { IndexBuilder, IndexTemplates } from "./index-builder";
import { ResponseFormatter } from "./utils/response-helper";
import { resolveAnalyzerForLanguage } from "./utils/languageAnalyzers";
import getToolHints from "./utils/toolHints";
import { encodeCursor, decodeCursor } from "./utils/pagination";
import { paginateArray } from "./utils/streaming-pagination";
import { withTimeout } from "./utils/timeout";
import type { ToolContext } from "./types";
import { ToolElicitationBuilder } from "./tool-elicitation";
import { elicitIfNeeded, mergeElicitedParams, needsElicitation } from "./utils/elicitation-integration";
import { IndexNameSchema, IndexDefinitionSchema, IndexFieldSchema, PaginationSchema } from "./schemas";
import { MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE, DEFAULT_TIMEOUT_MS } from "./constants";

/** Local validation helper to keep behavior consistent with previous implementation. */
function validateIndexDefinition(def: any): string[] {
  const errors: string[] = [];
  if (!def?.fields || !Array.isArray(def.fields) || def.fields.length === 0) {
    errors.push("Index must have at least one field");
    return errors;
  }

  // Key field checks
  const keyFields = def.fields.filter((f: any) => f?.key);
  if (keyFields.length === 0) {
    errors.push("Index must have exactly one key field");
  } else if (keyFields.length > 1) {
    errors.push("Index can only have one key field");
  }

  // Duplicate names and vector sanity
  const names = new Set<string>();
  for (const f of def.fields) {
    if (names.has(f.name)) {
      errors.push(`Duplicate field name: ${f.name}`);
    }
    names.add(f.name);

    if (f.type === "Collection(Edm.Single)" && (!f.dimensions || f.dimensions < 1)) {
      errors.push(`Vector field ${f.name} must have dimensions > 0`);
    }
  }
  return errors;
}

/**
 * Register Index management tools on the provided MCP server.
 * Tools:
 *  - listIndexes, getIndex, getIndexStats, deleteIndex
 *  - createIndex, createOrUpdateIndex
 */
export function registerIndexTools(server: any, context: ToolContext) {
  const { getClient, getSummarizer } = context;
  const rf = new ResponseFormatter(() => {
    const s = context.getSummarizer?.();
    if (!s) return null;
    return (text: string, maxTokens?: number) => s(text, maxTokens ?? 800);
  });

  // ---------------- INDEX MANAGEMENT ----------------
  server.tool(
    "listIndexes",
    "List all index names with basic metadata.",
    {
      includeStats: z.boolean().optional().describe("Include document count and storage size for each index"),
      verbose: z.boolean().optional().describe("Include full index definitions (fields, analyzers, etc.)"),
    },
    async ({ includeStats, verbose }: any) => {
      try {
        const client = getClient();
        const indexes = await client.listIndexes();

        if (verbose) {
          const structured = { indexes, count: indexes.length };
          return rf.formatSuccess(structured);
        }

        let indexInfo = indexes.map((idx: any) => ({
          name: idx.name,
          fields: idx.fields?.length || 0,
          ...(idx.defaultScoringProfile && { defaultScoringProfile: idx.defaultScoringProfile }),
          ...(idx.corsOptions && { corsEnabled: true }),
          ...(idx.semantic && { semanticSearchEnabled: true }),
          ...(idx.vectorSearch && { vectorSearchEnabled: true }),
        }));

        if (includeStats) {
          indexInfo = await Promise.all(
            indexInfo.map(async (info: any) => {
              try {
                const stats: any = await client.getIndexStats(info.name);
                const result = {
                  ...info,
                  documentCount: stats.documentCount || 0,
                  storageSize: stats.storageSize || 0,
                };

                // Add vector index size if available and non-zero
                if (stats.vectorIndexSize && stats.vectorIndexSize > 0) {
                  result.vectorIndexSize = stats.vectorIndexSize;
                } else if (info.vectorSearchEnabled && stats.vectorIndexSize === 0) {
                  // Note when vector search is enabled but size is 0
                  result.vectorIndexSize = 0;
                  result.vectorIndexNote = "Vector search enabled but size not reported";
                }

                return result;
              } catch {
                return info;
              }
            }),
          );
        }

        const structuredData = { indexes: indexInfo, count: indexInfo.length };
        return rf.formatSuccess(structuredData);
      } catch (e) {
        return rf.formatError(e, { tool: "listIndexes", includeStats, verbose });
      }
    },
    getToolHints("GET"),
  );

  server.tool(
    "getIndex",
    "Fetch full index definition.",
    { indexName: z.string() },
    async ({ indexName }: any) => {
      try {
        const client = getClient();
        const exec = rf.createToolExecutor<{ indexName: string }>("getIndex", DEFAULT_TIMEOUT_MS);
        return exec({ indexName }, (p) => client.getIndex(p.indexName), { indexName });
      } catch (e) {
        return rf.formatError(e, { tool: "getIndex", indexName });
      }
    },
    getToolHints("GET"),
  );

  server.tool(
    "getIndexStats",
    "Get document count and storage usage.",
    { indexName: z.string() },
    async ({ indexName }: any) => {
      try {
        const client = getClient();
        const stats = await client.getIndexStats(indexName);

        // Add diagnostic information if vectorIndexSize is 0
        if (stats && stats.vectorIndexSize === 0) {
          // Fetch index definition to check for vector fields
          try {
            const indexDef = await client.getIndex(indexName);
            const hasVectorFields = indexDef.fields?.some(
              (f: any) => f.type === "Collection(Edm.Single)" || f.type === "Edm.Vector" || (f.dimensions && f.dimensions > 0),
            );

            if (hasVectorFields) {
              stats.note =
                "Vector fields detected but vectorIndexSize shows 0. This may indicate vectors are not yet indexed or the API doesn't report vector storage separately.";
              stats.vectorFieldsPresent = true;
            }
          } catch {
            // Ignore errors from fetching index definition
          }
        }

        return rf.formatSuccess(stats);
      } catch (e) {
        return rf.formatError(e, { tool: "getIndexStats", indexName });
      }
    },
    getToolHints("GET"),
  );

  server.tool(
    "deleteIndex",
    "⚠️ DESTRUCTIVE: Permanently delete an index and all its documents. This action cannot be undone. Please confirm carefully before proceeding.",
    { indexName: z.string() },
    async ({ indexName }: any) => {
      try {
        const client = getClient();

        // Use MCP elicitation for confirmation if supported
        const elicitRequest = ToolElicitationBuilder.deleteIndexElicitation(indexName);
        const confirmed = await elicitIfNeeded(context.agent || server, elicitRequest);

        // If elicitation was triggered, check confirmation
        if (confirmed !== undefined) {
          if (confirmed.indexName !== indexName) {
            throw new Error("Index name mismatch in confirmation");
          }
          if (confirmed.confirmation !== "DELETE") {
            throw new Error("Deletion not confirmed");
          }
          if (!confirmed.understood) {
            throw new Error("User did not acknowledge the permanent nature of this action");
          }
        }

        await rf.executeWithTimeout(client.deleteIndex(indexName), DEFAULT_TIMEOUT_MS, "deleteIndex", { indexName });
        return rf.formatSuccess({ success: true, message: `Index ${indexName} deleted` });
      } catch (e) {
        return rf.formatError(e, { tool: "deleteIndex", indexName });
      }
    },
    getToolHints("DELETE"),
  );

  server.tool(
    "createIndex",
    "Create a new search index. Choose from templates (document search, product catalog, hybrid search, knowledge base) or provide custom definition. Supports cloning existing indexes and automatic language configuration.",
    {
      template: z
        .enum(["custom", "documentSearch", "productCatalog", "hybridSearch", "knowledgeBase"])
        .optional()
        .describe("Use a pre-built template for common scenarios"),
      indexName: z.string().optional().describe("Index name (lowercase letters, numbers, hyphens only, max 128 chars)"),
      cloneFrom: z.string().optional().describe("Clone structure from an existing index (copies schema but not data)"),
      vectorDimensions: z.number().optional().describe("Vector dimensions for hybrid search template (default: 1536)"),
      language: z
        .string()
        .optional()
        .describe(
          "Language for text analysis: english, spanish, french, german, italian, portuguese, japanese, chinese, korean, arabic, etc.",
        ),
      validate: z.boolean().optional().default(true).describe("Validate index definition before creation"),
      indexDefinition: z
        .object({
          name: z.string(),
          fields: z.array(z.any()).describe("Array of field definitions"),
          suggesters: z.array(z.any()).optional(),
          scoringProfiles: z.array(z.any()).optional(),
          analyzers: z.array(z.any()).optional(),
          tokenizers: z.array(z.any()).optional(),
          tokenFilters: z.array(z.any()).optional(),
          charFilters: z.array(z.any()).optional(),
          normalizers: z.array(z.any()).optional(),
          corsOptions: z.any().optional(),
          encryptionKey: z.any().optional(),
          semantic: z.any().optional(),
          vectorSearch: z.any().optional(),
        })
        .optional()
        .describe("Custom index definition (required if template is 'custom' or not specified)"),
    },
    async ({ template, indexName, cloneFrom, vectorDimensions, language, validate, indexDefinition }: any) => {
      try {
        const client = getClient();

        // Check if we need to elicit missing parameters
        if (!template && !cloneFrom && !indexDefinition) {
          // Get the first elicitation step (choosing approach)
          const elicitationSteps = ToolElicitationBuilder.createIndexElicitation();
          const elicited = await elicitIfNeeded(context.agent || server, elicitationSteps[0]);

          if (elicited?.approach) {
            if (elicited.approach === "template") {
              // Ask for template choice
              const templateElicited = await elicitIfNeeded(context.agent || server, elicitationSteps[1]);
              if (templateElicited?.template) {
                template = templateElicited.template;
              }
            } else if (elicited.approach === "clone") {
              cloneFrom = elicited.cloneFrom || cloneFrom;
            }
            // For "custom", we'll proceed with indexDefinition requirement
          }

          // Get index configuration details if we have a template
          if (template && !indexName) {
            const configElicited = await elicitIfNeeded(context.agent || server, elicitationSteps[2]);
            if (configElicited) {
              indexName = configElicited.indexName || indexName;
              language = configElicited.language || language;
              vectorDimensions = configElicited.vectorDimensions || vectorDimensions;
            }
          }
        }

        let finalDefinition: any;

        if (cloneFrom) {
          const sourceIndex = await client.getIndex(cloneFrom);
          finalDefinition = { ...(sourceIndex as any) };
          finalDefinition.name = indexName || `${cloneFrom}-copy`;
          delete finalDefinition["@odata.etag"];
          delete finalDefinition["@odata.context"];
        } else if (template && template !== "custom") {
          if (!indexName) {
            throw new Error("indexName is required when using a template");
          }

          let builder: IndexBuilder;
          switch (template) {
            case "documentSearch":
              builder = IndexTemplates.documentSearch(indexName);
              break;
            case "productCatalog":
              builder = IndexTemplates.productCatalog(indexName);
              break;
            case "hybridSearch":
              builder = IndexTemplates.hybridSearch(indexName, vectorDimensions || 1536);
              break;
            case "knowledgeBase":
              builder = IndexTemplates.knowledgeBase(indexName);
              break;
            default:
              throw new Error(`Unknown template: ${template}`);
          }

          // Apply language analyzer if specified
          if (language) {
            // Apply to all text fields via builder helper
            builder.applyLanguageToAllText(language);
            // Fallback legacy behavior if needed:
            const analyzer = resolveAnalyzerForLanguage(language);
            if (analyzer && (builder as any).definition?.fields) {
              (builder as any).definition.fields.forEach((f: any) => {
                if (f.searchable && f.type === "Edm.String") {
                  f.analyzer = analyzer;
                }
              });
            }
          }

          finalDefinition = builder.build();
        } else {
          if (!indexDefinition) {
            throw new Error("indexDefinition is required when not using a template");
          }
          finalDefinition = indexDefinition;
        }

        if (validate) {
          const errors = validateIndexDefinition(finalDefinition);
          if (errors.length > 0) {
            throw new Error(`Validation failed:\n${errors.join("\n")}`);
          }
        }

        return rf.executeWithTimeout(client.createIndex(finalDefinition), DEFAULT_TIMEOUT_MS, "createIndex", {
          indexName: finalDefinition.name,
        });
      } catch (e) {
        return rf.formatError(e, { tool: "createIndex" });
      }
    },
    getToolHints("POST"),
  );

  server.tool(
    "createOrUpdateIndex",
    "Create or update a search index with smart field addition.",
    {
      indexName: z.string(),
      addFields: z
        .array(
          z.object({
            name: z.string(),
            type: z.string(),
            searchable: z.boolean().optional(),
            filterable: z.boolean().optional(),
            sortable: z.boolean().optional(),
            facetable: z.boolean().optional(),
            analyzer: z.string().optional(),
          }),
        )
        .optional()
        .describe("Fields to add to existing index"),
      updateSemanticConfig: z
        .object({
          titleField: z.string(),
          contentFields: z.array(z.string()),
          keywordFields: z.array(z.string()).optional(),
        })
        .optional()
        .describe("Update semantic search configuration"),
      validate: z.boolean().optional().default(true),
      mergeWithExisting: z.boolean().optional().default(true).describe("Merge with existing definition or replace"),
      indexDefinition: z
        .object({
          name: z.string(),
          fields: z.array(z.any()).describe("Array of field definitions"),
          suggesters: z.array(z.any()).optional(),
          scoringProfiles: z.array(z.any()).optional(),
          analyzers: z.array(z.any()).optional(),
          tokenizers: z.array(z.any()).optional(),
          tokenFilters: z.array(z.any()).optional(),
          charFilters: z.array(z.any()).optional(),
          normalizers: z.array(z.any()).optional(),
          corsOptions: z.any().optional(),
          encryptionKey: z.any().optional(),
          semantic: z.any().optional(),
          vectorSearch: z.any().optional(),
          "@odata.etag": z.string().optional(),
        })
        .optional(),
    },
    async ({ indexName, addFields, updateSemanticConfig, validate, mergeWithExisting, indexDefinition }: any) => {
      try {
        const client = getClient();
        let finalDefinition: any;
        let etag: string | undefined;

        if (mergeWithExisting || addFields || updateSemanticConfig) {
          // Fetch with timeout to prevent hanging
          const existingIndex: any = await withTimeout(client.getIndex(indexName), DEFAULT_TIMEOUT_MS, `getIndex:${indexName}`);

          // Preserve ETag for optimistic concurrency control
          etag = existingIndex["@odata.etag"];
          finalDefinition = { ...(existingIndex as any) };

          if (addFields && Array.isArray(addFields)) {
            const existingNames = new Set(finalDefinition.fields.map((f: any) => f.name));
            for (const nf of addFields) {
              if (!existingNames.has(nf.name)) {
                finalDefinition.fields.push({
                  ...nf,
                  retrievable: true,
                  stored: true,
                });
              }
            }
          }

          if (updateSemanticConfig) {
            finalDefinition.semantic = {
              configurations: [
                {
                  name: "default-semantic-config",
                  prioritizedFields: {
                    titleField: { fieldName: updateSemanticConfig.titleField },
                    prioritizedContentFields: updateSemanticConfig.contentFields.map((f: string) => ({ fieldName: f })),
                    ...(updateSemanticConfig.keywordFields && {
                      prioritizedKeywordsFields: updateSemanticConfig.keywordFields.map((f: string) => ({ fieldName: f })),
                    }),
                  },
                },
              ],
            };
          }

          if (indexDefinition) {
            finalDefinition = { ...finalDefinition, ...indexDefinition };
          }
        } else {
          if (!indexDefinition) {
            throw new Error("indexDefinition is required when not merging with existing");
          }
          finalDefinition = indexDefinition;
        }

        finalDefinition.name = indexName;

        // Include ETag for optimistic concurrency control
        if (etag) {
          finalDefinition["@odata.etag"] = etag;
        }

        if (validate) {
          // Prevent removals if indexDefinition provided (compat rule)
          if (indexDefinition?.fields) {
            const existingIndex: any = await withTimeout(
              client.getIndex(indexName).catch(() => null),
              DEFAULT_TIMEOUT_MS,
              `getIndex:${indexName}:validation`,
            );
            if (existingIndex) {
              const existingNames = new Set(existingIndex.fields.map((f: any) => f.name));
              const newNames = new Set(finalDefinition.fields.map((f: any) => f.name));
              for (const en of existingNames) {
                if (!newNames.has(en)) {
                  throw new Error(`Validation failed:\nCannot remove existing field: ${en}`);
                }
              }
            }
          }

          const errors = validateIndexDefinition(finalDefinition);
          if (errors.length > 0) {
            throw new Error(`Validation failed:\n${errors.join("\n")}`);
          }
        }

        return rf.executeWithTimeout(client.createOrUpdateIndex(indexName, finalDefinition), DEFAULT_TIMEOUT_MS, "createOrUpdateIndex", {
          indexName,
        });
      } catch (e) {
        return rf.formatError(e, { tool: "createOrUpdateIndex", indexName });
      }
    },
    getToolHints("PUT"),
  );

  const ListIndexesPaginatedSchema = z.object({
    cursor: z.string().optional().describe("Opaque pagination cursor"),
    pageSize: z.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  });

  server.tool(
    "listIndexesPaginated",
    "List indexes with an opaque MCP-style cursor.",
    ListIndexesPaginatedSchema,
    async (params: z.infer<typeof ListIndexesPaginatedSchema>) => {
      const { cursor, pageSize } = params;
      try {
        const client = context.getClient();

        // Fetch indexes with timeout
        const all = await withTimeout(client.listIndexes(), DEFAULT_TIMEOUT_MS, "listIndexes");

        // Use efficient pagination utility
        const paginatedResult = paginateArray(all, { pageSize, cursor });

        const structuredData = {
          indexes: paginatedResult.items,
          totalCount: paginatedResult.totalCount,
          hasMore: paginatedResult.hasMore,
          ...(paginatedResult.nextCursor && { nextCursor: paginatedResult.nextCursor }),
        };

        return rf.formatSuccess(structuredData);
      } catch (e) {
        return rf.formatError(e, { tool: "listIndexesPaginated", cursor, pageSize });
      }
    },
    getToolHints("GET"),
  );
}
