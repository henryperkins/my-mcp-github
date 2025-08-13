# Azure Search Preview Spec → MCP Alignment

This document maps each improvement listed in `MCP_SPECIFICATION_ALIGNMENT.md` to concrete constructs already available in the **2025-08-01-preview** Azure Search REST specification.

## 1. Tool Hints

- All `PUT`, `POST`, and `DELETE` paths are **not** read-only → `readOnlyHint: false`.
- `DELETE` calls are destructive → `destructiveHint: true`.
- `PUT` is idempotent, `POST` is not → set `idempotentHint` accordingly.
- These flags can be generated automatically when parsing the Swagger `paths` object.

## 2. Resource Management

- Expose REST entities as MCP resources:
  - `agents/{agentName}` and collection `agents`
  - `knowledgesources/{sourceName}`
  - `indexes/{indexName}` (already present)
- Use the same URI format in `server.resource()`; pass the JSON body through with `mimeType: "application/json"`.

## 3. Error Handling

- Every operation references a `default` response of type **`ErrorResponse`**.
  - Map `ErrorResponse.code` → MCP `error` value (`invalid_request`, `resource_not_found`, etc.).
  - Map `ErrorResponse.message` → MCP `message`.
- `IfMatch` / `IfNoneMatch` parameters introduce ETag conflicts (`412`) → map to MCP `conflict` code.

## 4. Progress Notifications

- Long-running operations surface `x-ms-request-id`.
- Store this ID, poll the related `GET` status endpoint, and emit `notification("progress", { operation, progress })` until completion.

## 5. Enhanced Capabilities Declaration

- `Prefer: return=representation` is supported on many PUTs. Use it to return the full resource after updates for better MCP UX.
- This spec does not advertise `respond-async`; for long operations rely on explicit status endpoints (e.g., indexer `search.status`).
- Tracing headers (`client-request-id`, `x-ms-request-id`) justify rich `logging.levels` exposure.

## 6. Output Schemas

- Convert every object in Swagger **`definitions`** (e.g., `KnowledgeAgent`, `KnowledgeSource`, `ListKnowledgeAgentsResult`) into equivalent Zod schemas.
- Preserve field docs via `.describe()` so schemas double as inline MCP documentation.

## 7. Pagination Protocol

- Paths with `x-ms-pageable` define paging details.
  - Expose MCP inputs `{ cursor, limit }`.
  - Relay service `nextLink` as `nextCursor`, set `hasMore` when `nextLink` is non-null.

## 8. Request Context

- Optional `clientRequestId` parameter maps directly to an MCP `contextId` (or similar input).
- Echo this ID back so LLMs can chain related requests.

## Recommended Implementation Order

1. **Generate Zod schemas** from Swagger `definitions`.
2. **Wrap CRUD endpoints** as MCP tools with correct hints & schemas.
3. **Add pagination** for every `x-ms-pageable` path.
4. **Integrate structured errors** & ETag conflict mapping.
5. **Implement async polling** & progress notifications.

Leveraging the preview specification in this manner satisfies all eight alignment goals with minimal custom code—the necessary metadata already exists in the Swagger and only needs to be surfaced through MCP constructs.


## Corrections and Nuances

- Prefer header: Use `Prefer: return=representation` on PUT to return updated resources; do not rely on `respond-async` (not present in this spec).
- Paging: Many list endpoints have `x-ms-pageable.nextLinkName: null`. Implement MCP cursors consistently; when available, pass service `$select/$top/$skip` to reduce payloads.
- Concurrency: Encourage `If-Match` for updates/deletes; treat HTTP 412 as MCP `conflict` and surface the prior ETag (when available) to guide retries.

## Concrete MCP Tool Stubs

Below are concrete stubs showing how to wrap key preview endpoints as MCP tools. Type signatures use Zod-style schemas and assume a typed REST client.

