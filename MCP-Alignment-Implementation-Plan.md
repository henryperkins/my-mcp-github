# Azure Search MCP Server - Comprehensive Alignment Implementation Plan

This document merges the analysis from `MCP_SPECIFICATION_ALIGNMENT.md`, `SRC_INDEX_MCP_ALIGNMENT_REVIEW.md`, and `AzureSearch-MCP-Alignment-Recommendations.md` into a unified implementation plan for aligning **the _current_ modular Azure Search MCP server** with the latest MCP specification (2025-06-18) and Azure Search REST API (2025-08-01-preview).

👉 **Why an update?**  Since the original plan was written the code-base was refactored from a single monolithic `src/index.ts` file into a _collection of focused tool-registration modules_.  All tool definitions now live in purpose-built files (`IndexTools.ts`, `DocumentTools.ts`, `DataTools.ts`, `IndexerTools.ts`, `SkillTools.ts`, `SynonymTools.ts`), are wired up from the lightweight entry point in `src/index.ts`, and share common helpers under `src/utils/*`.  The original plan referenced line numbers and helper methods that no longer exist or live elsewhere.  This revision keeps the same high-level goals but maps the work to the **new architecture** so implementation tasks are immediately actionable.

## Executive Summary

The current Azure Search MCP server provides comprehensive functionality for index, document, indexer, skillset, and synonym management. To achieve full MCP specification compliance, we need to implement:

1. **MCP-native resource exposure** for browsing capabilities
2. **Structured error handling** with proper MCP error codes
3. **Tool hints** for better LLM decision making
4. **Progress notifications** for long-running operations
5. **Output schemas** for type safety and validation
6. **Pagination protocol** for large result sets
7. **Request context threading** for better tracing
8. **Preview API features** (Knowledge Agents, Knowledge Sources)

## Current State Analysis

### ✅ Already Implemented
- **Core Functionality**: Complete CRUD operations for indexes, documents, indexers, skillsets, and synonyms
- **Safety Features**: Destructive operations clearly marked with "⚠️ DESTRUCTIVE" warnings
- **Response Management**: Large response handling with truncation and optional Azure OpenAI summarization via [`formatResponse()`](src/utils/response.ts)
- **Search Operations**: Full document search with filtering, sorting, and pagination support via [`searchDocuments`](src/DocumentTools.ts)
- **Status Monitoring**: Indexer status tracking and execution history via [`getIndexerStatus`](src/IndexerTools.ts)

### ❌ Missing MCP Compliance Features
- **Resource Management**: No `server.resource()` registrations – _none_ of the modular tool files expose resources.
- **Structured Errors**: `utils/response.ts` only exposes `formatError()` and `insights.normalizeError()` – neither maps to MCP error codes.
- **Tool Hints**: No `readOnlyHint`, `destructiveHint`, or `idempotentHint` flags are passed in any `server.tool` declarations across the tool modules.
- **Progress Notifications**: The `runIndexer` logic in `IndexerTools.ts` fires-and-forgets – no incremental `notification("progress")` events.
- **Output Schemas**: Input validation uses Zod but **no output schemas** are supplied to `server.tool`.
- **Cursor Pagination**: Client-side pagination helpers exist but are not exposed through MCP-style cursors.
- **Request Context**: `AzureSearchClient` does not currently pass `x-ms-client-request-id` or expose ETag handling.
- **Preview Features**: Missing Knowledge Agents and Knowledge Sources endpoints

## Implementation Strategy

### Phase 1: Core MCP Compliance (High Priority)

#### 1.1 Tool Hints Implementation
**Goal**: Add behavioral hints to help LLMs understand tool impact
**Files**: [`src/utils/toolHints.ts`](new), _plus_ every `*.Tools.ts` module where `server.tool` is called.

```typescript
// Add hints helper
// utils/toolHints.ts – shared helper
export function getToolHints(method: "GET" | "PUT" | "POST" | "DELETE") {
  return {
    readOnlyHint: method === "GET",
    destructiveHint: method === "DELETE",
    idempotentHint: method === "GET" || method === "PUT" || method === "DELETE"
  } as const;
}

// Example – inside `IndexTools.ts`

server.tool(
  "deleteIndex",
  "⚠️ DESTRUCTIVE: Permanently delete an index and all its documents. This action cannot be undone.",
  { indexName: z.string() },
  async ({ indexName }) => { /* ... */ },
 getToolHints("DELETE")
);

#### 1.4 Protocol Discovery & Lists
**Goal**: Expose mandatory discovery endpoints so clients can enumerate capabilities without hard-coding paths.
**Files**: [`src/index.ts`](src/index.ts)

```typescript
// Root discovery (rpc.discover) already handled by McpServer internals, but we must
// supplement with dynamic lists so UI clients can build menus.

