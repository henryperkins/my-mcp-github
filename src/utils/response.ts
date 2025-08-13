// src/utils/response.ts
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

  const result = { ...obj };

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
 */
export async function formatResponse(
  data: any,
  opts?: { maxSize?: number; summarizer?: Summarizer; summaryMaxTokens?: number; structuredContent?: any }
): Promise<MCPResponse> {
  const maxSize = opts?.maxSize ?? 20000;
  const summaryMaxTokens = opts?.summaryMaxTokens ?? 800;

  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);

  if (text.length > maxSize) {
    // For arrays, paginate/truncate guidance
    if (Array.isArray(data)) {
      const payload = {
        message:
          "Response truncated due to size. Use pagination parameters (skip/top) to retrieve data in chunks.",
        totalItems: data.length,
        truncated: true,
        firstItems: data.slice(0, 10),
        recommendation: "Use skip and top parameters to paginate through results"
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
            message:
              "Response was too large and has been intelligently summarized.",
            hint:
              "To see specific sections, use targeted queries or pagination parameters."
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
export function formatToolError(insight: string | { message: string; [key: string]: any }): MCPResponse {
  const text = typeof insight === 'string' ? insight : JSON.stringify(insight, null, 2);
  return {
    content: [{ type: "text", text }],
    isError: true
  };
}

// Re-export normalizeError so tools can import only from utils (to avoid cycles)
export { normalizeError } from "../insights";