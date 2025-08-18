// src/index-dynamic.ts
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AzureSearchClient } from "./azure-search-client";
import { AzureOpenAIClient } from "./azure-openai-client";
import { registerResources } from "./resources";
import { setLogLevel } from "./utils/logging";
import type { ToolContext } from "./types";

import { IndexTool } from "./dynamic-tools/IndexTool";
import { DocumentTool } from "./dynamic-tools/DocumentTool";
import { DataSourceTool } from "./dynamic-tools/DataSourceTool";
import { IndexerTool } from "./dynamic-tools/IndexerTool";
import { SkillsetTool } from "./dynamic-tools/SkillsetTool";
import { KnowledgeAgentTool } from "./dynamic-tools/KnowledgeAgentTool";
import { KnowledgeSourceTool } from "./dynamic-tools/KnowledgeSourceTool";
import { ServiceTool } from "./dynamic-tools/ServiceTool";
import { registerPrompts } from "./dynamic-tools/prompts";
import { registerAdvancedPrompts } from "./dynamic-tools/prompts/advanced";

// Add below imports
const addCors = (r: Response, req?: Request) => {
  const h = new Headers(r.headers);
  // CORS for remote clients (Claude Desktop/Code via local proxy or direct)
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  // Ensure no caching or transformation on API/SSE responses
  const ct = h.get("Content-Type") || "";
  const isSSE = ct.includes("event-stream");
  if (isSSE) {
    // SSE must not be compressed or transformed; keep-alive for long-lived streams
    h.set("Content-Type", "text/event-stream; charset=utf-8");
    h.set("Cache-Control", "no-store, no-transform");
    h.set("Content-Encoding", "identity");
    h.set("Connection", "keep-alive");
  } else if (!h.has("Cache-Control")) {
    // Default: do not cache dynamic MCP responses
    h.set("Cache-Control", "no-store");
  }
  // Minimal request correlation to aid debugging with Claude/Cloudflare Ray IDs
  const rid = req?.headers.get("x-request-id") || `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
  h.set("x-request-id", rid);
  h.set("x-mcp-server", "azure-ai-search-mcp-dynamic");
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
};

class AzureSearchMCPDynamic extends McpAgent {
  server = new McpServer({
    name: "azure-ai-search-mcp-dynamic",
    version: "2.0.0"
  }, {
    capabilities: {
      logging: {},
      prompts: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      tools: { listChanged: true }
    },
    instructions: `Azure AI Search MCP Server - Usage Guidelines:

1. **Pagination**: Use cursor-based pagination for large result sets. When you receive a 'nextCursor' in responses, pass it back as 'cursor' parameter to get the next page.

2. **Large Responses**: Responses over 20KB are automatically summarized using GPT-4o-mini when configured, or truncated with guidance.

3. **Confirmations**: Destructive operations (delete, reset) support elicitation for safety confirmations when the client supports it.

4. **Vector Search**: For hybrid search, use the 'vectors' parameter in DocumentOperations.search with your embedding values.

5. **Performance**: 
   - Use 'select' to limit returned fields
   - Set 'includeTotalCount: false' for faster queries
   - Batch document operations when possible

6. **Error Handling**: All errors include structured insights with suggested remediation steps.

7. **Logging**: Use logging/setLevel to control log verbosity (debug, info, warning, error, etc.)

For detailed documentation, see: https://github.com/azure-search-mcp/docs`
  });

  private cachedClient: AzureSearchClient | null = null;
  private cachedOpenAIClient: AzureOpenAIClient | null = null;

  private getClient(): AzureSearchClient {
    if (this.cachedClient) return this.cachedClient;
    const env = this.env as any;
    const endpoint = env.AZURE_SEARCH_ENDPOINT;
    const apiKey = env.AZURE_SEARCH_API_KEY;
    if (!endpoint || !apiKey) throw new Error("Missing AZURE_SEARCH_* config");
    this.cachedClient = new AzureSearchClient(endpoint, apiKey);
    return this.cachedClient;
  }

  private getOpenAIClient(): AzureOpenAIClient | null {
    if (this.cachedOpenAIClient !== null) return this.cachedOpenAIClient;
    const env = this.env as any;
    const endpoint = env.AZURE_OPENAI_ENDPOINT;
    const apiKey = env.AZURE_OPENAI_API_KEY;
    const deployment = env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";
    this.cachedOpenAIClient = endpoint && apiKey ? new AzureOpenAIClient(endpoint, apiKey, deployment) : null;
    return this.cachedOpenAIClient;
  }