server.capabilities.tools = { listChanged: true };
server.capabilities.prompts = { listChanged: true };

// When tool set changes (e.g., after env-based feature flags) emit notification
server.notification("tools/listChanged", {});

// Prompts list is provided automatically but we register a handler so we can
// inject pagination later if needed.
```
```

#### 1.2 Enhanced Error Handling
**Goal**: Implement structured MCP error responses with proper error codes
**Files**: [`src/insights.ts`](src/insights.ts), [`src/utils/response.ts`](src/utils/response.ts), [`src/utils/errors.ts`](new)

```typescript
// utils/errors.ts – shared across tools
export function formatMcpError(error: any, requestId?: string) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const status = error?.status || error?.response?.status;
  
  // Map HTTP status codes to MCP error codes
  const errorCodeMap: Record<number, string> = {
    400: "invalid_request",
    401: "unauthorized", 
    403: "unauthorized",
    404: "resource_not_found",
    409: "conflict",
    412: "conflict", // ETag mismatch
    429: "rate_limited"
  };
  
  const errorCode = errorCodeMap[status] || (status >= 500 ? "server_error" : "unknown_error");
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        error: errorCode,
        status,
        message: errorMessage,
        requestId: requestId || error?.headers?.["x-ms-request-id"]
      }, null, 2)
    }],
    isError: true
  };
}
```

#### 1.3 Output Schemas
**Goal**: Add Zod schemas for tool outputs to provide type safety and validation
**Files**: All `*.Tools.ts` modules and new shared schema folder `src/schemas/*` (to avoid duplication).

```typescript
// Define output schemas
const IndexStatsSchema = z.object({
  documentCount: z.number(),
  storageSize: z.number()
});

const SearchResultsSchema = z.object({
  value: z.array(z.any()),
  "@odata.count": z.number().optional(),
  "@search.nextPageParameters": z.any().optional()
});

// Apply to tools
this.server.tool(
  "getIndexStats",
  "Get document count and storage usage.",
  { indexName: z.string() },
  async ({ indexName }) => { /* ... */ },
  {
    ...getToolHints("GET"),
    outputSchema: IndexStatsSchema
  }
);
```

### Phase 2: Advanced MCP Features (Medium Priority)

#### 2.1 Resource Management
**Goal**: Expose Azure Search entities as browsable MCP resources
**Files**: [`src/resources.ts`](new), [`src/index.ts`](src/index.ts)

```typescript
// Update server capabilities in constructor
server = new McpServer({
  name: "azure-ai-search-mcp",
  version: "1.4.0",
  capabilities: {
    prompts: {},
    resources: {
      subscribe: true,
      listChanged: true
    },
    tools: {
      listChanged: false
    },
    logging: {
      levels: ["debug", "info", "warning", "error"]
    }
  }
});

// Implement key resources
this.server.resource(
  "indexes/{indexName}",
  "Browse search index definition and metadata",
  async ({ indexName }) => {
    const client = this.getClient();
    const indexDef = await client.getIndex(indexName);
    const stats = await client.getIndexStats(indexName);
    
    return {
      uri: `indexes/${indexName}`,
      mimeType: "application/json",
      metadata: {
        documentCount: stats.documentCount,
        storageSize: stats.storageSize,
        fieldCount: indexDef.fields?.length || 0
      },
      contents: [{
        uri: `indexes/${indexName}`,
        mimeType: "application/json", 
        text: JSON.stringify(indexDef, null, 2)
      }]
    };
  }
);

// ---------------- RESOURCE LIST & READ ----------------
// Required by ResourcesOverviewMCP2025.md – provides opaque-cursor pagination

this.server.method("resources/list", async ({ cursor }) => {
  // cursor is opaque – encode/decode with base64 JSON { offset }
  const { offset } = cursor ? JSON.parse(Buffer.from(cursor, "base64").toString()) : { offset: 0 };
  const pageSize = 50;
  const all = await listAllResources(); // helper enumerates resource registry
  const nextOffset = offset + pageSize < all.length ? offset + pageSize : null;
  return {
    resources: all.slice(offset, offset + pageSize),
    ...(nextOffset !== null && { nextCursor: Buffer.from(JSON.stringify({ offset: nextOffset })).toString("base64") })
  };
});

this.server.method("resources/read", async ({ uri }) => {
  const res = await getResourceByUri(uri); // helper
  return { contents: res.contents };
});

// Emit listChanged when registry updated
watchResourceRegistry((change) => {
  this.server.notification("resources/listChanged", change);
});

this.server.resource(
  "servicestats",
  "Service-level statistics and quotas",
  async () => {
    const client = this.getClient();
    const stats = await client.getServiceStatistics();
    return {
      uri: "servicestats",
      mimeType: "application/json",
      contents: [{
        uri: "servicestats",
        mimeType: "application/json",
        text: JSON.stringify(stats, null, 2)
      }]
    };
  }
);
```

