// src/dynamic-tools/ServiceTool.ts
import { z } from "zod";
import { DynamicTool, OperationDefinition } from "./base/DynamicTool";
import type { ToolContext } from "../types";

export class ServiceTool extends DynamicTool {
  static readonly toolName = "ServiceUtilities";
  static readonly description = "Service utilities for Azure Search. USAGE: Call with {'operation': '<op>', 'params': {...}}. Operations: serviceStats, analyzeText, listSynonymMaps, getSynonymMap, createOrUpdateSynonymMap, deleteSynonymMap.";

  static readonly operations: Record<string, OperationDefinition> = {
    // Service Statistics
    serviceStats: {
      description: "Get service-level statistics including counters, quotas, and resource usage",
      category: 'read',
      params: z.object({}),
      examples: [],
      handler: async (client, params, context, helpers) => {
        return await helpers.withTimeout(
          client.getServiceStatistics(),
          undefined,
          "getServiceStatistics"
        );
      }
    },

    indexStatsSummary: { 
      description: "Get aggregate statistics for all indexes in the service",
      category: 'read',
      params: z.object({}),
      examples: [],
      handler: async (client, params, context, helpers) => {
        const indexes = await helpers.withTimeout(
          client.listIndexes(),
          undefined,
          "listIndexes"
        ) as Array<any>;

        const statsPromises = indexes.map(async (index: any) => {
          try {
            const stats = await helpers.withTimeout(
              client.getIndexStats(index.name),
              5000,
              `getIndexStats:${index.name}`
            );
            return {
              name: index.name,
              documentCount: (stats as any).documentCount || 0,
              storageSize: (stats as any).storageSize || 0
            };
          } catch {
            return {
              name: index.name,
              documentCount: 0,
              storageSize: 0,
              error: "Unable to retrieve stats"
            };
          }
        });

        const indexStats = await Promise.all(statsPromises);
        const totalDocuments = indexStats.reduce((sum, idx) => sum + idx.documentCount, 0);
        const totalStorage = indexStats.reduce((sum, idx) => sum + idx.storageSize, 0);

        return {
          indexCount: indexes.length,
          totalDocuments,
          totalStorage,
          averageDocumentsPerIndex: indexes.length > 0 ? Math.round(totalDocuments / indexes.length) : 0,
          indexes: indexStats
        };
      }
    },

    // Text Analysis
    analyzeText: {
      description: "Test how text is tokenized and processed by analyzers",
      category: 'analyze',
      params: z.object({
        indexName: z.string().describe("Name of the index to test the analyzer against"),
        text: z.string().describe("Text to analyze"),
        analyzer: z.string().optional()
          .describe("Analyzer name (e.g., 'standard.lucene', 'en.microsoft', 'whitespace')"),
        tokenizer: z.string().optional()
          .describe("Tokenizer name (alternative to analyzer)"),
        tokenFilters: z.array(z.string()).optional()
          .describe("Token filters to apply"),
        charFilters: z.array(z.string()).optional()
          .describe("Character filters to apply")
      }),
      examples: [
        {
          indexName: "products",
          text: "The quick brown fox jumps over the lazy dog",
          analyzer: "en.microsoft"
        },
        {
          indexName: "documents",
          text: "user@example.com visited https://example.com",
          tokenizer: "whitespace"
        }
      ],
      handler: async (client, params, context, helpers) => {
        const analyzeRequest: any = {
          text: params.text
        };

        if (params.analyzer) {
          analyzeRequest.analyzer = params.analyzer;
        } else if (params.tokenizer) {
          analyzeRequest.tokenizer = params.tokenizer;
          if (params.tokenFilters) {
            analyzeRequest.tokenFilters = params.tokenFilters;
          }
          if (params.charFilters) {
            analyzeRequest.charFilters = params.charFilters;
          }
        } else {
          analyzeRequest.analyzer = "standard.lucene"; // Default
        }

        const result = await helpers.withTimeout(
          client.analyzeText(params.indexName, analyzeRequest),
          undefined,
          "analyzeText"
        );

        return {
          analyzer: params.analyzer || params.tokenizer || "standard.lucene",
          originalText: params.text,
          tokens: result,
          tokenCount: Array.isArray(result) ? result.length : (result as any).tokens?.length || 0
        };
      }
    },

    // Synonym Map Operations
    listSynonymMaps: {
      description: "List all synonym map names",
      category: 'read',
      params: z.object({}),
      examples: [],
      handler: async (client, params, context, helpers) => {
        const synonymMaps = await helpers.withTimeout(
          client.listSynonymMaps(),
          undefined,
          "listSynonymMaps"
        ) as Array<any>;

        const names = synonymMaps.map((sm) => sm.name || "").filter(Boolean);
        return { synonymMaps: names, count: names.length };
      }
    },

    getSynonymMap: {
      description: "Get a synonym map definition",
      category: 'read',
      params: z.object({
        name: z.string().describe("Synonym map name")
      }),
      examples: [
        { name: "product-synonyms" }
      ],
      handler: async (client, params, context, helpers) => {
        const synonymMap = await helpers.withTimeout(
          client.getSynonymMap(params.name),
          undefined,
          `getSynonymMap:${params.name}`
        ) as any;

        // Format synonyms for better readability
        if (synonymMap && typeof synonymMap.synonyms === "string") {
          const formatted = {
            ...synonymMap,
            synonymsFormatted: synonymMap.synonyms.split("\n").filter((line: string) => line.trim()),
            synonymsRaw: synonymMap.synonyms
          };
          formatted.synonyms = formatted.synonymsFormatted;
          return formatted;
        }

        return synonymMap;
      }
    },

    createOrUpdateSynonymMap: {
      description: "Create or update a synonym map for search relevance",
      category: 'write',
      params: z.object({
        name: z.string().describe("Synonym map name"),
        synonymMapDefinition: z.object({
          name: z.string().min(1),
          synonyms: z.string().min(1)
            .describe("Synonym rules in Solr format (one per line)"),
          format: z.literal("solr").default("solr").optional(),
          encryptionKey: z.any().optional(),
          "@odata.etag": z.string().optional()
        }).describe("Synonym map definition with Solr-format rules")
      }),
      examples: [
        {
          name: "product-synonyms",
          synonymMapDefinition: {
            name: "product-synonyms",
            synonyms: "USA, United States, United States of America\niphone => apple phone\nlaptop, notebook"
          }
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Ensure format is set
        if (!params.synonymMapDefinition.format) {
          params.synonymMapDefinition.format = "solr";
        }

        // Ensure name matches
        params.synonymMapDefinition.name = params.name;

        const created = await helpers.withTimeout(
          client.createOrUpdateSynonymMap(params.name, params.synonymMapDefinition),
          undefined,
          "createOrUpdateSynonymMap"
        );

        helpers.notify("tools/synonym_map_updated", {
          name: params.name,
          ruleCount: params.synonymMapDefinition.synonyms.split("\n").filter((l: string) => l.trim()).length
        });

        // Emit MCP resource updates
        helpers.notifyResourceUpdated("synonymmaps");
        helpers.notifyResourceUpdated(`synonymmaps/${params.name}`);

        return {
          success: true,
          message: `Synonym map '${params.name}' created/updated successfully`,
          synonymMap: created
        };
      }
    },

    deleteSynonymMap: {
      description: "Delete a synonym map",
      category: 'delete',
      requiresConfirmation: true,
      params: z.object({
        name: z.string().describe("Synonym map name to delete"),
        confirmation: z.literal("DELETE").optional()
          .describe("Type 'DELETE' to confirm")
      }),
      examples: [
        { name: "old-synonyms", confirmation: "DELETE" }
      ],
      handler: async (client, params, context, helpers) => {
        // Elicit confirmation if not provided
        if (params.confirmation !== "DELETE") {
          const response = await helpers.elicit({
            message: `⚠️ This will delete synonym map '${params.name}'. Type 'DELETE' to confirm.`,
            inputType: 'text',
            validation: (input: string) => input === "DELETE" ? null : "Please type 'DELETE' to confirm",
            timeout: 10000
          });

          if (response?.text !== "DELETE") {
            throw new Error("Delete operation cancelled");
          }
        }

        await helpers.withTimeout(
          client.deleteSynonymMap(params.name),
          undefined,
          `deleteSynonymMap:${params.name}`
        );

        helpers.notify("tools/synonym_map_deleted", {
          name: params.name,
          timestamp: new Date().toISOString()
        });

        // Emit MCP resource updates
        helpers.notifyResourceUpdated("synonymmaps");
        helpers.notifyResourceUpdated(`synonymmaps/${params.name}`);

        return {
          success: true,
          message: `Synonym map '${params.name}' deleted`
        };
      }
    },

    // Debug and Elicitation
    debugElicitation: {
      description: "Test elicitation capability and timing",
      category: 'analyze',
      params: z.object({
        performTest: z.boolean().default(false)
          .describe("If true, attempts a simple elicitation ping")
      }),
      examples: [
        { performTest: false },
        { performTest: true }
      ],
      handler: async (client, params, context, helpers) => {
        const capabilities: any = {
          elicitationSupported: typeof helpers.elicit === 'function',
          timestamp: new Date().toISOString(),
          environment: "Cloudflare Workers",
          mcp: {
            version: "1.0.0",
            transport: context.agent ? "SSE/HTTP" : "Unknown"
          }
        };

        if (params.performTest && capabilities.elicitationSupported) {
          try {
            const startTime = Date.now();
            const response = await helpers.elicit({
              message: "This is a test elicitation. Please type 'TEST' to confirm.",
              inputType: 'text',
              timeout: 5000
            });
            const elapsedMs = Date.now() - startTime;

            capabilities.testResult = {
              success: !!response,
              responseTime: elapsedMs,
              userInput: response?.text || null,
              message: response ? "Elicitation successful" : "No response received"
            };
          } catch (error: any) {
            capabilities.testResult = {
              success: false,
              error: error.message || "Elicitation test failed"
            };
          }
        }

        return capabilities;
      }
    }
  };

  // Resource definitions
  protected static resources = [
    {
      uri: "synonymmaps://list",
      description: "List of all synonym maps",
      handler: async (context: ToolContext) => {
        const client = context.getClient();
        const synonymMaps = await client.listSynonymMaps() as Array<any>;

        return {
          count: synonymMaps.length,
          synonymMaps: synonymMaps.map(sm => ({
            name: sm.name,
            format: sm.format || "solr",
            ruleCount: sm.synonyms ? sm.synonyms.split("\n").filter((l: any) => (l as string).trim()).length : 0
          }))
        };
      }
    },
    {
      uri: "service://stats",
      description: "Service-level statistics and limits",
      handler: async (context: ToolContext) => {
        const client = context.getClient();
        try {
          return await client.getServiceStatistics();
        } catch (error) {
          return {
            error: "Unable to retrieve service statistics",
            message: error instanceof Error ? error.message : "Unknown error"
          };
        }
      }
    }
  ];

  // Prompt definitions
  protected static prompts = [
    {
      name: "synonym_builder",
      description: "Interactive synonym map builder",
      params: z.object({
        domain: z.enum(["ecommerce", "medical", "legal", "technical", "general"]),
        language: z.string().default("english"),
        includeAbbreviations: z.boolean().default(true)
      }),
      handler: async (params: any, context: ToolContext) => {
        const synonyms = ServiceTool.generateSynonymExamples(
          params.domain,
          params.language,
          params.includeAbbreviations
        );

        return {
          messages: [
            {
              role: "assistant" as const,
              content: {
                type: "text" as const,
                text: `Generated synonym map for ${params.domain} domain:\n\n${synonyms.rules.join("\n")}\n\nUsage:\nCreate a synonym map with these rules to improve search relevance for ${params.domain} content.`
              }
            }
          ]
        };
      }
    },
    {
      name: "analyzer_selector",
      description: "Help choose the right text analyzer",
      params: z.object({
        contentLanguage: z.string().describe("Primary language of content"),
        contentType: z.enum(["general", "technical", "code", "email", "social"]),
        searchRequirements: z.string().describe("What search features do you need?")
      }),
      handler: async (params: any, context: ToolContext) => {
        const recommendation = ServiceTool.recommendAnalyzer(
          params.contentLanguage,
          params.contentType,
          params.searchRequirements
        );

        return {
          messages: [
            {
              role: "assistant" as const,
              content: {
                type: "text" as const,
                text: `Recommended analyzer configuration:\n\n${recommendation.explanation}\n\nAnalyzer: ${recommendation.analyzer}\n\nTest with: ServiceUtilities.analyzeText`
              }
            }
          ]
        };
      }
    }
  ];

  // Helper methods
  private static generateSynonymExamples(
    domain: string,
    language: string,
    includeAbbreviations: boolean
  ): any {
    const rules: string[] = [];

    switch (domain) {
      case "ecommerce":
        rules.push(
          "laptop, notebook, portable computer",
          "phone, smartphone, mobile, cell phone",
          "tv, television, smart tv",
          "headphones, earphones, earbuds",
          "buy, purchase, order",
          "cart, basket, bag",
          "discount, sale, offer, deal"
        );
        if (includeAbbreviations) {
          rules.push(
            "USB => Universal Serial Bus",
            "LED => Light Emitting Diode",
            "HD => High Definition"
          );
        }
        break;

      case "medical":
        rules.push(
          "doctor, physician, MD",
          "medicine, medication, drug",
          "hospital, medical center, clinic",
          "symptom, sign, indication",
          "treatment, therapy, care"
        );
        if (includeAbbreviations) {
          rules.push(
            "BP => blood pressure",
            "HR => heart rate",
            "ER => emergency room"
          );
        }
        break;

      case "legal":
        rules.push(
          "lawyer, attorney, counsel",
          "contract, agreement, deal",
          "lawsuit, litigation, case",
          "court, tribunal, bench",
          "judge, magistrate, justice"
        );
        break;

      case "technical":
        rules.push(
          "bug, defect, issue, problem",
          "deploy, release, publish",
          "code, source, implementation",
          "test, verify, validate",
          "api, interface, endpoint"
        );
        if (includeAbbreviations) {
          rules.push(
            "CI/CD => continuous integration continuous deployment",
            "API => application programming interface",
            "UI => user interface"
          );
        }
        break;

      case "general":
      default:
        rules.push(
          "big, large, huge, enormous",
          "small, tiny, little, mini",
          "fast, quick, rapid, speedy",
          "slow, sluggish, gradual",
          "good, great, excellent, superb"
        );
        break;
    }

    // Add common language-specific synonyms
    if (language.toLowerCase() !== "english") {
      rules.push("# Add language-specific synonyms here");
    }

    return { rules };
  }

  private static recommendAnalyzer(
    language: string,
    contentType: string,
    requirements: string
  ): any {
    let analyzer = "standard.lucene";
    let explanation = "";

    // Language-specific analyzers
    const languageAnalyzers: Record<string, string> = {
      "english": "en.microsoft",
      "spanish": "es.microsoft",
      "french": "fr.microsoft",
      "german": "de.microsoft",
      "italian": "it.microsoft",
      "portuguese": "pt-BR.microsoft",
      "japanese": "ja.microsoft",
      "chinese": "zh-Hans.microsoft",
      "korean": "ko.microsoft",
      "arabic": "ar.microsoft"
    };

    if (languageAnalyzers[language.toLowerCase()]) {
      analyzer = languageAnalyzers[language.toLowerCase()];
      explanation = `Language-specific analyzer for ${language} with stemming and stop words. `;
    }

    // Content type adjustments
    switch (contentType) {
      case "technical":
      case "code":
        if (requirements.toLowerCase().includes("exact") ||
            requirements.toLowerCase().includes("case")) {
          analyzer = "keyword";
          explanation += "Keyword analyzer for exact matching (no tokenization). ";
        } else {
          analyzer = "whitespace";
          explanation += "Whitespace analyzer to preserve technical terms. ";
        }
        break;

      case "email":
        analyzer = "pattern";
        explanation += "Pattern analyzer to handle email addresses and URLs. ";
        break;

      case "social":
        if (language === "english") {
          analyzer = "en.microsoft";
          explanation += "Microsoft English analyzer handles informal text well. ";
        }
        break;
    }

    // Requirements-based adjustments
    if (requirements.toLowerCase().includes("phonetic")) {
      explanation += "\n\nConsider adding a phonetic token filter for fuzzy matching. ";
    }
    if (requirements.toLowerCase().includes("ngram")) {
      explanation += "\n\nConsider adding n-gram tokenizers for partial matching. ";
    }
    if (requirements.toLowerCase().includes("synonym")) {
      explanation += "\n\nAdd a synonym map to the field for query expansion. ";
    }

    return { analyzer, explanation };
  }
}
