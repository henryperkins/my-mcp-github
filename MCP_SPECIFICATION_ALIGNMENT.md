# MCP Specification Alignment Improvements

Based on the latest MCP specification (2025-06-18), here are key improvements to align the Azure Search MCP server with best practices and requirements.

## 1. Add Tool Hints for Better LLM Guidance

Tools should include behavioral hints to help LLMs understand their impact:

```typescript
// In src/index.ts, enhance tool definitions:

this.server.tool(
  "deleteIndex",
  "⚠️ DESTRUCTIVE: Permanently delete an index and all its documents.",
  { indexName: z.string() },
  async ({ indexName }) => { /* ... */ },
  {
    // Add MCP hints
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true
  }
);

this.server.tool(
  "searchDocuments", 
  "Search for documents using keywords, filters, and sorting.",
  { /* params */ },
  async ({ /* params */ }) => { /* ... */ },
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true
  }
);
```

## 2. Implement Resource Management

Add resource capabilities for browsing indexes and documents:

```typescript
// Add to server initialization
server = new McpServer({ 
  name: "azure-ai-search-mcp", 
  version: "1.3.0",
  capabilities: {
    prompts: {},
    resources: {},  // Add resource support
    tools: {}
  }
});

// Implement resource listing
this.server.resource(
  "indexes/{indexName}",
  "Browse search index contents",
  async ({ indexName }) => {
    const client = this.getClient();
    const stats = await client.getIndexStats(indexName);
    return {
      uri: `indexes/${indexName}`,
      mimeType: "application/json",
      metadata: {
        documentCount: stats.documentCount,
        storageSize: stats.storageSize
      }
    };
  }
);
```

## 3. Improve Error Handling

Implement proper MCP error responses:

```typescript
// Create error helper
private formatMcpError(error: any, isError: boolean = true) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Parse Azure Search errors for better context
  let errorCode = "unknown_error";
  let details = {};
  
  if (errorMessage.includes("404")) {
    errorCode = "resource_not_found";
  } else if (errorMessage.includes("400")) {
    errorCode = "invalid_request";
  } else if (errorMessage.includes("403")) {
    errorCode = "unauthorized";
  }
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        error: errorCode,
        message: errorMessage,
        details: details
      }, null, 2)
    }],
    isError: isError  // MCP spec flag
  };
}
```

## 4. Add Progress Notifications for Long Operations

For operations like indexing or migrations:

```typescript
// In long-running operations
async runIndexerWithProgress(name: string) {
  // Send progress notification
  await this.server.notification("progress", {
    operation: `Running indexer ${name}`,
    progress: 0.0
  });
  
  const client = this.getClient();
  await client.runIndexer(name);
  
  // Poll status with progress updates
  let complete = false;
  while (!complete) {
    const status = await client.getIndexerStatus(name);
    const progress = this.calculateProgress(status);
    
    await this.server.notification("progress", {
      operation: `Running indexer ${name}`,
      progress: progress
    });
    
    complete = status.lastResult?.status === "success";
    await new Promise(r => setTimeout(r, 5000));
  }
}
```

## 5. Enhanced Capabilities Declaration

```typescript
class AzureSearchMCP extends McpAgent {
  server = new McpServer({
    name: "azure-ai-search-mcp",
    version: "1.3.0",
    capabilities: {
      prompts: {
        listChanged: true  // Support dynamic prompt updates
      },
      resources: {
        subscribe: true,   // Enable resource subscriptions
        listChanged: true
      },
      tools: {
        listChanged: false // Static tool list
      },
      logging: {
        levels: ["debug", "info", "warning", "error"]
      },
      experimental: {
        pagination: true,  // Custom pagination support
        batchOperations: true
      }
    }
  });
}
```

## 6. Add Output Schemas for Tools

Define expected output structures:

```typescript
const IndexStatsSchema = z.object({
  documentCount: z.number(),
  storageSize: z.number()
});

this.server.tool(
  "getIndexStats",
  "Get document count and storage usage.",
  { indexName: z.string() },
  async ({ indexName }) => { /* ... */ },
  {
    outputSchema: IndexStatsSchema
  }
);
```

## 7. Implement Pagination Protocol

For list operations:

```typescript
this.server.tool(
  "listIndexes",
  "List all index names with basic metadata.",
  { 
    cursor: z.string().optional().describe("Pagination cursor"),
    limit: z.number().optional().default(50)
  },
  async ({ cursor, limit }) => {
    const client = this.getClient();
    const allIndexes = await client.listIndexes();
    
    const startIndex = cursor ? parseInt(cursor) : 0;
    const endIndex = startIndex + limit;
    const indexes = allIndexes.slice(startIndex, endIndex);
    
    const response = {
      indexes: indexes,
      nextCursor: endIndex < allIndexes.length ? String(endIndex) : null,
      hasMore: endIndex < allIndexes.length
    };
    
    return await this.formatResponse(response);
  }
);
```

## 8. Add Request Context Support

Support including additional context:

```typescript
this.server.tool(
  "searchDocuments",
  "Search for documents",
  {
    indexName: z.string(),
    search: z.string(),
    includeContext: z.boolean().optional().describe("Include search context")
  },
  async ({ indexName, search, includeContext }) => {
    const results = await client.searchDocuments(indexName, { search });
    
    if (includeContext) {
      // Add additional context for LLM
      results._context = {
        indexSchema: await client.getIndex(indexName),
        searchAnalyzer: "standard.lucene",
        scoringProfile: "default"
      };
    }
    
    return await this.formatResponse(results);
  }
);
```

## Implementation Priority

### High Priority
1. **Tool Hints** - Essential for LLM decision making
2. **Error Handling** - Improves reliability and debugging
3. **Output Schemas** - Provides type safety and validation

### Medium Priority
4. **Resource Management** - Enables browsing capabilities
5. **Pagination Protocol** - Handles large datasets efficiently
6. **Enhanced Capabilities** - Better feature discovery

### Low Priority
7. **Progress Notifications** - Nice UX for long operations
8. **Request Context** - Advanced feature for complex queries

## Benefits of These Improvements

- **Better LLM Integration**: Tool hints help LLMs make safer decisions
- **Improved Error Recovery**: Structured errors enable better error handling
- **Type Safety**: Output schemas provide validation and documentation
- **Scalability**: Pagination handles large result sets efficiently
- **Discoverability**: Resources and capabilities make features discoverable
- **User Experience**: Progress notifications improve feedback for long operations

## Migration Path

1. Start with non-breaking changes (hints, error handling)
2. Add new features incrementally (resources, pagination)
3. Test with MCP Inspector after each change
4. Update documentation and examples
5. Version bump when releasing major changes

These improvements will make the Azure Search MCP server more compliant with the MCP specification and provide better integration with LLM clients while maintaining backward compatibility.