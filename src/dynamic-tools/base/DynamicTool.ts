// src/dynamic-tools/base/DynamicTool.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResponseFormatter } from "../../utils/response";
import { withTimeout } from "../../utils/timeout";
import { ToolElicitationBuilder, ElicitationRequest } from "../../tool-elicitation";
import { elicitIfNeeded } from "../../utils/elicitation-integration";
import { paginateArray } from "../../utils/streaming-pagination";
import { StringBuilder } from "../../utils/string-builder";
import type { ToolContext } from "../../types";
import { DEFAULT_TIMEOUT_MS } from "../../constants";

/**
 * Operation definition for dynamic tools
 */
export interface OperationDefinition {
  description: string;
  params: z.ZodSchema<any>;
  handler: OperationHandler;
  requiresConfirmation?: boolean;
  supportsPagination?: boolean;
  batchOperation?: boolean;
  timeout?: number;
  examples?: any[];
  category?: 'read' | 'write' | 'delete' | 'analyze';
  requiredPermissions?: string[];
}

/**
 * Operation handler function type
 */
export type OperationHandler = (
  client: any,
  params: any,
  context: ToolContext,
  helpers: OperationHelpers
) => Promise<any>;

/**
 * Helper functions available to operation handlers
 */
export interface OperationHelpers {
  withTimeout: <T>(promise: Promise<T>, timeoutMs?: number, operation?: string) => Promise<T>;
  paginate: (items: any[], options: { pageSize?: number; cursor?: string }) => any;
  elicit: (options: ElicitationOptions) => Promise<any>;
  notify: (event: string, data: any) => void;
  progress: (update: { progress?: number; total?: number; message?: string; [k: string]: any }) => void;
  formatBytes: (bytes: number) => string;
  processBatch: <T>(items: T[], batchSize: number, processor: (batch: T[]) => Promise<any>) => Promise<any>;
  validateRequired: (params: any, required: string[]) => void;
  log: (level: 'info' | 'warn' | 'error', message: string, data?: any) => void;
  notifyResourceUpdated: (uri: string) => void;
  notifyResourcesListChanged: () => void;
  notifyPromptsListChanged: () => void;
  notifyToolsListChanged: () => void;
}

/**
 * Elicitation options
 */
export interface ElicitationOptions {
  message: string;
  inputType?: 'text' | 'choice' | 'confirm';
  choices?: Array<{ value: string; label: string }>;
  validation?: (input: any) => string | null;
  timeout?: number;
}

/**
 * Tool registration options
 */
export interface ToolRegistrationOptions {
  includeResources?: boolean;
  includePrompts?: boolean;
  enableLogging?: boolean;
  enableMetrics?: boolean;
}

/**
 * Tool metrics for performance tracking
 */
export interface ToolMetrics {
  operationCounts: Map<string, number>;
  errorCounts: Map<string, number>;
  averageLatency: Map<string, number>;
  lastErrors: Array<{ operation: string; error: string; timestamp: Date }>;
}

/**
 * Base class for all dynamic tools
 */
export abstract class DynamicTool {
  protected static metrics: ToolMetrics = {
    operationCounts: new Map(),
    errorCounts: new Map(),
    averageLatency: new Map(),
    lastErrors: []
  };

  /**
   * Tool name - must be unique
   */
  static readonly toolName: string = "";

  /**
   * Tool description
   */
  static readonly description: string = "";

  /**
   * Available operations for this tool
   */
  static readonly operations: Record<string, OperationDefinition> = {};

  /**
   * Optional resource definitions
   */
  protected static resources?: Array<{
    uri: string;
    description: string;
    handler: (context: ToolContext) => Promise<any>;
  }>;

  /**
   * Optional prompt definitions
   */
  protected static prompts?: Array<{
    name: string;
    description: string;
    params: z.ZodObject<any>;
    handler: (params: any, context: ToolContext) => Promise<any>;
  }>;

