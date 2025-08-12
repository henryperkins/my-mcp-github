### **`src/insights.ts`**
```ts
// src/insights.ts
import type { PipelineResponse } from "@azure/core-rest-pipeline";

export type InsightCode =
  | "ERR_AUTH" | "ERR_NOT_FOUND" | "ERR_CONFLICT"
  | "ERR_RATE_LIMIT" | "ERR_STORAGE_LIMIT" | "ERR_TIER_LIMIT"
  | "ERR_DOWNTIME_REQUIRED" | "ERR_VECTOR_DIM_MISMATCH"
  | "ERR_BAD_FILTER" | "ERR_INDEXER_COOLDOWN" | "ERR_NETWORK"
  | "OK";

export type Insight = {
  ok: boolean;
  code: InsightCode;
  message: string;
  recommendation?: string;
  retryAfterSec?: number;
  extras?: Record<string, any>;
};

function retryAfterSeconds(resp?: PipelineResponse | null) {
  const h = (resp as any)?.headers;
  if (!h) return undefined;
  const get = typeof h.get === "function" ? (k: string) => h.get(k) : (k: string) => h[k];
  const ra = get("Retry-After") ?? get("retry-after") ?? get("retry-after-ms");
  if (!ra) return undefined;
  const s = String(ra).trim().toLowerCase();
  const n = Number(s.replace("ms", ""));
  if (!Number.isFinite(n)) return undefined;
  return s.endsWith("ms") ? Math.ceil(n / 1000) : n;
}

export function success(extras?: Record<string, any>): { insight: Insight } {
  return { insight: { ok: true, code: "OK", message: "Success", extras } };
}

export function normalizeError(e: any, context?: Record<string, any>): { insight: Insight } {
  const status = e?.statusCode ?? e?.response?.status;
  const code = (e?.code as string) || "";
  const msg = String(e?.message ?? e?.toString?.() ?? e);

  let insight: Insight = {
    ok: false,
    code: "ERR_NETWORK",
    message: msg,
    recommendation: "Check connectivity, endpoint, or service availability.",
    extras: { status, code, ...context }
  };

  // Treat 429 and 503 as retryable/busy conditions
  if (status === 429 || status === 503) {
    insight = {
      ok: false,
      code: "ERR_RATE_LIMIT",
      message: msg,
      recommendation:
        "Back off with jitter; if creating objects, you may be at tier/object limits or low on storage. Reduce request rate, delete unused objects/documents, or upgrade SKU.",
      retryAfterSec: retryAfterSeconds(e?.response),
      extras: { status, code, ...context }
    };
  } else if (status === 401 || status === 403) {
    insight = {
      ok: false,
      code: "ERR_AUTH",
      message: msg,
      recommendation:
        "Use an ADMIN key for management ops (indexes/indexers/skillsets/datasources) or configure Entra RBAC. Verify network/Private Link and audience.",
      extras: { status, code, ...context }
    };
  } else if (status === 404) {
    insight = {
      ok: false,
      code: "ERR_NOT_FOUND",
      message: msg,
      recommendation: "List resources first and correct the name; the resource likely does not exist.",
      extras: { status, code, ...context }
    };
  } else if (status === 409) {
    insight = {
      ok: false,
      code: "ERR_CONFLICT",
      message: msg,
      recommendation: "Serialize management operations and retry with exponential backoff.",
      extras: { status, code, ...context }
    };
  }

  // Heuristic refinements
  if (/allowIndexDowntime/i.test(msg) || /analyzer|tokenizer|vectorizer.+cannot/i.test(msg)) {
    insight.code = "ERR_DOWNTIME_REQUIRED";
    insight.recommendation =
      "Retry createOrUpdateIndex with { allowIndexDowntime: true } or plan a rebuild/alias swap for breaking changes.";
  }
  if (/dimension/i.test(msg) && /vector/i.test(msg)) {
    insight.code = "ERR_VECTOR_DIM_MISMATCH";
    insight.recommendation =
      "Ensure the field’s vectorSearchDimensions equals the embedding length; regenerate embeddings or fix schema.";
  }
  if (/Invalid expression/i.test(msg) || /\$filter/i.test(msg)) {
    insight.code = "ERR_BAD_FILTER";
    insight.recommendation =
      "Fix OData syntax, use parentheses, any/all for collections, and consider search.in(...) for set filters.";
  }
  if (/Indexer invocation is once every 180 seconds/i.test(msg)) {
    insight.code = "ERR_INDEXER_COOLDOWN";
    insight.recommendation = "Wait ~180s between runs on Free tier or upgrade to a paid tier.";
  }

  return { insight };
}
```

### **`src/verify.ts`**
```ts
// src/verify.ts
export type VerifyResult = {
  ok: boolean;
  verified: boolean;
  verifyStatus?: number;
  etag?: string | null;
  details?: Record<string, any>;
};

export function extractEtag(obj: any): string | null {
  return obj?.["@odata.etag"] ?? obj?.etag ?? obj?.ETag ?? null;
}

export async function verifyExists<T>(
  getFn: () => Promise<T>
): Promise<VerifyResult> {
  const res = await getFn();
  return { ok: true, verified: true, verifyStatus: 200, etag: extractEtag(res as any), details: res as any };
}

export async function verifyDeleted(getFn: () => Promise<any>): Promise<VerifyResult> {
  try {
    await getFn();
    // still exists
    return { ok: false, verified: false, verifyStatus: 200 };
  } catch (e: any) {
    const status = e?.statusCode ?? e?.response?.status;
    if (status === 404) return { ok: true, verified: true, verifyStatus: 404 };
    return { ok: false, verified: false, verifyStatus: status };
  }
}

/** Polls indexer status until terminal state or timeout. */
export async function pollIndexerCompletion<T extends { lastResult?: any }>(
  getStatusFn: () => Promise<T>,
  {
    intervalMs = 3000,
    timeoutMs = 300_000, // 5 min default
  }: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<VerifyResult> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const s = await getStatusFn();
    const last = (s as any).lastResult ?? (s as any).executionResult ?? {};
    const st = String(last.status ?? "").toLowerCase(); // success|inprogress|transientfailure|persistentfailure|reset
    if (st === "success" || st === "reset" || st === "persistentfailure" || st === "transientfailure") {
      return {
        ok: st === "success",
        verified: true,
        verifyStatus: 200,
        details: { lastResult: last, status: st },
      };
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return { ok: false, verified: false, details: { reason: "timeout" } };
}
```

