// MCP Tool Wrapper for Direct Invocation
// This wrapper allows the dynamic tools to be called directly from Claude Code
import { AzureSearchClient } from "./azure-search-client";
import { AzureOpenAIClient } from "./azure-openai-client";
import { AzureSearchClientMock } from "./azure-search-client.mock";
import type { ToolContext } from "./types";
import { withTimeout as withTimeoutUtil } from "./utils/timeout";
import { paginateArray } from "./utils/streaming-pagination";
import { DEFAULT_TIMEOUT_MS } from "./constants";

// Import all dynamic tools
import { IndexTool } from "./dynamic-tools/IndexTool";
import { DocumentTool } from "./dynamic-tools/DocumentTool";
import { DataSourceTool } from "./dynamic-tools/DataSourceTool";
import { IndexerTool } from "./dynamic-tools/IndexerTool";
import { SkillsetTool } from "./dynamic-tools/SkillsetTool";
import { ServiceTool } from "./dynamic-tools/ServiceTool";
import { KnowledgeAgentTool } from "./dynamic-tools/KnowledgeAgentTool";
import { KnowledgeSourceTool } from "./dynamic-tools/KnowledgeSourceTool";

// Tool registry
const DYNAMIC_TOOLS = {
  IndexManagement: IndexTool,
  DocumentOperations: DocumentTool,
  DataSourceManagement: DataSourceTool,
  IndexerManagement: IndexerTool,
  SkillsetManagement: SkillsetTool,
  ServiceUtilities: ServiceTool,
  KnowledgeAgentOperations: KnowledgeAgentTool,
  KnowledgeSourceOperations: KnowledgeSourceTool
};

/**
 * Creates a callable wrapper for a dynamic tool
 */