  /**
   * Register the dynamic tool with the MCP server
   */
  static register(
    server: McpServer,
    context: ToolContext,
    options: ToolRegistrationOptions = {}
  ): void {
    const {
      includeResources = true,
      includePrompts = true,
      enableLogging = true,
      enableMetrics = true
    } = options;

    // Create response formatter
    const rf = new ResponseFormatter(() => context.getSummarizer?.() ?? null);

    // Build operation schema
    const operationEnum = z.enum(Object.keys(this.operations) as [string, ...string[]]);
    const operationDescriptions = this.buildOperationDescriptions();

    const paramSchema = z.object({
      operation: operationEnum.describe(`Operation to perform:\n${operationDescriptions}`),
      params: z.any().optional().describe("Operation-specific parameters (see examples)"),
      options: z.object({
        timeout: z.number().optional().describe("Custom timeout in milliseconds"),
        skipValidation: z.boolean().optional().describe("Skip parameter validation"),
        dryRun: z.boolean().optional().describe("Validate without executing")
      }).optional()
    });

    // Build examples from operations
    const examples = this.buildExamples();

    // Build tool hints
    const hints = this.buildHints();

    // Register the main tool
    const annotations = (() => {
      const ops = Object.values(this.operations);
      const allRead = ops.every(o => o.category === 'read');
      const hasDelete = ops.some(o => o.category === 'delete');
      return {
        readOnlyHint: allRead,
        destructiveHint: hasDelete,
        idempotentHint: allRead,
        openWorldHint: true,
        title: this.description
      };
    })();
    server.tool(
      this.toolName,
      this.description,
      paramSchema as any,
      {
        annotations,
        _meta: {
          examples,
          hints,
          metadata: {
            version: "2.0.0",
            dynamic: true,
            operationCount: Object.keys(this.operations).length
          }
        }
      },
      async (input: any) => {
        const startTime = Date.now();
        const { operation, params = {}, options = {} } = input;

        // Validate operation exists
        const op = this.operations[operation];
        if (!op) {
          const error = new Error(
            `Unknown operation: ${operation}. Available operations: ${Object.keys(this.operations).join(', ')}`
          );

          if (enableMetrics) {
            this.recordError(operation, error);
          }

          return rf.formatError(error, {
            tool: this.toolName,
            operation,
            availableOperations: Object.keys(this.operations)
          });
        }

        try {
          // Skip validation if requested
          const validatedParams = options.skipValidation
            ? params
            : op.params.parse(params);

          // Dry run - validate only
          if (options.dryRun) {
            return rf.formatSuccess({
              operation,
              dryRun: true,
              valid: true,
              params: validatedParams,
              wouldExecute: op.description
            });
          }

          // Create operation helpers, threading progress token if provided by client
          const progressToken = (input as any)?._meta?.progressToken;
          const helpers = this.createHelpers(context, operation, enableLogging, progressToken);

          // Log operation start
          if (enableLogging) {
            helpers.notify(`${this.toolName}:start`, {
              operation,
              params: this.sanitizeParams(validatedParams)
            });
          }

          // Execute with timeout
          const timeout = options.timeout || op.timeout || DEFAULT_TIMEOUT_MS;
          const result = await withTimeout(
            op.handler(context.getClient(), validatedParams, context, helpers),
            timeout,
            `${this.toolName}.${operation}`
          );

          // Record metrics
          if (enableMetrics) {
            this.recordSuccess(operation, Date.now() - startTime);
          }

          // Log operation completion
          if (enableLogging) {
            helpers.notify(`${this.toolName}:complete`, {
              operation,
              duration: Date.now() - startTime
            });
          }

          // Format response with metadata
          return rf.formatSuccess({
            operation,
            result,
            _metadata: {
              tool: this.toolName,
              duration: Date.now() - startTime,
              requiresConfirmation: op.requiresConfirmation,
              supportsPagination: op.supportsPagination,
              batchOperation: op.batchOperation
            }
          });

        } catch (error: any) {
          // Record error metrics
          if (enableMetrics) {
            this.recordError(operation, error);
          }

          // Log error
          if (enableLogging) {
            try {
              const notifier = (context.agent as any)?.server?.notification ||
                             (context.agent as any)?.notification;
              if (notifier) {
                notifier(`${this.toolName}:error`, {
                  operation,
                  error: error.message,
                  stack: error.stack,
                  duration: Date.now() - startTime
                });
              }
            } catch {
              // Ignore notification errors
            }
          }

          // Check if error is validation error
          if (error instanceof z.ZodError) {
            return rf.formatError(
              new Error(`Parameter validation failed: ${this.formatZodError(error)}`),
              {
                tool: this.toolName,
                operation,
                validationErrors: error.errors
              }
            );
          }

          // Format general error
          return rf.formatError(error, {
            tool: this.toolName,
            operation,
            params: this.sanitizeParams(params),
            duration: Date.now() - startTime
          });
        }
      }
    );

    // Register resources if defined
    if (includeResources && this.resources) {
      this.registerResources(server, context);
    }

    // Register prompts if defined
    if (includePrompts && this.prompts) {
      this.registerPrompts(server, context);
    }

    // Register metrics endpoint
    if (enableMetrics) {
      this.registerMetricsResource(server, context);
    }
  }

