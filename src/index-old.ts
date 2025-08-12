/* src/index.ts */
import { env } from "cloudflare:workers";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  AzureKeyCredential,
  SearchClient,
  SearchIndexClient,
  SearchIndexerClient,
  type VectorQuery,
} from "@azure/search-documents";
import { success, normalizeError } from "./insights";
import { verifyExists, verifyDeleted, pollIndexerCompletion } from "./verify";

class AzureSearchMCP extends McpAgent {
  server = new McpServer({ name: "azure-ai-search-mcp", version: "1.3.0" });

  // Helper function to format responses for MCP
  private formatResponse(data: any) {
    return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
  }

  private formatError(error: any) {
    return { content: [{ type: "text", text: `Error: ${String(error)}` }] };
  }

  private get endpoint(): string {
    const endpoint = env.AZURE_SEARCH_ENDPOINT;
    if (!endpoint) {
      throw new Error("AZURE_SEARCH_ENDPOINT is not configured. Please set it as a Worker secret.");
    }
    return endpoint;
  }
  private get credential(): AzureKeyCredential {
    const apiKey = env.AZURE_SEARCH_API_KEY;
    if (!apiKey) {
      throw new Error("AZURE_SEARCH_API_KEY is not configured. Please set it as a Worker secret.");
    }
    return new AzureKeyCredential(apiKey);
  }
  private indexClient() {
    return new SearchIndexClient(this.endpoint, this.credential, {
      proxyOptions: undefined,
      userAgentOptions: { userAgentPrefix: "azure-search-mcp" }
    });
  }
  private indexerClient() {
    return new SearchIndexerClient(this.endpoint, this.credential, {
      proxyOptions: undefined,
      userAgentOptions: { userAgentPrefix: "azure-search-mcp" }
    });
  }
  private searchClient(indexName: string) {
    return new SearchClient(this.endpoint, indexName, this.credential, {
      proxyOptions: undefined,
      userAgentOptions: { userAgentPrefix: "azure-search-mcp" }
    });
  }

  async init() {
    // Verify credentials are available
    try {
      const endpoint = this.endpoint;
      const cred = this.credential;
      console.log(`Azure Search MCP initialized for endpoint: ${endpoint}`);
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
          const names: string[] = [];
          for await (const n of this.indexClient().listIndexesNames()) names.push(n);
          return this.formatResponse({ indexes: names, count: names.length });
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
          const idx = await this.indexClient().getIndex(indexName);
          return this.formatResponse(idx);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "createOrUpdateIndex",
      "Create/Update index. Pass full SearchIndex JSON. Set allowIndexDowntime for analyzer/vectorizer changes.",
      {
        indexJson: z.record(z.any()),
        allowIndexDowntime: z.boolean().default(false),
        verify: z.boolean().default(true),
        onlyIfUnchanged: z.boolean().default(false),
        ifMatchEtag: z.string().optional()
      },
      async ({ indexJson, allowIndexDowntime, verify, onlyIfUnchanged, ifMatchEtag }) => {
        try {
          const options: any = {
            allowIndexDowntime,
            onlyIfUnchanged,
            ...(ifMatchEtag ? { ifMatch: ifMatchEtag } : {})
          };
          const res = await this.indexClient().createOrUpdateIndex(indexJson as any, options);
          if (!verify) return { content: [{ type: "text", text: JSON.stringify({ ok: true, result: res }, null, 2) }] };
          const v = await verifyExists(() =>
            this.indexClient().getIndex((res as any).name ?? (indexJson as any).name)
          );
          return { content: [{ type: "text", text: JSON.stringify(v, null, 2) }] };
        } catch (e) {
          return { content: [{ type: "text", text: `Error: ${String(e)}` }] };
        }
      }
    );

    this.server.tool(
      "deleteIndex",
      "Delete index and its documents.",
      { indexName: z.string(), verify: z.boolean().default(true) },
      async ({ indexName, verify }) => {
        try {
          await this.indexClient().deleteIndex(indexName);
          if (!verify) return { content: [{ type: "json", json: { ok: true } }], ...success() };
          const v = await verifyDeleted(() => this.indexClient().getIndex(indexName));
          return { content: [{ type: "json", json: { ...v } }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "deleteIndex", indexName }) };
        }
      }
    );

