// src/KnowledgeSourceTools.ts
import { z } from "zod";
import { ResponseFormatter } from "./utils/response";
import type { ToolContext } from "./types";
import { withTimeout } from "./utils/timeout";
import { DEFAULT_TIMEOUT_MS } from "./constants";

// Schemas for Knowledge Sources
const KnowledgeSourceNameSchema = z.string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/, "Source name must start with alphanumeric and contain only alphanumeric, hyphens, and underscores");

const KnowledgeSourceKindSchema = z.enum(["searchIndex", "azureBlob", "web"]);

// Search Index Knowledge Source Parameters
const SearchIndexParametersSchema = z.object({
  searchIndexName: z.string(),
  sourceDataSelect: z.string().optional()
});

// Azure Blob Knowledge Source Parameters
const AzureBlobParametersSchema = z.object({
  identity: z.any().optional(), // SearchIndexerDataIdentity
  connectionString: z.string().optional(),
  containerName: z.string(),
  folderPath: z.string().optional(),
  embeddingModel: z.any().optional(), // VectorSearchVectorizer
  chatCompletionModel: z.any().optional(), // KnowledgeAgentModel
  ingestionSchedule: z.object({
    interval: z.string(),
    startTime: z.string().optional()
  }).optional(),
  createdResources: z.record(z.string()).optional().describe("Resources created by the knowledge source"),
  disableImageVerbalization: z.boolean().optional()
});

// Web Knowledge Source Parameters
const WebParametersSchema = z.object({
  identity: z.any().optional(), // SearchIndexerDataIdentity
  bingResourceId: z.string().optional(),
  language: z.string().optional(),
  market: z.string().optional(),
  freshness: z.string().optional(),
  allowedDomains: z.array(z.object({
    address: z.string(),
    includeSubpages: z.boolean().optional(),
    rankingAdjustment: z.enum(["boost", "superBoost", "demote"]).optional()
  })).optional(),
  blockedDomains: z.array(z.object({
    address: z.string(),
    includeSubpages: z.boolean().optional()
  })).optional()
});

const KnowledgeSourceSchema = z.object({
  name: KnowledgeSourceNameSchema,
  description: z.string().optional(),
  kind: KnowledgeSourceKindSchema,
  searchIndexParameters: SearchIndexParametersSchema.optional(),
  azureBlobParameters: AzureBlobParametersSchema.optional(),
  webParameters: WebParametersSchema.optional(),
  "@odata.etag": z.string().optional(),
  encryptionKey: z.object({
    keyVaultKeyName: z.string(),
    keyVaultKeyVersion: z.string(),
    keyVaultUri: z.string().url(),
    accessCredentials: z.any().optional()
  }).optional()
});

/**
 * Register Knowledge Source management tools on the provided MCP server.
 * Tools:
 *  - listKnowledgeSources, getKnowledgeSource, deleteKnowledgeSource
 *  - createKnowledgeSource, createOrUpdateKnowledgeSource
 */
