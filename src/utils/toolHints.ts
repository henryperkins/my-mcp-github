// src/utils/toolHints.ts
export type Http = "GET" | "PUT" | "POST" | "DELETE";
/**
 * MCP tool behavior hints so the client/LLM can reason about impact.
 */
export function getToolHints(method: Http) {
  return {
    readOnlyHint: method === "GET",
    destructiveHint: method === "DELETE",
    idempotentHint:
      method === "GET" ||
      method === "PUT" ||
      method === "DELETE",
  } as const;
}

export default getToolHints;