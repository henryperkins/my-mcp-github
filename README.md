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

IMPORTANT: Each tool is a multi-operation tool. Always call with a JSON object: `{ "operation": "<op>", "params": { ... } }`.

### IndexManagement
- Operations: `list`, `get`, `create`, `createOrUpdate`, `update`, `delete`, `stats`, `analyze`, `validate`
  - `list`: Optional `includeStats`, `verbose`, `pageSize`, `cursor`
  - `create`: `indexName`, optional `template` (`documentSearch`, `productCatalog`, `hybridSearch`, `knowledgeBase`, `custom`); or provide `indexDefinition`
  - `delete`: `indexName` with confirmation elicitation

### DocumentOperations
- Operations: `search`, `get`, `count`, `upload`, `merge`, `mergeOrUpload`, `delete`, `sample`
  - `search`: `indexName`, optional `search`, `filter`, `orderBy`, `vectors`, `pageSize`, `cursor`, `select`, `includeTotalCount`, `facets`

### DataSourceManagement
- Operations: `list`, `get`, `createBlob`, `createOrUpdate`, `delete`, `test`, `generateSyncPlan`

### IndexerManagement
- Operations: `list`, `get`, `create`, `createOrUpdate`, `run`, `reset`, `getStatus`, `delete`

### SkillsetManagement
- Operations: `list`, `get`, `create`, `createOrUpdate`, `delete`, `validate`

### ServiceUtilities
- Operations: `serviceStats`, `analyzeText`, `listSynonymMaps`, `getSynonymMap`, `createOrUpdateSynonymMap`, `deleteSynonymMap`

### KnowledgeAgentOperations
- Operations: `list`, `get`, `create`, `update`, `delete`, `search`, `chat`

### KnowledgeSourceOperations
- Operations: `list`, `get`, `create`, `update`, `delete`, `sync`, `getStatus`

## Usage Examples

### List Indexes
```json
{
  "tool": "IndexManagement",
  "arguments": {
    "operation": "list",
    "params": { "includeStats": true }
  }
}
```

### Search Documents
```json
{
  "tool": "DocumentOperations",
  "arguments": {
    "operation": "search",
    "params": {
      "indexName": "products",
      "search": "laptop",
      "filter": "category eq 'Electronics'",
      "pageSize": 10,
      "orderBy": "price desc"
    }
  }
}
```

### Get Indexer Status
```json
{
  "tool": "IndexerManagement",
  "arguments": {
    "operation": "getStatus",
    "params": { "name": "my-indexer", "historyLimit": 5 }
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
### "cb is not a function" when calling tools
- Ensure you are using the multi-operation call shape:
  - Correct: `{"operation":"list","params":{}}`
  - Incorrect: raw string or missing `operation`
- Verify you’re using the dynamic tool names above (e.g., `IndexManagement`, `DocumentOperations`).
- If building a server extension, register tools with the Zod shape, not a ZodObject.