#### 2.2 Progress Notifications
**Goal**: Provide real-time progress updates for long-running operations
**Files**: [`src/IndexerTools.ts`](src/IndexerTools.ts), [`src/utils/progress.ts`](new)

```typescript
this.server.tool(
  "runIndexerWithProgress",
  "Run an indexer and track progress until completion.",
  { 
    indexerName: z.string(),
    clientRequestId: z.string().uuid().optional().describe("Optional request ID for tracing")
  },
  async ({ indexerName, clientRequestId }) => {
    try {
      const client = this.getClient();
      const headers = clientRequestId ? { "x-ms-client-request-id": clientRequestId } : {};
      
      // Start the indexer
      await client.runIndexer(indexerName, { headers });
      
      // Send initial progress notification
      await this.server.notification("progress", {
        operation: `Running indexer ${indexerName}`,
        progress: 0.1,
        message: "Indexer started"
      });
      
      // Poll for completion with progress updates
      let complete = false;
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max polling
      
      while (!complete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        const status = await client.getIndexerStatus(indexerName);
        const lastResult = status.lastResult;
        
        if (lastResult) {
          const progress = this.calculateIndexerProgress(lastResult);
          const message = this.getIndexerStatusMessage(lastResult);
          
          await this.server.notification("progress", {
            operation: `Running indexer ${indexerName}`,
            progress,
            message
          });
          
          complete = lastResult.status === "success" || lastResult.status === "transientFailure";
        }
        
        attempts++;
      }
      
      const finalStatus = await client.getIndexerStatus(indexerName);
      return await this.formatResponse({
        indexerName,
        status: finalStatus.lastResult?.status || "unknown",
        documentsProcessed: finalStatus.lastResult?.itemCount || 0,
        clientRequestId
      });
      
    } catch (error) {
      return this.formatMcpError(error, clientRequestId);
    }
  },
  getToolHints("POST")
);

private calculateIndexerProgress(lastResult: any): number {
  if (lastResult.status === "success") return 1.0;
  if (lastResult.status === "inProgress") {
    // Estimate progress based on items processed
    const processed = lastResult.itemCount || 0;
    const failed = lastResult.failedItemCount || 0;
    const total = processed + failed;
    return total > 0 ? Math.min(0.9, processed / total) : 0.5;
  }
  if (lastResult.status === "transientFailure") return 0.0;
  return 0.1; // Started but status unknown
}
```

#### 2.3 Pagination Protocol
**Goal**: Implement MCP-style cursor-based pagination for list operations
**Files**: [`src/IndexTools.ts`](src/IndexTools.ts), [`src/DocumentTools.ts`](src/DocumentTools.ts), [`src/utils/pagination.ts`](new)

