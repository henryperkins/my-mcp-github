// src/IndexTools.ts
import { z } from "zod";
import { IndexBuilder, IndexTemplates } from "./index-builder";
import { formatResponse, normalizeError } from "./utils/response";
import { resolveAnalyzerForLanguage } from "./utils/languageAnalyzers";
import type { ToolContext } from "./types";
import { generateParameterElicitation } from "./tool-elicitation";

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
 * Build a JSON schema for MCP elicitation requests based on a tool's elicitation steps.
 * Currently tailored for createIndex, with a generic fallback for other tools if needed.
 */
function buildSchemaFromElicitationSteps(toolName: string, steps?: any[]) {
  if (toolName === "createIndex") {
    return {
      type: "object",
      properties: {
        creationMode: {
          type: "string",
          title: "Creation Mode",
          description: "Choose how to create the index",
          enum: ["Use a template", "Clone existing index", "Custom definition"]
        },
        template: {
          type: "string",
          title: "Template",
          description: "Template to use when creating the index",
          enum: ["documentSearch", "productCatalog", "hybridSearch", "knowledgeBase"]
        },
        indexName: {
          type: "string",
          title: "Index name",
          description: "Lowercase letters, numbers, hyphens; must start with a letter; max 128 chars",
          pattern: "^[a-z][a-z0-9-]*$",
          maxLength: 128
        },
        language: {
          type: "string",
          title: "Language",
          description: "Primary language of your content",
          enum: ["english", "spanish", "french", "german", "japanese", "chinese", "other"],
          default: "english"
        },
        vectorDimensions: {
          type: "number",
          title: "Vector dimensions (hybrid search)",
          description: "Common: 1536 for OpenAI/Azure OpenAI embeddings",
          minimum: 1,
          maximum: 4096,
          default: 1536
        },
        cloneFrom: {
          type: "string",
          title: "Clone from index",
          description: "Name of an existing index to clone"
        }
      },
      required: ["creationMode"]
    };
  }

  // Generic fallback: map steps to anonymous properties
  const properties: Record<string, any> = {};
  const required: string[] = [];
  (steps || []).forEach((s: any, i: number) => {
    const key = `step_${i + 1}`;
    const prop: any = { title: s?.prompt || `Step ${i + 1}` };
    switch (s?.type) {
      case "choice":
        prop.type = "string";
        if (Array.isArray(s.options)) prop.enum = s.options;
        break;
      case "text":
        prop.type = "string";
        break;
      case "number":
        prop.type = "number";
        if (typeof s.default !== "undefined") prop.default = s.default;
        break;
      case "boolean":
      case "confirm":
        prop.type = "boolean";
        if (typeof s.default !== "undefined") prop.default = s.default;
        break;
      default:
        prop.type = "string";
    }
    if (s?.helpText) prop.description = s.helpText;
    properties[key] = prop;
    if (typeof s?.default === "undefined") required.push(key);
  });

  return { type: "object", properties, required };
}

/**
 * Register Index management tools on the provided MCP server.
 * Tools:
 *  - listIndexes, getIndex, getIndexStats, deleteIndex
 *  - createIndex, createOrUpdateIndex
 */