async init() {
  // Lazy-init Azure Search client at first use to avoid blocking MCP handshake when secrets are missing.
  
    // Add logging/setLevel handler to fulfill MCP protocol requirement
    const { z } = await import("zod");
    const loggingSetLevelSchema = z.object({
      method: z.literal('logging/setLevel'),
      params: z.object({
        level: z.enum(['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'])
      })
    });
    
    this.server.server.setRequestHandler(loggingSetLevelSchema, async (request) => {
      const { level } = request.params;
      
      // Map MCP LoggingLevel to internal levels
      const levelMap: Record<string, string> = {
        'debug': 'debug',
        'info': 'info',
        'notice': 'info',    // Map notice to info
        'warning': 'warn',
        'error': 'error',
        'critical': 'error', // Map critical to error
        'alert': 'error',    // Map alert to error
        'emergency': 'error' // Map emergency to error
      };
      
      const internalLevel = levelMap[level] || 'info';
      setLogLevel(internalLevel as any);
      
      // Return EmptyResult
      return {};
    });

    const toolContext: ToolContext = {
      getClient: () => this.getClient(),
      getSummarizer: () => {
        const ai = this.getOpenAIClient();
        return ai ? (text: string, maxTokens?: number) => ai.summarize(text, maxTokens) : null;
      },
      agent: this
    };

    // Register dynamic tools only
    IndexTool.register(this.server, toolContext, {
      includeResources: true,
      includePrompts: true,
      enableLogging: true,
      enableMetrics: true
    });

    DocumentTool.register(this.server, toolContext, {
      includeResources: true,
      includePrompts: true,
      enableLogging: true,
      enableMetrics: true
    });

    DataSourceTool.register(this.server, toolContext, {
      includeResources: true,
      includePrompts: true,
      enableLogging: true,
      enableMetrics: true
    });

    IndexerTool.register(this.server, toolContext, {
      includeResources: true,
      includePrompts: true,
      enableLogging: true,
      enableMetrics: true
    });

    SkillsetTool.register(this.server, toolContext, {
      includeResources: true,
      includePrompts: true,
      enableLogging: true,
      enableMetrics: true
    });

    ServiceTool.register(this.server, toolContext, {
      includeResources: true,
      includePrompts: true,
      enableLogging: true,
      enableMetrics: true
    });

    KnowledgeAgentTool.register(this.server, toolContext, {
      includeResources: true,
      includePrompts: true,
      enableLogging: true,
      enableMetrics: true
    });

    KnowledgeSourceTool.register(this.server, toolContext, {
      includeResources: true,
      includePrompts: true,
      enableLogging: true,
      enableMetrics: true
    });

    // Note: Resources are now registered by individual dynamic tools
    // registerResources(this.server, () => this.getClient());

    // Register prompts for guided workflows
    registerPrompts(this.server, toolContext);
    registerAdvancedPrompts(this.server, toolContext);
  }
}

// Create handlers for both transport methods
// Explicitly bind to the Durable Object namespace configured in wrangler.jsonc
const sseHandler = AzureSearchMCPDynamic.serveSSE("/sse", { binding: "MCP_OBJECT" });
const mcpHandler = AzureSearchMCPDynamic.serve("/mcp", { binding: "MCP_OBJECT" });

