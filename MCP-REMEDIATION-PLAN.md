# MCP Protocol Compliance - Remediation Implementation Plan

## Overview
Step-by-step implementation plan to address all protocol violations and issues identified in the audit report.

## Phase 1: Critical Fixes (Immediate - Day 1)

### 1.1 Implement logging/setLevel Handler

**File**: `src/index-dynamic.ts`

```typescript
// Add import at top
import { setLogLevel } from "./utils/logging";

// Add after server initialization (line ~81)
async init() {
  // Add logging/setLevel handler
  this.server.setRequestHandler('logging/setLevel', async (request) => {
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
  
  // ... rest of init
}
```

### 1.2 Fix Pagination Logic

**File**: `src/utils/streaming-pagination.ts`

```typescript
// Replace lines 109-134 with:
export async function streamPaginate<T>(
  fetchFn: (skip: number, top: number) => Promise<{ value: T[]; count?: number }>,
  options: PaginationOptions
): Promise<PaginatedResponse<T>> {
  const { pageSize, cursor } = options;
  const { offset = 0 } = decodeCursor(cursor);

  if (offset < 0) {
    throw new Error("Invalid cursor: negative offset");
  }

  const result = await fetchFn(offset, pageSize);
  
  // Fix: Use count when available for accurate hasMore
  const hasMore = result.count !== undefined 
    ? (offset + result.value.length) < result.count
    : result.value.length === pageSize;

  const response: PaginatedResponse<T> = {
    items: result.value,
    totalCount: result.count
  };

  if (hasMore) {
    response.nextCursor = encodeCursor({ offset: offset + result.value.length });
  }

  return response;
}
```

### 1.3 Add Vector Search Support

**File**: `src/dynamic-tools/DocumentTool.ts`

```typescript
// Update search operation params (line ~22)
search: {
  description: "Search documents with filters, sorting, pagination, and optional vector search",
  category: 'read',
  supportsPagination: true,
  params: z.object({
    indexName: z.string().regex(INDEX_NAME_PATTERN),
    search: z.string().default("*").describe("Search query (* for all)"),
    filter: z.string().optional().describe("OData filter expression"),
    orderBy: z.string().optional().describe("Sort order (e.g., 'price desc')"),
    // Add vector search support
    vectors: z.array(z.object({
      value: z.array(z.number()).describe("Vector embedding values"),
      fields: z.string().describe("Vector field name"),
      k: z.number().optional().default(10).describe("Number of nearest neighbors")
    })).optional().describe("Vector search queries for hybrid search"),
    // ... rest of existing params
  }),
  
  handler: async (client, params, context, helpers) => {
    // Build search request
    const baseSearchRequest = {
      search: params.search,
      filter: params.filter,
      orderby: params.orderBy,
      select: params.select?.join(','),
      count: params.includeTotalCount,
      facets: params.facets,
      // Add vector queries if provided
      vectorQueries: params.vectors?.map(v => ({
        kind: "vector",
        vector: v.value,
        fields: v.fields,
        k: v.k || 10
      }))
    } as Record<string, any>;
    
    // ... rest of handler
  }
}
```

## Phase 2: High Priority Fixes (Day 2-3)

### 2.1 Fix Unicode-Safe Base64 Encoding

**File**: `src/utils/streaming-pagination.ts`

```typescript
// Replace lines 6-35 with:
function toBase64(input: string): string {
  // Use TextEncoder for proper Unicode handling
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  
  // Convert to base64 using web-safe method
  if (typeof btoa === 'function') {
    const binary = String.fromCharCode(...bytes);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
  
  // Fallback to Buffer if available
  const B: any = (globalThis as any).Buffer;
  if (B?.from) {
    return B.from(bytes).toString('base64url');
  }
  
  throw new Error('Base64 encoding not supported in this environment');
}

function fromBase64(b64: string): string {
  // Add padding if needed
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (padded.length % 4)) % 4;
  const fullB64 = padded + '='.repeat(padding);
  
  if (typeof atob === 'function') {
    const binary = atob(fullB64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  }
  
  const B: any = (globalThis as any).Buffer;
  if (B?.from) {
    return B.from(fullB64, 'base64').toString('utf-8');
  }
  
  throw new Error('Base64 decoding not supported in this environment');
}
```

### 2.2 Add InitializeResult Instructions

**File**: `src/index-dynamic.ts`

```typescript
// Update server initialization (around line 48)
server = new McpServer({
  name: "azure-ai-search-mcp-dynamic",
  version: "2.0.0",
  capabilities: {
    logging: {},
    prompts: { listChanged: true },
    resources: { subscribe: true, listChanged: true },
    tools: { listChanged: true }
  },
  // Add instructions for client guidance
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

For detailed documentation, see: https://github.com/your-repo/azure-search-mcp`
});
```

## Phase 3: Medium Priority Fixes (Week 1)

### 3.1 Add Prompt Titles

**File**: `src/dynamic-tools/prompts/index.ts`

```typescript
// Update prompt registration to include titles
server.prompt({
  name: "create_search_index",
  title: "Create Search Index",  // Add human-friendly title
  description: "Create a new search index with guided setup for your use case",
  arguments: [
    {
      name: "use_case",
      title: "Use Case",
      description: "Type of search: ecommerce, documents, knowledge, hybrid, or custom",
      required: true
    },
    {
      name: "index_name", 
      title: "Index Name",
      description: "Name for the index (lowercase, hyphens allowed)",
      required: true
    },
    {
      name: "language",
      title: "Content Language",
      description: "Primary content language (e.g., english, spanish, french)",
      required: false
    }
  ]
}, async (args) => {
  // ... existing handler
});
```

### 3.2 Standardize Resource URIs

**File**: `src/dynamic-tools/base/DynamicTool.ts`

```typescript
// Add resource URI constants
export const RESOURCE_URIS = {
  INDEXES_LIST: 'indexes://list',
  INDEXES_ITEM: 'indexes://',
  DATASOURCES_LIST: 'datasources://list',
  DATASOURCES_ITEM: 'datasources://',
  INDEXERS_LIST: 'indexers://list',
  INDEXERS_ITEM: 'indexers://',
  SYNONYMMAPS_LIST: 'synonymmaps://list',
  SYNONYMMAPS_ITEM: 'synonymmaps://',
  SERVICE_STATS: 'service://stats'
} as const;

