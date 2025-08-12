#!/bin/bash

# Local script to sync repository to Azure Blob Storage
# Can be run manually or via cron job

echo "=== Local Azure Blob Storage Sync ==="
echo "Syncing repository to Azure Blob Storage..."
echo ""

# Configuration (set these or use environment variables)
STORAGE_ACCOUNT="${AZURE_STORAGE_ACCOUNT:-}"
CONTAINER_NAME="${AZURE_CONTAINER_NAME:-repo-content}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-}"

# Check if logged in to Azure
if ! az account show &>/dev/null; then
    echo "Not logged in to Azure. Running 'az login'..."
    az login
fi

# Prompt for storage account if not set
if [ -z "$STORAGE_ACCOUNT" ]; then
    read -p "Enter Azure Storage Account name: " STORAGE_ACCOUNT
fi

# Create container if it doesn't exist
echo "Ensuring container exists..."
az storage container create \
    --name $CONTAINER_NAME \
    --account-name $STORAGE_ACCOUNT \
    --auth-mode login \
    --fail-on-exist false 2>/dev/null || true

# Get current git info
REPO_NAME=$(basename $(git remote get-url origin) .git)
BRANCH=$(git branch --show-current)
COMMIT=$(git rev-parse HEAD)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "Repository: $REPO_NAME"
echo "Branch: $BRANCH"
echo "Commit: $COMMIT"
echo ""

# Create a temporary directory for files to sync
TEMP_DIR=$(mktemp -d)
echo "Preparing files for sync..."

# Copy repository files (excluding unwanted directories)
rsync -av \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='build' \
    --exclude='.env*' \
    --exclude='*.log' \
    . "$TEMP_DIR/"

# Create metadata file
cat > "$TEMP_DIR/_metadata.json" <<EOF
{
  "repository": "$REPO_NAME",
  "branch": "$BRANCH",
  "commit": "$COMMIT",
  "syncTimestamp": "$TIMESTAMP",
  "fileCount": $(find "$TEMP_DIR" -type f | wc -l)
}
EOF

# Upload to blob storage
echo "Uploading to Azure Blob Storage..."
az storage blob upload-batch \
    --account-name $STORAGE_ACCOUNT \
    --destination $CONTAINER_NAME \
    --source "$TEMP_DIR" \
    --overwrite \
    --auth-mode login

# Clean up
rm -rf "$TEMP_DIR"

echo ""
echo "=== Sync Complete ==="
echo "Files have been uploaded to:"
echo "  Storage Account: $STORAGE_ACCOUNT"
echo "  Container: $CONTAINER_NAME"
echo ""

# Optional: Trigger indexer
read -p "Do you want to trigger an Azure Search indexer? (y/n): " TRIGGER_INDEXER
if [ "$TRIGGER_INDEXER" = "y" ]; then
    read -p "Enter Azure Search service name: " SEARCH_SERVICE
    read -p "Enter indexer name: " INDEXER_NAME
    read -p "Enter Azure Search API key: " API_KEY
    
    echo "Triggering indexer..."
    curl -X POST \
        "https://${SEARCH_SERVICE}.search.windows.net/indexers/${INDEXER_NAME}/run?api-version=2025-08-01-preview" \
        -H "Content-Type: application/json" \
        -H "api-key: ${API_KEY}"
    
    echo "Indexer triggered successfully"
fi