### **`src/server.ts`**
```ts
// src/server.ts
import "dotenv/config";
import { McpServer, ToolSchema } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  AzureKeyCredential,
  SearchClient,
  SearchIndexClient,
  SearchIndexerClient,
  type VectorQuery,
} from "@azure/search-documents";
import { success, normalizeError } from "./insights.js";
import { verifyExists, verifyDeleted, pollIndexerCompletion } from "./verify.js";

/** --- Azure clients (Admin key auth) --- */
const endpoint = process.env.AZURE_SEARCH_ENDPOINT!;
const key = process.env.AZURE_SEARCH_API_KEY!;
if (!endpoint || !key) throw new Error("AZURE_SEARCH_ENDPOINT / AZURE_SEARCH_API_KEY required");

const credential = new AzureKeyCredential(key);
const indexClient = () => new SearchIndexClient(endpoint, credential);
const indexerClient = () => new SearchIndexerClient(endpoint, credential);
const searchClient = (indexName: string) => new SearchClient(endpoint, indexName, credential);

const server = new McpServer({ name: "azure-ai-search-mcp", version: "1.3.0" });

/** ---------------- INDEX MANAGEMENT ---------------- */

/** List index names */
server.tool(
  "listIndexes",
  ToolSchema({ inputSchema: z.object({}), description: "List all index names." }),
  async () => {
    try {
      const names: string[] = [];
      for await (const n of indexClient().listIndexesNames()) names.push(n);
      return { content: [{ type: "json", json: { indexes: names } }], ...success({ count: names.length }) };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "listIndexes" }) };
    }
  }
);

/** Get index schema/definition */
server.tool(
  "getIndex",
  ToolSchema({ inputSchema: z.object({ indexName: z.string() }), description: "Fetch full index definition." }),
  async ({ indexName }) => {
    try {
      const idx = await indexClient().getIndex(indexName);
      return { content: [{ type: "json", json: idx }], ...success() };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "getIndex", indexName }) };
    }
  }
);

/** Create or update index from raw JSON (supports downtime updates) */
server.tool(
  "createOrUpdateIndex",
  ToolSchema({
    inputSchema: z.object({
      indexJson: z.record(z.any()),
      allowIndexDowntime: z.boolean().default(false),
      verify: z.boolean().default(true),
      // Optimistic concurrency (optional)
      onlyIfUnchanged: z.boolean().default(false),
      ifMatchEtag: z.string().optional()
    }),
    description: "Create/Update index. Pass full SearchIndex JSON. Set allowIndexDowntime for analyzer/vectorizer changes."
  }),
  async ({ indexJson, allowIndexDowntime, verify, onlyIfUnchanged, ifMatchEtag }) => {
    try {
      const options: any = {
        allowIndexDowntime,
        onlyIfUnchanged,
        ...(ifMatchEtag ? { ifMatch: ifMatchEtag } : {})
      };
      const res = await indexClient().createOrUpdateIndex(indexJson as any, options);
      if (!verify) {
        return { content: [{ type: "json", json: { ok: true, result: res } }], ...success() };
      }
      const v = await verifyExists(() =>
        indexClient().getIndex((res as any).name ?? (indexJson as any).name)
      );
      return { content: [{ type: "json", json: { ...v } }], ...success() };
    } catch (e) {
      return {
        content: [{ type: "json", json: { error: String(e) } }],
        ...normalizeError(e, { op: "createOrUpdateIndex", allowIndexDowntime, onlyIfUnchanged })
      };
    }
  }
);

/** Delete index */
server.tool(
  "deleteIndex",
  ToolSchema({
    inputSchema: z.object({ indexName: z.string(), verify: z.boolean().default(true) }),
    description: "Delete index and its documents."
  }),
  async ({ indexName, verify }) => {
    try {
      await indexClient().deleteIndex(indexName);
      if (!verify) {
        return { content: [{ type: "json", json: { ok: true } }], ...success() };
      }
      const v = await verifyDeleted(() => indexClient().getIndex(indexName));
      return { content: [{ type: "json", json: { ...v } }], ...success() };
    } catch (e) {
      return {
        content: [{ type: "json", json: { error: String(e) } }],
        ...normalizeError(e, { op: "deleteIndex", indexName })
      };
    }
  }
);

/** Index statistics (doc count, storage) */
server.tool(
  "getIndexStats",
  ToolSchema({ inputSchema: z.object({ indexName: z.string() }), description: "Get document count and storage usage." }),
  async ({ indexName }) => {
    try {
      const stats = await indexClient().getIndexStatistics(indexName);
      return { content: [{ type: "json", json: stats }], ...success() };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "getIndexStats", indexName }) };
    }
  }
);

/** ---------------- DOCUMENTS (VIEW CONTENTS) ---------------- */

/** Search/browse documents (keyword/hybrid/vector) */
server.tool(
  "searchDocuments",
  ToolSchema({
    inputSchema: z.object({
      indexName: z.string(),
      query: z.string().default("*"),
      top: z.number().int().positive().max(1000).default(50),
      skip: z.number().int().nonnegative().default(0),
      select: z.array(z.string()).optional(),
      filter: z.string().optional(),
      orderBy: z.array(z.string()).optional(),
      includeTotalCount: z.boolean().default(true),
      vectorQueries: z
        .array(z.object({
          kind: z.enum(["vector", "text"]).default("vector"),
          fields: z.array(z.string()),
          k: z.number().int().positive().max(1000).default(3),
          vector: z.array(z.number()).optional(),
          text: z.string().optional()
        }))
        .optional()
    }),
    description: "Query documents. Supports keyword (*), optional filter/select/orderBy, and vector/hybrid queries."
  }),
  async ({ indexName, query, top, skip, select, filter, orderBy, includeTotalCount, vectorQueries }) => {
    try {
      // Proactive hint based on index capabilities
      const idx = await indexClient().getIndex(indexName);
      const hasVectorizer = !!(idx as any).vectorSearch?.vectorizers?.length;
      const note = hasVectorizer
        ? "This index supports kind:'text' vector queries."
        : "No vectorizer configured; prefer kind:'vector' with numeric embeddings.";

      const sc = searchClient(indexName);
      const vs: VectorQuery[] =
        vectorQueries?.map(q => q.kind === "vector"
          ? { kind: "vector", fields: q.fields, vector: q.vector!, kNearestNeighborsCount: q.k }
          : { kind: "text", fields: q.fields, text: q.text!, kNearestNeighborsCount: q.k }
        ) ?? [];

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
      const total = (results as any).count;
      return { content: [{ type: "json", json: { count: total, results: out, note } }], ...success({ note }) };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "searchDocuments", indexName }) };
    }
  }
);

/** Get a single document by key */
server.tool(
  "getDocument",
  ToolSchema({
    inputSchema: z.object({ indexName: z.string(), key: z.string(), select: z.array(z.string()).optional() }),
    description: "Lookup a document by its primary key."
  }),
  async ({ indexName, key, select }) => {
    try {
      const sc = searchClient(indexName);
      const doc = await sc.getDocument(key, { selectedFields: select as any });
      return { content: [{ type: "json", json: doc }], ...success() };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "getDocument", indexName, key }) };
    }
  }
);

/** Count documents in an index */
server.tool(
  "countDocuments",
  ToolSchema({ inputSchema: z.object({ indexName: z.string() }), description: "Return document count." }),
  async ({ indexName }) => {
    try {
      const sc = searchClient(indexName);
      const n = await sc.getDocumentsCount();
      return { content: [{ type: "json", json: { count: n } }], ...success() };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "countDocuments", indexName }) };
    }
  }
);

/** ---------------- DATA SOURCES ---------------- */

server.tool(
  "listDataSources",
  ToolSchema({ inputSchema: z.object({}), description: "List data source connection names." }),
  async () => {
    try {
      const names: string[] = [];
      for await (const ds of indexerClient().listDataSourceConnections()) names.push(ds.name!);
      return { content: [{ type: "json", json: { dataSources: names } }], ...success({ count: names.length }) };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "listDataSources" }) };
    }
  }
);

server.tool(
  "getDataSource",
  ToolSchema({ inputSchema: z.object({ name: z.string() }), description: "Get a data source connection." }),
  async ({ name }) => {
    try {
      const ds = await indexerClient().getDataSourceConnection(name);
      return { content: [{ type: "json", json: ds }], ...success() };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "getDataSource", name }) };
    }
  }
);

server.tool(
  "createOrUpdateDataSource",
  ToolSchema({
    inputSchema: z.object({
      dataSourceJson: z.record(z.any()),
      verify: z.boolean().default(true),
      // Optimistic concurrency
      onlyIfUnchanged: z.boolean().default(false),
      ifMatchEtag: z.string().optional()
    }),
    description: "Create/Update a data source connection. Pass full SearchIndexerDataSourceConnection JSON."
  }),
  async ({ dataSourceJson, verify, onlyIfUnchanged, ifMatchEtag }) => {
    try {
      const options: any = { onlyIfUnchanged, ...(ifMatchEtag ? { ifMatch: ifMatchEtag } : {}) };
      const res = await indexerClient().createOrUpdateDataSourceConnection(dataSourceJson as any, options);
      if (!verify) return { content: [{ type: "json", json: { ok: true, result: res } }], ...success() };
      const name = (res as any).name ?? (dataSourceJson as any).name;
      const v = await verifyExists(() => indexerClient().getDataSourceConnection(name));
      return { content: [{ type: "json", json: { ...v } }], ...success() };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "createOrUpdateDataSource" }) };
    }
  }
);

server.tool(
  "deleteDataSource",
  ToolSchema({ inputSchema: z.object({ name: z.string(), verify: z.boolean().default(true) }), description: "Delete a data source connection." }),
  async ({ name, verify }) => {
    try {
      await indexerClient().deleteDataSourceConnection(name);
      if (!verify) return { content: [{ type: "json", json: { ok: true } }], ...success() };
      const v = await verifyDeleted(() => indexerClient().getDataSourceConnection(name));
      return { content: [{ type: "json", json: { ...v } }], ...success() };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "deleteDataSource", name }) };
    }
  }
);

/** ---------------- INDEXERS ---------------- */

server.tool(
  "listIndexers",
  ToolSchema({ inputSchema: z.object({}), description: "List indexer names." }),
  async () => {
    try {
      const names: string[] = [];
      for await (const ix of indexerClient().listIndexers()) names.push(ix.name!);
      return { content: [{ type: "json", json: { indexers: names } }], ...success({ count: names.length }) };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "listIndexers" }) };
    }
  }
);

server.tool(
  "getIndexer",
  ToolSchema({ inputSchema: z.object({ name: z.string() }), description: "Get an indexer." }),
  async ({ name }) => {
    try {
      const ix = await indexerClient().getIndexer(name);
      return { content: [{ type: "json", json: ix }], ...success() };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "getIndexer", name }) };
    }
  }
);

server.tool(
  "createOrUpdateIndexer",
  ToolSchema({
    inputSchema: z.object({
      indexerJson: z.record(z.any()),
      verify: z.boolean().default(true),
      // Optimistic concurrency
      onlyIfUnchanged: z.boolean().default(false),
      ifMatchEtag: z.string().optional()
    }),
    description: "Create/Update an indexer. Pass full SearchIndexer JSON."
  }),
  async ({ indexerJson, verify, onlyIfUnchanged, ifMatchEtag }) => {
    try {
      const options: any = { onlyIfUnchanged, ...(ifMatchEtag ? { ifMatch: ifMatchEtag } : {}) };
      const res = await indexerClient().createOrUpdateIndexer(indexerJson as any, options);
      if (!verify) return { content: [{ type: "json", json: { ok: true, result: res } }], ...success() };
      const name = (res as any).name ?? (indexerJson as any).name;
      const v = await verifyExists(() => indexerClient().getIndexer(name));
      return { content: [{ type: "json", json: { ...v } }], ...success() };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "createOrUpdateIndexer" }) };
    }
  }
);

server.tool(
  "deleteIndexer",
  ToolSchema({ inputSchema: z.object({ name: z.string(), verify: z.boolean().default(true) }), description: "Delete an indexer." }),
  async ({ name, verify }) => {
    try {
      await indexerClient().deleteIndexer(name);
      if (!verify) return { content: [{ type: "json", json: { ok: true } }], ...success() };
      const v = await verifyDeleted(() => indexerClient().getIndexer(name));
      return { content: [{ type: "json", json: { ...v } }], ...success() };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "deleteIndexer", name }) };
    }
  }
);

server.tool(
  "runIndexer",
  ToolSchema({
    inputSchema: z.object({
      name: z.string(),
      verify: z.boolean().default(true),
      verifyTimeoutMs: z.number().int().positive().default(300000),
      verifyIntervalMs: z.number().int().positive().default(3000)
    }),
    description: "Run an indexer now; optionally poll until completion."
  }),
  async ({ name, verify, verifyTimeoutMs, verifyIntervalMs }) => {
    try {
      await indexerClient().runIndexer(name); // 202 Accepted on success
      if (!verify) return { content: [{ type: "json", json: { ok: true, started: true } }], ...success() };
      const v = await pollIndexerCompletion(
        () => indexerClient().getIndexerStatus(name),
        { timeoutMs: verifyTimeoutMs, intervalMs: verifyIntervalMs }
      );
      return { content: [{ type: "json", json: { ...v } }], ...success() };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "runIndexer", name }) };
    }
  }
);

server.tool(
  "resetIndexer",
  ToolSchema({ inputSchema: z.object({ name: z.string() }), description: "Reset change tracking for an indexer (full re-crawl)." }),
  async ({ name }) => {
    try {
      await indexerClient().resetIndexer(name);
      return { content: [{ type: "text", text: `Indexer ${name} reset` }], ...success() };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "resetIndexer", name }) };
    }
  }
);

server.tool(
  "getIndexerStatus",
  ToolSchema({ inputSchema: z.object({ name: z.string() }), description: "Get execution history/status for an indexer." }),
  async ({ name }) => {
    try {
      const status = await indexerClient().getIndexerStatus(name);
      return { content: [{ type: "json", json: status }], ...success() };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "getIndexerStatus", name }) };
    }
  }
);

/** ---------------- SKILLSETS ---------------- */

server.tool(
  "listSkillsets",
  ToolSchema({ inputSchema: z.object({}), description: "List skillset names." }),
  async () => {
    try {
      const names: string[] = [];
      for await (const ss of indexerClient().listSkillsets()) names.push(ss.name!);
      return { content: [{ type: "json", json: { skillsets: names } }], ...success({ count: names.length }) };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "listSkillsets" }) };
    }
  }
);

server.tool(
  "getSkillset",
  ToolSchema({ inputSchema: z.object({ name: z.string() }), description: "Get a skillset." }),
  async ({ name }) => {
    try {
      const ss = await indexerClient().getSkillset(name);
      return { content: [{ type: "json", json: ss }], ...success() };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "getSkillset", name }) };
    }
  }
);

server.tool(
  "createOrUpdateSkillset",
  ToolSchema({
    inputSchema: z.object({
      skillsetJson: z.record(z.any()),
      verify: z.boolean().default(true),
      // Optimistic concurrency
      onlyIfUnchanged: z.boolean().default(false),
      ifMatchEtag: z.string().optional()
    }),
    description: "Create/Update a skillset. Pass full SearchIndexerSkillset JSON."
  }),
  async ({ skillsetJson, verify, onlyIfUnchanged, ifMatchEtag }) => {
    try {
      const options: any = { onlyIfUnchanged, ...(ifMatchEtag ? { ifMatch: ifMatchEtag } : {}) };
      const res = await indexerClient().createOrUpdateSkillset(skillsetJson as any, options);
      if (!verify) return { content: [{ type: "json", json: { ok: true, result: res } }], ...success() };
      const name = (res as any).name ?? (skillsetJson as any).name;
      const v = await verifyExists(() => indexerClient().getSkillset(name));
      return { content: [{ type: "json", json: { ...v } }], ...success() };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "createOrUpdateSkillset" }) };
    }
  }
);

server.tool(
  "deleteSkillset",
  ToolSchema({ inputSchema: z.object({ name: z.string(), verify: z.boolean().default(true) }), description: "Delete a skillset." }),
  async ({ name, verify }) => {
    try {
      await indexerClient().deleteSkillset(name);
      if (!verify) return { content: [{ type: "json", json: { ok: true } }], ...success() };
      const v = await verifyDeleted(() => indexerClient().getSkillset(name));
      return { content: [{ type: "json", json: { ...v } }], ...success() };
    } catch (e) {
      return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "deleteSkillset", name }) };
    }
  }
);

/** --- stdio --- */
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("azure-ai-search-mcp ready (stdio)");
```