```typescript
this.server.tool(
  "listIndexesPaginated",
  "List search indexes with cursor-based pagination.",
  {
    cursor: z.string().optional().describe("Opaque pagination cursor"),
    pageSize: z.number().int().positive().max(200).default(50).describe("Requested page size (server may override)")
  },
  async ({ cursor, pageSize }) => {
    try {
      const { offset } = cursor ? JSON.parse(Buffer.from(cursor, "base64").toString()) : { offset: 0 };
      const client = this.getClient();
      const allIndexes = await client.listIndexes();
      const slice = allIndexes.slice(offset, offset + pageSize);

      const nextOffset = offset + pageSize < allIndexes.length ? offset + pageSize : null;
      return await this.formatResponse({
        indexes: slice,
        ...(nextOffset !== null && {
          nextCursor: Buffer.from(JSON.stringify({ offset: nextOffset })).toString("base64")
        })
      });
    } catch (error) {
      return this.formatMcpError(error);
    }
  },
getToolHints("GET")
);

#### 2.4 Sampling Protocol
**Goal**: Support MCP sampling for deterministic re-execution and debugging flows (see MCP_SamplingProtocolOverview.md)
**Files**: [`src/utils/sampling.ts`](new), [`src/index.ts`](src/index.ts)

```typescript
// utils/sampling.ts – helper storage abstraction (KV / D1 / R2)
export async function recordSampling(id: string, payload: any) {
  await MY_KV.put(`sampling:${id}`, JSON.stringify(payload));
}

export async function getSampling(id: string) {
  const raw = await MY_KV.get(`sampling:${id}`);
  return raw ? JSON.parse(raw) : null;
}

// Register protocol methods
server.method("sampling/record", async ({ id, request, response }) => {
  await recordSampling(id, { request, response });
  return { ok: true };
});

server.method("sampling/playback", async ({ id }) => {
  const data = await getSampling(id);
  if (!data) throw new Error("sampling_not_found");
  return data;
});
```

#### 2.5 Enhanced Logging
**Goal**: Emit `logging/event` notifications and allow runtime log-level changes (MCPLoggingProtocol20250618.md)
**Files**: [`src/utils/logging.ts`](new), [`src/index.ts`](src/index.ts)

```typescript
// utils/logging.ts – simple Pub/Sub
let currentLevel: "debug" | "info" | "warning" | "error" = "info";
const subscribers: ((e: any) => void)[] = [];

export function setLogLevel(l: typeof currentLevel) { currentLevel = l; }
export function onLog(cb: (e:any)=>void) { subscribers.push(cb); }
export function log(lvl: typeof currentLevel, msg: string, extras?: any) {
  if (lvl === "error" || lvl === currentLevel) {
    const entry = { timestamp: Date.now(), level: lvl, msg, ...extras };
    subscribers.forEach(s => s(entry));
  }
}

// Register with MCP server
server.method("logging/setLevel", ({ level }) => { setLogLevel(level); return { ok: true }; });
onLog(entry => server.notification("logging/event", entry));
```
```

### Phase 3: Azure Search Preview Features (Low Priority)

#### 3.1 Knowledge Agents Support
**Goal**: Add full CRUD support for Knowledge Agents (2025-08-01-preview)
**Files**: [`src/azure-search-client.ts`](src/azure-search-client.ts), [`src/index.ts`](src/index.ts)

Client additions:
```typescript
// Add to AzureSearchClient class
async createOrUpdateAgent(agentName: string, agent: any, options?: { headers?: Record<string, string> }) {
  const url = `${this.endpoint}/agents('${agentName}')?api-version=${this.apiVersion}`;
  const headers = { 
    ...this.getHeaders(), 
    "Prefer": "return=representation",
    ...options?.headers 
  };
  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(agent)
  });
  return this.handleResponse(response);
}

async getAgent(agentName: string) {
  const url = `${this.endpoint}/agents('${agentName}')?api-version=${this.apiVersion}`;
  const response = await fetch(url, { headers: this.getHeaders() });
  return this.handleResponse(response);
}

async deleteAgent(agentName: string, options?: { headers?: Record<string, string> }) {
  const url = `${this.endpoint}/agents('${agentName}')?api-version=${this.apiVersion}`;
  const headers = { ...this.getHeaders(), ...options?.headers };
  const response = await fetch(url, { method: "DELETE", headers });
  return this.handleResponse(response);
}

async listAgents() {
  const url = `${this.endpoint}/agents?api-version=${this.apiVersion}`;
  const response = await fetch(url, { headers: this.getHeaders() });
  return this.handleResponse(response);
}
```