export default {
  async fetch(request: Request, envIn: unknown, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // Basic access log for observability
    try {
      console.log(`[mcp] ${method} ${pathname}`);
    } catch {}

    // Handle CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    // Health check (for route/DNS/WAF validation)
    if (pathname === "/health") {
      if (method === "HEAD") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
            "x-mcp-server": "azure-ai-search-mcp-dynamic"
          }
        });
      }
      return new Response(
        JSON.stringify({
          ok: true,
          service: "azure-ai-search-mcp-dynamic",
          transports: ["sse", "http"],
          time: Date.now(),
          routes: ["/sse", "/mcp", "/transport-test/sse"]
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
            "x-mcp-server": "azure-ai-search-mcp-dynamic"
          }
        }
      );
    }

    // Transport probe: simple SSE stream with heartbeats to validate long-lived connections through WAF/CDN
    if (pathname.startsWith("/transport-test/sse")) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          let i = 0;
          // Send an initial comment to open the stream promptly
          controller.enqueue(encoder.encode(`: stream-open ${new Date().toISOString()}\n\n`));
          const interval = setInterval(() => {
            i += 1;
            controller.enqueue(encoder.encode(`event: ping\n`));
            controller.enqueue(encoder.encode(`data: {"seq":${i},"ts":${Date.now()}}\n\n`));
            // Keep it open for a while; close after 2 minutes to prove stability
            if (i >= 120) {
              clearInterval(interval);
              controller.enqueue(encoder.encode(`event: close\n`));
              controller.enqueue(encoder.encode(`data: "done"\n\n`));
              controller.close();
            }
          }, 1000);
        },
        cancel() {}
      });

      const res = new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store, no-transform",
          "Content-Encoding": "identity",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "x-mcp-server": "azure-ai-search-mcp-dynamic"
        }
      });
      return res;
    }

    // Route to SSE handler
    if (pathname.startsWith("/sse")) {
      const envObj = envIn as any;
      if (!envObj || !envObj.MCP_OBJECT) {
        // Fail fast with a clear error instead of throwing inside the SDK
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32002,
              message: "missing_durable_object_binding",
              data: {
                binding: "MCP_OBJECT",
                hint: "Ensure wrangler.jsonc durable_objects.bindings has name MCP_OBJECT for class AzureSearchMCPDynamic, and redeploy.",
              }
            },
            id: null
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              "x-mcp-server": "azure-ai-search-mcp-dynamic",
              "x-error": "missing-binding",
            },
          }
        );
      }
      try {
        const res = await sseHandler.fetch(request, envObj, ctx);
        return addCors(res, request);
      } catch (e: any) {
        const body = JSON.stringify({
          error: "sse_handler_error",
          message: e?.message || String(e),
        });
        return new Response(body, {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "x-mcp-server": "azure-ai-search-mcp-dynamic",
            "x-error": "sse-handler",
          },
        });
      }
    }

    // Route to Streamable HTTP handler
    if (pathname.startsWith("/mcp")) {
      const envObj = envIn as any;
      if (!envObj || !envObj.MCP_OBJECT) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32002,
              message: "missing_durable_object_binding",
              data: {
                binding: "MCP_OBJECT",
                hint: "Ensure wrangler.jsonc durable_objects.bindings has name MCP_OBJECT for class AzureSearchMCPDynamic, and redeploy.",
              }
            },
            id: null
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              "x-mcp-server": "azure-ai-search-mcp-dynamic",
              "x-error": "missing-binding",
            },
          }
        );
      }
      try {
        const res = await mcpHandler.fetch(request, envObj, ctx);
        return addCors(res, request);
      } catch (e: any) {
        const body = JSON.stringify({
          error: "mcp_handler_error",
          message: e?.message || String(e),
        });
        return new Response(body, {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "x-mcp-server": "azure-ai-search-mcp-dynamic",
            "x-error": "mcp-handler",
          },
        });
      }
    }

    // Default response for root path
    return new Response("Azure AI Search MCP (dynamic) - Use /sse or /mcp", {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "x-mcp-server": "azure-ai-search-mcp-dynamic"
      }
    });
  }
};

// Export the Durable Object class
export { AzureSearchMCPDynamic };

// Also export as AzureSearchMCP for backward compatibility
export { AzureSearchMCPDynamic as AzureSearchMCP };
