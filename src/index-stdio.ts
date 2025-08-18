// src/index-stdio.ts
// Standalone Node MCP server (stdio transport) — runs without Cloudflare.
// Usage:
//   # Mock mode (no Azure required):
//   AZURE_SEARCH_MOCK=true npx tsx src/index-stdio.ts
//   # Real Azure (unset mock and provide creds):
//   AZURE_SEARCH_ENDPOINT="https://<svc>.search.windows.net" \
//   AZURE_SEARCH_API_KEY="<key>" npx tsx src/index-stdio.ts
//
// Then configure your MCP client (e.g., Claude Desktop) to use:
//   "command": "npx",
//   "args": ["tsx", "src/index-stdio.ts"]

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { AzureSearchClient } from "./azure-search-client";
import { AzureSearchClientMock } from "./azure-search-client.mock";
import { AzureOpenAIClient } from "./azure-openai-client";

import type { ToolContext } from "./types";
import { setLogLevel } from "./utils/logging";

// Dynamic tools
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

// Build ToolContext backed by real or mock Azure client
function buildToolContext(): ToolContext {
  const useMock = process.env.AZURE_SEARCH_MOCK === "true" || process.env.AZURE_SEARCH_MOCK === "1";

  let cachedKey: string | null = null;
  let cachedClient: AzureSearchClient | null = null;

  const getClient = () => {
    if (useMock) {
      // Return a fresh mock client instance (or cache if desired)
      if (cachedClient && cachedKey === "mock") return cachedClient;
      cachedClient = new (AzureSearchClientMock as any)() as unknown as AzureSearchClient;
      cachedKey = "mock";
      return cachedClient;
    }

    const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
    const apiKey = process.env.AZURE_SEARCH_API_KEY;
    if (!endpoint || !apiKey) {
      throw new Error("Missing AZURE_SEARCH_ENDPOINT or AZURE_SEARCH_API_KEY");
    }
    const key = `${endpoint}|${apiKey}`;
    if (cachedClient && cachedKey === key) return cachedClient;
    cachedClient = new AzureSearchClient(endpoint, apiKey);
    cachedKey = key;
    return cachedClient;
  };

  const getSummarizer = () => {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";
    if (!endpoint || !apiKey) return null;
    const client = new AzureOpenAIClient(endpoint, apiKey, deployment);
    return (text: string, maxTokens?: number) => client.summarize(text, maxTokens);
  };

  // In stdio mode, no Cloudflare McpAgent instance exists, so elicitation is not supported
  // Tools will gracefully skip elicitation when agent is null.
  return {
    getClient,
    getSummarizer,
    agent: null as any
  };
}

async function main() {
  const server = new McpServer(
    {
      name: "azure-ai-search-mcp-stdio",
      version: "2.0.0"
    },
    {
      capabilities: {
        logging: {},
        prompts: { listChanged: true },
        resources: { subscribe: true, listChanged: true },
        tools: { listChanged: true }
      },
      instructions: `Azure AI Search MCP Server (Node stdio) - Usage Guidelines:

1. Pagination: Use cursor-based pagination for large result sets. When you receive a 'nextCursor' in responses, pass it back as 'cursor' parameter to get the next page.

2. Large Responses: Responses over 20KB are summarized when Azure OpenAI is configured, or truncated with guidance.

3. Confirmations: Destructive operations (delete, reset) are guarded; elicitation is unavailable in stdio mode. Provide 'confirmation' params directly.

4. Vector Search: For hybrid search, use 'vectors' parameter in DocumentOperations.search with your embedding values.

5. Performance:
   - Use 'select' to limit returned fields
   - Set 'includeTotalCount: false' for faster queries
   - Batch document operations when possible

Environment:
- Mock mode: set AZURE_SEARCH_MOCK=true (no Azure required)
- Real mode: unset mock and set AZURE_SEARCH_ENDPOINT / AZURE_SEARCH_API_KEY`
    }
  );

  // Implement logging/setLevel (MCP protocol)
  const loggingSetLevelSchema = z.object({
    method: z.literal("logging/setLevel"),
    params: z.object({
      level: z.enum(["debug", "info", "notice", "warning", "error", "critical", "alert", "emergency"])
    })
  });

  // setRequestHandler exists on McpServer in the SDK
  (server as any).setRequestHandler(loggingSetLevelSchema, async (request: any) => {
    const { level } = request.params;
    const map: Record<string, string> = {
      debug: "debug",
      info: "info",
      notice: "info",
      warning: "warning",
      error: "error",
      critical: "error",
      alert: "error",
      emergency: "error"
    };
    setLogLevel((map[level] || "info") as any);
    return {};
  });

  const toolContext = buildToolContext();

  // Register tools (dynamic)
  IndexTool.register(server, toolContext, { includeResources: true, includePrompts: true, enableLogging: true, enableMetrics: true });
  DocumentTool.register(server, toolContext, { includeResources: true, includePrompts: true, enableLogging: true, enableMetrics: true });
  DataSourceTool.register(server, toolContext, { includeResources: true, includePrompts: true, enableLogging: true, enableMetrics: true });
  IndexerTool.register(server, toolContext, { includeResources: true, includePrompts: true, enableLogging: true, enableMetrics: true });
  SkillsetTool.register(server, toolContext, { includeResources: true, includePrompts: true, enableLogging: true, enableMetrics: true });
  ServiceTool.register(server, toolContext, { includeResources: true, includePrompts: true, enableLogging: true, enableMetrics: true });
  KnowledgeAgentTool.register(server, toolContext, { includeResources: true, includePrompts: true, enableLogging: true, enableMetrics: true });
  KnowledgeSourceTool.register(server, toolContext, { includeResources: true, includePrompts: true, enableLogging: true, enableMetrics: true });

  // Register prompts
  registerPrompts(server, toolContext);
  registerAdvancedPrompts(server, toolContext);

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Keep process running
  // The stdio transport will read/write from STDIN/STDOUT and block the process.
  // Provide a helpful banner to stderr for humans.
  const banner = [
    "Azure AI Search MCP (Node stdio)",
    `Mode: ${process.env.AZURE_SEARCH_MOCK === "true" || process.env.AZURE_SEARCH_MOCK === "1" ? "MOCK" : "REAL"}`,
    "Waiting for MCP client over stdio..."
  ].join(" | ");

  console.error(banner);
}

main().catch((err) => {
  console.error("Fatal error starting stdio MCP server:", err);
  process.exit(1);
});