```ts
// Hints helper derived from HTTP method
function hintsFor(method: "GET"|"PUT"|"POST"|"DELETE") {
  return {
    readOnlyHint: method === "GET",
    destructiveHint: method === "DELETE",
    idempotentHint: method === "GET" || method === "PUT" || method === "DELETE",
  } as const;
}

// Error normalization
function toMcpError(e: any, requestId?: string) {
  const msg = e?.message || String(e);
  const status = e?.status || e?.response?.status;
  const map: Record<number, string> = {
    400: "invalid_request",
    401: "unauthorized",
    403: "unauthorized",
    404: "resource_not_found",
    409: "conflict",
    412: "conflict",
    429: "rate_limited",
  };
  const error = map[status] || (status >= 500 ? "server_error" : "unknown_error");
  return {
    isError: true,
    content: [{
      type: "text",
      text: JSON.stringify({ error, status, message: msg, requestId }, null, 2)
    }]
  };
}

// Optional request context
function withRequestHeaders(opts?: { clientRequestId?: string, preferReturnRepresentation?: boolean, etag?: string, ifNoneMatch?: string }) {
  const headers: Record<string,string> = {};
  if (opts?.clientRequestId) headers["x-ms-client-request-id"] = opts.clientRequestId;
  if (opts?.preferReturnRepresentation) headers["Prefer"] = "return=representation";
  if (opts?.etag) headers["If-Match"] = opts.etag;
  if (opts?.ifNoneMatch) headers["If-None-Match"] = opts.ifNoneMatch;
  return headers;
}

// 1) Indexes: list with MCP pagination
this.server.tool(
  "listIndexes",
  "List all search indexes (client-side cursor).",
  {
    cursor: z.string().optional().describe("Opaque cursor (offset)"),
    limit: z.number().int().positive().max(200).default(50),
    select: z.string().optional().describe("Comma-separated $select of top-level props")
  },
  async ({ cursor, limit, select }) => {
    try {
      const offset = cursor ? parseInt(cursor, 10) : 0;
      const res = await client.listIndexes({ select });
      const items = res.indexes ?? res.value ?? [];
      const slice = items.slice(offset, offset + limit);
      const nextCursor = offset + limit < items.length ? String(offset + limit) : null;
      return { content: [{ type: "json", json: { items: slice, nextCursor, hasMore: !!nextCursor } }] };
    } catch (e) {
      return toMcpError(e);
    }
  },
  { ...hintsFor("GET") }
);

// 2) Index stats (per-index)
const IndexStatsSchema = z.object({ documentCount: z.number(), storageSize: z.number() });
this.server.tool(
  "getIndexStats",
  "Get document count and storage usage for an index.",
  { indexName: z.string() },
  async ({ indexName }) => {
    try {
      const r = await client.getIndexStatistics(indexName);
      return { content: [{ type: "json", json: r }] };
    } catch (e) { return toMcpError(e); }
  },
  { ...hintsFor("GET"), outputSchema: IndexStatsSchema }
);

// 3) Analyzer test
this.server.tool(
  "analyzeText",
  "Test how an analyzer tokenizes text for an index.",
  { indexName: z.string(), request: z.object({ analyzer: z.string().optional(), text: z.string() }) },
  async ({ indexName, request }) => {
    try {
      const r = await client.indexes.analyze(indexName, request);
      return { content: [{ type: "json", json: r }] };
    } catch (e) { return toMcpError(e); }
  },
  { ...hintsFor("POST") }
);

// 4) Indexers lifecycle
this.server.tool(
  "runIndexer",
  "Run an indexer and emit progress until completion.",
  { indexerName: z.string(), clientRequestId: z.string().uuid().optional() },
  async ({ indexerName, clientRequestId }) => {
    try {
      await client.indexers.run(indexerName, { headers: withRequestHeaders({ clientRequestId }) });
      let complete = false;
      while (!complete) {
        const status = await client.indexers.getStatus(indexerName);
        const phase = status?.lastResult?.status ?? status?.status;
        const progress = phase === "inProgress" ? 0.5 : phase === "success" ? 1.0 : 0.0;
        await this.server.notification("progress", { operation: `Indexer ${indexerName}`, progress });
        complete = phase === "success" || phase === "error";
        if (!complete) await new Promise(r => setTimeout(r, 4000));
      }
      return { content: [{ type: "text", text: `Indexer ${indexerName} completed.` }] };
    } catch (e) { return toMcpError(e); }
  },
  { ...hintsFor("POST") }
);

this.server.tool(
  "getIndexerStatus",
  "Get current indexer status and recent execution history.",
  { indexerName: z.string() },
  async ({ indexerName }) => {
    try {
      const r = await client.indexers.getStatus(indexerName);
      return { content: [{ type: "json", json: r }] };
    } catch (e) { return toMcpError(e); }
  },
  { ...hintsFor("GET") }
);

// 5) Knowledge Agents (CRUD with ETag)
const KnowledgeAgentSchema = z.any(); // Generate from Swagger definitions
this.server.tool(
  "createOrUpdateAgent",
  "Create or update a knowledge agent (uses ETag if provided).",
  {
    agentName: z.string(),
    body: KnowledgeAgentSchema,
    etag: z.string().optional(),
    clientRequestId: z.string().uuid().optional()
  },
  async ({ agentName, body, etag, clientRequestId }) => {
    try {
      const headers = withRequestHeaders({ clientRequestId, preferReturnRepresentation: true, etag });
      const r = await client.agents.createOrUpdate(agentName, body, { headers });
      return { content: [{ type: "json", json: r }] };
    } catch (e) { return toMcpError(e); }
  },
  { ...hintsFor("PUT"), outputSchema: KnowledgeAgentSchema }
);

this.server.tool(
  "getAgent",
  "Retrieve a knowledge agent definition.",
  { agentName: z.string() },
  async ({ agentName }) => {
    try { return { content: [{ type: "json", json: await client.agents.get(agentName) }] }; }
    catch (e) { return toMcpError(e); }
  },
  { ...hintsFor("GET") }
);

this.server.tool(
  "deleteAgent",
  "Delete a knowledge agent (destructive).",
  { agentName: z.string(), etag: z.string().optional() },
  async ({ agentName, etag }) => {
    try {
      await client.agents.delete(agentName, { headers: withRequestHeaders({ etag }) });
      return { content: [{ type: "text", text: `Deleted agent ${agentName}` }] };
    } catch (e) { return toMcpError(e); }
  },
  { ...hintsFor("DELETE") }
);

// 6) Knowledge Sources: mirror agents CRUD
```

