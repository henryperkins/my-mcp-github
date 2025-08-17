// src/dynamic-tools/IndexerTool.ts
import { z } from "zod";
import { DynamicTool, OperationDefinition } from "./base/DynamicTool";
import type { ToolContext } from "../types";

export class IndexerTool extends DynamicTool {
  static readonly toolName = "IndexerManagement";
  static readonly description = "Manage Azure Search indexers for automated data ingestion from external sources like Azure Blob Storage.";

  static readonly operations: Record<string, OperationDefinition> = {
    list: {
      description: "List all indexer names",
      category: 'read',
      params: z.object({}),
      examples: [],
      handler: async (client, params, context, helpers) => {
        const indexers = await helpers.withTimeout(
          client.listIndexers(),
          undefined,
          "listIndexers"
        );
        const names = (indexers as Array<{ name?: string }>).map(ix => ix.name || "").filter(Boolean);
        return { indexers: names, count: names.length };
      }
    },

    get: {
      description: "Get indexer configuration and details",
      category: 'read',
      params: z.object({
        name: z.string().describe("Indexer name")
      }),
      examples: [
        { name: "blob-indexer" }
      ],
      handler: async (client, params, context, helpers) => {
        return await helpers.withTimeout(
          client.getIndexer(params.name),
          undefined,
          `getIndexer:${params.name}`
        );
      }
    },

    create: {
      description: "Create a new blob indexer for automated data ingestion",
      category: 'write',
      params: z.object({
        name: z.string().describe("Indexer name"),
        dataSourceName: z.string().describe("Existing data source connection name"),
        targetIndexName: z.string().describe("Target search index name"),
        scheduleInterval: z.string().default("PT2H")
          .describe("ISO-8601 duration (e.g., PT2H for 2 hours, P1D for daily)"),
        runNow: z.boolean().default(false).describe("Run immediately after creation"),
        parsingMode: z.enum(["default","json","jsonArray","jsonLines","delimitedText","markdown","text"])
          .default("default").describe("Document parsing mode"),
        indexedFileNameExtensions: z.string()
          .default(".md,.ts,.js,.json,.yml,.yaml,.txt")
          .describe("Comma-separated file extensions to index"),
        excludedFileNameExtensions: z.string()
          .default(".png,.jpg,.gif,.svg,.ico")
          .describe("Comma-separated file extensions to exclude"),
        dataToExtract: z.enum(["storageMetadata","allMetadata","contentAndMetadata"])
          .default("contentAndMetadata").describe("What data to extract from blobs"),
        indexStorageMetadataOnlyForOversizedDocuments: z.boolean().default(true)
          .describe("Index only metadata for oversized documents"),
        ignoreResetRequirements: z.boolean().optional()
          .describe("If true, ignore indexer cache reset requirements when updating indexer"),
        disableCacheReprocessingChangeDetection: z.boolean().optional()
          .describe("If true, disable cache reprocessing change detection for this indexer"),
        fieldMappings: z.array(z.object({
          sourceFieldName: z.string(),
          targetFieldName: z.string(),
          mappingFunction: z.object({ name: z.string() }).nullable().optional()
        })).optional().describe("Custom field mappings from source to index fields")
      }),
      examples: [
        {
          name: "documents-indexer",
          dataSourceName: "blob-datasource",
          targetIndexName: "documents",
          scheduleInterval: "PT4H",
          runNow: true,
          parsingMode: "default",
          indexedFileNameExtensions: ".pdf,.docx,.txt"
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Validate required fields or elicit
        if (!params.name || !params.dataSourceName || !params.targetIndexName) {
          const response = await helpers.elicit({
            message: "Please provide the required indexer configuration",
            inputType: 'text',
            timeout: 30000
          });

          if (!response) {
            throw new Error("Indexer configuration is required");
          }
        }

        const indexerDefinition: any = {
          name: params.name,
          dataSourceName: params.dataSourceName,
          targetIndexName: params.targetIndexName,
          schedule: params.scheduleInterval ? { interval: params.scheduleInterval } : undefined,
          parameters: {
            configuration: {
              parsingMode: params.parsingMode,
              indexedFileNameExtensions: params.indexedFileNameExtensions,
              excludedFileNameExtensions: params.excludedFileNameExtensions,
              dataToExtract: params.dataToExtract,
              indexStorageMetadataOnlyForOversizedDocuments: params.indexStorageMetadataOnlyForOversizedDocuments
            },
            batchSize: 10,
            maxFailedItems: 10,
            maxFailedItemsPerBatch: 5
          },
          description: `Indexer for '${params.dataSourceName}' to '${params.targetIndexName}'`
        };

        // Add field mappings if provided
        if (params.fieldMappings && params.fieldMappings.length > 0) {
          indexerDefinition.fieldMappings = params.fieldMappings.map((fm: any) => {
            const cleaned: any = {
              sourceFieldName: fm.sourceFieldName,
              targetFieldName: fm.targetFieldName
            };
            if (fm.mappingFunction) {
              cleaned.mappingFunction = fm.mappingFunction;
            }
            return cleaned;
          });
        } else {
          // Minimal default mapping
          indexerDefinition.fieldMappings = [
            {
              sourceFieldName: "content",
              targetFieldName: "content"
            }
          ];
        }

        const created = await helpers.withTimeout(
          client.createOrUpdateIndexer(params.name, indexerDefinition, {
            ignoreResetRequirements: params.ignoreResetRequirements,
            disableCacheReprocessingChangeDetection: params.disableCacheReprocessingChangeDetection
          }),
          undefined,
          "createIndexer"
        );

        // Run immediately if requested
        if (params.runNow) {
          try {
            await helpers.withTimeout(
              client.runIndexer(params.name),
              undefined,
              `runIndexer:${params.name}`
            );
            helpers.notify("tools/indexer_started", {
              name: params.name
            });
            // Emit resource updates (indexers and target index content expected to change)
            helpers.notifyResourceUpdated("indexers");
            helpers.notifyResourceUpdated(`indexers/${params.name}`);
            if (params.targetIndexName) {
              helpers.notifyResourceUpdated("indexes");
              helpers.notifyResourceUpdated(`indexes/${params.targetIndexName}`);
            }
          } catch (runErr: any) {
            return {
              success: false,
              message: `Indexer created but run failed: ${runErr.message}`,
              indexer: created
            };
          }
        }

        helpers.notify("tools/indexer_created", {
          name: params.name,
          dataSource: params.dataSourceName,
          targetIndex: params.targetIndexName,
          schedule: params.scheduleInterval
        });

        // Emit resource updates
        helpers.notifyResourceUpdated("indexers");
        helpers.notifyResourceUpdated(`indexers/${params.name}`);

        return {
          success: true,
          message: `Indexer '${params.name}' created${params.runNow ? " and started" : ""} successfully`,
          indexer: created
        };
      }
    },

    update: {
      description: "Update an existing indexer configuration",
      category: 'write',
      params: z.object({
        name: z.string().describe("Indexer name to update"),
        scheduleInterval: z.string().optional(),
        parsingMode: z.enum(["default","json","jsonArray","jsonLines","delimitedText","markdown","text"]).optional(),
        indexedFileNameExtensions: z.string().optional(),
        excludedFileNameExtensions: z.string().optional(),
        dataToExtract: z.enum(["storageMetadata","allMetadata","contentAndMetadata"]).optional(),
        ignoreResetRequirements: z.boolean().optional(),
        disableCacheReprocessingChangeDetection: z.boolean().optional(),
        fieldMappings: z.array(z.object({
          sourceFieldName: z.string(),
          targetFieldName: z.string(),
          mappingFunction: z.object({ name: z.string() }).nullable().optional()
        })).optional()
      }),
      examples: [
        {
          name: "documents-indexer",
          scheduleInterval: "PT1H",
          indexedFileNameExtensions: ".pdf,.docx,.txt,.md"
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Get existing indexer
        const existing: any = await helpers.withTimeout(
          client.getIndexer(params.name),
          undefined,
          `getIndexer:${params.name}`
        );

        // Update schedule if provided
        if (params.scheduleInterval !== undefined) {
          existing.schedule = { interval: params.scheduleInterval };
        }

        // Update parameters if provided
        if (params.parsingMode !== undefined) {
          existing.parameters.configuration.parsingMode = params.parsingMode;
        }
        if (params.indexedFileNameExtensions !== undefined) {
          existing.parameters.configuration.indexedFileNameExtensions = params.indexedFileNameExtensions;
        }
        if (params.excludedFileNameExtensions !== undefined) {
          existing.parameters.configuration.excludedFileNameExtensions = params.excludedFileNameExtensions;
        }
        if (params.dataToExtract !== undefined) {
          existing.parameters.configuration.dataToExtract = params.dataToExtract;
        }

        // Update field mappings if provided
        if (params.fieldMappings) {
          existing.fieldMappings = params.fieldMappings.map((fm: any) => {
            const cleaned: any = {
              sourceFieldName: fm.sourceFieldName,
              targetFieldName: fm.targetFieldName
            };
            if (fm.mappingFunction) {
              cleaned.mappingFunction = fm.mappingFunction;
            }
            return cleaned;
          });
        }

        const updated = await helpers.withTimeout(
          client.createOrUpdateIndexer(params.name, existing, {
            ignoreResetRequirements: params.ignoreResetRequirements,
            disableCacheReprocessingChangeDetection: params.disableCacheReprocessingChangeDetection
          }),
          undefined,
          "updateIndexer"
        );

        helpers.notify("tools/indexer_updated", {
          name: params.name
        });

        // Emit resource updates
        helpers.notifyResourceUpdated("indexers");
        helpers.notifyResourceUpdated(`indexers/${params.name}`);

        return {
          success: true,
          message: `Indexer '${params.name}' updated successfully`,
          indexer: updated
        };
      }
    },

    run: {
      description: "Run an indexer immediately",
      category: 'write',
      params: z.object({
        name: z.string().describe("Indexer name to run")
      }),
      examples: [
        { name: "documents-indexer" }
      ],
      handler: async (client, params, context, helpers) => {
        await helpers.withTimeout(
          client.runIndexer(params.name),
          undefined,
          `runIndexer:${params.name}`
        );

        helpers.notify("tools/indexer_started", {
          name: params.name,
          timestamp: new Date().toISOString()
        });

        // Emit resource updates
        helpers.notifyResourceUpdated("indexers");
        helpers.notifyResourceUpdated(`indexers/${params.name}`);

        return {
          success: true,
          message: `Indexer '${params.name}' started successfully`
        };
      }
    },

    reset: {
      description: "Reset indexer change tracking for full re-crawl",
      category: 'write',
      params: z.object({
        name: z.string().describe("Indexer name to reset")
      }),
      examples: [
        { name: "documents-indexer" }
      ],
      handler: async (client, params, context, helpers) => {
        await helpers.withTimeout(
          client.resetIndexer(params.name),
          undefined,
          `resetIndexer:${params.name}`
        );

        helpers.notify("tools/indexer_reset", {
          name: params.name,
          timestamp: new Date().toISOString()
        });

        // Emit resource updates
        helpers.notifyResourceUpdated("indexers");
        helpers.notifyResourceUpdated(`indexers/${params.name}`);

        return {
          success: true,
          message: `Indexer '${params.name}' reset successfully. Next run will perform full re-crawl.`
        };
      }
    },

    resetDocs: {
      description: "Reset specific documents to be selectively re-ingested by the indexer",
      category: 'write',
      params: z.object({
        name: z.string().describe("Indexer name to reset documents for"),
        documentKeys: z.array(z.string()).optional()
          .describe("Document keys in the target index to be reset"),
        datasourceDocumentIds: z.array(z.string()).optional()
          .describe("Document identifiers in the datasource to be reset"),
        overwrite: z.boolean().optional().default(false)
          .describe("If true, overwrite existing queued keys/ids; if false, append")
      }),
      examples: [
        { name: "documents-indexer", documentKeys: ["doc-1","doc-2"], overwrite: true }
      ],
      handler: async (client, params, context, helpers) => {
        await helpers.withTimeout(
          client.resetIndexerDocs(params.name, {
            documentKeys: params.documentKeys,
            datasourceDocumentIds: params.datasourceDocumentIds
          }, params.overwrite ?? false),
          undefined,
          `resetDocs:${params.name}`
        );

        helpers.notify("tools/indexer_reset_docs", {
          name: params.name,
          documentKeys: params.documentKeys?.length || 0,
          datasourceDocumentIds: params.datasourceDocumentIds?.length || 0,
          overwrite: params.overwrite ?? false,
          timestamp: new Date().toISOString()
        });

        helpers.notifyResourceUpdated("indexers");
        helpers.notifyResourceUpdated(`indexers/${params.name}`);

        return {
          success: true,
          message: `Indexer '${params.name}' queued ${params.documentKeys?.length || 0} document keys and ${params.datasourceDocumentIds?.length || 0} datasource ids for re-ingestion`
        };
      }
    },

    resync: {
      description: "Resync selective options from the datasource (e.g., permissions)",
      category: 'write',
      params: z.object({
        name: z.string().describe("Indexer name to resync"),
        options: z.array(z.literal("permissions")).min(1)
          .describe("Resync options (currently supports: 'permissions')")
      }),
      examples: [
        { name: "documents-indexer", options: ["permissions"] }
      ],
      handler: async (client, params, context, helpers) => {
        await helpers.withTimeout(
          client.resyncIndexer(params.name, params.options as Array<"permissions">),
          undefined,
          `resyncIndexer:${params.name}`
        );

        helpers.notify("tools/indexer_resync", {
          name: params.name,
          options: params.options,
          timestamp: new Date().toISOString()
        });

        helpers.notifyResourceUpdated("indexers");
        helpers.notifyResourceUpdated(`indexers/${params.name}`);

        return {
          success: true,
          message: `Indexer '${params.name}' resync initiated for options: ${params.options.join(", ")}`
        };
      }
    },

    status: {
      description: "Get indexer execution status and history",
      category: 'read',
      params: z.object({
        name: z.string().describe("Indexer name"),
        historyLimit: z.number().int().positive().max(50).default(5)
          .describe("Number of execution history entries to retrieve")
      }),
      examples: [
        { name: "documents-indexer", historyLimit: 10 }
      ],
      handler: async (client, params, context, helpers) => {
        const status: any = await helpers.withTimeout(
          client.getIndexerStatus(params.name),
          undefined,
          `getIndexerStatus:${params.name}`
        );

        // Limit execution history
        if (status.executionHistory && Array.isArray(status.executionHistory)) {
          status.executionHistory = status.executionHistory.slice(0, params.historyLimit);
          if (status.executionHistory.length < params.historyLimit) {
            status.historyComplete = true;
          } else {
            status.historyTruncated = true;
            status.message = `Showing first ${params.historyLimit} execution history entries. Increase historyLimit to see more.`;
          }
        }

        return status;
      }
    },

    runWithProgress: {
      description: "Run an indexer and monitor progress until completion",
      category: 'write',
      timeout: 600000, // 10 minutes
      params: z.object({
        indexerName: z.string().describe("Indexer name to run"),
        clientRequestId: z.string().uuid().optional(),
        pollSeconds: z.number().int().positive().max(30).default(5)
          .describe("Polling interval in seconds"),
        maxAttempts: z.number().int().positive().max(600).default(60)
          .describe("Maximum polling attempts before timeout")
      }),
      examples: [
        {
          indexerName: "documents-indexer",
          pollSeconds: 5,
          maxAttempts: 120
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Start the indexer (with timeout protection)
        await helpers.withTimeout(
          client.runIndexer(params.indexerName),
          undefined,
          `runIndexer:${params.indexerName}`
        );

        helpers.notify("tools/indexer_progress", {
          indexerName: params.indexerName,
          status: "started",
          timestamp: new Date().toISOString()
        });

        let done = false;
        let attempts = 0;
        const progressUpdates: any[] = [];

        while (!done && attempts++ < params.maxAttempts) {
          // Wait for polling interval
          await new Promise(resolve => setTimeout(resolve, params.pollSeconds * 1000));

          // Get current status (with timeout protection)
          const status: any = await helpers.withTimeout(
            client.getIndexerStatus(params.indexerName),
            undefined,
            `getIndexerStatus:${params.indexerName}`
          );
          const lastResult = status?.lastResult;
          const currentStatus = lastResult?.status ?? status?.status ?? "unknown";

          // Calculate progress
          const itemsProcessed = Number(lastResult?.itemsProcessed ?? lastResult?.itemCount ?? 0);
          const itemsFailed = Number(lastResult?.itemsFailed ?? lastResult?.failedItemCount ?? 0);
          const processedSoFar = itemsProcessed + itemsFailed;

          const progressUpdate = {
            attempt: attempts,
            status: currentStatus,
            itemsProcessed,
            itemsFailed,
            totalProcessed: processedSoFar,
            message: lastResult?.errorMessage || lastResult?.warnings?.join("; ")
          };

          progressUpdates.push(progressUpdate);

          // Emit progress notification
          helpers.notify("tools/indexer_progress", {
            indexerName: params.indexerName,
            ...progressUpdate
          });

          // Check if done
          if (currentStatus === "success" || currentStatus === "transientFailure" || currentStatus === "reset") {
            done = true;
          }
        }

        // Final status (with timeout protection)
        const finalStatus: any = await helpers.withTimeout(
          client.getIndexerStatus(params.indexerName),
          undefined,
          `getIndexerStatus:${params.indexerName}`
        );
        const lastResult = finalStatus?.lastResult;

        helpers.notify("tools/indexer_complete", {
          indexerName: params.indexerName,
          finalStatus: lastResult?.status,
          itemsProcessed: lastResult?.itemsProcessed,
          itemsFailed: lastResult?.itemsFailed,
          duration: lastResult?.endTime && lastResult?.startTime
            ? new Date(lastResult.endTime).getTime() - new Date(lastResult.startTime).getTime()
            : undefined
        });

        // Emit resource updates
        helpers.notifyResourceUpdated("indexers");
        helpers.notifyResourceUpdated(`indexers/${params.indexerName}`);

        return {
          success: done,
          message: done
            ? `Indexer '${params.indexerName}' completed with status: ${lastResult?.status}`
            : `Indexer '${params.indexerName}' timed out after ${attempts} attempts`,
          finalStatus: lastResult,
          progressHistory: progressUpdates,
          totalAttempts: attempts
        };
      }
    },

    delete: {
      description: "Delete an indexer",
      category: 'delete',
      requiresConfirmation: true,
      params: z.object({
        name: z.string().describe("Indexer name to delete"),
        confirmation: z.literal("DELETE").optional().describe("Type 'DELETE' to confirm")
      }),
      examples: [
        { name: "old-indexer", confirmation: "DELETE" }
      ],
      handler: async (client, params, context, helpers) => {
        // Elicit confirmation if not provided
        if (params.confirmation !== "DELETE") {
          const response = await helpers.elicit({
            message: `⚠️ This will delete indexer '${params.name}'. Type 'DELETE' to confirm.`,
            inputType: 'text',
            validation: (input: string) => input === "DELETE" ? null : "Please type 'DELETE' to confirm",
            timeout: 10000
          });

          if (response?.text !== "DELETE") {
            throw new Error("Delete operation cancelled");
          }
        }

        await helpers.withTimeout(
          client.deleteIndexer(params.name),
          undefined,
          "deleteIndexer"
        );

        helpers.notify("tools/indexer_deleted", {
          name: params.name,
          timestamp: new Date().toISOString()
        });

        // Emit resource updates
        helpers.notifyResourceUpdated("indexers");
        helpers.notifyResourceUpdated(`indexers/${params.name}`);

        return {
          success: true,
          message: `Indexer '${params.name}' has been deleted`
        };
      }
    }
  };

  // Resource definitions
  protected static resources = [
    {
      uri: "indexers://list",
      description: "List of configured indexers with their status",
      handler: async (context: ToolContext) => {
        const client = context.getClient();
        const indexers: any[] = await client.listIndexers() as any[];

        // Get status for each indexer
        const indexersWithStatus = await Promise.all(
          indexers.map(async (indexer: any) => {
            try {
              const status: any = await client.getIndexerStatus(indexer.name);
              return {
                name: indexer.name,
                dataSource: indexer.dataSourceName,
                targetIndex: indexer.targetIndexName,
                schedule: indexer.schedule?.interval,
                lastRun: status.lastResult?.endTime,
                lastStatus: status.lastResult?.status
              };
            } catch {
              return {
                name: indexer.name,
                dataSource: indexer.dataSourceName,
                targetIndex: indexer.targetIndexName,
                schedule: indexer.schedule?.interval
              };
            }
          })
        );

        return {
          count: indexers.length,
          indexers: indexersWithStatus
        };
      }
    },
    {
      uri: "indexers://status",
      description: "Aggregate status of all indexers",
      handler: async (context: ToolContext) => {
        const client = context.getClient();
        const indexers: any[] = await client.listIndexers() as any[];

        let running = 0;
        let failed = 0;
        let success = 0;

        for (const indexer of indexers) {
          try {
            const status: any = await client.getIndexerStatus(indexer.name);
            const lastStatus = status.lastResult?.status;
            if (lastStatus === "inProgress") running++;
            else if (lastStatus === "transientFailure" || lastStatus === "persistentFailure") failed++;
            else if (lastStatus === "success") success++;
          } catch {
            // Skip if can't get status
          }
        }

        return {
          total: indexers.length,
          running,
          failed,
          success,
          other: indexers.length - running - failed - success
        };
      }
    }
  ];

  // Prompt definitions
  protected static prompts = [
    {
      name: "setup_blob_indexer",
      description: "Interactive setup for blob storage indexer",
      params: z.object({
        contentType: z.string().describe("What type of content will you index?"),
        updateFrequency: z.enum(["realtime", "hourly", "daily", "weekly"]),
        fileTypes: z.string().describe("What file types? (e.g., pdf, docx, txt)")
      }),
      handler: async (params: any, context: ToolContext) => {
        const config = IndexerTool.recommendIndexerConfig(
          params.contentType,
          params.updateFrequency,
          params.fileTypes
        );

        return {
          messages: [
            {
              role: "assistant" as const,
              content: {
                type: "text" as const,
                text: `Recommended indexer configuration:\n\n${config.explanation}\n\nConfiguration:\n${JSON.stringify(config.params, null, 2)}`
              }
            }
          ]
        };
      }
    }
  ];

  // Helper methods
  private static recommendIndexerConfig(contentType: string, updateFrequency: string, fileTypes: string): any {
    const params: any = {
      operation: "create",
      params: {
        name: contentType.toLowerCase().replace(/[^a-z0-9]/g, '-') + "-indexer",
        indexedFileNameExtensions: fileTypes.replace(/\s+/g, '').split(',').map(ft =>
          ft.startsWith('.') ? ft : `.${ft}`
        ).join(',')
      }
    };

    let explanation = "";

    // Schedule based on frequency
    switch (updateFrequency) {
      case "realtime":
        params.params.scheduleInterval = "PT5M";
        params.params.runNow = true;
        explanation += "Real-time indexing with 5-minute intervals for near-immediate updates.";
        break;
      case "hourly":
        params.params.scheduleInterval = "PT1H";
        explanation += "Hourly indexing for regular content updates.";
        break;
      case "daily":
        params.params.scheduleInterval = "P1D";
        explanation += "Daily indexing for batch processing overnight.";
        break;
      case "weekly":
        params.params.scheduleInterval = "P7D";
        explanation += "Weekly indexing for stable content.";
        break;
    }

    // Parsing mode based on content
    if (contentType.toLowerCase().includes("json") || contentType.toLowerCase().includes("log")) {
      params.params.parsingMode = "jsonArray";
      explanation += "\n\nJSON array parsing mode for structured data.";
    } else if (contentType.toLowerCase().includes("csv") || contentType.toLowerCase().includes("tsv")) {
      params.params.parsingMode = "delimitedText";
      explanation += "\n\nDelimited text parsing for CSV/TSV data.";
    } else {
      params.params.parsingMode = "default";
      explanation += "\n\nDefault parsing mode for mixed content types.";
    }

    // Data extraction
    if (fileTypes.includes("pdf") || fileTypes.includes("docx")) {
      params.params.dataToExtract = "contentAndMetadata";
      explanation += "\n\nExtracting both content and metadata from documents.";
    }

    return { params, explanation };
  }
}