export function registerKnowledgeSourceTools(server: any, context: ToolContext) {
  const { getClient } = context;
  const rf = new ResponseFormatter(() => {
    const s = context.getSummarizer?.();
    if (!s) return null;
    return (text: string, maxTokens?: number) => s(text, maxTokens);
  });

  // List all knowledge sources
  server.tool(
    "listKnowledgeSources",
    "List all knowledge sources configured in the search service.",
    {
      verbose: z.boolean().optional().describe("Include full source definitions"),
      type: KnowledgeSourceKindSchema.optional().describe("Filter by source type")
    },
    async (args: any) => {
      try {
        const client = getClient();
        const result = await withTimeout(
          client.listKnowledgeSources(args.verbose, args.type),
          DEFAULT_TIMEOUT_MS
        );
        return rf.formatSuccess(result);
      } catch (error: any) {
        return rf.formatError(error, { tool: "listKnowledgeSources", verbose: args.verbose, type: args.type });
      }
    }
  );

  // Get a specific knowledge source
  server.tool(
    "getKnowledgeSource",
    "Get the definition of a specific knowledge source.",
    {
      sourceName: KnowledgeSourceNameSchema.describe("The name of the source to retrieve")
    },
    async (args: any) => {
      try {
        const client = getClient();
        const result = await withTimeout(
          client.getKnowledgeSource(args.sourceName),
          DEFAULT_TIMEOUT_MS
        );
        return rf.formatSuccess(result);
      } catch (error: any) {
        return rf.formatError(error, { tool: "getKnowledgeSource", sourceName: args.sourceName });
      }
    }
  );

  // Create a new knowledge source
  server.tool(
    "createKnowledgeSource",
    "Create a new knowledge source for ingesting data into search indexes.",
    {
      sourceName: KnowledgeSourceNameSchema.describe("Name of the source to create"),
      sourceDefinition: KnowledgeSourceSchema.describe("The source definition"),
      validate: z.boolean().optional().describe("Validate the source definition before creation")
    },
    async (args: any) => {
      try {
        // Ensure name consistency
        if (!args.sourceDefinition.name) {
          args.sourceDefinition.name = args.sourceName;
        } else if (args.sourceDefinition.name !== args.sourceName) {
          throw new Error(`Source name mismatch: ${args.sourceName} vs ${args.sourceDefinition.name}`);
        }

        // Validate if requested
        if (args.validate) {
          const errors = validateKnowledgeSource(args.sourceDefinition);
          if (errors.length > 0) {
            return rf.formatSuccess({
              success: false,
              errors,
              message: "Knowledge source validation failed"
            });
          }
        }

        const client = getClient();
        const result = await withTimeout(
          client.createKnowledgeSource(args.sourceDefinition),
          DEFAULT_TIMEOUT_MS
        );
        return rf.formatSuccess(result);
      } catch (error: any) {
        return rf.formatError(error, { tool: "createKnowledgeSource", sourceName: args.sourceName });
      }
    }
  );

  // Create or update a knowledge source
  server.tool(
    "createOrUpdateKnowledgeSource",
    "Create a new knowledge source or update an existing one.",
    {
      sourceName: KnowledgeSourceNameSchema.describe("Name of the source"),
      sourceDefinition: KnowledgeSourceSchema.describe("The source definition"),
      ifMatch: z.string().optional().describe("ETag for optimistic concurrency control"),
      ifNoneMatch: z.string().optional().describe("ETag to prevent overwriting existing source"),
      validate: z.boolean().optional().describe("Validate the source definition before creation")
    },
    async (args: any) => {
      try {
        // Ensure name consistency
        if (!args.sourceDefinition.name) {
          args.sourceDefinition.name = args.sourceName;
        } else if (args.sourceDefinition.name !== args.sourceName) {
          throw new Error(`Source name mismatch: ${args.sourceName} vs ${args.sourceDefinition.name}`);
        }

        // Validate if requested
        if (args.validate) {
          const errors = validateKnowledgeSource(args.sourceDefinition);
          if (errors.length > 0) {
            return rf.formatSuccess({
              success: false,
              errors,
              message: "Knowledge source validation failed"
            });
          }
        }

        const client = getClient();
        const result = await withTimeout(
          client.createOrUpdateKnowledgeSource(
            args.sourceName,
            args.sourceDefinition,
            {
              ifMatch: args.ifMatch,
              ifNoneMatch: args.ifNoneMatch
            }
          ),
          DEFAULT_TIMEOUT_MS
        );
        return rf.formatSuccess(result);
      } catch (error: any) {
        return rf.formatError(error, { tool: "createOrUpdateKnowledgeSource", sourceName: args.sourceName });
      }
    }
  );

  // Delete a knowledge source
  server.tool(
    "deleteKnowledgeSource",
    "⚠️ DESTRUCTIVE: Permanently delete a knowledge source. This action cannot be undone.",
    {
      sourceName: KnowledgeSourceNameSchema.describe("The name of the source to delete"),
      confirmation: z.string().optional().describe("Type 'DELETE' to confirm deletion")
    },
    async (args: any) => {
      try {
        // Check for explicit confirmation
        if (args.confirmation !== "DELETE") {
          return rf.formatSuccess({
            success: false,
            message: "Delete operation requires explicit confirmation. Please provide confirmation='DELETE'"
          });
        }

        const client = getClient();
        await withTimeout(
          client.deleteKnowledgeSource(args.sourceName),
          DEFAULT_TIMEOUT_MS
        );
        
        return rf.formatSuccess({
          success: true,
          message: `Knowledge source '${args.sourceName}' has been permanently deleted`
        });
      } catch (error: any) {
        return rf.formatError(error, { tool: "deleteKnowledgeSource", sourceName: args.sourceName });
      }
    }
  );

  // Create Azure Blob knowledge source helper
  server.tool(
    "createAzureBlobKnowledgeSource",
    "Create a knowledge source for Azure Blob Storage with guided setup.",
    {
      sourceName: KnowledgeSourceNameSchema.describe("Name of the source to create"),
      storageAccount: z.string().describe("Azure Storage account name"),
      containerName: z.string().describe("Blob container name"),
      accountKey: z.string().optional().describe("Storage account key"),
      connectionString: z.string().optional().describe("Full connection string (alternative to accountKey)"),
      folderPath: z.string().optional().describe("Specific folder path within container"),
      fileExtensions: z.array(z.string()).optional().describe("File extensions to include (e.g., ['.pdf', '.docx'])"),
      targetIndexName: z.string().describe("Target search index for ingested data"),
      schedule: z.string().optional().describe("Refresh schedule (e.g., 'PT2H' for every 2 hours)")
    },
    async (args: any) => {
      try {
        // Build the knowledge source definition
        const sourceDefinition: any = {
          name: args.sourceName,
          kind: "azureBlob",
          azureBlobParameters: {
            connectionString: args.connectionString,
            containerName: args.containerName,
            folderPath: args.folderPath
          }
        };

        // Set up authentication
        if (!args.connectionString && args.accountKey) {
          // Build connection string from account name and key
          sourceDefinition.azureBlobParameters.connectionString = 
            `DefaultEndpointsProtocol=https;AccountName=${args.storageAccount};AccountKey=${args.accountKey};EndpointSuffix=core.windows.net`;
        } else if (!args.connectionString) {
          throw new Error("Either connectionString or accountKey must be provided");
        }

        // Add optional schedule
        if (args.schedule) {
          sourceDefinition.azureBlobParameters.ingestionSchedule = {
            interval: args.schedule
          };
        }

        const client = getClient();
        const result = await withTimeout(
          client.createKnowledgeSource(sourceDefinition),
          DEFAULT_TIMEOUT_MS
        );
        return rf.formatSuccess(result);
      } catch (error: any) {
        return rf.formatError(error, { tool: "createAzureBlobKnowledgeSource", sourceName: args.sourceName });
      }
    }
  );

  // Create Web knowledge source helper
  server.tool(
    "createWebKnowledgeSource",
    "Create a knowledge source for web crawling with guided setup.",
    {
      sourceName: KnowledgeSourceNameSchema.describe("Name of the source to create"),
      urls: z.array(z.string().url()).describe("Starting URLs to crawl"),
      crawlDepth: z.number().min(0).max(10).optional().describe("Maximum crawl depth (default: 2)"),
      includeSubdomains: z.boolean().optional().describe("Include subdomains in crawl"),
      excludePatterns: z.array(z.string()).optional().describe("URL patterns to exclude"),
      targetIndexName: z.string().describe("Target search index for ingested data"),
      schedule: z.string().optional().describe("Refresh schedule (e.g., 'P1D' for daily)")
    },
    async (args: any) => {
      try {
        // Build the knowledge source definition
        const sourceDefinition: any = {
          name: args.sourceName,
          kind: "web",
          webParameters: {}
        };

        // Configure allowed domains from URLs
        if (args.urls && args.urls.length > 0) {
          sourceDefinition.webParameters.allowedDomains = args.urls.map((url: string) => {
            const urlObj = new URL(url);
            return {
              address: urlObj.hostname,
              includeSubpages: true
            };
          });
        }

        // Add optional parameters
        if (args.includeSubdomains !== undefined) {
          sourceDefinition.webParameters.allowedDomains?.forEach((domain: any) => {
            domain.includeSubpages = args.includeSubdomains;
          });
        }

        if (args.excludePatterns && args.excludePatterns.length > 0) {
          sourceDefinition.webParameters.blockedDomains = args.excludePatterns.map((pattern: string) => ({
            address: pattern,
            includeSubpages: true
          }));
        }

        const client = getClient();
        const result = await withTimeout(
          client.createKnowledgeSource(sourceDefinition),
          DEFAULT_TIMEOUT_MS
        );
        return rf.formatSuccess(result);
      } catch (error: any) {
        return rf.formatError(error, { tool: "createWebKnowledgeSource", sourceName: args.sourceName });
      }
    }
  );
}

// Validation helper for knowledge sources
function validateKnowledgeSource(source: any): string[] {
  const errors: string[] = [];

  if (!source.name) {
    errors.push("Source must have a name");
  }

  if (!source.kind) {
    errors.push("Source must have a kind (searchIndex, azureBlob, or web)");
  }

  // Validate based on source kind
  switch (source.kind) {
    case "searchIndex":
      if (!source.searchIndexParameters) {
        errors.push("Search index source requires searchIndexParameters");
      } else {
        if (!source.searchIndexParameters.searchIndexName) {
          errors.push("Search index source requires searchIndexName");
        }
      }
      break;

    case "azureBlob":
      if (!source.azureBlobParameters) {
        errors.push("Azure Blob source requires azureBlobParameters");
      } else {
        if (!source.azureBlobParameters.containerName) {
          errors.push("Azure Blob source requires containerName");
        }
        if (!source.azureBlobParameters.connectionString) {
          errors.push("Azure Blob source requires connectionString");
        }
      }
      break;

    case "web":
      if (!source.webParameters) {
        errors.push("Web source requires webParameters");
      }
      break;
  }

  return errors;
}