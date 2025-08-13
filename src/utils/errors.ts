// src/utils/errors.ts
/**
 * Map HTTP-ish errors to MCP error envelopes.
 */
export function formatMcpError(err: any, requestId?: string) {
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
  const error = map[status] ?? (status >= 500 ? "server_error" : "unknown_error");
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

export default formatMcpError;