# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Azure AI Search MCP (Model Context Protocol) server deployed on Cloudflare Workers that provides comprehensive management tools for Azure Cognitive Search services. It exposes both SSE (Server-Sent Events) and Streamable HTTP endpoints for maximum client compatibility.

## Architecture

### Core Components
- **Main Entry Points**:
  - `src/index.ts` - Basic MCP server with static tool registration
  - `src/index-dynamic.ts` - Enhanced server with dynamic tool architecture (primary implementation)
- **Dynamic Tool System**: `src/dynamic-tools/` - Modular tool architecture with:
  - `base/DynamicTool.ts` - Abstract base class for all tools
  - Individual tool implementations (IndexTool, DocumentTool, etc.)
  - Operation-based design with categories (read/write/delete/analyze)
  - Built-in pagination, elicitation, and batch processing support
- **MCP Tool Wrapper**: `src/mcp-tool-wrapper.ts` - Direct invocation wrapper for dynamic tools
  - Allows calling tools directly without MCP protocol overhead
  - Provides `createToolWrapper()` for tool instantiation
  - Includes `listAvailableTools()` and `getToolInfo()` utilities
  - Useful for testing, debugging, and integration scenarios
- **REST Client**: `src/azure-search-client.ts` - REST API client for Azure Search (Workers-compatible)
- **OpenAI Client**: `src/azure-openai-client.ts` - Azure OpenAI integration for intelligent summarization
- **Resources**: `src/resources.ts` - MCP resource definitions for real-time data exposure
- **Prompts**: `src/dynamic-tools/prompts/` - Pre-built prompts for common operations
- **Error Handling**: `src/insights.ts` - Structured error insights and remediation suggestions
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

## Available Tools (Dynamic Architecture)

The server uses a dynamic tool system where each tool category is a single MCP tool with multiple operations:

### IndexManagement Tool
Operations available via `operation` parameter:
- `list` - List all indexes with metadata (supports pagination, stats, verbose mode)
- `get` - Fetch full index definition
- `getStats` - Get document count and storage usage  
- `create` - Create new index (templates: documentSearch, productCatalog, hybridSearch, knowledgeBase)
- `createOrUpdate` - Smart index updates with field merging
- `delete` - Delete index and its documents
- `analyze` - Test text analysis with analyzers
- `validate` - Validate index definition without creating

### DocumentOperations Tool
Operations available via `operation` parameter:
- `search` - Query with keyword search, filters, vectors, pagination (max 50/page)
- `get` - Lookup document by primary key
- `count` - Return document count with optional filter
- `upload` - Upload new documents (batch support)
- `merge` - Update existing documents  
- `mergeOrUpload` - Upsert documents
- `delete` - Delete documents by key
- `sample` - Get random sample of documents

### DataSourceManagement Tool
Operations available via `operation` parameter:
- `list` - List data source connections
- `get` - Get data source details
- `create` - Create new data source (Blob, SQL, Cosmos DB, ADLS Gen2)
- `createOrUpdate` - Update data source configuration
- `delete` - Delete data source
- `test` - Test connection validity
- `generateSyncPlan` - Preview what will be indexed (Blob sources)

### IndexerManagement Tool
Operations available via `operation` parameter:
- `list` - List indexers with status
- `get` - Get indexer configuration
- `create` - Create new indexer
- `createOrUpdate` - Update indexer configuration
- `delete` - Delete indexer
- `run` - Run indexer immediately
- `reset` - Reset change tracking
- `getStatus` - Get execution history (configurable limit)
- `schedule` - Update indexer schedule

### SkillsetManagement Tool
Operations available via `operation` parameter:
- `list` - List skillsets
- `get` - Get skillset configuration
- `create` - Create skillset with AI enrichment
- `createOrUpdate` - Update skillset
- `delete` - Delete skillset
- `validate` - Validate skillset configuration

### ServiceUtilities Tool
Operations available via `operation` parameter:
- `getSynonymMaps` - List synonym maps
- `getSynonymMap` - Get specific synonym map
- `createOrUpdateSynonymMap` - Manage synonym maps
- `deleteSynonymMap` - Delete synonym map
- `getServiceStats` - Service-level statistics
- `analyzeText` - Test text analysis
- `setLogLevel` - Configure logging verbosity
- `getMetrics` - Performance metrics

### KnowledgeAgentOperations Tool
Operations available via `operation` parameter:
- `list` - List knowledge agents
- `get` - Get agent configuration
- `create` - Create new agent
- `update` - Update agent settings
- `delete` - Delete agent
- `search` - Query agent knowledge base
- `chat` - Interactive chat with agent

### KnowledgeSourceOperations Tool  
Operations available via `operation` parameter:
- `list` - List knowledge sources
- `get` - Get source details
- `create` - Create source (Blob, Web)
- `update` - Update source configuration
- `delete` - Delete source
- `sync` - Trigger manual sync
- `getStatus` - Check sync status

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

## Dynamic Tool System Details

### Tool Architecture
- **Base Class**: All tools extend `DynamicTool` base class
- **Operation Pattern**: Each tool exposes multiple operations through a single MCP tool entry
- **Operation Categories**: read, write, delete, analyze - for permission management
- **Built-in Features**:
  - Automatic pagination with cursor support
  - Elicitation for confirmations on destructive operations
  - Batch processing for bulk operations
  - Progress reporting for long-running tasks
  - Timeout management with configurable limits
  - Response formatting with size limits

### Direct Tool Invocation
The `mcp-tool-wrapper.ts` provides direct access to tools without MCP protocol:

```javascript
// Example usage
import { createToolWrapper } from './mcp-tool-wrapper';

const indexTool = createToolWrapper('IndexManagement', env);
const result = await indexTool({
  operation: 'list',
  params: { includeStats: true }
});

// Or use simplified syntax for operations without params
const indexes = await indexTool('list');
```

Available wrapper functions:
- `createToolWrapper(toolName, env)` - Create a callable tool instance
- `listAvailableTools()` - Get all tools and their operations
- `getToolInfo(toolName)` - Get detailed info about a specific tool

### Helper Functions Available to Operations
- `withTimeout` - Wrap async operations with timeout
- `paginate` - Handle array pagination with cursors
- `elicit` - Request user confirmation/input (returns null in direct mode)
- `notify` - Send progress notifications
- `processBatch` - Handle batch operations efficiently
- `validateRequired` - Ensure required parameters
- `log` - Structured logging at various levels

### Resource System
- Real-time data exposure through MCP resources
- Automatic updates via `notifyResourcesListChanged()`
- Resources include:
  - `indexes://list` - Live index listing
  - `metrics://[ToolName]` - Performance metrics per tool
  - `search://recent` - Recent search queries
  - `indexers://status` - Aggregate indexer status
  - Service statistics and configuration

### Prompt System
- Pre-built prompts in `src/dynamic-tools/prompts/`
- Advanced prompts for complex operations
- Dynamic prompt generation based on context
- Integration with tool operations for guided workflows

## Important Notes

- The Azure SDK (`@azure/search-documents`) is NOT used due to incompatibility with Cloudflare Workers
- All Azure Search operations use the REST API directly via `fetch()`
- Large responses (>20KB) are automatically handled via:
  - Intelligent summarization using Azure OpenAI (if configured)
  - Pagination for array results (default 50 items)
  - Smart truncation as fallback
- Performance optimizations:
  - `listIndexes` uses aggregate `/indexstats` endpoint
  - Concurrent operations with controlled parallelism
  - Response caching for frequently accessed data
  - Streaming support for large result sets
