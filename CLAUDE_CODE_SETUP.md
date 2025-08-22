# Connecting Azure Search MCP Server to Claude Code

This guide explains how to connect the Azure AI Search MCP server to Claude Code, enabling you to manage Azure Cognitive Search services directly from your AI assistant.

## Prerequisites

1. **Azure Search Service**: You need an Azure Cognitive Search service with:
   - Service endpoint URL (e.g., `https://your-service.search.windows.net`)
   - Admin API key (found in Azure Portal > Your Search Service > Keys)

2. **Claude Code**: Ensure you have Claude Code installed and configured

3. **(Optional) Azure OpenAI**: For intelligent response summarization:
   - Azure OpenAI endpoint
   - API key
   - Deployment name (e.g., `gpt-4o-mini`)

## Connection Methods

### Method 1: Connect to the Deployed Cloudflare Worker (Recommended)

The Azure Search MCP server is deployed at: `https://azure-search-mcp.lfd.workers.dev`

#### Using SSE (Server-Sent Events) Transport

```bash
# Add the Azure Search MCP server via SSE
claude mcp add --transport sse azure-search https://azure-search-mcp.lfd.workers.dev/sse

# If you need to pass API keys via headers (more secure)
claude mcp add --transport sse azure-search https://azure-search-mcp.lfd.workers.dev/sse \
  --header "X-Azure-Search-Endpoint: https://your-service.search.windows.net" \
  --header "X-Azure-Search-Api-Key: your-api-key"
```

#### Using HTTP Transport

```bash
# Add via HTTP transport
claude mcp add --transport http azure-search https://azure-search-mcp.lfd.workers.dev/mcp

# With authentication headers
claude mcp add --transport http azure-search https://azure-search-mcp.lfd.workers.dev/mcp \
  --header "X-Azure-Search-Endpoint: https://your-service.search.windows.net" \
  --header "X-Azure-Search-Api-Key: your-api-key"
```

### Method 2: Run Locally (For Development/Testing)

#### Option A: Using Node.js Stdio Server

1. **Clone the repository**:
```bash
git clone https://github.com/henryperkins/my-mcp-github.git
cd my-mcp-github
npm install
```

2. **Set up environment variables**:
Create a `.env` file:
```bash
AZURE_SEARCH_ENDPOINT=https://your-service.search.windows.net
AZURE_SEARCH_API_KEY=your-admin-api-key
# Optional: For summarization
AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/
AZURE_OPENAI_API_KEY=your-openai-api-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
```

3. **Add to Claude Code**:
```bash
# Add as local stdio server
claude mcp add azure-search \
  --env AZURE_SEARCH_ENDPOINT=https://your-service.search.windows.net \
  --env AZURE_SEARCH_API_KEY=your-api-key \
  -- npx tsx /path/to/my-mcp-github/src/index-stdio.ts
```

#### Option B: Using Mock Mode (No Azure Required)

For testing without Azure credentials:
```bash
claude mcp add azure-search-mock \
  --env AZURE_SEARCH_MOCK=true \
  -- npx tsx /path/to/my-mcp-github/src/index-stdio.ts
```

### Method 3: Project-Scoped Configuration

Add to your project's `.mcp.json` file for team sharing:

```json
{
  "mcpServers": {
    "azure-search": {
      "type": "sse",
      "url": "https://azure-search-mcp.lfd.workers.dev/sse",
      "headers": {
        "X-Azure-Search-Endpoint": "${AZURE_SEARCH_ENDPOINT}",
        "X-Azure-Search-Api-Key": "${AZURE_SEARCH_API_KEY}"
      }
    }
  }
}
```

Then team members can add the server:
```bash
claude mcp add azure-search --scope project
```

## Verifying the Connection

1. **Check server status**:
```bash
# List all configured servers
claude mcp list

# Get details for Azure Search server
claude mcp get azure-search
```

2. **In Claude Code, verify connection**:
```
/mcp
```
This shows all connected MCP servers and their status.

3. **Test basic operations**:
```
List all search indexes
```

Claude should respond by calling the IndexManagement tool with the list operation.

## Using the Azure Search MCP Server

### Available Tools and Operations

Once connected, you can ask Claude to perform these operations:

#### 1. Index Management
- List all indexes with statistics
- Get index definitions
- Create new indexes (with templates)
- Update/delete indexes
- Get index statistics

**Example prompts**:
```
Show me all search indexes with their document counts
Create a new product catalog index with English language support
Get the schema for the "products" index
```

#### 2. Document Operations
- Search documents with filters
- Upload/update documents
- Delete documents
- Count documents

**Example prompts**:
```
Search for "laptop" in the products index
Upload these 5 product documents to the catalog index
Count how many documents have category="electronics"
```

#### 3. Data Source Management
- List data sources
- Create blob storage connections
- Test connections
- Generate sync plans

**Example prompts**:
```
Show me all configured data sources
Create a blob storage data source for my container
Test if the SQL data source connection is working
```

#### 4. Indexer Management
- List/create indexers
- Run/reset indexers
- Check indexer status
- View execution history