---
> **How can I make this MCP server something I can deploy on Cloudflare? [[Build a Remote MCP Server on Cloudflare]] [[Tools Cloudflare Agents Docs]] [[Model Context Protocol MCP Cloudflare Agents Documentation]] [[Transport Mechanisms in Model Context Protocol (MCP)]]**
---

Great news: your current stdio MCP server can be turned into a remote, Cloudflare‑hosted MCP server with SSE (and Streamable HTTP) endpoints by wrapping your tools in a Cloudflare Worker using the Agents SDK’s McpAgent. Below is a clear, copy‑paste path based on [[Build a Remote MCP Server on Cloudflare]], [[Model Context Protocol MCP Cloudflare Agents Documentation]] and [[Transport Mechanisms in Model Context Protocol (MCP)]].

Overview
- You’ll scaffold a Cloudflare Worker that exposes your MCP server at:
  - /sse for Server‑Sent Events (current widely supported remote transport)
  - /mcp for Streamable HTTP (new transport; enable both for maximum client compatibility)
- You’ll port your existing server.tool definitions into a MyMCP class that extends McpAgent.
- You’ll set your Azure Search secrets in Wrangler and deploy.

Option A — Quickest: start from the “authless” template, then paste your tools
1) Scaffold an authless remote MCP project (template handles Worker boilerplate)
- npm
  npm create cloudflare@latest -- my-mcp-on-workers --template=cloudflare/ai/demos/remote-mcp-authless