MCP tools:
```typescript
// Knowledge Agent schema (generate from Swagger)
const KnowledgeAgentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  // Add other fields based on API spec
});

this.server.tool(
  "createOrUpdateAgent",
  "Create or update a knowledge agent for intelligent search assistance.",
  {
    agentName: z.string().describe("Unique agent identifier"),
    agent: KnowledgeAgentSchema,
    etag: z.string().optional().describe("ETag for optimistic concurrency"),
    clientRequestId: z.string().uuid().optional()
  },
  async ({ agentName, agent, etag, clientRequestId }) => {
    try {
      const client = this.getClient();
      const headers: Record<string, string> = {};
      
      if (clientRequestId) headers["x-ms-client-request-id"] = clientRequestId;
      if (etag) headers["If-Match"] = etag;
      
      const result = await client.createOrUpdateAgent(agentName, agent, { headers });
      return await this.formatResponse(result);
    } catch (error) {
      return this.formatMcpError(error, clientRequestId);
    }
  },
  {
    ...getToolHints("PUT"),
    outputSchema: KnowledgeAgentSchema
  }
);
```

#### 3.2 Knowledge Sources Support
**Goal**: Add CRUD support for Knowledge Sources
**Implementation**: Mirror the Knowledge Agents pattern for Knowledge Sources

### Phase 4: Enhanced Client Features

#### 4.1 ETag and Concurrency Support
**Goal**: Add proper ETag handling for safe concurrent operations
**Files**: [`src/azure-search-client.ts`](src/azure-search-client.ts)

```typescript
// Enhanced error handling with ETag support
private async handleResponse(response: Response) {
  if (!response.ok) {
    const requestId = response.headers.get("x-ms-request-id");
    const etag = response.headers.get("etag");
    
    let errorBody: any = {};
    try {
      errorBody = await response.json();
    } catch {
      errorBody = { message: response.statusText };
    }
    
    const error = new Error(errorBody.message || `HTTP ${response.status}: ${response.statusText}`);
    (error as any).status = response.status;
    (error as any).requestId = requestId;
    (error as any).etag = etag;
    (error as any).code = errorBody.code;
    
    throw error;
  }
  
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }
  
  return response.text();
}

// Add headers support to request method
private async request(path: string, options: RequestInit & { headers?: Record<string, string> } = {}) {
  const url = `${this.endpoint}${path}${path.includes('?') ? '&' : '?'}api-version=${this.apiVersion}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'api-key': this.apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return this.handleResponse(response);
}
```

#### 4.2 Request Context Threading
**Goal**: Thread request IDs through operations for better tracing
**Implementation**: Add `clientRequestId` parameter to all mutating operations

## Implementation Timeline

## Testing Strategy

### MCP Inspector Testing
```bash
# Test with MCP Inspector after each phase
npx @modelcontextprotocol/inspector@latest
# Enter: https://your-worker.workers.dev/sse

# Verify:
# - Tool hints appear correctly
# - Resources are browsable  
# - Errors are properly formatted
# - Progress notifications work
# - Pagination functions correctly
```

### Integration Testing
```bash
# Test with Claude Desktop
claude mcp add --transport sse azure-search https://your-worker.workers.dev/sse

