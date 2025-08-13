# Azure Search MCP Server - Comprehensive Alignment Implementation Plan

This document merges the analysis from `MCP_SPECIFICATION_ALIGNMENT.md`, `SRC_INDEX_MCP_ALIGNMENT_REVIEW.md`, and `AzureSearch-MCP-Alignment-Recommendations.md` into a unified implementation plan for aligning the Azure Search MCP server with the latest MCP specification (2025-06-18) and Azure Search API (2025-08-01-preview).

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
- **Response Management**: Large response handling with truncation and optional Azure OpenAI summarization via [`formatResponse()`](src/index.ts:29)
- **Search Operations**: Full document search with filtering, sorting, and pagination support via [`searchDocuments`](src/index.ts:272)
- **Status Monitoring**: Indexer status tracking and execution history via [`getIndexerStatus`](src/index.ts:561)

### ❌ Missing MCP Compliance Features
- **Resource Management**: No `server.resource()` implementations in [`AzureSearchMCP.init()`](src/index.ts:158)
- **Structured Errors**: Plain text error responses via [`formatError()`](src/index.ts:125) without MCP error codes
- **Tool Hints**: No `readOnlyHint`, `destructiveHint`, or `idempotentHint` flags in tool definitions
- **Progress Notifications**: [`runIndexer`](src/index.ts:531) returns immediately without progress tracking
- **Output Schemas**: No Zod schema validation for tool outputs
- **Cursor Pagination**: No MCP-style cursor-based pagination for list operations
- **Request Context**: No `x-ms-client-request-id` threading in [`AzureSearchClient`](src/azure-search-client.ts:12)
- **Preview Features**: Missing Knowledge Agents and Knowledge Sources endpoints

## Implementation Strategy

### Phase 1: Core MCP Compliance (High Priority)

#### 1.1 Tool Hints Implementation
**Goal**: Add behavioral hints to help LLMs understand tool impact
**Files**: [`src/index.ts`](src/index.ts)

```typescript
// Add hints helper
function getToolHints(method: "GET" | "PUT" | "POST" | "DELETE") {
  return {
    readOnlyHint: method === "GET",
    destructiveHint: method === "DELETE",
    idempotentHint: method === "GET" || method === "PUT" || method === "DELETE"
  };
}

// Apply to tool definitions
this.server.tool(
  "deleteIndex",
  "⚠️ DESTRUCTIVE: Permanently delete an index and all its documents. This action cannot be undone. Please confirm carefully before proceeding.",
  { indexName: z.string() },
  async ({ indexName }) => { /* ... */ },
  getToolHints("DELETE")
);
```

#### 1.2 Enhanced Error Handling
**Goal**: Implement structured MCP error responses with proper error codes
**Files**: [`src/index.ts`](src/index.ts)

```typescript
private formatMcpError(error: any, requestId?: string) {
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
**Files**: [`src/index.ts`](src/index.ts)

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
**Files**: [`src/index.ts`](src/index.ts)

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
**Files**: [`src/index.ts`](src/index.ts)

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
**Files**: [`src/index.ts`](src/index.ts)

```typescript
this.server.tool(
  "listIndexesPaginated",
  "List search indexes with cursor-based pagination.",
  {
    cursor: z.string().optional().describe("Pagination cursor (offset)"),
    limit: z.number().int().positive().max(200).default(50).describe("Maximum items per page"),
    includeStats: z.boolean().optional().describe("Include document count and storage size"),
    verbose: z.boolean().optional().describe("Include full index definitions")
  },
  async ({ cursor, limit, includeStats, verbose }) => {
    try {
      const client = this.getClient();
      const offset = cursor ? parseInt(cursor, 10) : 0;
      
      // Get all indexes (the service doesn't support server-side pagination)
      const allIndexes = await client.listIndexes({ includeStats, verbose });
      const indexes = allIndexes.value || allIndexes;
      
      // Apply client-side pagination
      const slice = indexes.slice(offset, offset + limit);
      const nextCursor = offset + limit < indexes.length ? String(offset + limit) : null;
      
      const response = {
        indexes: slice,
        pagination: {
          cursor: cursor || "0",
          nextCursor,
          hasMore: !!nextCursor,
          total: indexes.length,
          limit
        }
      };
      
      return await this.formatResponse(response);
    } catch (error) {
      return this.formatMcpError(error);
    }
  },
  getToolHints("GET")
);
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