- yarn
  yarn create cloudflare my-mcp-on-workers --template=cloudflare/ai/demos/remote-mcp-authless
- pnpm
  pnpm create cloudflare@latest my-mcp-on-workers --template=cloudflare/ai/demos/remote-mcp-authless

2) Configure runtime and secrets
- wrangler.toml (or wrangler.jsonc) — ensure Node.js compatibility and set an up-to-date compatibility_date.

Example wrangler.jsonc:
```json
{
  "name": "azure-search-mcp",
  "main": "src/index.ts",
  "compatibility_date": "2025-03-10",
  "compatibility_flags": ["nodejs_compat"]
}
```

Set your Azure Search endpoint and admin key as Worker secrets:
```bash
wrangler secret put AZURE_SEARCH_ENDPOINT
wrangler secret put AZURE_SEARCH_API_KEY
```

3) Replace src/index.ts with an MCP Worker that mounts both /sse and /mcp
The key is: extend McpAgent, register your tools in init(), and expose both transports as per [[Transport Mechanisms in Model Context Protocol (MCP)]].
```ts
src/index.ts (skeleton you can paste and then drop your tools into init)
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AzureKeyCredential, SearchClient, SearchIndexClient, SearchIndexerClient, type VectorQuery } from "@azure/search-documents";
import { env } from "cloudflare:workers"; // lets you read Worker bindings anywhere

export class MyMCP extends McpAgent {
  server = new McpServer({ name: "azure-ai-search-mcp", version: "1.0.0" });

  private get indexClient() {
    const endpoint = env.AZURE_SEARCH_ENDPOINT;
    const key = env.AZURE_SEARCH_API_KEY;
    const credential = new AzureKeyCredential(key);
    return new SearchIndexClient(endpoint, credential);
  }

  private get indexerClient() {
    const endpoint = env.AZURE_SEARCH_ENDPOINT;
    const key = env.AZURE_SEARCH_API_KEY;
    const credential = new AzureKeyCredential(key);
    return new SearchIndexerClient(endpoint, credential);
  }

  private searchClient(indexName: string) {
    const endpoint = env.AZURE_SEARCH_ENDPOINT;
    const key = env.AZURE_SEARCH_API_KEY;
    const credential = new AzureKeyCredential(key);
    return new SearchClient(endpoint, indexName, credential);
  }

  async init() {
    // Example: port your tools here. You can copy/paste your existing
    // server.tool(...) definitions (from your Node stdio server) into this method.

    // List index names
    this.server.tool(
      "listIndexes",
      { inputSchema: z.object({}) },
      async () => {
        const names: string[] = [];
        for await (const n of this.indexClient.listIndexesNames()) names.push(n);
        return { content: [{ type: "json", json: { indexes: names } }] };
      }
    );

    // Get index
    this.server.tool(
      "getIndex",
      { inputSchema: z.object({ indexName: z.string() }) },
      async ({ indexName }) => {
        const idx = await this.indexClient.getIndex(indexName);
        return { content: [{ type: "json", json: idx }] };
      }
    );

    // Create/update index (include allowIndexDowntime)
    this.server.tool(
      "createOrUpdateIndex",
      {
        inputSchema: z.object({
          indexJson: z.record(z.any()),
          allowIndexDowntime: z.boolean().default(false),
        }),
      },
      async ({ indexJson, allowIndexDowntime }) => {
        const res = await this.indexClient.createOrUpdateIndex(indexJson as any, { allowIndexDowntime });
        return { content: [{ type: "json", json: res }] };
      }
    );

    // Delete index
    this.server.tool(
      "deleteIndex",
      { inputSchema: z.object({ indexName: z.string() }) },
      async ({ indexName }) => {
        await this.indexClient.deleteIndex(indexName);
        return { content: [{ type: "text", text: `Deleted index ${indexName}` }] };
      }
    );

    // Index stats
    this.server.tool(
      "getIndexStats",
      { inputSchema: z.object({ indexName: z.string() }) },
      async ({ indexName }) => {
        const stats = await this.indexClient.getIndexStatistics(indexName);
        return { content: [{ type: "json", json: stats }] };
      }
    );

    // Search documents (iterate results.results per your audit)
    this.server.tool(
      "searchDocuments",
      {
        inputSchema: z.object({
          indexName: z.string(),
          query: z.string().default("*"),
          top: z.number().int().positive().max(1000).default(50),
          skip: z.number().int().nonnegative().default(0),
          select: z.array(z.string()).optional(),
          filter: z.string().optional(),
          orderBy: z.array(z.string()).optional(),
          includeTotalCount: z.boolean().default(true),
          vectorQueries: z
            .array(z.object({
              kind: z.enum(["vector", "text"]).default("vector"),
              fields: z.array(z.string()),
              k: z.number().int().positive().max(1000).default(3),
              vector: z.array(z.number()).optional(),
              text: z.string().optional()
            }))
            .optional()
        }),
      },
      async ({ indexName, query, top, skip, select, filter, orderBy, includeTotalCount, vectorQueries }) => {
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
          out.push({ score: (r as any).score, doc: (r as any).document });
        }
        return { content: [{ type: "json", json: { count: (results as any).count, results: out } }] };
      }
    );

    // ...continue pasting the rest of your tools:
    // getDocument, countDocuments, data source CRUD, indexer CRUD/run/reset/status,
    // skillset CRUD, and (optionally) your verify/insights wrappers.
  }
}

// Expose both remote transports: SSE and Streamable HTTP.
// This follows [[Transport Mechanisms in Model Context Protocol (MCP)]] guidance.
export default {
  fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/sse")) {
      return MyMCP.serveSSE("/sse").fetch(request, env as any, ctx);
    }
    if (pathname.startsWith("/mcp")) {
      return MyMCP.serve("/mcp").fetch(request, env as any, ctx);
    }
    return new Response("Not found", { status: 404 });
  }
};
```

