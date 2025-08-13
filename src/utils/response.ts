// src/utils/response.ts
/* eslint-disable @typescript-eslint/consistent-type-imports */

import { withTimeout } from "./timeout";
import { DEFAULT_TIMEOUT_MS, MAX_RESPONSE_SIZE_BYTES, DEFAULT_SUMMARY_MAX_TOKENS } from "../constants";
import { normalizeError } from "../insights";

// Utilities for consistent MCP response formatting and error normalization

export type MCPTextContent = { type: "text"; text: string };
export type MCPResponse = {
  content: MCPTextContent[];
  structuredContent?: any;
  isError?: boolean;
};

// Optional summarizer abstraction (e.g., AzureOpenAIClient.summarize)
export type Summarizer = (text: string, maxTokens: number) => Promise<string>;

/**
 * Truncate large arrays within a response object to keep payload sizes manageable.
 * Applies special handling for common Azure Search response shapes.
 */
export function truncateLargeArrays(obj: any, maxSize: number): any {
  const str = JSON.stringify(obj);
  if (str.length <= maxSize) return obj;

  const result: any = { ...obj };

  // Execution history (indexers)
  if (result.executionHistory && Array.isArray(result.executionHistory)) {
    result.executionHistory = result.executionHistory.slice(0, 5);
    result.executionHistoryTruncated = true;
    result.totalExecutions = obj.executionHistory.length;
  }

  // Generic collection wrapper { value: [...] }
  if (result.value && Array.isArray(result.value)) {
    const original = result.value.length;
    result.value = result.value.slice(0, 10);
    result.truncated = true;
    result.totalResults = original;
  }

  // Error arrays
  if (result.errors && Array.isArray(result.errors) && result.errors.length > 10) {
    result.errors = result.errors.slice(0, 10);
    result.errorsTruncated = true;
    result.totalErrors = obj.errors.length;
  }

  return result;
}

/**
 * Format any data into an MCP text response. If content is too large:
 *  - Arrays: returns truncated preview and pagination hint
 *  - Objects: attempts summarization if a summarizer is provided; falls back to truncation
 *
 * Format options:
 *  - "full": Return complete data (default)
 *  - "summary": Force summarization if possible
 *  - "minimal": Return only essential fields
 */
export async function formatResponse(
  data: any,
  opts?: {
    maxSize?: number;
    summarizer?: Summarizer;
    summaryMaxTokens?: number;
    structuredContent?: any;
    format?: "full" | "summary" | "minimal";
  }
): Promise<MCPResponse> {
  const maxSize = opts?.maxSize ?? MAX_RESPONSE_SIZE_BYTES;
  const summaryMaxTokens = opts?.summaryMaxTokens ?? DEFAULT_SUMMARY_MAX_TOKENS;
  const format = opts?.format ?? "full";

  // Apply format-specific transformations
  let formattedData = data;

  if (format === "minimal" && typeof data === "object" && data !== null) {
    // Extract only essential fields for minimal format
    if (Array.isArray(data)) {
      formattedData = data.slice(0, 5).map((item: any) => {
        if (typeof item === "object" && item !== null) {
          // Keep only key fields
          const minimal: any = {};
          ["name", "id", "key", "title", "status", "type", "count", "message"].forEach((field) => {
            if (field in item) minimal[field] = item[field];
          });
          return Object.keys(minimal).length > 0 ? minimal : item;
        }
        return item;
      });
      if (data.length > 5) {
        formattedData = {
          items: formattedData,
          totalCount: data.length,
          format: "minimal",
          note: "Showing first 5 items with essential fields only",
        };
      }
    } else if ((data as any).value && Array.isArray((data as any).value)) {
      // Handle OData responses
      formattedData = {
        ...data,
        value: (data as any).value.slice(0, 5),
        format: "minimal",
        note: "Minimal format - showing first 5 items",
      };
    }
  } else if (format === "summary" && opts?.summarizer) {
    // Force summarization for summary format
    try {
      const fullText = typeof data === "string" ? data : JSON.stringify(data, null, 2);
      const summary = await opts.summarizer(fullText, summaryMaxTokens);
      formattedData = {
        format: "summary",
        summary,
        originalSize: fullText.length,
        message: "Response summarized as requested",
      };
    } catch {
      // Fall back to truncation if summarization fails
      formattedData = truncateLargeArrays(data, maxSize / 2);
    }
  }

  const text = typeof formattedData === "string" ? formattedData : JSON.stringify(formattedData, null, 2);

  if (text.length > maxSize && format !== "summary") {
    // For arrays, paginate/truncate guidance
    if (Array.isArray(data)) {
      const payload = {
        message:
          "Response truncated due to size. Use pagination parameters (skip/top) to retrieve data in chunks.",
        totalItems: data.length,
        truncated: true,
        firstItems: data.slice(0, 10),
        recommendation: "Use skip and top parameters to paginate through results",
      };
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    }

    // For objects, try summarization if available
    if (typeof data === "object" && data !== null) {
      if (opts?.summarizer) {
        try {
          const summary = await opts.summarizer(text, summaryMaxTokens);
          const payload = {
            summarized: true,
            originalSize: text.length,
            summary,
            message: "Response was too large and has been intelligently summarized.",
            hint: "To see specific sections, use targeted queries or pagination parameters.",
          };
          return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
        } catch {
          // Fall through to truncation on summarization failure
        }
      }

      // Fallback truncation for objects
      const truncated = truncateLargeArrays(data, maxSize);
      return { content: [{ type: "text", text: JSON.stringify(truncated, null, 2) }] };
    }
  }

  const response: MCPResponse = { content: [{ type: "text", text }] };

  // Add structuredContent if provided and response isn't too large
  if (opts?.structuredContent && text.length <= maxSize) {
    response.structuredContent = opts.structuredContent;
  }

  return response;
}

