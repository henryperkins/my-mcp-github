/* src/index-simple.ts */
import { env } from "cloudflare:workers";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AzureSearchClient } from "./azure-search-client";
import { AzureOpenAIClient } from "./azure-openai-client";

class AzureSearchMCP extends McpAgent {
  server = new McpServer({ name: "azure-ai-search-mcp", version: "1.3.0" });

  // Helper function to format responses for MCP with pagination and summarization support
  private async formatResponse(data: any, maxSize: number = 20000): Promise<any> {
    const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    
    // Check if response is too large
    if (text.length > maxSize) {
      // For arrays, try to paginate
      if (Array.isArray(data)) {
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              message: "Response truncated due to size. Use pagination parameters (skip/top) to retrieve data in chunks.",
              totalItems: data.length,
              truncated: true,
              firstItems: data.slice(0, 10),
              recommendation: "Use skip and top parameters to paginate through results"
            }, null, 2)
          }]
        };
      }
      
      // For large single objects, try intelligent summarization
      if (typeof data === 'object' && data !== null) {
        const openAI = this.getOpenAIClient();
        
        // Try to summarize if OpenAI is available
        if (openAI) {
          try {
            console.log(`Large response detected (${text.length} chars), attempting summarization...`);
            const summary = await openAI.summarize(text, 800);
            console.log("Summarization successful");
            
            return {
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  summarized: true,
                  originalSize: text.length,
                  summary: summary,
                  message: "Response was too large and has been intelligently summarized using GPT-4o-mini.",
                  hint: "To see specific sections, use targeted queries or pagination parameters."
                }, null, 2)
              }]
            };
          } catch (error) {
            console.error("Summarization failed:", error);
            // Fall back to truncation
          }
        } else {
          console.log("OpenAI not configured, falling back to truncation");
        }
        
        // Fall back to truncation if summarization not available
        const truncated = this.truncateLargeArrays(data, maxSize);
        return { 
          content: [{ 
            type: "text", 
            text: JSON.stringify(truncated, null, 2) 
          }] 
        };
      }
    }
    
    return { content: [{ type: "text", text }] };
  }
  
  // Helper to truncate large arrays in objects
  private truncateLargeArrays(obj: any, maxSize: number): any {
    const str = JSON.stringify(obj);
    if (str.length <= maxSize) return obj;
    
    const result = { ...obj };
    
    // Special handling for specific response types
    if (result.executionHistory && Array.isArray(result.executionHistory)) {
      result.executionHistory = result.executionHistory.slice(0, 5);
      result.executionHistoryTruncated = true;
      result.totalExecutions = obj.executionHistory.length;
    }
    
    if (result.value && Array.isArray(result.value)) {
      const original = result.value.length;
      result.value = result.value.slice(0, 10);
      result.truncated = true;
      result.totalResults = original;
    }
    
    if (result.errors && Array.isArray(result.errors) && result.errors.length > 10) {
      result.errors = result.errors.slice(0, 10);
      result.errorsTruncated = true;
      result.totalErrors = obj.errors.length;
    }
    
    return result;
  }

  private formatError(error: any) {
    return { content: [{ type: "text", text: `Error: ${String(error)}` }] };
  }

  private getClient(): AzureSearchClient {
    const endpoint = env.AZURE_SEARCH_ENDPOINT;
    const apiKey = env.AZURE_SEARCH_API_KEY;
    
    if (!endpoint) {
      throw new Error("AZURE_SEARCH_ENDPOINT is not configured. Please set it as a Worker secret.");
    }
    if (!apiKey) {
      throw new Error("AZURE_SEARCH_API_KEY is not configured. Please set it as a Worker secret.");
    }
    
    return new AzureSearchClient(endpoint, apiKey);
  }
  
  private getOpenAIClient(): AzureOpenAIClient | null {
    const endpoint = env.AZURE_OPENAI_ENDPOINT;
    const apiKey = env.AZURE_OPENAI_API_KEY;
    const deploymentName = env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";
    
    if (!endpoint || !apiKey) {
      console.log("Azure OpenAI not configured for summarization");
      return null;
    }
    
    return new AzureOpenAIClient(endpoint, apiKey, deploymentName);
  }

  async init() {
    // Verify credentials are available
    try {
      const client = this.getClient();
      console.log(`Azure Search MCP initialized`);
    } catch (error) {
      console.error("Failed to initialize Azure Search MCP:", error);
      throw error;
    }
    
    // ---------------- INDEX MANAGEMENT ----------------
    this.server.tool(
      "listIndexes",
      "List all index names.",
      { },
      async () => {
        try {
          const client = this.getClient();
          const indexes = await client.listIndexes();
          const names = indexes.map((idx: any) => idx.name);
          return await this.formatResponse({ indexes: names, count: names.length });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "getIndex",
      "Fetch full index definition.",
      { indexName: z.string() },
      async ({ indexName }) => {
        try {
          const client = this.getClient();
          const idx = await client.getIndex(indexName);
          return await this.formatResponse(idx);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "getIndexStats",
      "Get document count and storage usage.",
      { indexName: z.string() },
      async ({ indexName }) => {
        try {
          const client = this.getClient();
          const stats = await client.getIndexStats(indexName);
          return await this.formatResponse(stats);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "deleteIndex",
      "Delete index and its documents.",
      { indexName: z.string() },
      async ({ indexName }) => {
        try {
          const client = this.getClient();
          await client.deleteIndex(indexName);
          return await this.formatResponse({ success: true, message: `Index ${indexName} deleted` });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    // ---------------- DOCUMENTS ----------------
    this.server.tool(
      "searchDocuments",
      "Query documents. Supports keyword search with filters. Use skip/top for pagination.",
      {
        indexName: z.string(),
        search: z.string().default("*"),
        top: z.number().int().positive().max(50).default(10).describe("Max 50 to prevent large responses"),
        skip: z.number().int().nonnegative().default(0).describe("Skip N results for pagination"),
        select: z.array(z.string()).optional().describe("Fields to return (reduces response size)"),
        filter: z.string().optional(),
        orderBy: z.string().optional(),
        includeTotalCount: z.boolean().default(true)
      },
      async ({ indexName, search, top, skip, select, filter, orderBy, includeTotalCount }) => {
        try {
          const client = this.getClient();
          const searchParams = {
            search,
            top,
            skip,
            ...(select && { select: select.join(',') }),
            ...(filter && { filter }),
            ...(orderBy && { orderBy }),
            ...(includeTotalCount && { count: true })
          };
          const results = await client.searchDocuments(indexName, searchParams);
          return await this.formatResponse(results);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "getDocument",
      "Lookup a document by its primary key.",
      { indexName: z.string(), key: z.string(), select: z.array(z.string()).optional() },
      async ({ indexName, key, select }) => {
        try {
          const client = this.getClient();
          const doc = await client.getDocument(indexName, key, select);
          return await this.formatResponse(doc);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "countDocuments",
      "Return document count.",
      { indexName: z.string() },
      async ({ indexName }) => {
        try {
          const client = this.getClient();
          const count = await client.getDocumentCount(indexName);
          return await this.formatResponse({ count });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    // ---------------- DATA SOURCES ----------------
    this.server.tool(
      "listDataSources",
      "List data source connection names.",
      { },
      async () => {
        try {
          const client = this.getClient();
          const dataSources = await client.listDataSources();
          const names = dataSources.map((ds: any) => ds.name);
          return await this.formatResponse({ dataSources: names, count: names.length });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "getDataSource",
      "Get a data source connection.",
      { name: z.string() },
      async ({ name }) => {
        try {
          const client = this.getClient();
          const ds = await client.getDataSource(name);
          return await this.formatResponse(ds);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    // ---------------- INDEXERS ----------------
    this.server.tool(
      "listIndexers",
      "List indexer names.",
      { },
      async () => {
        try {
          const client = this.getClient();
          const indexers = await client.listIndexers();
          const names = indexers.map((ix: any) => ix.name);
          return await this.formatResponse({ indexers: names, count: names.length });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "getIndexer",
      "Get an indexer.",
      { name: z.string() },
      async ({ name }) => {
        try {
          const client = this.getClient();
          const ix = await client.getIndexer(name);
          return await this.formatResponse(ix);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "runIndexer",
      "Run an indexer now.",
      { name: z.string() },
      async ({ name }) => {
        try {
          const client = this.getClient();
          await client.runIndexer(name);
          return await this.formatResponse({ success: true, message: `Indexer ${name} started` });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "resetIndexer",
      "Reset change tracking for an indexer (full re-crawl).",
      { name: z.string() },
      async ({ name }) => {
        try {
          const client = this.getClient();
          await client.resetIndexer(name);
          return await this.formatResponse({ success: true, message: `Indexer ${name} reset` });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "getIndexerStatus",
      "Get execution history/status for an indexer.",
      { 
        name: z.string(),
        historyLimit: z.number().int().positive().max(50).default(5).describe("Limit execution history entries")
      },
      async ({ name, historyLimit }) => {
        try {
          const client = this.getClient();
          const status = await client.getIndexerStatus(name);
          
          // Limit execution history to prevent large responses
          if (status.executionHistory && Array.isArray(status.executionHistory)) {
            status.executionHistory = status.executionHistory.slice(0, historyLimit);
            if (status.executionHistory.length < historyLimit) {
              status.historyComplete = true;
            } else {
              status.historyTruncated = true;
              status.message = `Showing first ${historyLimit} execution history entries. Increase historyLimit to see more.`;
            }
          }
          
          return await this.formatResponse(status);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    // ---------------- SKILLSETS ----------------
    this.server.tool(
      "listSkillsets",
      "List skillset names.",
      { },
      async () => {
        try {
          const client = this.getClient();
          const skillsets = await client.listSkillsets();
          const names = skillsets.map((ss: any) => ss.name);
          return await this.formatResponse({ skillsets: names, count: names.length });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "getSkillset",
      "Get a skillset.",
      { name: z.string() },
      async ({ name }) => {
        try {
          const client = this.getClient();
          const ss = await client.getSkillset(name);
          return await this.formatResponse(ss);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );
  }
}

// Export the class for Durable Object binding
export { AzureSearchMCP };

// Expose both transports (SSE + Streamable HTTP)
export default {
  fetch(request: Request, envIn: unknown, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/sse")) {
      return AzureSearchMCP.serveSSE("/sse").fetch(request, envIn as any, ctx);
    }
    if (pathname.startsWith("/mcp")) {
      return AzureSearchMCP.serve("/mcp").fetch(request, envIn as any, ctx);
    }
    return new Response("Azure AI Search MCP Server - Use /sse or /mcp endpoints", { status: 200 });
  }
};