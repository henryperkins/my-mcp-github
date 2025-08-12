# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Azure AI Search MCP (Model Context Protocol) server deployed on Cloudflare Workers that provides comprehensive management tools for Azure Cognitive Search services. It exposes both SSE (Server-Sent Events) and Streamable HTTP endpoints for maximum client compatibility.

## Architecture

- **Main Entry**: `src/index.ts` - Defines the `AzureSearchMCP` class extending `McpAgent` and exposes both `/sse` and `/mcp` endpoints
- **REST Client**: `src/azure-search-client.ts` - Simple REST API client for Azure Search that works in Cloudflare Workers environment
- **OpenAI Client**: `src/azure-openai-client.ts` - Azure OpenAI integration for intelligent summarization of large responses
- **Error Handling**: `src/insights.ts` - Provides intelligent error normalization with actionable recommendations (currently unused in simplified version)
- **Verification**: `src/verify.ts` - Helper utilities for verifying operations and polling indexer completion (currently unused in simplified version)
- **No Authentication**: This server operates without OAuth, relying on Azure Search API keys for authentication

## Key Implementation Details

- **REST API**: Uses native fetch() with Azure Search REST API instead of Azure SDK (SDK not compatible with Workers environment)
- **Durable Objects**: Requires Durable Object binding for MCP Agent state management
- **Response Format**: All tools return text content type with JSON stringified data
- **API Versions**: 
  - Azure Search: 2024-07-01
  - Azure OpenAI: 2024-08-01-preview
- **Intelligent Response Handling**:
  - **Pagination**: Large result sets are automatically paginated (max 50 items for search, configurable history limits)
  - **Summarization**: Responses >20KB are intelligently summarized using GPT-4o-mini
  - **Truncation**: Falls back to smart truncation if OpenAI is unavailable

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
- `listIndexes` - List all index names
- `getIndex` - Fetch full index definition
- `getIndexStats` - Get document count and storage usage
- `deleteIndex` - Delete index and its documents

### Document Operations
- `searchDocuments` - Query documents with keyword search, filters, sorting, and pagination (max 50 items per request)
- `getDocument` - Lookup document by primary key
- `countDocuments` - Return document count for an index

### Data Source Management
- `listDataSources` - List data source connection names
- `getDataSource` - Get data source connection details

### Indexer Management
- `listIndexers` - List indexer names
- `getIndexer` - Get indexer configuration
- `runIndexer` - Run indexer immediately
- `resetIndexer` - Reset change tracking for full re-crawl
- `getIndexerStatus` - Get execution history/status

### Skillset Management
- `listSkillsets` - List skillset names
- `getSkillset` - Get skillset configuration

## Testing

Connect to the MCP server using the Inspector:
```bash
npx @modelcontextprotocol/inspector@latest
# Enter: https://your-worker.workers.dev/sse
```

Or use Claude Code:
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

## Dependencies

- `@modelcontextprotocol/sdk`: MCP protocol SDK
- `agents`: Cloudflare Agents SDK for MCP
- `workers-mcp`: MCP implementation for Workers
- `zod`: Schema validation

## Important Notes

- The Azure SDK (`@azure/search-documents`) is NOT used due to incompatibility with Cloudflare Workers
- All Azure Search operations use the REST API directly via fetch()
- Response format is simplified to text content type with JSON stringified data
- Complex features like vector search and advanced create/update operations are not yet implemented in the simplified version