# Azure AI Search MCP Server

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/henryperkins/my-mcp-github)
[![MCP Version](https://img.shields.io/badge/MCP-v2.0.0-blue)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful Model Context Protocol (MCP) server that enables AI assistants to manage Azure AI Search services. Deploy on Cloudflare Workers for global edge performance or run locally for development.

## 🚀 Quick Start

### Fastest Setup: Connect to Deployed Server

```bash
# For Claude Code
claude mcp add --transport sse azure-search https://azure-search-mcp.lfd.workers.dev/sse \
  --header "X-Azure-Search-Endpoint: https://your-service.search.windows.net" \
  --header "X-Azure-Search-Api-Key: your-api-key"

# For Claude Desktop - add to config file
{
  "mcpServers": {
    "azure-search": {
      "command": "npx",
      "args": ["mcp-remote", "https://azure-search-mcp.lfd.workers.dev/sse"]
    }
  }
}
```

That's it! Start using Azure Search in your AI assistant immediately.

## 📋 Table of Contents

- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Usage Guide](#-usage-guide)
- [Available Operations](#-available-operations)
- [Examples](#-examples)
- [Troubleshooting](#-troubleshooting)
- [Development](#-development)
- [Architecture](#-architecture)

## ✨ Features

- **🔍 Complete Azure Search Management** - Full control over indexes, documents, data sources, indexers, and skillsets
- **🤖 Intelligent Response Handling** - Automatic summarization of large responses using GPT-4o-mini
- **📄 Smart Pagination** - Efficient handling of large result sets with cursor-based pagination
- **🚀 Edge Deployment** - Fast, globally distributed via Cloudflare Workers
- **🔌 Multiple Transports** - SSE (Server-Sent Events) and HTTP support
- **⚡ Direct API Access** - No OAuth complexity, uses Azure Search API keys
- **🛡️ Built-in Safety** - Confirmation prompts for destructive operations
- **📊 Real-time Resources** - Live monitoring of indexes, indexers, and service stats

## 📦 Prerequisites

### Required
- **Azure AI Search Service** with:
  - Endpoint URL (e.g., `https://your-service.search.windows.net`)
  - Admin API key (found in Azure Portal → Your Search Service → Keys)

### Optional
- **Azure OpenAI** (for intelligent summarization):
  - Endpoint, API key, and deployment name (e.g., `gpt-4o-mini`)
- **Cloudflare Account** (for custom deployment)
- **Node.js 18+** (for local development)

## 🔧 Installation

### Option 1: Use the Deployed Server (Recommended)

The server is already deployed and ready to use at:
- **Base URL**: `https://azure-search-mcp.lfd.workers.dev`
- **SSE Endpoint**: `https://azure-search-mcp.lfd.workers.dev/sse`
- **HTTP Endpoint**: `https://azure-search-mcp.lfd.workers.dev/mcp`

#### Connect with Claude Code

```bash
# SSE Transport (recommended)
claude mcp add --transport sse azure-search https://azure-search-mcp.lfd.workers.dev/sse \
  --header "X-Azure-Search-Endpoint: https://your-service.search.windows.net" \
  --header "X-Azure-Search-Api-Key: your-api-key"

# HTTP Transport
claude mcp add --transport http azure-search https://azure-search-mcp.lfd.workers.dev/mcp \
  --header "X-Azure-Search-Endpoint: https://your-service.search.windows.net" \
  --header "X-Azure-Search-Api-Key: your-api-key"
```

#### Connect with Claude Desktop

Add to your configuration file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "azure-search": {
      "command": "npx",
      "args": ["mcp-remote", "https://azure-search-mcp.lfd.workers.dev/sse"],
      "env": {
        "AZURE_SEARCH_ENDPOINT": "https://your-service.search.windows.net",
        "AZURE_SEARCH_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Option 2: Deploy Your Own Instance

```bash
# Clone repository
git clone https://github.com/henryperkins/my-mcp-github.git
cd my-mcp-github

# Install dependencies
npm install

# Configure secrets
wrangler secret put AZURE_SEARCH_ENDPOINT
wrangler secret put AZURE_SEARCH_API_KEY
wrangler secret put AZURE_OPENAI_ENDPOINT  # Optional
wrangler secret put AZURE_OPENAI_API_KEY   # Optional

# Deploy to Cloudflare
npm run deploy
```

### Option 3: Run Locally

```bash
# Clone and install
git clone https://github.com/henryperkins/my-mcp-github.git
cd my-mcp-github
npm install

# Create .dev.vars file
cat > .dev.vars << EOF
AZURE_SEARCH_ENDPOINT=https://your-service.search.windows.net
AZURE_SEARCH_API_KEY=your-api-key
AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/  # Optional
AZURE_OPENAI_API_KEY=your-openai-key  # Optional
EOF

# Run development server
npm run dev  # Available at http://localhost:8788

# Or run with mock data (no Azure required)
npm run dev:mock
```

## 📖 Usage Guide

### How to Interact with the Server

Once connected, you can interact naturally with your AI assistant. The server handles all the complexity behind the scenes.

#### Example Conversations

```
You: Show me all search indexes with their document counts

Claude: I'll list all the search indexes with their statistics.
[Lists indexes with document counts, storage sizes, and features]

You: Search for "laptop" in the products index with price under $1000

Claude: I'll search for laptops under $1000 in your products index.
[Returns filtered search results with relevant products]

You: Create an indexer to sync data from blob storage every hour

Claude: I'll create an indexer with hourly synchronization from your blob storage.
[Sets up the indexer with the specified schedule]
```

### Verifying Connection

After adding the server, verify it's working:

```bash
# In Claude Code
/mcp

# Check specific server
claude mcp get azure-search

# List all servers
claude mcp list
```

## 🛠️ Available Operations

The server provides comprehensive Azure Search management through these tools:

### 📚 Index Management (`IndexManagement`)
| Operation | Description | Key Parameters |
|-----------|-------------|----------------|
| `list` | List all indexes with stats | `includeStats`, `verbose`, `pageSize` |
| `get` | Get index definition | `indexName` |
| `create` | Create new index | `indexName`, `template`, `indexDefinition` |
| `update` | Update index schema | `indexName`, `indexDefinition` |
| `delete` | Delete index | `indexName` (with confirmation) |
| `stats` | Get index statistics | `indexName` |

**Templates available**: `documentSearch`, `productCatalog`, `hybridSearch`, `knowledgeBase`

### 📄 Document Operations (`DocumentOperations`)
| Operation | Description | Key Parameters |
|-----------|-------------|----------------|
| `search` | Search documents | `indexName`, `search`, `filter`, `orderBy` |
| `get` | Get document by ID | `indexName`, `key` |
| `count` | Count documents | `indexName`, `filter` |
| `upload` | Upload new documents | `indexName`, `documents` |
| `merge` | Update existing documents | `indexName`, `documents` |
| `delete` | Delete documents | `indexName`, `keys` |

### 🔌 Data Source Management (`DataSourceManagement`)
| Operation | Description | Key Parameters |
|-----------|-------------|----------------|
| `list` | List data sources | - |
| `get` | Get data source details | `name` |
| `createBlob` | Create blob storage source | `name`, `connectionString`, `container` |
| `delete` | Delete data source | `name` |
| `test` | Test connection | `name` |

### ⚙️ Indexer Management (`IndexerManagement`)
| Operation | Description | Key Parameters |
|-----------|-------------|----------------|
| `list` | List all indexers | - |
| `get` | Get indexer config | `name` |
| `create` | Create new indexer | `name`, `dataSource`, `targetIndex` |
| `run` | Run indexer now | `name` |
| `reset` | Reset change tracking | `name` |
| `getStatus` | Get execution history | `name`, `historyLimit` |

### 🧠 Skillset Management (`SkillsetManagement`)
| Operation | Description | Key Parameters |
|-----------|-------------|----------------|
| `list` | List AI enrichment skillsets | - |
| `get` | Get skillset definition | `name` |
| `create` | Create skillset | `name`, `skills` |
| `validate` | Validate configuration | `skillsetDefinition` |

### 🔧 Service Utilities (`ServiceUtilities`)
| Operation | Description | Key Parameters |
|-----------|-------------|----------------|
| `serviceStats` | Get service quotas/usage | - |
| `analyzeText` | Test text analyzers | `text`, `analyzer` |
| `listSynonymMaps` | List synonym maps | - |
| `createOrUpdateSynonymMap` | Manage synonyms | `name`, `synonyms` |

## 💡 Examples

### Creating a Product Catalog Index

```
You: Create a product catalog index named "products-v2" with English language support

Claude: I'll create a product catalog index with English language support for you.
[Creates index with appropriate fields for product data including name, description, 
price, category, with proper analyzers for English text]
```

### Complex Search with Filters

```
You: Search the orders index for pending orders from last week, sorted by amount

Claude: I'll search for pending orders from the last week, sorted by amount.
[Executes search with date filter, status filter, and ordering]
```

### Setting Up Data Sync

```
You: Set up a complete data pipeline from my blob storage to a new search index

Claude: I'll help you set up a complete data pipeline. This will involve:
1. Creating a data source connection to your blob storage
2. Creating a target index with appropriate schema
3. Setting up an indexer to sync data
[Proceeds with step-by-step setup]
```

## 🔍 Troubleshooting

### Common Issues and Solutions

#### "Connection closed" or "Not connected" Error
```bash
# Remove and re-add the server
claude mcp remove azure-search
claude mcp add --transport sse azure-search https://azure-search-mcp.lfd.workers.dev/sse \
  --header "X-Azure-Search-Endpoint: https://your-service.search.windows.net" \
  --header "X-Azure-Search-Api-Key: your-api-key"
```

#### Authentication Failures
- ✅ Verify API key has admin permissions
- ✅ Check endpoint URL format (should end with `.search.windows.net`)
- ✅ Ensure no extra spaces in credentials
- ✅ Confirm service is not in free tier (some operations require paid tiers)

#### Large Response Issues
- Responses >20KB are automatically summarized
- Configure Azure OpenAI for best results:
  ```bash
  wrangler secret put AZURE_OPENAI_ENDPOINT
  wrangler secret put AZURE_OPENAI_API_KEY
  ```
- Use pagination: `pageSize` and `cursor` parameters
- Use `select` to limit returned fields

#### Rate Limiting (429 Errors)
- Implement exponential backoff
- Reduce request frequency
- Consider upgrading service tier

#### Windows-Specific Issues
For native Windows (not WSL), use cmd wrapper:
```bash
claude mcp add my-server -- cmd /c npx -y @azure/search-mcp
```

### Debugging Tips

1. **Enable verbose logging**:
   ```
   You: Set logging level to debug
   ```

2. **Check server status**:
   ```bash
   /mcp
   ```

3. **Test with mock data**:
   ```bash
   AZURE_SEARCH_MOCK=true npm run dev
   ```

4. **Inspect raw responses**:
   ```bash
   curl -X POST https://azure-search-mcp.lfd.workers.dev/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
   ```

## 🧪 Development

### Local Development Setup

```bash
# Install dependencies
npm install

# Type checking
npm run type-check

# Run tests
npm test

# Generate Cloudflare types
npm run cf-typegen

# Watch logs
wrangler tail
```

### Project Structure

```
azure-search-mcp/
├── src/
│   ├── index-dynamic.ts        # Main MCP server with dynamic tools
│   ├── dynamic-tools/           # Tool implementations
│   │   ├── base/               # Base classes and interfaces
│   │   ├── IndexTool.ts        # Index management operations
│   │   ├── DocumentTool.ts     # Document operations
│   │   └── ...                 # Other tools
│   ├── azure-search-client.ts  # Azure Search REST client
│   ├── azure-openai-client.ts  # OpenAI integration
│   ├── resources.ts            # MCP resource definitions
│   └── utils/                  # Helper functions
├── docs/                       # Documentation
├── test/                       # Test files
└── wrangler.toml              # Cloudflare configuration
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AZURE_SEARCH_ENDPOINT` | Yes | Your Azure Search service URL |
| `AZURE_SEARCH_API_KEY` | Yes | Admin API key |
| `AZURE_OPENAI_ENDPOINT` | No | Azure OpenAI endpoint for summarization |
| `AZURE_OPENAI_API_KEY` | No | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT` | No | Deployment name (default: gpt-4o-mini) |

## 🏗️ Architecture

### Technical Stack
- **Runtime**: Cloudflare Workers with Durable Objects
- **Protocol**: Model Context Protocol (MCP) v2.0
- **Language**: TypeScript
- **APIs**: 
  - Azure Search REST API (2025-08-01-preview)
  - Azure OpenAI API (2024-08-01-preview)

### Key Design Decisions

1. **Dynamic Tool System**: Multi-operation tools reduce overhead and improve performance
2. **Response Management**: Automatic summarization/truncation for large payloads
3. **Direct API Access**: Uses REST API instead of SDK for Workers compatibility
4. **Edge Deployment**: Global distribution via Cloudflare's network
5. **No OAuth**: Simplified authentication using API keys

### Performance Optimizations
- Concurrent operations with controlled parallelism
- Response caching for frequently accessed data
- Streaming support for large result sets
- Automatic pagination (max 50 items default)
- Intelligent field selection to reduce payload size

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/henryperkins/my-mcp-github/issues)
- **Discussions**: [GitHub Discussions](https://github.com/henryperkins/my-mcp-github/discussions)
- **MCP Documentation**: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **Azure Search Docs**: [docs.microsoft.com](https://docs.microsoft.com/azure/search/)

## 🙏 Acknowledgments

- Built on the [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic
- Powered by [Cloudflare Workers](https://workers.cloudflare.com)
- Integrates with [Azure AI Search](https://azure.microsoft.com/services/search/) and [Azure OpenAI](https://azure.microsoft.com/services/openai/)

---

**Version**: 2.0.0 | **Last Updated**: December 2024