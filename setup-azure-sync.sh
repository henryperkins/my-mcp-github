#!/bin/bash

# Setup script for Azure Blob Storage sync
# This script helps configure GitHub secrets for the sync workflow

echo "=== Azure Blob Storage Sync Setup ==="
echo "This script will help you configure the GitHub Actions workflow for syncing to Azure Blob Storage"
echo ""

# Check if gh CLI is authenticated
if ! gh auth status &>/dev/null; then
    echo "Please authenticate with GitHub CLI first:"
    echo "Run: gh auth login"
    exit 1
fi

# Check if az CLI is authenticated
if ! az account show &>/dev/null; then
    echo "Please authenticate with Azure CLI first:"
    echo "Run: az login"
    exit 1
fi

echo "Current repository: $(git remote get-url origin)"
echo ""

# Get or create storage account
read -p "Enter your Azure Storage Account name (or press Enter to create new): " STORAGE_ACCOUNT
if [ -z "$STORAGE_ACCOUNT" ]; then
    read -p "Enter name for new storage account (lowercase, no spaces): " STORAGE_ACCOUNT
    read -p "Enter resource group name: " RESOURCE_GROUP
    read -p "Enter location (e.g., eastus, westus2): " LOCATION
    
    echo "Creating storage account..."
    az storage account create \
        --name $STORAGE_ACCOUNT \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --sku Standard_LRS \
        --kind StorageV2
fi

# Container name
read -p "Enter container name for repository files (default: repo-content): " CONTAINER_NAME
CONTAINER_NAME=${CONTAINER_NAME:-repo-content}

# Get Azure credentials for GitHub Actions
echo ""
echo "Creating service principal for GitHub Actions..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
SP_NAME="github-actions-$(git remote get-url origin | sed 's/.*\/\([^\/]*\)\.git/\1/')"

# Create service principal
SP_OUTPUT=$(az ad sp create-for-rbac \
    --name $SP_NAME \
    --role "Storage Blob Data Contributor" \
    --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/*/providers/Microsoft.Storage/storageAccounts/$STORAGE_ACCOUNT \
    --sdk-auth)

# Set GitHub secrets
echo ""
echo "Setting GitHub secrets..."

# Set AZURE_CREDENTIALS secret
echo "$SP_OUTPUT" | gh secret set AZURE_CREDENTIALS

# Set storage account name
echo "$STORAGE_ACCOUNT" | gh secret set STORAGE_ACCOUNT_NAME

# Set container name
echo "$CONTAINER_NAME" | gh secret set CONTAINER_NAME

# Optional: Set Azure Search configuration
echo ""
read -p "Do you want to configure Azure Search indexer trigger? (y/n): " CONFIGURE_SEARCH
if [ "$CONFIGURE_SEARCH" = "y" ]; then
    read -p "Enter Azure Search service name: " SEARCH_SERVICE
    read -p "Enter indexer name: " INDEXER_NAME
    read -p "Enter Azure Search API key: " SEARCH_API_KEY
    
    echo "$SEARCH_SERVICE" | gh secret set AZURE_SEARCH_SERVICE
    echo "$INDEXER_NAME" | gh secret set INDEXER_NAME
    echo "$SEARCH_API_KEY" | gh secret set AZURE_SEARCH_API_KEY
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "GitHub Actions workflow has been created at: .github/workflows/sync-to-azure-blob.yml"
echo "Required secrets have been configured in your repository"
echo ""
echo "The workflow will:"
echo "  - Run automatically on pushes to main branch"
echo "  - Run every 6 hours"
echo "  - Can be manually triggered from GitHub Actions tab"
echo ""
echo "Next steps:"
echo "  1. Commit and push the workflow file:"
echo "     git add .github/workflows/sync-to-azure-blob.yml"
echo "     git commit -m 'Add Azure Blob Storage sync workflow'"
echo "     git push origin main"
echo ""
echo "  2. Create an Azure Search data source pointing to:"
echo "     Storage Account: $STORAGE_ACCOUNT"
echo "     Container: $CONTAINER_NAME"
echo ""
echo "  3. Create an indexer to index the blob content"