Notes
- Using env from cloudflare:workers lets you access Worker secrets anywhere (no process.env in Workers).
- The nodejs_compat flag helps with Node APIs some SDKs expect.

4) Develop locally, then deploy
Local dev (the template’s dev script starts a local Worker you can connect to from the MCP inspector):
npm start

Deploy to Cloudflare:
npx wrangler@latest deploy

After deployment, your MCP endpoints will be live at:
- https://your-worker.your-account.workers.dev/sse
- https://your-worker.your-account.workers.dev/mcp

5) Test with MCP clients (authless)
- AI Playground: open, set model, put your /sse URL into “MCP Servers” and Connect (from [[Build a Remote MCP Server on Cloudflare]]).
- MCP Inspector:
  npx @modelcontextprotocol/inspector@latest
  Open http://localhost:5173 and connect to your deployed /sse URL.
- Claude Desktop (via local proxy) per the guide:
```json
  {
    "mcpServers": {
      "azure-search": {
        "command": "npx",
        "args": ["mcp-remote", "https://your-worker.your-account.workers.dev/sse"]
      }
    }
  }
```

Option B — Add OAuth authn/authz now (GitHub example)
If you want login + scoped permissions as in [[Build a Remote MCP Server on Cloudflare]]:
- Use the GitHub OAuth template:
```bash
  npm create cloudflare@latest -- my-mcp-github --template=cloudflare/ai/demos/remote-mcp-github-oauth
```
- Or wire auth into your project using the Workers OAuth Provider with apiHandlers to support both transports (see [[Transport Mechanisms in Model Context Protocol (MCP)]] “MCP Server with Authentication”):
```typescript
import GitHubHandler from "./github-handler";
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
// import your MyMCP from above

export default new OAuthProvider({
  apiHandlers: {
    "/sse": MyMCP.serveSSE("/sse"),
    "/mcp": MyMCP.serve("/mcp"),
  },
  defaultHandler: GitHubHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
```
- Create two GitHub OAuth Apps (local + production) and set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET with wrangler secret put ..., then deploy (full steps are in [[Build a Remote MCP Server on Cloudflare]]).

Why both /sse and /mcp
Per [[Transport Mechanisms in Model Context Protocol (MCP)]], SSE is broadly supported today, while Streamable HTTP is the new standard. Mounting both ensures any client can connect.

Tool design stays the same
As noted in [[Tools Cloudflare Agents Docs]] and [[Model Context Protocol MCP Cloudflare Agents Documentation]], you define tools the same way using the MCP TypeScript SDK APIs. You’ve already done that—just move those server.tool(...) calls into MyMCP.init().

Optional polish you can add
- Keep your verify and insight helpers (the normalizeError and verify flows you built) and import them into your Worker—these work the same in Workers.
- Consider returning both @search.score and @search.rerankerScore (if you use semantic reranking) in searchDocuments.
- Add Streamable HTTP tests with mcp-remote or compatible clients.

Quick checklist
- Scaffold with the authless template
- Add wrangler.jsonc with compatibility_flags ["nodejs_compat"]
- Set secrets: AZURE_SEARCH_ENDPOINT, AZURE_SEARCH_API_KEY
- Port your tools into MyMCP.init()
- Mount both /sse and /mcp
- Deploy with npx wrangler deploy
- Test with AI Playground or MCP Inspector

If you want, I can produce a ready-to-drop src/index.ts that includes all your tools (list/create/update/delete for indexes/datasources/indexers/skillsets, search/get/count, plus your verify + insights), already wired to /sse and /mcp.

#### Sources:

- [[Build a Remote MCP Server on Cloudflare]]
- [[Tools Cloudflare Agents Docs]]
- [[Model Context Protocol MCP Cloudflare Agents Documentation]]
- [[Transport Mechanisms in Model Context Protocol (MCP)]]
- [[Cloudflare Agents SDK Documentation]]
- [[Test a Remote MCP Server Cloudflare Agents Docs]]
- [[Playwright MCP Browser Rendering Deployment and Automation Guide]]
- [[MCP authentication and authorization implementation guide]]
- [[Model Context Protocol MCP Cloudflare Agents Docs]]
- [[Connect Claude Code to tools via MCP]]
- [[Model Context Protocol Overview and Specification]]

