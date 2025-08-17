// src/index-dynamic.ts
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AzureSearchClient } from "./azure-search-client";
import { AzureOpenAIClient } from "./azure-openai-client";
import { registerResources } from "./resources";
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
const addCors = (r: Response) => {
  const h = new Headers(r.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
};

class AzureSearchMCPDynamic extends McpAgent {
  server = new McpServer({
    name: "azure-ai-search-mcp-dynamic",
    version: "2.0.0",
    capabilities: {
      logging: {},
      prompts: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      tools: { listChanged: true }
    }
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
    // Fail fast on missing Search config
    this.getClient();

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

    // Keep shared resources if applicable
    registerResources(this.server, () => this.getClient());

    // Register prompts for guided workflows
    registerPrompts(this.server, toolContext);
    registerAdvancedPrompts(this.server, toolContext);
  }
}

// Create handlers for both transport methods
const sseHandler = AzureSearchMCPDynamic.serveSSE("/sse", { binding: "MCP_OBJECT" });
const mcpHandler = AzureSearchMCPDynamic.serve("/mcp", { binding: "MCP_OBJECT" });

export default {
  async fetch(request: Request, envIn: unknown, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
      });
    }
    
    // Route to SSE handler
    if (pathname.startsWith("/sse")) {
      return addCors(await sseHandler.fetch(request, envIn as any, ctx));
    }
    
    // Route to Streamable HTTP handler
    if (pathname.startsWith("/mcp")) {
      return addCors(await mcpHandler.fetch(request, envIn as any, ctx));
    }
    
    // Default response for root path
    return new Response("Azure AI Search MCP (dynamic) - Use /sse or /mcp", {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};

// Export the Durable Object class
export { AzureSearchMCPDynamic };

// Also export as AzureSearchMCP for backward compatibility
export { AzureSearchMCPDynamic as AzureSearchMCP };