    this.server.tool(
      "getIndexStats",
      "Get document count and storage usage.",
      { indexName: z.string() },
      async ({ indexName }) => {
        try {
          const stats = await this.indexClient().getIndexStatistics(indexName);
          return this.formatResponse(stats);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    // ---------------- DOCUMENTS ----------------
    this.server.tool(
      "searchDocuments",
      "Query documents. Supports keyword (*), filter/select/orderBy, and vector/hybrid queries.",
      {
        indexName: z.string(),
        query: z.string().default("*"),
        top: z.number().int().positive().max(1000).default(50),
        skip: z.number().int().nonnegative().default(0),
        select: z.array(z.string()).optional(),
        filter: z.string().optional(),
        orderBy: z.array(z.string()).optional(),
        includeTotalCount: z.boolean().default(true),
        vectorQueries: z.array(z.object({
          kind: z.enum(["vector", "text"]).default("vector"),
          fields: z.array(z.string()),
          k: z.number().int().positive().max(1000).default(3),
          vector: z.array(z.number()).optional(),
          text: z.string().optional()
        })).optional()
      },
      async ({ indexName, query, top, skip, select, filter, orderBy, includeTotalCount, vectorQueries }) => {
        try {
          const idx = await this.indexClient().getIndex(indexName);
          const hasVectorizer = !!(idx as any).vectorSearch?.vectorizers?.length;
          const note = hasVectorizer
            ? "This index supports kind:'text' vector queries."
            : "No vectorizer configured; prefer kind:'vector' with numeric embeddings.";

          const vs: VectorQuery[] =
            vectorQueries?.map(q => q.kind === "vector"
              ? { kind: "vector", fields: q.fields, vector: q.vector!, kNearestNeighborsCount: q.k }
              : { kind: "text", fields: q.fields, text: q.text!, kNearestNeighborsCount: q.k }
            ) ?? [];

          const sc = this.searchClient(indexName);
          const results = await sc.search(query, {
            top, skip, select: select as any, filter, orderBy, includeTotalCount,
            vectorSearchOptions: vs.length ? { queries: vs } : undefined
          });

          const out: any[] = [];
          for await (const r of (results as any).results) {
            out.push({
              score: (r as any).score,
              rerankerScore: (r as any)["@search.rerankerScore"],
              doc: (r as any).document
            });
          }
          return { content: [{ type: "json", json: { count: (results as any).count, results: out, note } }], ...success({ note }) };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "searchDocuments", indexName }) };
        }
      }
    );