**Example prompts**:
```
Show me the status of all indexers
Run the product-indexer immediately
Check the last 5 runs of the catalog-indexer
```

#### 5. Skillset Management (AI Enrichment)
- List/create skillsets
- Configure cognitive skills
- Validate skillset configuration

**Example prompts**:
```
List all AI enrichment skillsets
Create a skillset with OCR and key phrase extraction
```

#### 6. Service Utilities
- Get service statistics
- Analyze text with analyzers
- Manage synonym maps

**Example prompts**:
```
Show me the service quota and usage statistics
Test how the "en.lucene" analyzer processes this text
Create a synonym map for product categories
```

## Important Usage Notes

### Tool Calling Pattern

The MCP server uses a multi-operation pattern. Each tool requires:
1. **operation**: The specific operation (e.g., "list", "get", "create")
2. **params**: Operation-specific parameters

Claude Code handles this automatically, but if you see errors, ensure Claude is using the correct format:

```json
{
  "operation": "list",
  "params": {
    "includeStats": true
  }
}
```

### Pagination

For large result sets, use cursor-based pagination:
- Results include a `nextCursor` when more data is available
- Pass the cursor back in the next request to continue

### Response Size Management

- Responses over 20KB are automatically summarized (if Azure OpenAI is configured)
- Use `select` parameters to limit returned fields
- Set `pageSize` to control result counts

### Error Handling

All errors include structured insights with remediation suggestions. Common issues:
- **401**: Check API key validity
- **404**: Verify endpoint URL and resource names
- **429**: Rate limiting - reduce request frequency

## Troubleshooting

### Connection Issues

1. **"Connection closed" error**:
   - Verify API credentials
   - Check network connectivity
   - For Windows: Ensure using `cmd /c` wrapper for npx commands

2. **"Not connected" error**:
   ```bash
   # Remove and re-add the server
   claude mcp remove azure-search
   claude mcp add --transport sse azure-search https://azure-search-mcp.lfd.workers.dev/sse
   ```

3. **Authentication failures**:
   - Verify API key has admin permissions
   - Check endpoint URL format (should end with `.search.windows.net`)
   - Ensure no extra spaces in credentials

### Performance Tips

1. **Use mock mode for development**:
   ```bash
   claude mcp add azure-search-mock --env AZURE_SEARCH_MOCK=true -- npx tsx src/index-stdio.ts
   ```

2. **Enable Azure OpenAI for better responses**:
   - Large responses are intelligently summarized
   - Reduces token usage in Claude Code

3. **Scope appropriately**:
   - Use `--scope project` for team resources
   - Use `--scope user` for personal utilities
   - Use `--scope local` (default) for sensitive credentials

## Security Best Practices

1. **Never commit credentials**: Use environment variables
2. **Use headers for API keys**: More secure than URL parameters
3. **Rotate API keys regularly**: Update in Azure Portal
4. **Use read-only keys when possible**: For query-only operations
5. **Configure CORS properly**: If deploying your own instance

## Advanced Configuration

### Custom Deployment

If you want to deploy your own instance:

1. **Fork the repository**
2. **Configure Cloudflare Workers**:
   ```bash
   wrangler login
   wrangler secret put AZURE_SEARCH_ENDPOINT
   wrangler secret put AZURE_SEARCH_API_KEY
   wrangler deploy
   ```

3. **Update Claude Code to use your deployment**:
   ```bash
   claude mcp add --transport sse my-azure-search https://your-worker.workers.dev/sse
   ```

### Using with Multiple Azure Search Services

Create different configurations for each service:

```bash
# Production search
claude mcp add azure-search-prod \
  --env AZURE_SEARCH_ENDPOINT=https://prod.search.windows.net \
  --env AZURE_SEARCH_API_KEY=prod-key \
  -- npx tsx src/index-stdio.ts

# Development search
claude mcp add azure-search-dev \
  --env AZURE_SEARCH_ENDPOINT=https://dev.search.windows.net \
  --env AZURE_SEARCH_API_KEY=dev-key \
  -- npx tsx src/index-stdio.ts
```

## Getting Help

- **GitHub Issues**: https://github.com/henryperkins/my-mcp-github/issues
- **MCP Documentation**: https://modelcontextprotocol.io
- **Azure Search Docs**: https://docs.microsoft.com/azure/search/

## Example Session

After setup, you can have conversations like:

```
You: Show me all search indexes

Claude: I'll list all the search indexes in your Azure Search service.
[Executes IndexManagement.list operation]
Found 3 indexes:
- products (10,543 documents, 2.3 MB)
- customers (5,231 documents, 1.1 MB)  
- orders (25,672 documents, 5.7 MB)

You: Search for recent orders with status "pending"

Claude: I'll search the orders index for pending orders.
[Executes DocumentOperations.search operation]
Found 47 pending orders...

You: Create an indexer to sync data from blob storage every hour

Claude: I'll create an indexer to sync data from blob storage on an hourly schedule.
[Executes IndexerManagement.create operation]
Successfully created indexer "blob-sync-indexer" with hourly schedule...
```

---

**Last Updated**: December 2024
**MCP Server Version**: 2.0.0