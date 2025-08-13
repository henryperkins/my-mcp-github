# Azure Search MCP Server - Connection Solution

## Problem Summary
The MCP server connection issues stem from:
1. **OAuth Requirements**: Claude Code expects OAuth for remote servers, but this server uses API keys
2. **JSON Parsing Error**: The authentication attempt fails because the server doesn't implement OAuth endpoints
3. **Method Not Found**: The server tried to use `server.method()` which doesn't exist in McpServer

## Issues Fixed

### 1. Removed Invalid Method Call
- **Issue**: `this.server.method("logging/setLevel", ...)` caused TypeError
- **Fix**: Removed the invalid method call and unused import

### 2. Added CORS Headers
- **Issue**: Cross-origin requests were blocked
- **Fix**: Added proper CORS headers to all endpoints

### 3. Clarified Authentication Model
- **Issue**: Server doesn't implement OAuth but Claude expects it
- **Fix**: Document proper connection methods without authentication

## Connection Methods

### Method 1: Direct Connection (No Auth)
Since the server uses Azure API keys (configured as environment variables), connect without OAuth:

```bash
# For SSE transport (recommended for real-time updates)
claude mcp add --transport sse azure-search https://your-worker.workers.dev/sse

# For HTTP transport
claude mcp add --transport http azure-search https://your-worker.workers.dev/mcp
```

### Method 2: Local Development
```bash
# Start the development server
npm run dev

# In another terminal, connect Claude Code
claude mcp add --transport sse azure-search-local http://localhost:8788/sse
```

### Method 3: Using MCP Inspector
Test the server before connecting Claude:

```bash
# Install and run the MCP inspector
npx @modelcontextprotocol/inspector@latest

# When prompted, enter your server URL:
# - For local: http://localhost:8788/sse
# - For deployed: https://your-worker.workers.dev/sse
```

## Deployment Steps

1. **Deploy to Cloudflare Workers**:
```bash
# Deploy the server
npm run deploy

# Note the deployment URL (e.g., https://azure-search-mcp.username.workers.dev)
```

2. **Connect Claude Code**:
```bash
# Use the deployment URL
claude mcp add --transport sse azure-search https://azure-search-mcp.username.workers.dev/sse
```

## Testing the Connection

After connecting, test with these commands:

```bash
# List available tools
claude mcp list-tools azure-search

# Test a simple operation
claude "Using the azure-search MCP server, list all search indexes"

# Test search functionality
claude "Search for documents in the 'products' index using azure-search"
```

## Architecture Notes

### Authentication Model
- **Server-side**: Uses Azure Search API keys (stored as Cloudflare secrets)
- **Client-side**: No authentication required (server handles Azure auth)
- **Security**: API keys are never exposed to clients

### Transport Options
1. **SSE (Server-Sent Events)**: Best for real-time updates and long-running operations
2. **HTTP (Streamable)**: Standard request/response, better for simple operations

### Why OAuth Isn't Needed
This MCP server acts as a **proxy** to Azure Search:
- Authentication happens between the server and Azure Search API
- Clients don't need credentials - the server has them
- This is similar to how a backend API protects database credentials

## Troubleshooting

### "Cannot parse JSON" Error
This occurs when trying to authenticate. Solution: Don't use OAuth, connect directly.

### "Connection refused" Error
- Ensure the server is running (`npm run dev` for local)
- Check the URL is correct (with `/sse` or `/mcp` endpoint)
- Verify firewall/network settings allow the connection

### "Session not found" Error
- For HTTP transport, sessions need to be created first
- Use SSE transport instead for simpler connection

### "Method not found" Error
- Fixed in the code by removing invalid `server.method()` call
- Ensure you're using the latest version of the code

## Next Steps

1. **Deploy the server** to Cloudflare Workers for production use
2. **Connect Claude Code** using the SSE transport
3. **Test the tools** to ensure everything works
4. **Monitor logs** in Cloudflare dashboard for any issues

## Additional Resources

- [Cloudflare MCP Documentation](https://developers.cloudflare.com/agents/model-context-protocol/)
- [MCP SDK Documentation](https://modelcontextprotocol.io/)
- [Azure Search REST API](https://docs.microsoft.com/en-us/rest/api/searchservice/)