    this.server.tool(
      "getDocument",
      "Lookup a document by its primary key.",
      { indexName: z.string(), key: z.string(), select: z.array(z.string()).optional() },
      async ({ indexName, key, select }) => {
        try {
          const sc = this.searchClient(indexName);
          const doc = await sc.getDocument(key, { selectedFields: select as any });
          return { content: [{ type: "json", json: doc }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "getDocument", indexName, key }) };
        }
      }
    );

    this.server.tool(
      "countDocuments",
      "Return document count.",
      { indexName: z.string() },
      async ({ indexName }) => {
        try {
          const sc = this.searchClient(indexName);
          const n = await sc.getDocumentsCount();
          return this.formatResponse({ count: n });
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
          const names: string[] = [];
          for await (const ds of this.indexerClient().listDataSourceConnections()) names.push(ds.name!);
          return { content: [{ type: "json", json: { dataSources: names } }], ...success({ count: names.length }) };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "listDataSources" }) };
        }
      }
    );

    this.server.tool(
      "getDataSource",
      "Get a data source connection.",
      { name: z.string() },
      async ({ name }) => {
        try {
          const ds = await this.indexerClient().getDataSourceConnection(name);
          return { content: [{ type: "json", json: ds }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "getDataSource", name }) };
        }
      }
    );

    this.server.tool(
      "createOrUpdateDataSource",
      "Create/Update a data source connection. Pass full SearchIndexerDataSourceConnection JSON.",
      {
        dataSourceJson: z.record(z.any()),
        verify: z.boolean().default(true),
        onlyIfUnchanged: z.boolean().default(false),
        ifMatchEtag: z.string().optional()
      },
      async ({ dataSourceJson, verify, onlyIfUnchanged, ifMatchEtag }) => {
        try {
          const options: any = { onlyIfUnchanged, ...(ifMatchEtag ? { ifMatch: ifMatchEtag } : {}) };
          const res = await this.indexerClient().createOrUpdateDataSourceConnection(dataSourceJson as any, options);
          if (!verify) return { content: [{ type: "json", json: { ok: true, result: res } }], ...success() };
          const name = (res as any).name ?? (dataSourceJson as any).name;
          const v = await verifyExists(() => this.indexerClient().getDataSourceConnection(name));
          return { content: [{ type: "json", json: { ...v } }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "createOrUpdateDataSource" }) };
        }
      }
    );

    this.server.tool(
      "deleteDataSource",
      "Delete a data source connection.",
      { name: z.string(), verify: z.boolean().default(true) },
      async ({ name, verify }) => {
        try {
          await this.indexerClient().deleteDataSourceConnection(name);
          if (!verify) return { content: [{ type: "json", json: { ok: true } }], ...success() };
          const v = await verifyDeleted(() => this.indexerClient().getDataSourceConnection(name));
          return { content: [{ type: "json", json: { ...v } }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "deleteDataSource", name }) };
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
          const names: string[] = [];
          for await (const ix of this.indexerClient().listIndexers()) names.push(ix.name!);
          return { content: [{ type: "json", json: { indexers: names } }], ...success({ count: names.length }) };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "listIndexers" }) };
        }
      }
    );

    this.server.tool(
      "getIndexer",
      "Get an indexer.",
      { name: z.string() },
      async ({ name }) => {
        try {
          const ix = await this.indexerClient().getIndexer(name);
          return { content: [{ type: "json", json: ix }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "getIndexer", name }) };
        }
      }
    );

    this.server.tool(
      "createOrUpdateIndexer",
      "Create/Update an indexer. Pass full SearchIndexer JSON.",
      {
        indexerJson: z.record(z.any()),
        verify: z.boolean().default(true),
        onlyIfUnchanged: z.boolean().default(false),
        ifMatchEtag: z.string().optional()
      },
      async ({ indexerJson, verify, onlyIfUnchanged, ifMatchEtag }) => {
        try {
          const options: any = { onlyIfUnchanged, ...(ifMatchEtag ? { ifMatch: ifMatchEtag } : {}) };
          const res = await this.indexerClient().createOrUpdateIndexer(indexerJson as any, options);
          if (!verify) return { content: [{ type: "json", json: { ok: true, result: res } }], ...success() };
          const name = (res as any).name ?? (indexerJson as any).name;
          const v = await verifyExists(() => this.indexerClient().getIndexer(name));
          return { content: [{ type: "json", json: { ...v } }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "createOrUpdateIndexer" }) };
        }
      }
    );

    this.server.tool(
      "deleteIndexer",
      "Delete an indexer.",
      { name: z.string(), verify: z.boolean().default(true) },
      async ({ name, verify }) => {
        try {
          await this.indexerClient().deleteIndexer(name);
          if (!verify) return { content: [{ type: "json", json: { ok: true } }], ...success() };
          const v = await verifyDeleted(() => this.indexerClient().getIndexer(name));
          return { content: [{ type: "json", json: { ...v } }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "deleteIndexer", name }) };
        }
      }
    );

    this.server.tool(
      "runIndexer",
      "Run an indexer now; optionally poll until completion.",
      {
        name: z.string(),
        verify: z.boolean().default(true),
        verifyTimeoutMs: z.number().int().positive().default(300000),
        verifyIntervalMs: z.number().int().positive().default(3000)
      },
      async ({ name, verify, verifyTimeoutMs, verifyIntervalMs }) => {
        try {
          await this.indexerClient().runIndexer(name); // 202 Accepted
          if (!verify) return { content: [{ type: "json", json: { ok: true, started: true } }], ...success() };
          const v = await pollIndexerCompletion(
            () => this.indexerClient().getIndexerStatus(name),
            { timeoutMs: verifyTimeoutMs, intervalMs: verifyIntervalMs }
          );
          return { content: [{ type: "json", json: { ...v } }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "runIndexer", name }) };
        }
      }
    );

    this.server.tool(
      "resetIndexer",
      "Reset change tracking for an indexer (full re-crawl).",
      { name: z.string() },
      async ({ name }) => {
        try {
          await this.indexerClient().resetIndexer(name);
          return { content: [{ type: "text", text: `Indexer ${name} reset` }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "resetIndexer", name }) };
        }
      }
    );

    this.server.tool(
      "getIndexerStatus",
      "Get execution history/status for an indexer.",
      { name: z.string() },
      async ({ name }) => {
        try {
          const status = await this.indexerClient().getIndexerStatus(name);
          return { content: [{ type: "json", json: status }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "getIndexerStatus", name }) };
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
          const names: string[] = [];
          for await (const ss of this.indexerClient().listSkillsets()) names.push(ss.name!);
          return { content: [{ type: "json", json: { skillsets: names } }], ...success({ count: names.length }) };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "listSkillsets" }) };
        }
      }
    );

    this.server.tool(
      "getSkillset",
      "Get a skillset.",
      { name: z.string() },
      async ({ name }) => {
        try {
          const ss = await this.indexerClient().getSkillset(name);
          return { content: [{ type: "json", json: ss }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "getSkillset", name }) };
        }
      }
    );

    this.server.tool(
      "createOrUpdateSkillset",
      "Create/Update a skillset. Pass full SearchIndexerSkillset JSON.",
      {
        skillsetJson: z.record(z.any()),
        verify: z.boolean().default(true),
        onlyIfUnchanged: z.boolean().default(false),
        ifMatchEtag: z.string().optional()
      },
      async ({ skillsetJson, verify, onlyIfUnchanged, ifMatchEtag }) => {
        try {
          const options: any = { onlyIfUnchanged, ...(ifMatchEtag ? { ifMatch: ifMatchEtag } : {}) };
          const res = await this.indexerClient().createOrUpdateSkillset(skillsetJson as any, options);
          if (!verify) return { content: [{ type: "json", json: { ok: true, result: res } }], ...success() };
          const name = (res as any).name ?? (skillsetJson as any).name;
          const v = await verifyExists(() => this.indexerClient().getSkillset(name));
          return { content: [{ type: "json", json: { ...v } }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "createOrUpdateSkillset" }) };
        }
      }
    );

    this.server.tool(
      "deleteSkillset",
      "Delete a skillset.",
      { name: z.string(), verify: z.boolean().default(true) },
      async ({ name, verify }) => {
        try {
          await this.indexerClient().deleteSkillset(name);
          if (!verify) return { content: [{ type: "json", json: { ok: true } }], ...success() };
          const v = await verifyDeleted(() => this.indexerClient().getSkillset(name));
          return { content: [{ type: "json", json: { ...v } }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "deleteSkillset", name }) };
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