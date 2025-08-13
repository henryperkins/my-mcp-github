#!/bin/bash

# Azure Sync Configuration Variables
# Copy this file to azure-sync-config.sh and update with your values
# DO NOT commit azure-sync-config.sh to version control

# Azure Storage Configuration
STORAGE_ACCOUNT="codebasestorage2025"
CONTAINER_NAME="repo-content"
STORAGE_KEY="Yp6D/jndgCxNEYZdou6DlIRKImHgbFmOTrCPGEz+dF5Qojza3X3jnj7280YHoqUizkf/Seaq80rH+AStawJCaw=="

# Azure Search Configuration
SEARCH_SERVICE="oairesourcesearch"
INDEX_NAME="my-mcp-github-repo"
INDEXER_NAME="blob-indexer"
DATA_SOURCE_NAME="blob-datasource"

# Optional Resource Group (for storage account creation)
RESOURCE_GROUP=""
LOCATION="eastus"

# GitHub Actions Service Principal Name Pattern
SP_NAME_PREFIX="github-actions"

# Indexer Configuration
INDEXER_SCHEDULE="PT2H"  # Run every 2 hours
INDEXED_FILE_EXTENSIONS=".md,.ts,.js,.json,.yml,.yaml,.txt"
EXCLUDED_FILE_EXTENSIONS=".png,.jpg,.gif,.svg,.ico"

# Sync Configuration
EXCLUDE_PATTERNS=(
    '.git'
    'node_modules'
    'dist'
    'build'
    '.env*'
    '*.log'
)

# API Version
AZURE_SEARCH_API_VERSION="2025-08-01-preview"