# Test scenarios:
# - Browse indexes via resources
# - Run indexer with progress tracking
# - Handle destructive operations safely
# - Test error conditions and recovery
```

## Success Metrics

1. **MCP Compliance**: All tools have appropriate hints and schemas
2. **Error Handling**: Structured error responses with proper MCP codes
3. **Resource Discovery**: Key entities browsable via MCP resources  
4. **Progress Tracking**: Long operations provide real-time feedback
5. **Type Safety**: All outputs validated against Zod schemas
6. **Performance**: Large result sets handled efficiently with pagination
7. **Observability**: Request tracing through client request IDs

## Migration Considerations

### Backward Compatibility
- Existing tool names and signatures remain unchanged
- Add new paginated variants rather than modifying existing list tools
- Progressive enhancement approach - new features are additive

### Version Management
- Bump to version 1.4.0 for MCP compliance features
- Maintain changelog documenting breaking changes
- Provide migration guide for existing integrations

### Rollback Strategy
- Feature flags for new MCP features during testing
- Gradual rollout with monitoring
- Quick rollback path if issues arise

## Missing Features & Gaps Identified

### 1. Missing Azure Search Endpoints
Based on the 2025-08-01-preview spec, these endpoints are not covered:
- **Analyzer Testing**: `/indexes('{indexName}')/search.analyze` for tokenization testing
- **Service Statistics**: `/servicestats` endpoint for quota monitoring
- **Index Statistics Summary**: `/indexstats` aggregate endpoint
- **Suggest API**: `/indexes('{indexName}')/docs/suggest` for autocomplete
- **Autocomplete API**: `/indexes('{indexName}')/docs/autocomplete`

### 2. Missing Helper Methods
The plan lacks several helper methods mentioned in the original documents:
- `getIndexerStatusMessage()` - Convert status to human-readable messages
- `getServiceStatistics()` - Service-level quota and usage stats
- `getIndexStatsSummary()` - Aggregate statistics across indexes
- `getHeaders()` - Centralized header management for client

### 3. Missing Zod Schema Generation
The plan mentions generating schemas from Swagger but doesn't provide:
- Complete schema definitions for all Azure Search entities
- Schema generation strategy from the OpenAPI specification
- Validation for complex nested objects (vector search, semantic configuration)

### 4. Missing Error Recovery Strategies
- Retry logic for transient failures
- Circuit breaker patterns for service outages
- Graceful degradation when optional services (OpenAI) are unavailable

### 5. Missing Monitoring & Observability
- Health check endpoints for service monitoring
- Metrics collection for performance monitoring
- Logging strategy for debugging and audit trails
- Rate limiting considerations

### 6. Missing Security Considerations
- API key rotation strategy
- Request validation and sanitization
- Rate limiting implementation
- CORS configuration for web clients

## Detailed Implementation Gaps

### Gap 1: Complete Zod Schema Definitions
```typescript
// Missing comprehensive schemas
const IndexDefinitionSchema = z.object({
  name: z.string(),
  fields: z.array(FieldSchema),
  scoringProfiles: z.array(ScoringProfileSchema).optional(),
  corsOptions: CorsOptionsSchema.optional(),
  semantic: SemanticConfigurationSchema.optional(),
  vectorSearch: VectorSearchConfigurationSchema.optional()
});

const FieldSchema = z.object({
  name: z.string(),
  type: z.enum(['Edm.String', 'Edm.Int32', 'Edm.Double', 'Collection(Edm.Single)', ...]),
  searchable: z.boolean().optional(),
  filterable: z.boolean().optional(),
  sortable: z.boolean().optional(),
  facetable: z.boolean().optional(),
  key: z.boolean().optional(),
  retrievable: z.boolean().optional(),
  analyzer: z.string().optional(),
  dimensions: z.number().optional() // for vector fields
});
```

### Gap 2: Service Health & Monitoring Tools
```typescript
this.server.tool(
  "getServiceHealth",
  "Get comprehensive service health including quotas, limits, and performance metrics.",
  { includeQuotas: z.boolean().default(true) },
  async ({ includeQuotas }) => {
    const client = this.getClient();
    const stats = await client.getServiceStatistics();
    const indexes = await client.listIndexes();
    
    const health = {
      status: "healthy",
      indexCount: indexes.length,
      ...(includeQuotas && {
        quotas: stats.quotas,
        limits: stats.limits
      }),
      timestamp: new Date().toISOString()
    };
    
    return await this.formatResponse(health);
  },
  getToolHints("GET")
);
```

### Gap 3: Missing Client Method Implementations
```typescript
// Add to AzureSearchClient class
async getServiceStatistics() {
  return this.request('/servicestats');
}

async getIndexStatsSummary() {
  return this.request('/indexstats');
}

async analyzeText(indexName: string, analyzeRequest: any) {
  return this.request(`/indexes/${indexName}/search.analyze`, {
    method: 'POST',
    body: JSON.stringify(analyzeRequest)
  });
}

async suggest(indexName: string, suggestRequest: any) {
  return this.request(`/indexes/${indexName}/docs/suggest`, {
    method: 'POST',
    body: JSON.stringify(suggestRequest)
  });
}

async autocomplete(indexName: string, autocompleteRequest: any) {
  return this.request(`/indexes/${indexName}/docs/autocomplete`, {
    method: 'POST',
    body: JSON.stringify(autocompleteRequest)
  });
}
```

### Gap 4: Comprehensive Error Handling Strategy
```typescript
class AzureSearchError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public requestId?: string,
    public etag?: string
  ) {
    super(message);
    this.name = 'AzureSearchError';
  }
}