---
You can turn your current stdio MCP server into a remote, Cloudflare‑hosted MCP server by wrapping your tools with the Cloudflare Agents SDK’s McpAgent and exposing two endpoints:
- /sse for Server‑Sent Events (widely supported today)
- /mcp for Streamable HTTP (the new transport)
This follows the guidance in [[Build a Remote MCP Server on Cloudflare]], [[Model Context Protocol MCP Cloudflare Agents Documentation]], and [[Transport Mechanisms in Model Context Protocol (MCP)]].

Below is a copy‑pasteable path, plus a ready‑to‑drop Worker that ports your tools, insights, and verification helpers.

High‑level plan
- Scaffold a Cloudflare Worker using the remote MCP “authless” template.
- Add your Azure Search secrets as Worker secrets (no process.env in Workers).
- Port your server.tool(…) definitions into a MyMCP class (extends McpAgent).
- Expose both transports: /sse and /mcp.
- Deploy with Wrangler and test via the MCP Inspector or the AI Playground.

Option A — Fastest: start from the “authless” template and paste tools
1) Create the project (template sets up a remote MCP Worker)
- npm
  npm create cloudflare@latest -- my-azure-search-mcp --template=cloudflare/ai/demos/remote-mcp-authless
- yarn
  yarn create cloudflare my-azure-search-mcp --template=cloudflare/ai/demos/remote-mcp-authless
- pnpm
  pnpm create cloudflare@latest my-azure-search-mcp --template=cloudflare/ai/demos/remote-mcp-authless

2) Configure the Worker runtime
Add wrangler.jsonc (or use wrangler.toml) and enable Node compat as recommended for SDKs that expect Node APIs (see [[Transport Mechanisms in Model Context Protocol (MCP)]]):

wrangler.jsonc
{
  "name": "azure-search-mcp",
  "main": "src/index.ts",
  "compatibility_date": "2025-03-10",
  "compatibility_flags": ["nodejs_compat"]
}

3) Add secrets for Azure AI Search (Worker env replaces process.env)
wrangler secret put AZURE_SEARCH_ENDPOINT
wrangler secret put AZURE_SEARCH_API_KEY

4) Drop in your code (3 files)
Keep your insights and verify helpers (they work the same on Workers), and port server.ts into an Agent class. The only substantive changes are:
- Use env from cloudflare:workers instead of process.env.
- Replace stdio transport with McpAgent.serveSSE('/sse') and McpAgent.serve('/mcp').
- Keep your ToolSchema, success, normalizeError, and verify flows intact.

src/insights.ts
```ts
// src/insights.ts
import type { PipelineResponse } from "@azure/core-rest-pipeline";

export type InsightCode =
  | "ERR_AUTH" | "ERR_NOT_FOUND" | "ERR_CONFLICT"
  | "ERR_RATE_LIMIT" | "ERR_STORAGE_LIMIT" | "ERR_TIER_LIMIT"
  | "ERR_DOWNTIME_REQUIRED" | "ERR_VECTOR_DIM_MISMATCH"
  | "ERR_BAD_FILTER" | "ERR_INDEXER_COOLDOWN" | "ERR_NETWORK"
  | "OK";

export type Insight = {
  ok: boolean;
  code: InsightCode;
  message: string;
  recommendation?: string;
  retryAfterSec?: number;
  extras?: Record<string, any>;
};

function retryAfterSeconds(resp?: PipelineResponse | null) {
  const h = (resp as any)?.headers;
  if (!h) return undefined;
  const get = typeof h.get === "function" ? (k: string) => h.get(k) : (k: string) => h[k];
  const ra = get("Retry-After") ?? get("retry-after") ?? get("retry-after-ms");
  if (!ra) return undefined;
  const s = String(ra).trim().toLowerCase();
  const n = Number(s.replace("ms", ""));
  if (!Number.isFinite(n)) return undefined;
  return s.endsWith("ms") ? Math.ceil(n / 1000) : n;
}

export function success(extras?: Record<string, any>): { insight: Insight } {
  return { insight: { ok: true, code: "OK", message: "Success", extras } };
}

export function normalizeError(e: any, context?: Record<string, any>): { insight: Insight } {
  const status = e?.statusCode ?? e?.response?.status;
  const code = (e?.code as string) || "";
  const msg = String(e?.message ?? e?.toString?.() ?? e);

  let insight: Insight = {
    ok: false,
    code: "ERR_NETWORK",
    message: msg,
    recommendation: "Check connectivity, endpoint, or service availability.",
    extras: { status, code, ...context }
  };

  // Retryable/busy
  if (status === 429 || status === 503) {
    insight = {
      ok: false,
      code: "ERR_RATE_LIMIT",
      message: msg,
      recommendation:
        "Back off with jitter; if creating objects, you may be at tier/object limits or low on storage. Reduce request rate, delete unused objects/documents, or upgrade SKU.",
      retryAfterSec: retryAfterSeconds(e?.response),
      extras: { status, code, ...context }
    };
  } else if (status === 401 || status === 403) {
    insight = {
      ok: false,
      code: "ERR_AUTH",
      message: msg,
      recommendation:
        "Use an ADMIN key for management ops (indexes/indexers/skillsets/datasources) or configure Entra RBAC. Verify network/Private Link and audience.",
      extras: { status, code, ...context }
    };
  } else if (status === 404) {
    insight = {
      ok: false,
      code: "ERR_NOT_FOUND",
      message: msg,
      recommendation: "List resources first and correct the name; the resource likely does not exist.",
      extras: { status, code, ...context }
    };
  } else if (status === 409) {
    insight = {
      ok: false,
      code: "ERR_CONFLICT",
      message: msg,
      recommendation: "Serialize management operations and retry with exponential backoff.",
      extras: { status, code, ...context }
    };
  }

  // Heuristics
  if (/allowIndexDowntime/i.test(msg) || /analyzer|tokenizer|vectorizer.+cannot/i.test(msg)) {
    insight.code = "ERR_DOWNTIME_REQUIRED";
    insight.recommendation =
      "Retry createOrUpdateIndex with { allowIndexDowntime: true } or plan a rebuild/alias swap for breaking changes.";
  }
  if (/dimension/i.test(msg) && /vector/i.test(msg)) {
    insight.code = "ERR_VECTOR_DIM_MISMATCH";
    insight.recommendation =
      "Ensure the field’s vectorSearchDimensions equals the embedding length; regenerate embeddings or fix schema.";
  }
  if (/Invalid expression/i.test(msg) || /\$filter/i.test(msg)) {
    insight.code = "ERR_BAD_FILTER";
    insight.recommendation =
      "Fix OData syntax, use parentheses, any/all for collections, and consider search.in(...) for set filters.";
  }
  if (/Indexer invocation is once every 180 seconds/i.test(msg)) {
    insight.code = "ERR_INDEXER_COOLDOWN";
    insight.recommendation = "Wait ~180s between runs on Free tier or upgrade to a paid tier.";
  }

  return { insight };
}
```