  /**
   * Create operation helpers for handlers
   */
  protected static createHelpers(
    context: ToolContext,
    operation: string,
    enableLogging: boolean,
    progressToken?: string
  ): OperationHelpers {
    return {
      withTimeout: (promise, timeoutMs, op) =>
        withTimeout(promise, timeoutMs || DEFAULT_TIMEOUT_MS, op || operation),

      paginate: (items, options) =>
        paginateArray(items, {
          pageSize: options?.pageSize || 50,
          cursor: options?.cursor
        }),

      elicit: async (options) => {
        if (!context.agent) {
          throw new Error("Elicitation not available - agent context missing");
        }

        // Build MCP requestedSchema according to spec (primitive-only properties)
        const requestedSchema: ElicitationRequest["requestedSchema"] = {
          type: "object",
          properties: {},
          required: []
        };

        if (options.inputType === "choice" && options.choices && options.choices.length > 0) {
          requestedSchema.properties["choice"] = {
            type: "string",
            enum: options.choices.map(c => c.value),
            enumNames: options.choices.map(c => c.label)
          };
          requestedSchema.required = ["choice"];
        } else if (options.inputType === "confirm") {
          // Standard confirmation: require the literal string DELETE
          requestedSchema.properties["confirmation"] = {
            type: "string",
            enum: ["DELETE"]
          };
          requestedSchema.required = ["confirmation"];
        } else {
          // Default to free-text input
          requestedSchema.properties["input"] = { type: "string" };
          requestedSchema.required = ["input"];
        }

        const elicited = await elicitIfNeeded(context.agent, {
          message: options.message,
          requestedSchema
        });

        if (!elicited) {
          return null;
        }

        // Apply optional local validation if provided
        if (options.validation) {
          const candidate =
            (elicited as any).input ??
            (elicited as any).choice ??
            (elicited as any).confirmation;
          const validationError = options.validation(candidate);
          if (validationError) {
            throw new Error(validationError);
          }
        }

        // Return a compatibility object that supports existing call sites
        return {
          ...elicited,
          text:
            (elicited as any).input ??
            (elicited as any).confirmation ??
            undefined,
          choice: (elicited as any).choice
        };
      },

      notify: (event, data) => {
        if (enableLogging) {
          // Notifications are optional - only log if available
          try {
            const notifier = (context.agent as any)?.server?.notification ||
                           (context.agent as any)?.notification;
            if (notifier) {
              notifier(event, data);
            }
          } catch {
            // Ignore notification errors
          }
        }
      },
      progress: (update) => {
        if (!progressToken) return;
        try {
          const notifier = (context.agent as any)?.server?.notification ||
                         (context.agent as any)?.notification;
          if (notifier) {
            notifier("notifications/progress", { progressToken, ...update });
          }
        } catch {
          // Ignore notification errors
        }
      },
      notifyResourceUpdated: (uri: string) => {
        try {
          const notifier = (context.agent as any)?.server?.notification ||
                         (context.agent as any)?.notification;
          if (notifier) {
            notifier("notifications/resources/updated", { uri });
          }
        } catch {
          // Ignore notification errors
        }
      },
      notifyResourcesListChanged: () => {
        try {
          const notifier = (context.agent as any)?.server?.notification ||
                         (context.agent as any)?.notification;
          if (notifier) {
            notifier("notifications/resources/list_changed", {});
          }
        } catch {
          // Ignore notification errors
        }
      },
      notifyPromptsListChanged: () => {
        try {
          const notifier = (context.agent as any)?.server?.notification ||
                         (context.agent as any)?.notification;
          if (notifier) {
            notifier("notifications/prompts/list_changed", {});
          }
        } catch {
          // Ignore notification errors
        }
      },
      notifyToolsListChanged: () => {
        try {
          const notifier = (context.agent as any)?.server?.notification ||
                         (context.agent as any)?.notification;
          if (notifier) {
            notifier("notifications/tools/list_changed", {});
          }
        } catch {
          // Ignore notification errors
        }
      },

      formatBytes: (bytes) => {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
      },

      processBatch: async (items, batchSize, processor) => {
        const results = [];
        const totalBatches = Math.ceil(items.length / batchSize);

        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          const batchNumber = Math.floor(i / batchSize) + 1;

          if (enableLogging) {
            try {
              const notifier = (context.agent as any)?.server?.notification ||
                             (context.agent as any)?.notification;
              if (notifier) {
                notifier(`${toolName}:batch`, {
                  operation,
                  current: batchNumber,
                  total: totalBatches,
                  size: batch.length
                });
              }
            } catch {
              // Ignore notification errors
            }
          }

          const result = await processor(batch);
          results.push(result);
        }

        return {
          batches: totalBatches,
          itemsProcessed: items.length,
          results
        };
      },

      validateRequired: (params, required) => {
        const missing = required.filter(field => !params[field]);
        if (missing.length > 0) {
          throw new Error(`Missing required parameters: ${missing.join(', ')}`);
        }
      },

      log: (level, message, data) => {
        if (enableLogging) {
          try {
            const notifier = (context.agent as any)?.server?.notification ||
                           (context.agent as any)?.notification;
            if (notifier) {
              notifier("notifications/message", {
                level,
                logger: toolName,
                data: { message, ...(data ?? {}), timestamp: new Date().toISOString() }
              });
            }
          } catch {
            // Ignore notification errors
          }
        }
      }
    };
  }

  /**
   * Build operation descriptions for schema
   */
  protected static buildOperationDescriptions(): string {
    const grouped = this.groupOperationsByCategory();
    const lines: string[] = [];

    for (const [category, ops] of Object.entries(grouped)) {
      if (ops.length > 0) {
        lines.push(`\n${this.formatCategory(category)}:`);
        for (const opName of ops) {
          const op = this.operations[opName];
          lines.push(`  • ${opName}: ${op.description}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Group operations by category
   */
  protected static groupOperationsByCategory(): Record<string, string[]> {
    const groups: Record<string, string[]> = {
      read: [],
      write: [],
      delete: [],
      analyze: [],
      other: []
    };

    for (const [name, op] of Object.entries(this.operations)) {
      const category = op.category || 'other';
      groups[category].push(name);
    }

    return groups;
  }

  /**
   * Format category name for display
   */
  protected static formatCategory(category: string): string {
    const formatted: Record<string, string> = {
      read: '📖 Read Operations',
      write: '✏️ Write Operations',
      delete: '🗑️ Delete Operations',
      analyze: '📊 Analysis Operations',
      other: '🔧 Other Operations'
    };
    return formatted[category] || category;
  }

  /**
   * Build examples from operations
   */
  protected static buildExamples(): any[] {
    const examples: any[] = [];

    for (const [name, op] of Object.entries(this.operations)) {
      if (op.examples && op.examples.length > 0) {
        for (const example of op.examples) {
          examples.push({
            operation: name,
            params: example,
            description: `Example: ${op.description}`
          });
        }
      } else {
        // Generate default example based on schema
        try {
          const defaultParams = this.generateDefaultParams(op.params);
          if (defaultParams) {
            examples.push({
              operation: name,
              params: defaultParams,
              description: `Example: ${op.description}`
            });
          }
        } catch {
          // Skip if can't generate default
        }
      }

      // Limit to 5 examples total
      if (examples.length >= 5) break;
    }

    return examples;
  }

  /**
   * Generate default parameters from schema
   */
  protected static generateDefaultParams(schema: z.ZodSchema<any>): any {
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const params: any = {};

      for (const [key, value] of Object.entries(shape)) {
        if (value instanceof z.ZodString) {
          params[key] = "example";
        } else if (value instanceof z.ZodNumber) {
          params[key] = 10;
        } else if (value instanceof z.ZodBoolean) {
          params[key] = true;
        } else if (value instanceof z.ZodArray) {
          params[key] = [];
        } else if (value instanceof z.ZodOptional) {
          // Skip optional fields in examples
        }
      }

      return Object.keys(params).length > 0 ? params : null;
    }
    return null;
  }

  /**
   * Build tool hints
   */
  protected static buildHints(): any {
    const hints: any = {
      destructive: [],
      requiresConfirmation: [],
      supportsPagination: [],
      batchOperations: [],
      categories: {}
    };

    for (const [name, op] of Object.entries(this.operations)) {
      if (op.category === 'delete') {
        hints.destructive.push(name);
      }
      if (op.requiresConfirmation) {
        hints.requiresConfirmation.push(name);
      }
      if (op.supportsPagination) {
        hints.supportsPagination.push(name);
      }
      if (op.batchOperation) {
        hints.batchOperations.push(name);
      }

      const category = op.category || 'other';
      if (!hints.categories[category]) {
        hints.categories[category] = [];
      }
      hints.categories[category].push(name);
    }

    return hints;
  }

  /**
   * Register resources
   */
  protected static registerResources(server: McpServer, context: ToolContext): void {
    if (!this.resources) return;

    for (const resource of this.resources) {
      server.resource(
        resource.uri,
        resource.description,
        async () => {
          const data = await resource.handler(context);
          return {
            contents: [{
              uri: resource.uri,
              mimeType: "application/json",
              text: JSON.stringify(data, null, 2)
            }]
          };
        }
      );
    }
  }

  /**
   * Register prompts
   */
  protected static registerPrompts(server: McpServer, context: ToolContext): void {
    if (!this.prompts) return;

    for (const prompt of this.prompts) {
      server.prompt(
        prompt.name,
        prompt.description,
        (prompt.params as z.ZodObject<any>).shape as any,
        async (params: any) => {
          const result = await prompt.handler(params, context);
          return result;
        }
      );
    }
  }

  /**
   * Register metrics resource
   */
  protected static registerMetricsResource(server: McpServer, context: ToolContext): void {
    server.resource(
      `metrics://${this.toolName}`,
      `Performance metrics for ${this.toolName}`,
      async () => {
        const metrics: Record<string, any> = {
          tool: this.toolName,
          operations: {} as any
        };

        for (const [op, count] of this.metrics.operationCounts.entries()) {
          metrics.operations[op] = {
            calls: count,
            errors: this.metrics.errorCounts.get(op) || 0,
            averageLatency: this.metrics.averageLatency.get(op) || 0,
            successRate: count > 0
              ? ((count - (this.metrics.errorCounts.get(op) || 0)) / count * 100).toFixed(2) + '%'
              : '0%'
          };
        }

        metrics.recentErrors = this.metrics.lastErrors.slice(-10);

        return {
          contents: [{
            uri: `metrics://${this.toolName}`,
            mimeType: "application/json",
            text: JSON.stringify(metrics, null, 2)
          }]
        };
      }
    );
  }

  /**
   * Sanitize parameters for logging (remove sensitive data)
   */
  protected static sanitizeParams(params: any): any {
    if (!params) return params;

    const sanitized = { ...params };
    const sensitiveFields = ['apiKey', 'password', 'token', 'secret', 'connectionString'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    // Sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeParams(value);
      }
    }

    return sanitized;
  }

  /**
   * Format Zod validation errors
   */
  protected static formatZodError(error: z.ZodError): string {
    const messages = error.errors.map(err => {
      const path = err.path.join('.');
      return `${path}: ${err.message}`;
    });
    return messages.join('; ');
  }

  /**
   * Record successful operation
   */
  protected static recordSuccess(operation: string, latency: number): void {
    // Update operation count
    const count = this.metrics.operationCounts.get(operation) || 0;
    this.metrics.operationCounts.set(operation, count + 1);

    // Update average latency
    const avgLatency = this.metrics.averageLatency.get(operation) || 0;
    const newAvg = (avgLatency * count + latency) / (count + 1);
    this.metrics.averageLatency.set(operation, newAvg);
  }

  /**
   * Record operation error
   */
  protected static recordError(operation: string, error: Error): void {
    // Update error count
    const count = this.metrics.errorCounts.get(operation) || 0;
    this.metrics.errorCounts.set(operation, count + 1);

    // Add to recent errors
    this.metrics.lastErrors.push({
      operation,
      error: error.message,
      timestamp: new Date()
    });

    // Keep only last 100 errors
    if (this.metrics.lastErrors.length > 100) {
      this.metrics.lastErrors.shift();
    }
  }

  /**
   * Reset metrics (useful for testing)
   */
  static resetMetrics(): void {
    this.metrics = {
      operationCounts: new Map(),
      errorCounts: new Map(),
      averageLatency: new Map(),
      lastErrors: []
    };
  }

  /**
   * Get current metrics
   */
  static getMetrics(): ToolMetrics {
    return { ...this.metrics };
  }
}

/**
 * Helper function to create a dynamic tool class
 */
export function createDynamicTool(
  config: {
    toolName: string;
    description: string;
    operations: Record<string, OperationDefinition>;
    resources?: any[];
    prompts?: any[];
  }
): typeof DynamicTool {
  return class extends DynamicTool {
    static readonly toolName = config.toolName;
    static readonly description = config.description;
    static readonly operations = config.operations;
    static readonly resources = config.resources;
    static readonly prompts = config.prompts;
  };
}
