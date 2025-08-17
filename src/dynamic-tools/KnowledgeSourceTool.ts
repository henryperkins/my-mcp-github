// src/dynamic-tools/KnowledgeSourceTool.ts
import { z } from "zod";
import { DynamicTool, OperationDefinition } from "./base/DynamicTool";
import type { ToolContext } from "../types";

export class KnowledgeSourceTool extends DynamicTool {
  static readonly toolName = "KnowledgeSourceOperations";
  static readonly description = "Manage Azure Search knowledge sources for ingesting data from various sources including Azure Blob Storage and web content.";

  static readonly operations: Record<string, OperationDefinition> = {
    list: {
      description: "List all knowledge sources in the search service",
      category: 'read',
      params: z.object({
        type: z.enum(["searchIndex", "azureBlob", "web"]).optional()
          .describe("Filter by source type"),
        verbose: z.boolean().optional()
          .describe("Include full source definitions")
      }),
      examples: [
        {},
        { type: "azureBlob" },
        { verbose: true }
      ],
      handler: async (client, params, context, helpers) => {
        let sources = await helpers.withTimeout(
          client.listKnowledgeSources(),
          undefined,
          "listKnowledgeSources"
        ) as Array<any>;

        // Filter by type if specified
        if (params.type) {
          sources = sources.filter((s: any) => s.kind === params.type);
        }

        if (params.verbose) {
          return { sources, count: sources.length };
        }

        // Return simplified list
        const simplified = sources.map(source => ({
          name: source.name,
          kind: source.kind,
          description: source.description,
          hasSchedule: !!(source.azureBlobParameters?.ingestionSchedule ||
                         source.webParameters?.freshness)
        }));

        return { sources: simplified, count: sources.length };
      }
    },

    get: {
      description: "Get a specific knowledge source definition",
      category: 'read',
      params: z.object({
        sourceName: z.string()
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
          .max(128)
          .describe("The name of the source to retrieve")
      }),
      examples: [
        { sourceName: "product-docs-blob" }
      ],
      handler: async (client, params, context, helpers) => {
        return await helpers.withTimeout(
          client.getKnowledgeSource(params.sourceName),
          undefined,
          `getKnowledgeSource:${params.sourceName}`
        );
      }
    },

    create: {
      description: "Create a new knowledge source",
      category: 'write',
      params: z.object({
        sourceName: z.string()
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
          .max(128)
          .describe("Name of the source to create"),
        sourceDefinition: z.object({
          name: z.string()
            .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
            .max(128),
          kind: z.enum(["searchIndex", "azureBlob", "web"]),
          description: z.string().optional(),
          searchIndexParameters: z.object({
            searchIndexName: z.string(),
            sourceDataSelect: z.string().optional()
          }).optional(),
          azureBlobParameters: z.object({
            containerName: z.string(),
            connectionString: z.string().optional(),
            folderPath: z.string().optional(),
            disableImageVerbalization: z.boolean().optional(),
            ingestionSchedule: z.object({
              interval: z.string(),
              startTime: z.string().optional()
            }).optional(),
            chatCompletionModel: z.any().optional(),
            embeddingModel: z.any().optional(),
            identity: z.any().optional()
          }).optional(),
          webParameters: z.object({
            allowedDomains: z.array(z.object({
              address: z.string(),
              includeSubpages: z.boolean().optional(),
              rankingAdjustment: z.enum(["boost", "superBoost", "demote"]).optional()
            })).optional(),
            blockedDomains: z.array(z.object({
              address: z.string(),
              includeSubpages: z.boolean().optional()
            })).optional(),
            bingResourceId: z.string().optional(),
            language: z.string().optional(),
            market: z.string().optional(),
            freshness: z.string().optional(),
            identity: z.any().optional()
          }).optional(),
          encryptionKey: z.any().optional()
        }),
        validate: z.boolean().optional().default(true)
      }),
      examples: [
        {
          sourceName: "docs-blob",
          sourceDefinition: {
            name: "docs-blob",
            kind: "azureBlob",
            description: "Documentation from Azure Blob Storage",
            azureBlobParameters: {
              containerName: "documents",
              folderPath: "/docs"
            }
          }
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Validation
        if (params.validate) {
          const def = params.sourceDefinition;
          if (def.kind === "searchIndex" && !def.searchIndexParameters?.searchIndexName) {
            throw new Error("Search index name is required for searchIndex source");
          }
          if (def.kind === "azureBlob" && !def.azureBlobParameters?.containerName) {
            throw new Error("Container name is required for azureBlob source");
          }
          if (def.kind === "web" && (!def.webParameters?.allowedDomains || def.webParameters.allowedDomains.length === 0)) {
            throw new Error("At least one allowed domain is required for web source");
          }
        }

        // Ensure name matches
        params.sourceDefinition.name = params.sourceName;

        const created = await helpers.withTimeout(
          client.createKnowledgeSource(params.sourceDefinition),
          undefined,
          "createKnowledgeSource"
        );

        helpers.notify("tools/knowledge_source_created", {
          name: params.sourceName,
          kind: params.sourceDefinition.kind
        });

        return {
          success: true,
          message: `Knowledge source '${params.sourceName}' created successfully`,
          source: created
        };
      }
    },

    update: {
      description: "Update an existing knowledge source",
      category: 'write',
      params: z.object({
        sourceName: z.string()
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
          .max(128)
          .describe("Name of the source"),
        sourceDefinition: z.object({
          name: z.string(),
          kind: z.enum(["searchIndex", "azureBlob", "web"]),
          description: z.string().optional(),
          searchIndexParameters: z.any().optional(),
          azureBlobParameters: z.any().optional(),
          webParameters: z.any().optional(),
          encryptionKey: z.any().optional(),
          "@odata.etag": z.string().optional()
        }),
        ifMatch: z.string().optional(),
        ifNoneMatch: z.string().optional(),
        validate: z.boolean().optional().default(true)
      }),
      examples: [
        {
          sourceName: "docs-blob",
          sourceDefinition: {
            name: "docs-blob",
            kind: "azureBlob",
            description: "Updated documentation source"
          }
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Ensure name matches
        params.sourceDefinition.name = params.sourceName;

        // Remove ETag from body
        const cleanDefinition = { ...params.sourceDefinition };
        delete cleanDefinition["@odata.etag"];

        const updated = await helpers.withTimeout(
          client.createOrUpdateKnowledgeSource(params.sourceName, cleanDefinition),
          undefined,
          "updateKnowledgeSource"
        );

        helpers.notify("tools/knowledge_source_updated", {
          name: params.sourceName
        });

        return {
          success: true,
          message: `Knowledge source '${params.sourceName}' updated successfully`,
          source: updated
        };
      }
    },

    delete: {
      description: "Delete a knowledge source permanently",
      category: 'delete',
      requiresConfirmation: true,
      params: z.object({
        sourceName: z.string()
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
          .max(128)
          .describe("The name of the source to delete"),
        confirmation: z.literal("DELETE").optional()
          .describe("Type 'DELETE' to confirm deletion")
      }),
      examples: [
        { sourceName: "old-source", confirmation: "DELETE" }
      ],
      handler: async (client, params, context, helpers) => {
        // Elicit confirmation if not provided
        if (params.confirmation !== "DELETE") {
          const response = await helpers.elicit({
            message: `⚠️ This will permanently delete knowledge source '${params.sourceName}'. Type 'DELETE' to confirm.`,
            inputType: 'confirm'
          });

          if (response?.text !== "DELETE") {
            throw new Error("Delete operation cancelled");
          }
        }

        await helpers.withTimeout(
          client.deleteKnowledgeSource(params.sourceName),
          undefined,
          `deleteKnowledgeSource:${params.sourceName}`
        );

        helpers.notify("tools/knowledge_source_deleted", {
          name: params.sourceName,
          timestamp: new Date().toISOString()
        });

        return {
          success: true,
          message: `Knowledge source '${params.sourceName}' deleted`
        };
      }
    },

    createBlob: {
      description: "Create an Azure Blob Storage knowledge source with guided setup",
      category: 'write',
      params: z.object({
        sourceName: z.string()
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
          .max(128)
          .describe("Name of the source to create"),
        storageAccount: z.string().describe("Azure Storage account name"),
        containerName: z.string().describe("Blob container name"),
        accountKey: z.string().optional().describe("Storage account key"),
        connectionString: z.string().optional()
          .describe("Full connection string (alternative to accountKey)"),
        folderPath: z.string().optional()
          .describe("Specific folder path within container"),
        fileExtensions: z.array(z.string()).optional()
          .describe("File extensions to include (e.g., ['.pdf', '.docx'])"),
        freshness: z.string().optional()
          .describe("Web results freshness (applicable to web sources; e.g., 'day', 'week')"),
        targetIndexName: z.string().optional()
          .describe("Target search index for ingested data")
      }),
      examples: [
        {
          sourceName: "documentation",
          storageAccount: "mystorageaccount",
          containerName: "docs",
          folderPath: "/product-docs",
          fileExtensions: [".pdf", ".docx", ".md"],
          schedule: "PT4H"
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Build connection string if needed
        let connectionString = params.connectionString;
        if (!connectionString && params.accountKey) {
          connectionString = `DefaultEndpointsProtocol=https;AccountName=${params.storageAccount};AccountKey=${params.accountKey};EndpointSuffix=core.windows.net`;
        }

        // Elicit connection info if missing
        if (!connectionString) {
          const response = await helpers.elicit({
            message: "Please provide either a connection string or account key for the storage account",
            inputType: 'text'
          });

          if (!response?.text) {
            throw new Error("Connection information is required");
          }

          // Check if it looks like a connection string or account key
          if (response.text.includes("DefaultEndpointsProtocol")) {
            connectionString = response.text;
          } else {
            connectionString = `DefaultEndpointsProtocol=https;AccountName=${params.storageAccount};AccountKey=${response.text};EndpointSuffix=core.windows.net`;
          }
        }

        const sourceDefinition: any = {
          name: params.sourceName,
          kind: "azureBlob",
          description: `Azure Blob source for ${params.containerName}`,
          azureBlobParameters: {
            containerName: params.containerName,
            connectionString,
            folderPath: params.folderPath
          }
        };

        // Add ingestion schedule if provided (applies to blob sources)
        if (params.freshness) {
          // Note: 'freshness' is applicable to web sources. For blob ingestion, the schedule uses interval.
          sourceDefinition.azureBlobParameters.ingestionSchedule = {
            interval: params.freshness
          };
        }

        const created = await helpers.withTimeout(
          client.createKnowledgeSource(sourceDefinition),
          undefined,
          "createBlobKnowledgeSource"
        );

        helpers.notify("tools/blob_knowledge_source_created", {
          name: params.sourceName,
          container: params.containerName,
          schedule: params.freshness
        });

        return {
          success: true,
          message: `Azure Blob knowledge source '${params.sourceName}' created successfully`,
          source: created,
          connectionInfo: {
            storageAccount: params.storageAccount,
            container: params.containerName,
            folder: params.folderPath
          }
        };
      }
    },

    createWeb: {
      description: "Create a web crawling knowledge source with guided setup",
      category: 'write',
      params: z.object({
        sourceName: z.string()
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
          .max(128)
          .describe("Name of the source to create"),
        urls: z.array(z.string().url())
          .describe("Starting URLs to crawl"),
        crawlDepth: z.number().int().min(0).max(10).optional().default(2)
          .describe("Maximum crawl depth"),
        includeSubdomains: z.boolean().optional()
          .describe("Include subdomains in crawl"),
        excludePatterns: z.array(z.string()).optional()
          .describe("URL patterns to exclude"),
        freshness: z.string().optional()
          .describe("Freshness of web results (e.g., 'day', 'week', 'month')"),
        targetIndexName: z.string().optional()
          .describe("Target search index for ingested data")
      }),
      examples: [
        {
          sourceName: "company-website",
          urls: ["https://example.com"],
          crawlDepth: 3,
          includeSubdomains: true,
          excludePatterns: ["/admin/*", "/api/*"],
          schedule: "P1D"
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Build allowed domains from URLs
        const allowedDomains = params.urls.map((url: string) => {
          const domain = new URL(url).hostname;
          return {
            address: url,
            includeSubpages: true
          };
        });

        // Add subdomains if requested
        if (params.includeSubdomains) {
          params.urls.forEach((url: string) => {
            const domain = new URL(url).hostname;
            allowedDomains.push({
              address: `https://*.${domain}`,
              includeSubpages: true
            });
          });
        }

        // Build blocked domains from exclude patterns
        const blockedDomains = params.excludePatterns?.map((pattern: string) => ({
          address: pattern,
          includeSubpages: true
        })) || [];

        const sourceDefinition: any = {
          name: params.sourceName,
          kind: "web",
          description: `Web crawler for ${params.urls.join(", ")}`,
          webParameters: {
            allowedDomains,
            blockedDomains
          }
        };

        // Add freshness if provided
        if (params.freshness) {
          sourceDefinition.webParameters.freshness = params.freshness;
        }

        const created = await helpers.withTimeout(
          client.createKnowledgeSource(sourceDefinition),
          undefined,
          "createWebKnowledgeSource"
        );

        helpers.notify("tools/web_knowledge_source_created", {
          name: params.sourceName,
          urlCount: params.urls.length,
          crawlDepth: params.crawlDepth,
          crawlDepth: params.crawlDepth
        });

        return {
          success: true,
          message: `Web knowledge source '${params.sourceName}' created successfully`,
          source: created,
          crawlInfo: {
            startingUrls: params.urls,
            depth: params.crawlDepth,
            includeSubdomains: params.includeSubdomains
          }
        };
      }
    }
  };

  // Resource definitions
  protected static resources = [
    {
      uri: "knowledge-sources://list",
      description: "List of all knowledge sources with their configuration",
      handler: async (context: ToolContext) => {
        const client = context.getClient();
        const sources = await client.listKnowledgeSources() as Array<any>;

        const categorized = {
          searchIndex: [],
          azureBlob: [],
          web: [],
          total: sources.length
        } as any;

        for (const source of sources) {
          const summary = {
            name: source.name,
            description: source.description,
            hasSchedule: false,
            details: {} as any
          };

          if (source.kind === "searchIndex") {
            summary.details.indexName = source.searchIndexParameters?.searchIndexName;
            categorized.searchIndex.push(summary);
          } else if (source.kind === "azureBlob") {
            summary.details.container = source.azureBlobParameters?.containerName;
            summary.details.folder = source.azureBlobParameters?.folderPath;
            summary.hasSchedule = !!source.azureBlobParameters?.ingestionSchedule;
            categorized.azureBlob.push(summary);
          } else if (source.kind === "web") {
            summary.details.domainCount = source.webParameters?.allowedDomains?.length || 0;
            summary.hasSchedule = !!source.webParameters?.freshness;
            categorized.web.push(summary);
          }
        }

        return categorized;
      }
    }
  ];

  // Prompt definitions
  protected static prompts = [
    {
      name: "setup_knowledge_source",
      description: "Interactive setup for knowledge source ingestion",
      params: z.object({
        sourceType: z.enum(["documents", "website", "database"]),
        updateFrequency: z.enum(["realtime", "hourly", "daily", "weekly", "manual"]),
        dataVolume: z.enum(["small", "medium", "large"])
      }),
      handler: async (params: any, context: ToolContext) => {
        const config = KnowledgeSourceTool.recommendSourceConfig(
          params.sourceType,
          params.updateFrequency,
          params.dataVolume
        );

        return {
          messages: [
            {
              role: "assistant" as const,
              content: {
                type: "text" as const,
                text: `Recommended knowledge source configuration:\n\n${config.explanation}\n\nConfiguration:\n${JSON.stringify(config.params, null, 2)}`
              }
            }
          ]
        };
      }
    }
  ];

  // Helper methods
  private static recommendSourceConfig(
    sourceType: string,
    updateFrequency: string,
    dataVolume: string
  ): any {
    const params: any = {
      operation: sourceType === "website" ? "createWeb" : "createBlob",
      params: {}
    };

    let explanation = "";

    // Source type specific config
    if (sourceType === "documents") {
      params.params.containerName = "documents";
      params.params.fileExtensions = [".pdf", ".docx", ".txt", ".md"];
      explanation = "Azure Blob Storage source configured for document ingestion. ";
    } else if (sourceType === "website") {
      params.params.crawlDepth = dataVolume === "large" ? 5 : 3;
      params.params.includeSubdomains = true;
      explanation = "Web crawler configured for website content. ";
    } else if (sourceType === "database") {
      params.operation = "create";
      params.params.kind = "searchIndex";
      explanation = "Search index source for database synchronization. ";
    }

    // Schedule based on frequency
    switch (updateFrequency) {
      case "realtime":
        params.params.schedule = "PT15M";
        explanation += "Near real-time updates every 15 minutes.";
        break;
      case "hourly":
        params.params.schedule = "PT1H";
        explanation += "Hourly refresh schedule.";
        break;
      case "daily":
        params.params.schedule = "P1D";
        explanation += "Daily updates for stable content.";
        break;
      case "weekly":
        params.params.schedule = "P7D";
        explanation += "Weekly refresh cycle.";
        break;
      case "manual":
        explanation += "Manual refresh only (no schedule).";
        break;
    }

    // Volume-based optimizations
    if (dataVolume === "large") {
      explanation += " Optimized for large data volumes with batch processing.";
    }

    return { params, explanation };
  }
}