src/verify.ts
```ts
// src/verify.ts
export type VerifyResult = {
  ok: boolean;
  verified: boolean;
  verifyStatus?: number;
  etag?: string | null;
  details?: Record<string, any>;
};

export function extractEtag(obj: any): string | null {
  return obj?.["@odata.etag"] ?? obj?.etag ?? obj?.ETag ?? null;
}

export async function verifyExists<T>(
  getFn: () => Promise<T>
): Promise<VerifyResult> {
  const res = await getFn();
  return { ok: true, verified: true, verifyStatus: 200, etag: extractEtag(res as any), details: res as any };
}

export async function verifyDeleted(getFn: () => Promise<any>): Promise<VerifyResult> {
  try {
    await getFn();
    return { ok: false, verified: false, verifyStatus: 200 };
  } catch (e: any) {
    const status = e?.statusCode ?? e?.response?.status;
    if (status === 404) return { ok: true, verified: true, verifyStatus: 404 };
    return { ok: false, verified: false, verifyStatus: status };
  }
}

/** Polls indexer status until terminal state or timeout. */
export async function pollIndexerCompletion<T extends { lastResult?: any }>(
  getStatusFn: () => Promise<T>,
  {
    intervalMs = 3000,
    timeoutMs = 300_000,
  }: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<VerifyResult> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const s = await getStatusFn();
    const last = (s as any).lastResult ?? (s as any).executionResult ?? {};
    const st = String(last.status ?? "").toLowerCase();
    if (st === "success" || st === "reset" || st === "persistentfailure" || st === "transientfailure") {
      return {
        ok: st === "success",
        verified: true,
        verifyStatus: 200,
        details: { lastResult: last, status: st },
      };
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return { ok: false, verified: false, details: { reason: "timeout" } };
}
```
src/index.ts (Worker MCP server with both transports)
```ts
/* src/index.ts */
import { env } from "cloudflare:workers";
import { McpAgent } from "agents/mcp";
import { McpServer, ToolSchema } from "@modelcontextprotocol/sdk/server/mcp.js";
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

class MyMCP extends McpAgent {
  server = new McpServer({ name: "azure-ai-search-mcp", version: "1.3.0" });

  private get endpoint(): string {
    return env.AZURE_SEARCH_ENDPOINT;
  }
  private get credential(): AzureKeyCredential {
    return new AzureKeyCredential(env.AZURE_SEARCH_API_KEY);
  }
  private indexClient() {
    return new SearchIndexClient(this.endpoint, this.credential);
  }
  private indexerClient() {
    return new SearchIndexerClient(this.endpoint, this.credential);
  }
  private searchClient(indexName: string) {
    return new SearchClient(this.endpoint, indexName, this.credential);
  }

  async init() {
    // ---------------- INDEX MANAGEMENT ----------------
    this.server.tool(
      "listIndexes",
      ToolSchema({ inputSchema: z.object({}), description: "List all index names." }),
      async () => {
        try {
          const names: string[] = [];
          for await (const n of this.indexClient().listIndexesNames()) names.push(n);
          return { content: [{ type: "json", json: { indexes: names } }], ...success({ count: names.length }) };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "listIndexes" }) };
        }
      }
    );

    this.server.tool(
      "getIndex",
      ToolSchema({ inputSchema: z.object({ indexName: z.string() }), description: "Fetch full index definition." }),
      async ({ indexName }) => {
        try {
          const idx = await this.indexClient().getIndex(indexName);
          return { content: [{ type: "json", json: idx }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "getIndex", indexName }) };
        }
      }
    );

    this.server.tool(
      "createOrUpdateIndex",
      ToolSchema({
        inputSchema: z.object({
          indexJson: z.record(z.any()),
          allowIndexDowntime: z.boolean().default(false),
          verify: z.boolean().default(true),
          onlyIfUnchanged: z.boolean().default(false),
          ifMatchEtag: z.string().optional()
        }),
        description: "Create/Update index. Pass full SearchIndex JSON. Set allowIndexDowntime for analyzer/vectorizer changes."
      }),
      async ({ indexJson, allowIndexDowntime, verify, onlyIfUnchanged, ifMatchEtag }) => {
        try {
          const options: any = {
            allowIndexDowntime,
            onlyIfUnchanged,
            ...(ifMatchEtag ? { ifMatch: ifMatchEtag } : {})
          };
          const res = await this.indexClient().createOrUpdateIndex(indexJson as any, options);
          if (!verify) return { content: [{ type: "json", json: { ok: true, result: res } }], ...success() };
          const v = await verifyExists(() =>
            this.indexClient().getIndex((res as any).name ?? (indexJson as any).name)
          );
          return { content: [{ type: "json", json: { ...v } }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "createOrUpdateIndex", allowIndexDowntime, onlyIfUnchanged }) };
        }
      }
    );

    this.server.tool(
      "deleteIndex",
      ToolSchema({
        inputSchema: z.object({ indexName: z.string(), verify: z.boolean().default(true) }),
        description: "Delete index and its documents."
      }),
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
      ToolSchema({ inputSchema: z.object({ indexName: z.string() }), description: "Get document count and storage usage." }),
      async ({ indexName }) => {
        try {
          const stats = await this.indexClient().getIndexStatistics(indexName);
          return { content: [{ type: "json", json: stats }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "getIndexStats", indexName }) };
        }
      }
    );

    // ---------------- DOCUMENTS ----------------
    this.server.tool(
      "searchDocuments",
      ToolSchema({
        inputSchema: z.object({
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
        }),
        description: "Query documents. Supports keyword (*), filter/select/orderBy, and vector/hybrid queries."
      }),
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
      ToolSchema({
        inputSchema: z.object({ indexName: z.string(), key: z.string(), select: z.array(z.string()).optional() }),
        description: "Lookup a document by its primary key."
      }),
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
      ToolSchema({ inputSchema: z.object({ indexName: z.string() }), description: "Return document count." }),
      async ({ indexName }) => {
        try {
          const sc = this.searchClient(indexName);
          const n = await sc.getDocumentsCount();
          return { content: [{ type: "json", json: { count: n } }], ...success() };
        } catch (e) {
          return { content: [{ type: "json", json: { error: String(e) } }], ...normalizeError(e, { op: "countDocuments", indexName }) };
        }
      }
    );

    // ---------------- DATA SOURCES ----------------
    this.server.tool(
      "listDataSources",
      ToolSchema({ inputSchema: z.object({}), description: "List data source connection names." }),
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
      ToolSchema({ inputSchema: z.object({ name: z.string() }), description: "Get a data source connection." }),
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
      ToolSchema({
        inputSchema: z.object({
          dataSourceJson: z.record(z.any()),
          verify: z.boolean().default(true),
          onlyIfUnchanged: z.boolean().default(false),
          ifMatchEtag: z.string().optional()
        }),
        description: "Create/Update a data source connection. Pass full SearchIndexerDataSourceConnection JSON."
      }),
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
      ToolSchema({ inputSchema: z.object({ name: z.string(), verify: z.boolean().default(true) }), description: "Delete a data source connection." }),
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
      ToolSchema({ inputSchema: z.object({}), description: "List indexer names." }),
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
      ToolSchema({ inputSchema: z.object({ name: z.string() }), description: "Get an indexer." }),
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
      ToolSchema({
        inputSchema: z.object({
          indexerJson: z.record(z.any()),
          verify: z.boolean().default(true),
          onlyIfUnchanged: z.boolean().default(false),
          ifMatchEtag: z.string().optional()
        }),
        description: "Create/Update an indexer. Pass full SearchIndexer JSON."
      }),
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
      ToolSchema({ inputSchema: z.object({ name: z.string(), verify: z.boolean().default(true) }), description: "Delete an indexer." }),
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
      ToolSchema({
        inputSchema: z.object({
          name: z.string(),
          verify: z.boolean().default(true),
          verifyTimeoutMs: z.number().int().positive().default(300000),
          verifyIntervalMs: z.number().int().positive().default(3000)
        }),
        description: "Run an indexer now; optionally poll until completion."
      }),
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
      ToolSchema({ inputSchema: z.object({ name: z.string() }), description: "Reset change tracking for an indexer (full re-crawl)." }),
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
      ToolSchema({ inputSchema: z.object({ name: z.string() }), description: "Get execution history/status for an indexer." }),
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
      ToolSchema({ inputSchema: z.object({}), description: "List skillset names." }),
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
      ToolSchema({ inputSchema: z.object({ name: z.string() }), description: "Get a skillset." }),
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
      ToolSchema({
        inputSchema: z.object({
          skillsetJson: z.record(z.any()),
          verify: z.boolean().default(true),
          onlyIfUnchanged: z.boolean().default(false),
          ifMatchEtag: z.string().optional()
        }),
        description: "Create/Update a skillset. Pass full SearchIndexerSkillset JSON."
      }),
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
      ToolSchema({ inputSchema: z.object({ name: z.string(), verify: z.boolean().default(true) }), description: "Delete a skillset." }),
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

// Expose both transports (SSE + Streamable HTTP) per [[Transport Mechanisms in Model Context Protocol (MCP)]]
export default {
  fetch(request: Request, envIn: unknown, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/sse")) {
      return MyMCP.serveSSE("/sse").fetch(request, envIn as any, ctx);
    }
    if (pathname.startsWith("/mcp")) {
      return MyMCP.serve("/mcp").fetch(request, envIn as any, ctx);
    }
    return new Response("Not found", { status: 404 });
  }
};
```
5) Develop locally and deploy
- Local dev (template provides a dev server):
  npm start