export function registerIndexTools(server: any, context: ToolContext) {
  const { getClient, getSummarizer } = context;
  // ---------------- INDEX MANAGEMENT ----------------
  server.tool(
    "listIndexes",
    "List all index names with basic metadata.",
    {
      includeStats: z.boolean().optional().describe("Include document count and storage size for each index"),
      verbose: z.boolean().optional().describe("Include full index definitions (fields, analyzers, etc.)")
    },
    async ({ includeStats, verbose }: any) => {
      try {
        const client = getClient();
        const indexes = await client.listIndexes();

        if (verbose) {
          return await formatResponse({ indexes, count: indexes.length }, { summarizer: getSummarizer?.() || undefined });
        }

        let indexInfo = indexes.map((idx: any) => ({
          name: idx.name,
          fields: idx.fields?.length || 0,
          ...(idx.defaultScoringProfile && { defaultScoringProfile: idx.defaultScoringProfile }),
          ...(idx.corsOptions && { corsEnabled: true }),
          ...(idx.semantic && { semanticSearchEnabled: true }),
          ...(idx.vectorSearch && { vectorSearchEnabled: true })
        }));

        if (includeStats) {
          indexInfo = await Promise.all(
            indexInfo.map(async (info: any) => {
              try {
                const stats: any = await client.getIndexStats(info.name);
                return {
                  ...info,
                  documentCount: stats.documentCount || 0,
                  storageSize: stats.storageSize || 0
                };
              } catch {
                return info;
              }
            })
          );
        }

        return await formatResponse({ indexes: indexInfo, count: indexInfo.length }, { summarizer: getSummarizer?.() || undefined });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "listIndexes" });
        return await formatResponse(insight, { summarizer: getSummarizer?.() || undefined });
      }
    }
  );

  server.tool(
    "getIndex",
    "Fetch full index definition.",
    { indexName: z.string() },
    async ({ indexName }: any) => {
      try {
        const client = getClient();
        const idx = await client.getIndex(indexName);
        return await formatResponse(idx, { summarizer: getSummarizer?.() || undefined });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "getIndex", indexName });
        return await formatResponse(insight, { summarizer: getSummarizer?.() || undefined });
      }
    }
  );

  server.tool(
    "getIndexStats",
    "Get document count and storage usage.",
    { indexName: z.string() },
    async ({ indexName }: any) => {
      try {
        const client = getClient();
        const stats = await client.getIndexStats(indexName);
        return await formatResponse(stats, { summarizer: getSummarizer?.() || undefined });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "getIndexStats", indexName });
        return await formatResponse(insight, { summarizer: getSummarizer?.() || undefined });
      }
    }
  );

  server.tool(
    "deleteIndex",
    "⚠️ DESTRUCTIVE: Permanently delete an index and all its documents. This action cannot be undone. Please confirm carefully before proceeding.",
    { indexName: z.string() },
    async ({ indexName }: any) => {
      try {
        const client = getClient();
        await client.deleteIndex(indexName);
        return await formatResponse({ success: true, message: `Index ${indexName} deleted` }, { summarizer: getSummarizer?.() || undefined });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "deleteIndex", indexName });
        return await formatResponse(insight, { summarizer: getSummarizer?.() || undefined });
      }
    }
  );

  server.tool(
    "createIndex",
    "Create a new search index. Choose from templates (document search, product catalog, hybrid search, knowledge base) or provide custom definition. Supports cloning existing indexes and automatic language configuration.",
    {
      template: z
        .enum(["custom", "documentSearch", "productCatalog", "hybridSearch", "knowledgeBase"])
        .optional()
        .describe("Use a pre-built template for common scenarios"),
      indexName: z
        .string()
        .optional()
        .describe("Index name (lowercase letters, numbers, hyphens only, max 128 chars)"),
      cloneFrom: z
        .string()
        .optional()
        .describe("Clone structure from an existing index (copies schema but not data)"),
      vectorDimensions: z.number().optional().describe("Vector dimensions for hybrid search template (default: 1536)"),
      language: z
        .string()
        .optional()
        .describe(
          "Language for text analysis: english, spanish, french, german, italian, portuguese, japanese, chinese, korean, arabic, etc."
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
          vectorSearch: z.any().optional()
        })
        .optional()
        .describe("Custom index definition (required if template is 'custom' or not specified)")
    },
    async ({ template, indexName, cloneFrom, vectorDimensions, language, validate, indexDefinition }: any) => {
      try {
        const client = getClient();

        // Local mutable copies of parameters for elicitation updates
        let __template = template;
        let __indexName = indexName;
        let __cloneFrom = cloneFrom;
        let __vectorDimensions = vectorDimensions;
        let __language = language;
        let __validate = validate;
        let __indexDefinition = indexDefinition;

        // If not enough info provided, attempt an elicitation flow when supported
        if (!__template && !__cloneFrom && !__indexDefinition && server?.server?.elicitInput) {
          try {
            const elicitation = generateParameterElicitation("createIndex");
            if (elicitation) {
              const requestedSchema = buildSchemaFromElicitationSteps("createIndex", elicitation.steps);
              const elicited = await server.server.elicitInput({
                message: elicitation.description,
                requestedSchema
              });

              // Normalize elicitation response shape
              const answers: any = (elicited as any)?.content ?? (elicited as any)?.data ?? elicited ?? {};
              const mode = answers.creationMode || "Use a template";

              if (mode === "Use a template") {
                __template = answers.template;
                __indexName = answers.indexName;
                __language = (answers.language || __language || "").toString().toLowerCase();
                if (answers.vectorDimensions !== undefined) {
                  __vectorDimensions = Number(answers.vectorDimensions);
                }
              } else if (mode === "Clone existing index") {
                __cloneFrom = answers.cloneFrom;
                __indexName = answers.indexName || (__cloneFrom ? `${__cloneFrom}-copy` : __indexName);
              }
              // For "Custom definition", we still require indexDefinition; existing validation below will handle it
            }
          } catch {
            // If elicitation fails or client doesn't support it, continue with provided parameters
          }
        }

        let finalDefinition: any;

        if (__cloneFrom) {
          const sourceIndex = await client.getIndex(__cloneFrom);
          finalDefinition = { ...(sourceIndex as any) };
          finalDefinition.name = __indexName || `${__cloneFrom}-copy`;
          delete finalDefinition["@odata.etag"];
          delete finalDefinition["@odata.context"];
        } else if (__template && __template !== "custom") {
          if (!__indexName) {
            throw new Error("indexName is required when using a template");
          }

          let builder: IndexBuilder;
          switch (__template) {
            case "documentSearch":
              builder = IndexTemplates.documentSearch(__indexName);
              break;
            case "productCatalog":
              builder = IndexTemplates.productCatalog(__indexName);
              break;
            case "hybridSearch":
              builder = IndexTemplates.hybridSearch(__indexName, __vectorDimensions || 1536);
              break;
            case "knowledgeBase":
              builder = IndexTemplates.knowledgeBase(__indexName);
              break;
            default:
              throw new Error(`Unknown template: ${__template}`);
          }

          // Apply language analyzer if specified
          if (__language) {
            // Apply to all text fields via builder helper
            builder.applyLanguageToAllText(__language);
            // Fallback legacy behavior if needed:
            const analyzer = resolveAnalyzerForLanguage(__language);
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
          if (!__indexDefinition) {
            throw new Error("indexDefinition is required when not using a template");
          }
          finalDefinition = __indexDefinition;
        }

        if (__validate) {
          const errors = validateIndexDefinition(finalDefinition);
          if (errors.length > 0) {
            throw new Error(`Validation failed:\n${errors.join("\n")}`);
          }
        }

        const result = await client.createIndex(finalDefinition);
        return await formatResponse(result, { summarizer: getSummarizer?.() || undefined });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "createIndex" });
        return await formatResponse(insight, { summarizer: getSummarizer?.() || undefined });
      }
    }
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
            analyzer: z.string().optional()
          })
        )
        .optional()
        .describe("Fields to add to existing index"),
      updateSemanticConfig: z
        .object({
          titleField: z.string(),
          contentFields: z.array(z.string()),
          keywordFields: z.array(z.string()).optional()
        })
        .optional()
        .describe("Update semantic search configuration"),
      validate: z.boolean().optional().default(true),
      mergeWithExisting: z
        .boolean()
        .optional()
        .default(true)
        .describe("Merge with existing definition or replace"),
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
          "@odata.etag": z.string().optional()
        })
        .optional()
    },
    async ({ indexName, addFields, updateSemanticConfig, validate, mergeWithExisting, indexDefinition }: any) => {
      try {
        const client = getClient();
        let finalDefinition: any;

        if (mergeWithExisting || addFields || updateSemanticConfig) {
          const existingIndex: any = await client.getIndex(indexName);
          finalDefinition = { ...(existingIndex as any) };

          if (addFields && Array.isArray(addFields)) {
            const existingNames = new Set(finalDefinition.fields.map((f: any) => f.name));
            for (const nf of addFields) {
              if (!existingNames.has(nf.name)) {
                finalDefinition.fields.push({
                  ...nf,
                  retrievable: true,
                  stored: true
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
                      prioritizedKeywordsFields: updateSemanticConfig.keywordFields.map((f: string) => ({ fieldName: f }))
                    })
                  }
                }
              ]
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

        if (validate) {
          // Prevent removals if indexDefinition provided (compat rule)
          if (indexDefinition?.fields) {
            const existingIndex: any = await client.getIndex(indexName).catch(() => null);
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

        const result = await client.createOrUpdateIndex(indexName, finalDefinition);
        return await formatResponse(result, { summarizer: getSummarizer?.() || undefined });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "createOrUpdateIndex", indexName });
        return await formatResponse(insight, { summarizer: getSummarizer?.() || undefined });
      }
    }
  );
}