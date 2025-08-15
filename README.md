# Azure AI Search MCP Server

A powerful MCP (Model Context Protocol) server for managing Azure AI Search services, deployed on Cloudflare Workers. Features intelligent response summarization with Azure OpenAI and comprehensive search index management.

## Features

- 🔍 **Full Azure Search Management** - Create, update, and manage indexes, documents, synonym maps, data sources, indexers, and skillsets
- 🤖 **Intelligent Summarization** - Large responses (>20KB) are automatically summarized using GPT-4o-mini
- 📄 **Smart Pagination** - Automatic pagination for large result sets (max 50 items per search)
- 🚀 **Cloudflare Workers** - Fast, globally distributed edge deployment
- 🔌 **Multiple Transports** - Supports both SSE and standard HTTP endpoints
- ⚡ **No OAuth Required** - Uses Azure Search API keys directly

## Prerequisites

- Azure AI Search service with admin API key
- Azure OpenAI resource (optional, for summarization)
- Cloudflare account (for deployment)
- Node.js 18+ and npm

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd azure-search-mcp
npm install
```

### 2. Configure Environment

#### Local Development
Create `.dev.vars` file:
```bash
AZURE_SEARCH_ENDPOINT=https://your-search-service.search.windows.net
AZURE_SEARCH_API_KEY=your_admin_api_key
AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/
AZURE_OPENAI_API_KEY=your_openai_api_key
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
```

#### Production Deployment
```bash
# Azure Search (Required)
wrangler secret put AZURE_SEARCH_ENDPOINT
wrangler secret put AZURE_SEARCH_API_KEY

# Azure OpenAI (Optional - for summarization)
wrangler secret put AZURE_OPENAI_ENDPOINT
wrangler secret put AZURE_OPENAI_API_KEY
wrangler secret put AZURE_OPENAI_DEPLOYMENT
```

### 3. Deploy

```bash
# Development server (local)
npm run dev
# Available at http://localhost:8788

# Production deployment
npm run deploy
# Available at https://azure-search-mcp.<your-subdomain>.workers.dev
```

**Endpoints:**
- SSE: `https://azure-search-mcp.<your-subdomain>.workers.dev/sse`
- HTTP: `https://azure-search-mcp.<your-subdomain>.workers.dev/mcp`

## Documentation

- Elicitation + MCP lessons learned: `docs/elicitation-and-mcp-lessons.md`
- Elicitation client guide: `docs/elicitation-client-guide.md`

## Client Configuration

### Claude Desktop

Add to your configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/claude/claude_desktop_config.json`

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

### Claude CLI

```bash
# Add the MCP server
claude mcp add --transport sse azure-search https://your-worker.workers.dev/sse

# Or use directly
claude -p "Search for AI documents" \
  --mcp-server azure-search=https://your-worker.workers.dev/sse

# Local development
claude mcp add --transport sse azure-search http://localhost:8788/sse
claude mcp add --transport http azure-search http://localhost:8788/mcp
```

### MCP Inspector (Testing)

```bash
npx @modelcontextprotocol/inspector@latest
# Enter URL: https://your-worker.workers.dev/sse
```

## Available Tools

### Index Management
- `listIndexes` - List all search indexes with metadata
  - Optional `includeStats`: Add document count and storage size
  - Optional `verbose`: Return full index definitions
  - Optimized: Uses aggregate `/indexstats` with a timeout; falls back to per-index stats with small concurrency
- `getIndex` - Get full index definition and schema
- `getIndexStats` - View document count and storage usage
- `createIndex` - Create a new search index
- `createOrUpdateIndex` - Create or update index definition
- `deleteIndex` - Delete an index and all its documents

### Document Operations
- `searchDocuments` - Search with filters, sorting, and pagination
  - Max 50 results per request
  - Supports skip/top for pagination
  - Full OData filter syntax
- `getDocument` - Retrieve document by key
- `countDocuments` - Get total document count
- `uploadDocuments` - Upload new documents to an index
- `mergeDocuments` - Update existing documents
- `mergeOrUploadDocuments` - Update existing or create new documents
- `deleteDocuments` - Delete documents by key

### Synonym Maps
- `listSynonymMaps` - List all synonym maps
- `getSynonymMap` - Get synonym map definition
- `createOrUpdateSynonymMap` - Create or update synonym map
- `deleteSynonymMap` - Delete a synonym map

### Indexer Management
- `listIndexers` - List all indexers
- `getIndexer` - Get indexer configuration
- `runIndexer` - Trigger indexer execution
- `resetIndexer` - Reset change tracking
- `getIndexerStatus` - View execution history (configurable limit)

### Data Sources & Skillsets
- `listDataSources` - List data source connections
- `getDataSource` - Get connection details
- `listSkillsets` - List AI enrichment skillsets
- `getSkillset` - Get skillset configuration

### Debug / Diagnostics
- `debugElicitation` - Check elicitation capability at runtime and optionally trigger a test (`performTest: true`)

## Usage Examples

### Search Documents
```javascript
{
  "tool": "searchDocuments",
  "arguments": {
    "indexName": "products",
    "search": "laptop",
    "filter": "category eq 'Electronics'",
    "top": 10,
    "skip": 0,
    "orderBy": "price desc"
  }
}
```

### Get Indexer Status
```javascript
{
  "tool": "getIndexerStatus",
  "arguments": {
    "name": "my-indexer",
    "historyLimit": 5
  }
}
```

## Response Handling

### Intelligent Summarization
When responses exceed 20KB:
1. Attempts to summarize using Azure OpenAI (GPT-4o-mini)
2. Preserves key technical details and structure
3. Falls back to smart truncation if OpenAI unavailable

### Pagination
- Search results: Maximum 50 items per request
- Use `skip` and `top` parameters for pagination
- Arrays show first 10 items with pagination hints

## Development

```bash
# Type checking
npm run type-check

# Generate Cloudflare types
npm run cf-typegen

# View logs
wrangler tail
```

## Troubleshooting

### Permission Errors
If you see Azure OpenAI permission errors:
```bash
az role assignment create \
  --assignee <service-principal-id> \
  --role "Cognitive Services OpenAI User" \
  --scope /subscriptions/<subscription-id>
```

### Large Response Issues
- Responses >20KB trigger automatic summarization
- Ensure Azure OpenAI credentials are configured
- Use pagination parameters for large result sets

### Connection Issues
- Verify API keys are correct
- Check Azure Search service is running
- Ensure Cloudflare Worker is deployed

## Architecture

- **Runtime**: Cloudflare Workers with Durable Objects
- **Protocol**: MCP (Model Context Protocol)
- **APIs**: Azure Search REST API v2025-08-01-preview, Azure OpenAI v2024-08-01-preview
- **Language**: TypeScript
- **Files**:
  - `src/index.ts` - Main MCP server
  - `src/azure-search-client.ts` - Azure Search REST client
  - `src/azure-openai-client.ts` - Azure OpenAI client

## License

MIT
