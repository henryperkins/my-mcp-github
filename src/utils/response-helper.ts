// src/utils/response-helper.ts
import { formatResponse, formatToolError, normalizeError } from "./response";
import { withTimeout } from "./timeout";
import { DEFAULT_TIMEOUT_MS } from "../constants";

export interface ResponseFormatterOptions {
  summarizer?: ((text: string, maxTokens?: number) => Promise<string>) | null;
  structuredContent?: any;
}

/**
 * Standard response formatter for all tool operations
 */
export class ResponseFormatter {
  constructor(private readonly getSummarizer?: () => ((text: string, maxTokens?: number) => Promise<string>) | null) {}

  /**
   * Format a successful response
   */
  async formatSuccess(result: any, options?: Partial<ResponseFormatterOptions>): Promise<any> {
    const summarizer = options?.summarizer ?? this.getSummarizer?.() ?? undefined;
    return formatResponse(result, {
      summarizer,
      structuredContent: options?.structuredContent ?? result,
    });
  }

  /**
   * Format an error response with context
   */
  formatError(error: any, context: Record<string, any>): any {
    const { insight } = normalizeError(error, context);
    return formatToolError(insight);
  }

  /**
   * Execute an operation with timeout and format the response
   */
  async executeWithTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
    operationName: string,
    errorContext: Record<string, any>,
  ): Promise<any> {
    try {
      const result = await withTimeout(operation, timeoutMs, operationName);
      return this.formatSuccess(result);
    } catch (error) {
      return this.formatError(error, { ...errorContext, operation: operationName });
    }
  }

  /**
   * Create a standard tool executor with timeout and error handling
   */
  createToolExecutor<TParams>(toolName: string, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    return async (params: TParams, operation: (params: TParams) => Promise<any>, additionalContext?: Record<string, any>): Promise<any> => {
      const errorContext = {
        tool: toolName,
        ...params,
        ...additionalContext,
      };

      try {
        const result = await withTimeout(operation(params), timeoutMs, toolName);
        return this.formatSuccess(result);
      } catch (error) {
        return this.formatError(error, errorContext);
      }
    };
  }
}