/**
 * Minimal error formatting to MCP text content.
 * Prefer normalizeError for structured insights when appropriate.
 */
export function formatError(error: any): MCPResponse {
  return { content: [{ type: "text", text: `Error: ${String(error)}` }] };
}

/**
 * Format tool execution errors with proper isError flag for MCP compliance.
 * Use this in tool catch blocks to signal tool-level failures to clients.
 */
export function formatToolError(
  insight: string | { message: string;[key: string]: any }
): MCPResponse {
  const text = typeof insight === "string" ? insight : JSON.stringify(insight, null, 2);
  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}

/**
 * Map HTTP-ish errors to MCP error envelopes.
 */
export function formatMcpError(err: any, requestId?: string): MCPResponse {
  const status = err?.status ?? err?.response?.status;
  const map: Record<number, string> = {
    400: "invalid_request",
    401: "unauthorized",
    403: "unauthorized",
    404: "resource_not_found",
    409: "conflict",
    412: "conflict",
    429: "rate_limited",
  };
  const error =
    map[status as number] ??
    (typeof status === "number" && status >= 500 ? "server_error" : "unknown_error");
  const body = {
    error,
    status,
    message: String(err?.message ?? err),
    requestId: requestId ?? err?.requestId ?? err?.headers?.["x-ms-request-id"],
  };
  return {
    content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
    isError: true,
  };
}

/**
 * Standard response formatter for all tool operations
 */
export class ResponseFormatter {
  constructor(
    private readonly getSummarizer?: () =>
      | ((text: string, maxTokens?: number) => Promise<string>)
      | null
  ) { }

  /**
   * Format a successful response
   */
  async formatSuccess(
    result: any,
    options?: {
      summarizer?: ((text: string, maxTokens?: number) => Promise<string>) | null;
      structuredContent?: any;
    }
  ): Promise<MCPResponse> {
    const summarizerCandidate =
      options?.summarizer !== undefined ? options.summarizer : this.getSummarizer?.();

    const summarizer =
      summarizerCandidate === null ? undefined : summarizerCandidate ?? undefined;

    return formatResponse(result, {
      summarizer,
      structuredContent: options?.structuredContent ?? result,
    });
  }

  /**
   * Format an error response with context
   */
  formatError(error: any, context: Record<string, any>): MCPResponse {
    const { insight } = normalizeError(error, context);
    return formatToolError(insight);
  }

  /**
   * Wrap a potentially long-running operation with a timeout.
   * Accepts either a thunk (() => Promise) *preferred* or an already-started Promise.
   */
  async executeWithTimeout<T>(
    operation: Promise<T> | (() => Promise<T>),
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
    operationName: string,
    errorContext: Record<string, any>
  ): Promise<MCPResponse> {
    try {
      const op =
        typeof operation === "function" ? (operation as () => Promise<T>) : () => operation;
      const result = await withTimeout(op, timeoutMs, operationName);
      return this.formatSuccess(result);
    } catch (error) {
      return this.formatError(error, { ...errorContext, operation: operationName });
    }
  }

  /**
   * Create a standard tool executor with timeout and error handling
   */
  createToolExecutor<TParams>(toolName: string, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    return async (
      params: TParams,
      operation: (params: TParams) => Promise<any>,
      additionalContext?: Record<string, any>
    ): Promise<MCPResponse> => {
      const errorContext = {
        tool: toolName,
        ...params,
        ...additionalContext,
      };

      try {
        const result = await withTimeout(() => operation(params), timeoutMs, toolName);
        return this.formatSuccess(result);
      } catch (error) {
        return this.formatError(error, errorContext);
      }
    };
  }
}

// Re-export normalizeError so tools can import only from utils (to avoid cycles)
export { normalizeError };