## Resource Stubs

Expose high-value entities as MCP resources for discovery and browsing:

```ts
this.server.resource(
  "indexes/{indexName}",
  "Index definition (SearchIndex schema).",
  async ({ indexName }) => {
    const def = await client.indexes.get(indexName);
    return { uri: `indexes/${indexName}` , mimeType: "application/json", metadata: { name: indexName }, contents: [{ uri: `indexes/${indexName}`, mimeType: "application/json", text: JSON.stringify(def, null, 2) }] };
  }
);

this.server.resource(
  "agents/{agentName}",
  "Knowledge agent definition.",
  async ({ agentName }) => {
    const ag = await client.agents.get(agentName);
    return { uri: `agents/${agentName}`, mimeType: "application/json", metadata: { name: agentName }, contents: [{ uri: `agents/${agentName}`, mimeType: "application/json", text: JSON.stringify(ag, null, 2) }] };
  }
);

this.server.resource(
  "knowledgesources/{sourceName}",
  "Knowledge source definition.",
  async ({ sourceName }) => {
    const ks = await client.knowledgeSources.get(sourceName);
    return { uri: `knowledgesources/${sourceName}`, mimeType: "application/json", contents: [{ uri: `knowledgesources/${sourceName}`, mimeType: "application/json", text: JSON.stringify(ks, null, 2) }] };
  }
);

this.server.resource(
  "servicestats",
  "Service-level statistics.",
  async () => ({ uri: "servicestats", mimeType: "application/json", contents: [{ uri: "servicestats", mimeType: "application/json", text: JSON.stringify(await client.getServiceStatistics(), null, 2) }] })
);

this.server.resource(
  "indexstats",
  "Summary statistics across all indexes.",
  async () => ({ uri: "indexstats", mimeType: "application/json", contents: [{ uri: "indexstats", mimeType: "application/json", text: JSON.stringify(await client.getIndexStatsSummary(), null, 2) }] })
);
```

## Implementation Checklist

- Generate Zod schemas from Swagger `definitions` (respect `x-ms-enum`, `x-nullable`, discriminators).
- Wrap CRUD paths as MCP tools with hints and ETag headers; include `Prefer: return=representation` on PUT.
- Publish resources for indexes, agents, knowledge sources, and stats; consider `resources.subscribe` for indexer status.
- Normalize errors with HTTP→MCP mapping and include `x-ms-request-id` where available.
- Add MCP pagination (`cursor`, `limit`) for list endpoints; pass `$select/$top/$skip` when supported.
- Thread `x-ms-client-request-id` through calls and echo in responses/logs.