export function createToolWrapper(toolName: string, env: any) {
  const ToolClass = DYNAMIC_TOOLS[toolName as keyof typeof DYNAMIC_TOOLS];
  
  if (!ToolClass) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // Create context with environment
  const context: ToolContext = {
    getClient: (() => {
      let cachedKey: string | null = null;
      let cachedClient: AzureSearchClient | null = null;
      return () => {
        const useMock = env.AZURE_SEARCH_MOCK === "true" || env.AZURE_SEARCH_MOCK === "1";
        if (useMock) {
          if (cachedClient && cachedKey === "mock") return cachedClient;
          cachedClient = new (AzureSearchClientMock as any)() as unknown as AzureSearchClient;
          cachedKey = "mock";
          return cachedClient;
        }
        const endpoint = env.AZURE_SEARCH_ENDPOINT;
        const apiKey = env.AZURE_SEARCH_API_KEY;
        if (!endpoint || !apiKey) {
          throw new Error("Missing AZURE_SEARCH_ENDPOINT or AZURE_SEARCH_API_KEY");
        }
        const key = `${endpoint}|${apiKey}`;
        if (cachedClient && cachedKey === key) return cachedClient;
        cachedClient = new AzureSearchClient(endpoint, apiKey);
        cachedKey = key;
        return cachedClient;
      };
    })(),
    getSummarizer: () => {
      const endpoint = env.AZURE_OPENAI_ENDPOINT;
      const apiKey = env.AZURE_OPENAI_API_KEY;
      const deployment = env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";
      if (!endpoint || !apiKey) return null;
      const client = new AzureOpenAIClient(endpoint, apiKey, deployment);
      return (text: string, maxTokens?: number) => client.summarize(text, maxTokens);
    },
    agent: {
      // Provide a stub for elicitation support in direct mode
      elicitInput: async (params: { message: string; requestedSchema: any }) => {
        console.warn(`[Elicitation Required] ${params.message}`);
        console.warn('Elicitation is not available in direct tool invocation mode.');
        // Return a spec-compliant MCP ElicitResult action
        return { action: 'cancel' as const };
      }
    } as any
  };

  // Return a function that can be called with operation and params
  return async function(input: { operation?: string; params?: any; options?: any } | string) {
    // Handle both object input and string operation
    let operation: string;
    let params: any = {};
    let options: any = {};

    if (typeof input === 'string') {
      // If just a string, treat as operation name with no params
      operation = input;
    } else {
      operation = input.operation || 'list'; // Default to list operation
      params = input.params || {};
      options = input.options || {};
    }

    // Get the operation definition
    const opDef = ToolClass.operations[operation];
    if (!opDef) {
      const availableOps = Object.keys(ToolClass.operations);
      throw new Error(
        `Unknown operation '${operation}' for ${toolName}. ` +
        `Available operations: ${availableOps.join(', ')}`
      );
    }

    // Validate params if schema provided
    try {
      const validatedParams = opDef.params.parse(params);
      
      // Simple sanitizer to avoid logging sensitive values
      const sanitize = (value: any): any => {
        const SENSITIVE = new Set(["apiKey", "password", "token", "secret", "connectionString"]);
        if (value && typeof value === "object") {
          if (Array.isArray(value)) return value.map(sanitize);
          const out: any = {};
          for (const [k, v] of Object.entries(value)) {
            out[k] = SENSITIVE.has(k) ? "***REDACTED***" : sanitize(v as any);
          }
          return out;
        }
        return value;
      };

      // Create helpers for the operation
      const helpers = {
        withTimeout: async <T>(promise: Promise<T>, timeoutMs?: number, opName?: string): Promise<T> => {
          return withTimeoutUtil(promise, timeoutMs ?? DEFAULT_TIMEOUT_MS, opName ?? `${toolName}.${operation}`);
        },
        paginate: (items: any[], options: { pageSize?: number; cursor?: string }) => {
          return paginateArray(items, { pageSize: options.pageSize || 50, cursor: options.cursor });
        },
        elicit: async (options: any) => {
          console.warn(`[Elicitation Required] ${options.message}`);
          if (options.choices) {
            console.warn(`Available choices: ${options.choices.map((c: any) => `${c.value} (${c.label})`).join(', ')}`);
          }
          // In direct mode, we can't actually elicit, so return null
          // The operation should handle this gracefully
          return null;
        },
        notify: (event: string, data: any) => {
          console.log(`[${event}]`, sanitize(data));
        },
        progress: (update: { progress?: number; total?: number; message?: string }) => {
          // Direct wrapper has no MCP notification channel; log to console
          console.log(`[notifications/progress]`, sanitize(update));
        },
        formatBytes: (bytes: number) => {
          const units = ['B', 'KB', 'MB', 'GB', 'TB'];
          let size = bytes;
          let unitIndex = 0;
          while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
          }
          return `${size.toFixed(2)} ${units[unitIndex]}`;
        },
        processBatch: async <T>(items: T[], batchSize: number, processor: (batch: T[]) => Promise<any>) => {
          const results = [];
          for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const result = await processor(batch);
            results.push(result);
          }
          return results;
        },
        validateRequired: (params: any, required: string[]) => {
          for (const field of required) {
            if (params[field] === undefined || params[field] === null) {
              throw new Error(`Missing required parameter: ${field}`);
            }
          }
        },
        log: (level: 'info' | 'warn' | 'error', message: string, data?: any) => {
          console.log(`[${level.toUpperCase()}] ${message}`, data ? sanitize(data) : '');
        },
        notifyResourceUpdated: (uri: string) => {
          console.log(`[Resource Updated] ${uri}`);
        },
        notifyResourcesListChanged: () => {
          console.log('[Resources List Changed]');
        },
        notifyPromptsListChanged: () => {
          console.log('[Prompts List Changed]');
        },
        notifyToolsListChanged: () => {
          console.log('[Tools List Changed]');
        }
      };

      // Execute the operation
      const client = context.getClient();
      const result = await opDef.handler(client, validatedParams, context, helpers);
      
      return {
        success: true,
        operation,
        tool: toolName,
        result
      };

    } catch (error: any) {
      return {
        success: false,
        operation,
        tool: toolName,
        error: error.message,
        stack: error.stack
      };
    }
  };
}

/**
 * List all available tools and their operations
 */
export function listAvailableTools() {
  const tools: any = {};
  
  for (const [name, ToolClass] of Object.entries(DYNAMIC_TOOLS)) {
    tools[name] = {
      description: ToolClass.description,
      operations: Object.entries(ToolClass.operations).map(([opName, opDef]) => ({
        name: opName,
        description: opDef.description,
        category: opDef.category || 'general',
        requiresConfirmation: opDef.requiresConfirmation || false,
        supportsPagination: opDef.supportsPagination || false,
        examples: opDef.examples || []
      }))
    };
  }
  
  return tools;
}

/**
 * Get detailed information about a specific tool
 */
export function getToolInfo(toolName: string) {
  const ToolClass = DYNAMIC_TOOLS[toolName as keyof typeof DYNAMIC_TOOLS];
  
  if (!ToolClass) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  
  return {
    name: toolName,
    description: ToolClass.description,
    operations: Object.entries(ToolClass.operations).map(([opName, opDef]) => ({
      name: opName,
      description: opDef.description,
      category: opDef.category || 'general',
      requiresConfirmation: opDef.requiresConfirmation || false,
      supportsPagination: opDef.supportsPagination || false,
      batchOperation: opDef.batchOperation || false,
      timeout: opDef.timeout,
      examples: opDef.examples || [],
      // Avoid leaking Zod internals; wrapper consumers should reference upstream tool docs
      parameterSchema: '(zod schema not serialized)'
    }))
  };
}
