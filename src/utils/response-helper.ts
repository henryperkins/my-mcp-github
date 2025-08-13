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
    // Handle explicit nulls → undefined so downstream always receives a function or undefined
    const summarizerCandidate =
      options?.summarizer !== undefined
        ? options.summarizer
        : this.getSummarizer?.();

    const summarizer =
      summarizerCandidate === null ? undefined : summarizerCandidate;

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
  /**
   * Wrap a potentially long-running operation with a timeout.
   * Accepts either a thunk (() => Promise) *preferred* or an already-started Promise.
   */
  async executeWithTimeout<T>(
    operation: Promise<T> | (() => Promise<T>),
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
    operationName: string,
    errorContext: Record<string, any>,
  ): Promise<any> {
    try {
      const opFn = typeof operation === 'function' ? (operation as () => Promise<T>) : () => operation;
      const result = await withTimeout(opFn, timeoutMs, operationName);
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
        // Ensure the operation starts *inside* the timeout window
        const result = await withTimeout(() => operation(params), timeoutMs, toolName);
        return this.formatSuccess(result);
      } catch (error) {
        return this.formatError(error, errorContext);
      }
    };
  }
}