// Update notification helpers to use constants
notifyResourceUpdated: (uri: string) => {
  context.agent.server.notification({
    method: 'notifications/resources/updated',
    params: { uri }
  });
}
```

**File**: `src/dynamic-tools/IndexTool.ts`

```typescript
// Update all notification calls to use constants
import { RESOURCE_URIS } from './base/DynamicTool';

// In create handler:
helpers.notifyResourcesListChanged();
helpers.notifyResourceUpdated(RESOURCE_URIS.INDEXES_LIST);
helpers.notifyResourceUpdated(`${RESOURCE_URIS.INDEXES_ITEM}${indexName}`);

// In delete handler:
helpers.notifyResourcesListChanged();
helpers.notifyResourceUpdated(RESOURCE_URIS.INDEXES_LIST);
```

## Phase 4: Testing Implementation (Week 2)

### 4.1 Unit Tests

**File**: `test/pagination.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { streamPaginate, paginateArray } from '../src/utils/streaming-pagination';

describe('Pagination', () => {
  it('should handle exact pageSize boundaries correctly', async () => {
    const data = Array.from({ length: 20 }, (_, i) => ({ id: i }));
    
    const fetchFn = async (skip: number, top: number) => ({
      value: data.slice(skip, skip + top),
      count: data.length
    });
    
    // First page of exactly pageSize items
    const page1 = await streamPaginate(fetchFn, { pageSize: 10 });
    expect(page1.items).toHaveLength(10);
    expect(page1.nextCursor).toBeDefined();
    expect(page1.totalCount).toBe(20);
    
    // Second page (last page)
    const page2 = await streamPaginate(fetchFn, { 
      pageSize: 10, 
      cursor: page1.nextCursor 
    });
    expect(page2.items).toHaveLength(10);
    expect(page2.nextCursor).toBeUndefined(); // No more pages
  });
  
  it('should encode/decode Unicode in cursors', () => {
    const testStrings = [
      'Hello World',
      '你好世界',
      '🚀 Émojis and ñoñ-ASCII',
      'مرحبا بالعالم'
    ];
    
    for (const str of testStrings) {
      const cursor = encodeCursor({ text: str, offset: 42 });
      const decoded = decodeCursor(cursor);
      expect(decoded.text).toBe(str);
      expect(decoded.offset).toBe(42);
    }
  });
});
```

### 4.2 Integration Tests

**File**: `test/logging.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { testServer } from './utils/test-server';

describe('Logging Capability', () => {
  it('should handle logging/setLevel requests', async () => {
    const server = await testServer();
    
    const response = await server.request('logging/setLevel', {
      level: 'debug'
    });
    
    expect(response).toEqual({}); // EmptyResult
    
    // Verify internal level was set
    const { getLogLevel } = await import('../src/utils/logging');
    expect(getLogLevel()).toBe('debug');
  });
  
  it('should filter messages by level', async () => {
    const server = await testServer();
    const messages: any[] = [];
    
    server.on('notification', (n) => {
      if (n.method === 'notifications/message') {
        messages.push(n.params);
      }
    });
    
    // Set level to warning
    await server.request('logging/setLevel', { level: 'warning' });
    
    // These should not appear
    server.log('debug', 'Debug message');
    server.log('info', 'Info message');
    
    // These should appear
    server.log('warning', 'Warning message');
    server.log('error', 'Error message');
    
    expect(messages).toHaveLength(2);
    expect(messages[0].level).toBe('warning');
    expect(messages[1].level).toBe('error');
  });
});
```

## Validation Checklist

- [ ] Logging handler responds to `logging/setLevel` requests
- [ ] Pagination correctly uses count for hasMore calculation
- [ ] Vector search parameters work in DocumentOperations.search
- [ ] Unicode text survives cursor encoding/decoding
- [ ] Base64 encoding uses URL-safe characters
- [ ] InitializeResult includes instructions field
- [ ] All prompts have title fields
- [ ] Resource notifications use consistent URIs
- [ ] All tests pass
- [ ] No TypeScript errors

## Deployment Steps

1. **Test Locally**
   ```bash
   npm run test
   npm run type-check
   npm run dev
   ```

2. **Test with MCP Inspector**
   ```bash
   npx @modelcontextprotocol/inspector@latest
   # Connect to: http://localhost:8788/sse
   ```

3. **Deploy to Cloudflare**
   ```bash
   npm run deploy
   ```

4. **Verify Production**
   - Test logging/setLevel endpoint
   - Verify pagination with exact boundaries
   - Test vector search functionality
   - Confirm Unicode handling in cursors

## Rollback Plan

If issues are discovered post-deployment:

1. Revert to previous deployment:
   ```bash
   wrangler rollback
   ```

2. Fix issues in development
3. Re-run full test suite
4. Deploy with incremental rollout

## Success Metrics

- Zero protocol violation errors in client logs
- Successful handling of all MCP standard requests
- Proper pagination without data loss
- Unicode text preservation in all operations
- Client satisfaction with prompt guidance accuracy