#!/bin/bash
# Azure Search MCP Server wrapper with hardcoded environment variables

# Set your Azure Search configuration here
export AZURE_SEARCH_ENDPOINT="https://your-search-service.search.windows.net"
export AZURE_SEARCH_API_KEY="your-admin-api-key-here"

# Optional: Azure OpenAI configuration for intelligent summarization
export AZURE_OPENAI_ENDPOINT="https://your-openai.openai.azure.com/"
export AZURE_OPENAI_API_KEY="your-openai-api-key-here"
export AZURE_OPENAI_DEPLOYMENT="gpt-4o-mini"

# Run the server with stdio transport
cd "$(dirname "$0")"
npm run dev:stdio