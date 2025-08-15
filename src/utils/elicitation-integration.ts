// MCP Elicitation Integration Helper
// Provides a bridge between MCP tools and the elicitation protocol

import { 
  ElicitationRequest, 
  ElicitationResult,
  processElicitationResponse
} from "../tool-elicitation";
import { log } from "./logging";
import { withTimeout } from "./timeout";
import { DEFAULT_TIMEOUT_MS } from "../constants";

// Dedicated timeout for elicitation requests to avoid hanging tools
const ELICITATION_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;

/**
 * Helper to perform MCP elicitation if the server supports it
 * Returns elicited values or undefined if elicitation is not available or fails
 * 
 * As of Cloudflare Agents SDK update (2025-08-05), elicitation is now supported
 * via the elicitInput method on the agent/server context.
 */
export async function elicitIfNeeded(
  serverContext: any,
  request: ElicitationRequest
): Promise<Record<string, any> | undefined> {
  // Check for the elicitInput method (available in Cloudflare Agents SDK)
  // According to Cloudflare docs, it should be available as this.elicitInput on McpAgent
  const elicitMethod =
    serverContext?.elicitInput ||
    serverContext?.server?.elicitInput ||
    serverContext?.agent?.elicitInput;
  const owner = serverContext?.elicitInput
    ? serverContext
    : serverContext?.server?.elicitInput
    ? serverContext?.server
    : serverContext?.agent?.elicitInput
    ? serverContext?.agent
    : undefined;
    
  if (!elicitMethod || !owner) {
    log("debug", "Server does not support elicitation (no elicitInput method found)", {
      hasDirectElicit: !!serverContext?.elicitInput,
      hasServerElicit: !!serverContext?.server?.elicitInput,
      hasAgentElicit: !!serverContext?.agent?.elicitInput,
      contextType: serverContext?.constructor?.name
    });
    return undefined;
  }

  try {
    // Use the Cloudflare Agents SDK elicitInput method
    // It automatically handles the MCP protocol communication
    log("debug", "Attempting elicitation via elicitInput", {
      ownerType: owner?.constructor?.name,
      hasBound: !!(elicitMethod as any).bind,
    });
    const response = await withTimeout(
      () => (elicitMethod as any).call(owner, {
        message: request.message,
        requestedSchema: request.requestedSchema,
      }),
      ELICITATION_TIMEOUT_MS,
      "elicitInput"
    );

    // The response should contain action and optional content
    const responseData = response as any;
    const result: ElicitationResult = {
      action: responseData?.action || "cancel",
      content: responseData?.content
    };

    // Process and validate the response
    const processed = processElicitationResponse(result, request.requestedSchema);
    
    if (processed.valid && processed.data) {
      return processed.data;
    }
    
    return undefined;
  } catch (error) {
    // Log the error but don't fail the tool - use provided params as fallback
    log("error", "Elicitation failed", { error });
    log("debug", "Server context structure", {
      hasElicitInput: !!serverContext?.elicitInput,
      hasServerElicitInput: !!serverContext?.server?.elicitInput,
      hasAgentElicitInput: !!serverContext?.agent?.elicitInput,
      serverType: serverContext?.constructor?.name
    });
    return undefined;
  }
}

/**
 * Helper to merge elicited values with provided parameters
 * Provided parameters take precedence over elicited values
 */
export function mergeElicitedParams<T extends Record<string, any>>(
  provided: T,
  elicited: Record<string, any> | undefined
): T {
  if (!elicited) {
    return provided;
  }

  const merged: any = { ...provided };
  
  // Only use elicited values for undefined/null parameters
  for (const [key, value] of Object.entries(elicited)) {
    if (merged[key] === undefined || merged[key] === null) {
      merged[key] = value;
    }
  }
  
  return merged as T;
}

/**
 * Check if required parameters are missing
 */
export function needsElicitation(
  params: Record<string, any>,
  required: string[]
): boolean {
  return required.some(field => 
    params[field] === undefined || 
    params[field] === null || 
    params[field] === ""
  );
}
