# MCP Server Authentication Fix

## Issue
The Azure Search MCP server cannot be authenticated because:
1. It doesn't implement OAuth authentication flow
2. Claude Code expects OAuth for remote servers with authentication
3. The server only uses Azure Search API keys, not user-level OAuth

## Solution

### Option 1: Use Without Authentication (Recommended)
Since this server uses Azure Search API keys configured as environment variables, it doesn't need user-level authentication. Connect without OAuth:

```bash
# For SSE transport (recommended)
claude mcp add --transport sse azure-search https://your-worker.workers.dev/sse

# For HTTP transport
claude mcp add --transport http azure-search https://your-worker.workers.dev/mcp
```

### Option 2: Local Development
For local development, ensure the server is running:

```bash
# Start the development server
npm run dev

# Connect Claude Code to local server
claude mcp add --transport sse azure-search http://localhost:8788/sse
```

### Option 3: Deploy to Cloudflare Workers
Deploy the server and connect without authentication:

```bash
# Deploy to Cloudflare
npm run deploy

# Connect to deployed server
claude mcp add --transport sse azure-search https://your-worker.workers.dev/sse
```

## Why Authentication Fails

The error "cannot parse JSON" occurs because:
1. Claude Code sends OAuth authentication requests
2. The server doesn't handle these OAuth endpoints
3. The server returns HTML/text instead of expected OAuth JSON responses

## Configuration Changes Made

1. **Added CORS headers** to allow cross-origin requests
2. **Improved error handling** for unsupported authentication
3. **Clarified response formats** for better compatibility

## Testing the Connection

After connecting, test with:

```bash
# List available tools
claude mcp list-tools azure-search

# Test a simple operation
claude "List all Azure Search indexes using the azure-search MCP server"
```

## Important Notes

- This server is designed for **service-to-service** communication using API keys
- It doesn't need user-level OAuth authentication
- The Azure Search API keys are configured as environment secrets
- Authentication happens at the Azure Search API level, not the MCP level