- Deploy:
  npx wrangler@latest deploy
- Your remote MCP endpoints:
  - https://your-worker.your-account.workers.dev/sse
  - https://your-worker.your-account.workers.dev/mcp

6) Test with MCP clients
- MCP Inspector (from [[Test a Remote MCP Server Cloudflare Agents Docs]]):
  npx @modelcontextprotocol/inspector@latest
  Open http://localhost:5173 and connect to your /sse URL.
- AI Playground:
  Open the Playground, paste your /sse URL under MCP Servers, Connect (see [[Build a Remote MCP Server on Cloudflare]]).
- Claude Desktop via local proxy (from [[Build a Remote MCP Server on Cloudflare]] and [[Test a Remote MCP Server Cloudflare Agents Docs]]):
  {
    "mcpServers": {
      "azure-search": {
        "command": "npx",
        "args": ["mcp-remote", "https://your-worker.your-account.workers.dev/sse"]
      }
    }
  }

Option B — Add OAuth authn/authz now (GitHub example)
If you want users to log in and scope which tools can be called, use the template with OAuth or wire in the Workers OAuth Provider (see [[Build a Remote MCP Server on Cloudflare]] and [[Transport Mechanisms in Model Context Protocol (MCP)]] “MCP Server with Authentication”).

- Template:
```bash
  npm create cloudflare@latest -- my-mcp-github --template=cloudflare/ai/demos/remote-mcp-github-oauth
```
- Or wrap your MyMCP with OAuthProvider and expose both transports via apiHandlers:
```ts
  import GitHubHandler from "./github-handler";
  import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
  // import { MyMCP } from "./index"; // your MyMCP class above

  export default new OAuthProvider({
    apiHandlers: {
      "/sse": MyMCP.serveSSE("/sse"),
      "/mcp": MyMCP.serve("/mcp"),
    },
    defaultHandler: GitHubHandler,
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/token",
    clientRegistrationEndpoint: "/register",
  });
```
- Create two GitHub OAuth Apps (local + production), then set:
  wrangler secret put GITHUB_CLIENT_ID
  wrangler secret put GITHUB_CLIENT_SECRET
- Then deploy and connect via the Inspector or Playground.

Why expose both /sse and /mcp?
Per [[Transport Mechanisms in Model Context Protocol (MCP)]], most clients support SSE today, while Streamable HTTP is the new standard. Supporting both ensures broad compatibility now and in the future.

Notes and tips
- Tool definitions: As described in [[Tools Cloudflare Agents Docs]] and [[Model Context Protocol MCP Cloudflare Agents Documentation]], you define tools the same way you did with the typescript SDK. We preserved your ToolSchema usage and your success/normalizeError patterns.
- Environment access: Use env from cloudflare:workers; Workers do not use process.env.
- Node compatibility: Keep "compatibility_flags": ["nodejs_compat"] in wrangler.jsonc to satisfy libraries expecting Node APIs (see [[Transport Mechanisms in Model Context Protocol (MCP)]]).
- Testing: The MCP Inspector and AI Playground make it easy to validate your tools end‑to‑end (see [[Test a Remote MCP Server Cloudflare Agents Docs]] and [[Build a Remote MCP Server on Cloudflare]]).

Deployment checklist
- Scaffold with the authless template.
- Add wrangler config and enable nodejs_compat.
- Set secrets AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_API_KEY.
- Add src/insights.ts, src/verify.ts, and src/index.ts as above.
- Expose both /sse and /mcp.
- Deploy with npx wrangler deploy.
- Test via the MCP Inspector, AI Playground, or Claude Desktop with mcp‑remote.

If you want, I can generate this project structure as a ready‑to‑zip repo layout for you, or add OAuth (GitHub/Stytch/Auth0/WorkOS) now following the patterns in [[Build a Remote MCP Server on Cloudflare]] and [[Model Context Protocol MCP Cloudflare Agents Documentation]].

#### Sources:

- [[Azure AI Search Tools - Azure MCP Server]]
- [[Build a Remote MCP Server on Cloudflare]]
- [[Tools Cloudflare Agents Docs]]
- [[Model Context Protocol MCP Cloudflare Agents Documentation]]
- [[Transport Mechanisms in Model Context Protocol (MCP)]]
- [[Cloudflare Agents SDK Documentation]]
- [[Test a Remote MCP Server Cloudflare Agents Docs]]
- [[Playwright MCP Browser Rendering Deployment and Automation Guide]]
- [[MCP authentication and authorization implementation guide]]
- [[Connect Claude Code to tools via MCP]]
- [[Model Context Protocol Overview and Specification]]
- [[Model Context Protocol MCP Cloudflare Agents Docs]]