private async handleResponseWithRetry(response: Response, retries: number = 3): Promise<any> {
  if (response.status === 429 && retries > 0) {
    const retryAfter = response.headers.get('Retry-After');
    const delay = retryAfter ? parseInt(retryAfter) * 1000 : 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    // Retry the request
    return this.handleResponseWithRetry(response, retries - 1);
  }
  
  return this.handleResponse(response);
}
```

## Enhanced Implementation Timeline

### Week 1-2: Foundation (Phase 1) - UPDATED
- [ ] Implement tool hints for all existing tools
- [ ] Add structured error handling with MCP error codes and retry logic
- [ ] Create comprehensive Zod schemas for all Azure Search entities
- [ ] Add missing client methods (analyze, suggest, autocomplete, service stats)
- [ ] Update server capabilities declaration
 - [ ] Expose discovery endpoints: `tools/list`, `prompts/list`
 - [ ] Adopt official pagination shape with `nextCursor`

### Week 3-4: Advanced Features (Phase 2) - UPDATED
- [ ] Implement resource management for indexes, agents, and service stats
- [ ] Add progress notifications for indexer operations with proper status messaging
- [ ] Implement cursor-based pagination for all list operations
- [ ] Add request context threading and correlation IDs
- [ ] Implement service health monitoring tools
 - [ ] Implement `resources/list`, `resources/read`, and `resources/listChanged` notifications
 - [ ] Integrate sampling protocol (`sampling/record`, `sampling/playback`, `samplingHint`)
 - [ ] Emit `logging/event` notifications and `logging/setLevel` handler

### Week 5-6: Preview Features (Phase 3) - ENHANCED
- [ ] Extend client for Knowledge Agents and Knowledge Sources endpoints
- [ ] Add complete CRUD tools and resources for both Agents and Sources
- [ ] Implement analyzer testing and suggestion tools
- [ ] Add comprehensive monitoring and observability features
- [ ] Implement security enhancements (rate limiting, validation)
 - [ ] Alias CRUD, indexer reset docs/resync verbs, skillset reset skills

### Week 7: Integration & Testing (Phase 4) - ENHANCED
- [ ] Add ETag support for safe concurrency across all operations
- [ ] Implement comprehensive error mapping and recovery strategies
- [ ] Performance testing with load testing and monitoring
- [ ] Security testing and penetration testing
- [ ] Documentation updates with API reference and examples
 - [ ] Compliance audit against all Official MCP docs

## Key Implementation Files - UPDATED

| File | Purpose | Changes Required |
|------|---------|------------------|
| [`src/index.ts`](src/index.ts) | Entry point – wires tool modules & server | Update server capabilities + register new Resources module |
| `src/*Tools.ts` | All individual tool registration modules | Inject `getToolHints()` helper, output schemas, progress notifications |
| [`src/azure-search-client.ts`](src/azure-search-client.ts) | Azure Search REST client | Add ETag support, request headers, Knowledge Agents/Sources, retry logic, all missing endpoints |
| `src/schemas/*` | **NEW** - Zod schema definitions | Complete schema definitions for all Azure Search entities |
| [`src/monitoring.ts`](src/monitoring.ts) | **NEW** - Health and monitoring utilities | Service health checks, metrics collection, logging |
| [`src/utils/errors.ts`](src/utils/errors.ts) | **NEW** - Error handling utilities | Custom error classes, retry logic, error mapping |
| [`src/utils/sampling.ts`](src/utils/sampling.ts) | **NEW** - Sampling protocol helpers | Record & playback sample interactions |
| [`src/utils/logging.ts`](src/utils/logging.ts) | **NEW** - Central logging hub | Emit `logging/event`, dynamic log levels |
| [`package.json`](package.json) | Dependencies | Add monitoring libraries, enhanced error handling utilities |

## Conclusion

This enhanced implementation plan addresses the gaps in the original plan by providing comprehensive coverage of:

1. **Complete API Coverage**: All Azure Search 2025-08-01-preview endpoints
2. **Robust Error Handling**: Retry strategies, circuit breakers, and comprehensive error mapping
3. **Full Schema Validation**: Complete Zod schemas for all entities
4. **Enhanced Monitoring**: Service health, performance metrics, and observability
5. **Security Considerations**: Rate limiting, input validation, and secure practices

The phased approach ensures we can deliver value incrementally while building a production-ready, fully compliant MCP server that leverages all Azure Search capabilities.
