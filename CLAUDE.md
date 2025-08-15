# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Azure AI Search MCP (Model Context Protocol) server deployed on Cloudflare Workers that provides comprehensive management tools for Azure Cognitive Search services. It exposes both SSE (Server-Sent Events) and Streamable HTTP endpoints for maximum client compatibility.

## Architecture

- **Main Entry**: `src/index.ts` - Defines the `AzureSearchMCP` class extending `McpAgent` and exposes `/sse` and `/mcp` endpoints
- **REST Client**: `src/azure-search-client.ts` - REST API client for Azure Search (Workers-compatible)
- **OpenAI Client**: `src/azure-openai-client.ts` - Azure OpenAI integration for intelligent summarization of large responses
- **Error Handling**: `src/insights.ts` - Used by response formatter for structured error insights and messaging
- **Debug Tools**: `src/DebugTools.ts` - `debugElicitation` tool for verifying client elicitation support and timing
- **No OAuth**: Uses Azure Search API keys (stored as Worker secrets) rather than OAuth

## Key Implementation Details

- **REST API**: Uses native `fetch()` with Azure Search REST API instead of Azure SDK (SDK not compatible with Workers environment)
- **Durable Objects**: Requires Durable Object binding for MCP Agent state management
- **Response Format**: Tools return JSON (as text content) with automatic summarization/truncation for large payloads
- **API Versions**: 
  - Azure Search: 2025-08-01-preview
  - Azure OpenAI: 2024-08-01-preview
- **Intelligent Response Handling**:
  - **Pagination**: Large result sets are automatically paginated (max 50 items for search, configurable history limits)
  - **Summarization**: Responses >20KB are intelligently summarized using GPT-4o-mini
  - **Truncation**: Falls back to smart truncation if OpenAI is unavailable
- **Performance Optimizations**:
  - `listIndexes`: Uses `$select` to trim payloads and `/indexstats` aggregate endpoint for stats; falls back to per-index stats with small concurrency and timeouts
- **Elicitation Support**:
  - Server advertises `elicitation` capability and invokes `elicitInput` with proper binding
  - All elicitation calls are wrapped with a timeout to prevent hangs when clients don’t respond
  - `debugElicitation` tool can test support; some clients may not yet render elicitation UI

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (port 8788)
npm run dev
# or
wrangler dev

# Deploy to production
npm run deploy
# or
wrangler deploy

# Type check TypeScript
npm run type-check

# Generate Cloudflare types
npm run cf-typegen
```

## Environment Configuration

### Required Secrets (Production)
```bash
# Azure Search Configuration
wrangler secret put AZURE_SEARCH_ENDPOINT
# Enter: https://your-search-service.search.windows.net

wrangler secret put AZURE_SEARCH_API_KEY
# Enter: your admin API key

# Azure OpenAI Configuration (Optional - for intelligent summarization)
wrangler secret put AZURE_OPENAI_ENDPOINT
# Enter: https://your-openai.openai.azure.com/

wrangler secret put AZURE_OPENAI_API_KEY
# Enter: your OpenAI API key