### Week 1-2: Foundation (Phase 1)
- [ ] Implement tool hints for all existing tools
- [ ] Add structured error handling with MCP error codes
- [ ] Create and apply output schemas for key tools
- [ ] Update server capabilities declaration

### Week 3-4: Advanced Features (Phase 2)  
- [ ] Implement resource management for indexes and service stats
- [ ] Add progress notifications for indexer operations
- [ ] Implement cursor-based pagination for list operations
- [ ] Add request context threading

### Week 5-6: Preview Features (Phase 3)
- [ ] Extend client for Knowledge Agents endpoints
- [ ] Add Knowledge Agents CRUD tools and resources
- [ ] Implement Knowledge Sources support
- [ ] Add service-level analytics resources

### Week 7: Integration & Testing (Phase 4)
- [ ] Add ETag support for safe concurrency
- [ ] Implement comprehensive error mapping
- [ ] Performance testing and optimization
- [ ] Documentation updates

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

### Week 3-4: Advanced Features (Phase 2) - UPDATED
- [ ] Implement resource management for indexes, agents, and service stats
- [ ] Add progress notifications for indexer operations with proper status messaging
- [ ] Implement cursor-based pagination for all list operations
- [ ] Add request context threading and correlation IDs
- [ ] Implement service health monitoring tools

### Week 5-6: Preview Features (Phase 3) - ENHANCED
- [ ] Extend client for Knowledge Agents and Knowledge Sources endpoints
- [ ] Add complete CRUD tools and resources for both Agents and Sources
- [ ] Implement analyzer testing and suggestion tools
- [ ] Add comprehensive monitoring and observability features
- [ ] Implement security enhancements (rate limiting, validation)

### Week 7: Integration & Testing (Phase 4) - ENHANCED
- [ ] Add ETag support for safe concurrency across all operations
- [ ] Implement comprehensive error mapping and recovery strategies
- [ ] Performance testing with load testing and monitoring
- [ ] Security testing and penetration testing
- [ ] Documentation updates with API reference and examples

## Key Implementation Files - UPDATED

| File | Purpose | Changes Required |
|------|---------|------------------|
| [`src/index.ts`](src/index.ts) | Main MCP server implementation | Add tool hints, resources, progress notifications, pagination, health monitoring |
| [`src/azure-search-client.ts`](src/azure-search-client.ts) | Azure Search REST client | Add ETag support, request headers, Knowledge Agents/Sources, retry logic, all missing endpoints |
| [`src/schemas.ts`](src/schemas.ts) | **NEW** - Zod schema definitions | Complete schema definitions for all Azure Search entities |
| [`src/monitoring.ts`](src/monitoring.ts) | **NEW** - Health and monitoring utilities | Service health checks, metrics collection, logging |
| [`src/errors.ts`](src/errors.ts) | **NEW** - Error handling utilities | Custom error classes, retry logic, error mapping |
| [`package.json`](package.json) | Dependencies | Add monitoring libraries, enhanced error handling utilities |

## Conclusion

This enhanced implementation plan addresses the gaps in the original plan by providing comprehensive coverage of:

1. **Complete API Coverage**: All Azure Search 2025-08-01-preview endpoints
2. **Robust Error Handling**: Retry strategies, circuit breakers, and comprehensive error mapping
3. **Full Schema Validation**: Complete Zod schemas for all entities
4. **Enhanced Monitoring**: Service health, performance metrics, and observability
5. **Security Considerations**: Rate limiting, input validation, and secure practices

The phased approach ensures we can deliver value incrementally while building a production-ready, fully compliant MCP server that leverages all Azure Search capabilities.