wrangler secret put AZURE_OPENAI_DEPLOYMENT
# Enter: gpt-4o-mini (or your deployment name)
```

### Local Development (.dev.vars)
```
AZURE_SEARCH_ENDPOINT=https://your-search-service.search.windows.net
AZURE_SEARCH_API_KEY=your_admin_api_key
AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/
AZURE_OPENAI_API_KEY=your_openai_api_key
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
```

## Available Tools

### Index Management
- `listIndexes` - List all indexes with metadata
  - Optional `includeStats`: Add document count and storage size
  - Optional `verbose`: Return full index definitions
  - Implementation detail: when `includeStats` is true, the server uses `/indexstats` (aggregate) with timeout and a concurrency-limited fallback to avoid timeouts
- `getIndex` - Fetch full index definition (fields, analyzers, etc.)
- `getIndexStats` - Get document count and storage usage
- `createIndex` - Create a new search index with enhanced features
  - Templates: `documentSearch`, `productCatalog`, `hybridSearch`, `knowledgeBase`
  - Clone existing index with `cloneFrom`
  - Auto language analyzer selection
  - Built-in validation
  - Vector dimensions configuration
- `createOrUpdateIndex` - Smart index updates
  - Add fields without full redefinition
  - Update semantic search configuration
  - Merge with existing definition
  - Validation to prevent breaking changes
- `deleteIndex` - Delete index and its documents

### Document Operations
- `searchDocuments` - Query documents with keyword search, filters, sorting, and pagination (max 50 items per request)
- `getDocument` - Lookup document by primary key
- `countDocuments` - Return document count for an index
- `uploadDocuments` - Upload new documents to an index
- `mergeDocuments` - Update existing documents in an index
- `mergeOrUploadDocuments` - Update existing or create new documents
- `deleteDocuments` - Delete documents from an index by key

### Synonym Map Management
- `listSynonymMaps` - List all synonym map names
- `getSynonymMap` - Get synonym map definition
- `createOrUpdateSynonymMap` - Create or update a synonym map
- `deleteSynonymMap` - Delete a synonym map

### Data Source Management
- `listDataSources` - List data source connection names
- `getDataSource` - Get data source connection details

### Indexer Management
- `listIndexers` - List indexer names
- `getIndexer` - Get indexer configuration
- `runIndexer` - Run indexer immediately
- `resetIndexer` - Reset change tracking for full re-crawl
- `getIndexerStatus` - Get execution history/status (configurable history limit, default 5)

### Skillset Management
- `listSkillsets` - List skillset names
- `getSkillset` - Get skillset configuration

### Debug / Diagnostics
- `debugElicitation` - Report elicitation capability detection and optionally trigger a test elicitation (`performTest: true`)

## Elicitation Notes

- The server supports elicitation and times out safely if a client doesn’t respond (to avoid hanging tools).
- Some clients (e.g., current Claude Code CLI builds) may not yet render elicitation UI. In that case:
  - Destructive tools should be called with explicit confirmation parameters (e.g., `{ "confirmation": "DELETE" }`).
  - Missing-parameter tools will fall back to standard validation errors rather than hanging.
  - Use `debugElicitation` to verify runtime support and round-trip behavior.

## Testing

Connect to the MCP server using the Inspector (SSE):
```bash
npx @modelcontextprotocol/inspector@latest
# Enter: https://your-worker.workers.dev/sse
```

Or use Claude Code (SSE):
```bash
claude mcp add --transport sse azure-search https://your-worker.workers.dev/sse
```

Or use Claude Desktop:
```json
{
  "mcpServers": {
    "azure-search": {
      "command": "npx",
      "args": ["mcp-remote", "https://your-worker.workers.dev/sse"]
    }
  }
}
```

Local development (HTTP and SSE):
```bash
# Local SSE
claude mcp add --transport sse azure-search http://localhost:8788/sse

# Local HTTP (Streamable HTTP transport)
claude mcp add --transport http azure-search http://localhost:8788/mcp
```

## Dependencies

- `@modelcontextprotocol/sdk`: MCP protocol SDK
- `agents`: Cloudflare Agents SDK for MCP
- `workers-mcp`: MCP implementation for Workers
- `zod`: Schema validation

## Important Notes

- The Azure SDK (`@azure/search-documents`) is NOT used due to incompatibility with Cloudflare Workers
- All Azure Search operations use the REST API directly via `fetch()`
- Large responses (>20KB) are automatically handled via:
  - Intelligent summarization using Azure OpenAI (if configured)
  - Pagination for array results
  - Smart truncation as fallback
- Advanced capabilities are implemented, including semantic and vector settings, index validation, and smart update/merge logic
- `listIndexes` is optimized for performance with aggregate stats and fallbacks to reduce timeouts
