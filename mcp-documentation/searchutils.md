Here's the complete **[[SearchService_Utilities]]** note, structured for clarity and ready to use in your Obsidian vault:

---

### **[[SearchService_Utilities]]**
**Created**: 2025-08-11
**Modified**: 2025-08-11
**Tags**: `#azure-ai-search`, `#rest-api`, `#utilities`, `#best-practices`, `#monitoring`

---

### **What This Covers**
This note provides **essential utilities, patterns, and best practices** for working with **Azure AI Search**, including:
- **Common headers and parameters** for API requests.
- **Concurrency control** patterns (ETags, optimistic concurrency).
- **Service monitoring** endpoints and metrics.
- **Index design guardrails** and performance optimization.
- **Vector search** configurations and compression.
- **Permission filtering** for secure data access.
- **cURL flags** and debugging techniques.

---

### **Common Headers and Parameters**
| **Header/Parameter**       | **Purpose**                                                                 | **Example**                                      |
|----------------------------|-----------------------------------------------------------------------------|--------------------------------------------------|
| `api-version`              | Required for all requests. Use `2025-08-01-preview` for latest features. | `?api-version=2025-08-01-preview`               |
| `Content-Type`             | Required for requests with a body.                                         | `-H "Content-Type: application/json"`         |
| `x-ms-client-request-id`   | Optional GUID for request tracing.                                          | `-H "x-ms-client-request-id: 123e4567-e89b-12d3-a456-426614174000"` |
| `Prefer`                   | Return updated resource after `PUT`.                                        | `-H "Prefer: return=representation"`           |
| `If-Match`                 | Optimistic concurrency control using ETags.                                | `-H "If-Match: \"08D6A2D3F5E1C2A4\""`            |
| `If-None-Match`            | Conditional operations (e.g., create if not exists).                     | `-H "If-None-Match: *"`                          |

---

### **Concurrency Control Patterns**
#### **1. Safe Update (Optimistic Concurrency)**
1. **GET** the resource and capture its `@odata.etag`.
2. **PUT** with `If-Match: "<etag>"`.
3. Handle `412 Precondition Failed` by re-fetching and retrying.

**Example (cURL):**
```bash
# Step 1: Get the resource and ETag
ETAG=$(curl -s -I "https://[service].search.windows.net/indexes('my-index')?api-version=2025-08-01-preview" \
  -H "api-key: [your-key]" | grep -i etag | awk '{print $2}' | tr -d '\r')

# Step 2: Update with ETag
curl -X PUT "https://[service].search.windows.net/indexes('my-index')?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-key]" \
  -H "If-Match: $ETAG" \
  -d @updated-index.json
```

#### **2. Delete Pattern**
- Use `If-Match` to avoid accidental deletes.
- Accept `404 Not Found` as non-fatal for "delete if exists" operations.

**Example:**
```bash
curl -X DELETE "https://[service].search.windows.net/indexes('my-index')?api-version=2025-08-01-preview" \
  -H "api-key: [your-key]" \
  -H "If-Match: \"$ETAG\"" || echo "Index not found or already deleted"
```

---

### **Service-Level Endpoints**
#### **1. Service Statistics**
**Endpoint**: `GET /servicestats`
**Purpose**: Returns service counters and limits (e.g., index count, storage size).
**Example:**
```bash
curl "https://[service].search.windows.net/servicestats?api-version=2025-08-01-preview" \
  -H "api-key: [your-key]"
```
**Response Fields**:
```json
{
  "@odata.context": "...",
  "name": "[service-name]",
  "type": "Microsoft.Search/admin",
  "counters": {
    "documentCounter": {
      "count": 123456,
      "usage": 0.123
    },
    "indexCounter": {
      "count": 10,
      "usage": 0.5
    },
    "indexerCounter": {
      "count": 5,
      "usage": 0.25
    },
    "synonymMapCounter": {
      "count": 2,
      "usage": 0.1
    },
    "storageSize": {
      "current": 10737418240,  # 10 GB
      "limit": 214748364800,    # 200 GB
      "usage": 0.05
    },
    "vectorStorageSize": {
      "current": 5368709120,   # 5 GB
      "limit": 107374182400,   # 100 GB
      "usage": 0.05
    }
  }
}
```

#### **2. Index Statistics**
**Endpoint**: `GET /indexstats`
**Purpose**: Summary statistics for all indexes.
**Example:**
```bash
curl "https://[service].search.windows.net/indexstats?api-version=2025-08-01-preview" \
  -H "api-key: [your-key]"
```

---

### **List Filtering**
Use `$select` to trim payload size in list operations.
**Example:**
```bash
# List indexes with only names and field counts
curl "https://[service].search.windows.net/indexes?api-version=2025-08-01-preview&$select=name,fields" \
  -H "api-key: [your-key]"

# List indexers with status
curl "https://[service].search.windows.net/indexers?api-version=2025-08-01-preview&$select=name,status" \
  -H "api-key: [your-key]"
```

---

### **Index Design Guardrails**
#### **1. Field Requirements**
| **Requirement**               | **Details**                                                                 |
|-------------------------------|-----------------------------------------------------------------------------|
| **Key Field**                  | Must be `Edm.String` with `key: true`.                                    |
| **Searchable Fields**         | Require `analyzer` (default: `standard.lucene`).                         |
| **Vector Fields**             | Require `dimensions`, `vectorSearchProfile`, and `type: "Collection(Edm.Single)"`. |
| **Facetable Fields**          | Limit to 100 per index for performance.                                    |
| **Filterable Fields**         | Avoid on large text fields (e.g., `content`).                             |

#### **2. Analyzer Configuration**
- **Mutually Exclusive**: `analyzer` vs. `indexAnalyzer`/`searchAnalyzer`.
- **Custom Analyzers**: Require `allowIndexDowntime=true` when added/updated.
- **Example**:
  ```json
  {
    "name": "my-index",
    "fields": [
      {
        "name": "content",
        "type": "Edm.String",
        "searchable": true,
        "analyzer": "en.microsoft"  # Single analyzer
      },
      {
        "name": "title",
        "type": "Edm.String",
        "searchable": true,
        "indexAnalyzer": "whitespace",
        "searchAnalyzer": "standard.lucene"  # Separate analyzers
      }
    ]
  }
  ```

#### **3. Vector Search**
| **Parameter**               | **Recommendation**                                              | **Default**   |
|------------------------------|-----------------------------------------------------------------|----------------|
| **Algorithm**                | `hnsw` (Hierarchical Navigable Small World)                     | -              |
| **Metric**                   | `cosine` (for embeddings), `euclidean` (for geometric data)  | `cosine`       |
| **m**                       | 4–10 (tradeoff between accuracy and performance)              | 8              |
| **efConstruction**           | 100–1000 (higher = better recall, slower indexing)             | 400            |
| **efSearch**                 | 100–1000 (higher = better recall, slower queries)              | 500            |
| **Compression**              | `scalarQuantization` (int8) for storage savings               | None           |

**Example Configuration**:
```json
"vectorSearch": {
  "algorithms": [
    {
      "name": "hnsw-config",
      "kind": "hnsw",
      "hnswParameters": {
        "metric": "cosine",
        "m": 8,
        "efConstruction": 400,
        "efSearch": 500
      }
    }
  ],
  "vectorizers": [
    {
      "name": "azure-openai",
      "kind": "azureOpenAI",
      "azureOpenAIParameters": {
        "resourceUri": "https://your-aoai.openai.azure.com",
        "deploymentId": "text-embedding-3-small",
        "modelName": "text-embedding-3-small"
      }
    }
  ],
  "profiles": [
    {
      "name": "vector-profile",
      "algorithm": "hnsw-config",
      "vectorizer": "azure-openai"
    }
  ]
}
```

---

### **Permission Filtering**
#### **1. Data Source Configuration**
Enable permission filtering in the data source:
```json
{
  "name": "blob-ds",
  "type": "azureblob",
  "credentials": { ... },
  "container": { ... },
  "indexerPermissionOptions": ["userIds", "groupIds"]  # Enable filtering
}
```

#### **2. Index Field Configuration**
Mark fields for permission filtering:
```json
{
  "name": "document",
  "fields": [
    {
      "name": "content",
      "type": "Edm.String",
      "searchable": true
    },
    {
      "name": "userIds",
      "type": "Collection(Edm.String)",
      "permissionFilter": "userIds"  # Enable filtering
    },
    {
      "name": "groupIds",
      "type": "Collection(Edm.String)",
      "permissionFilter": "groupIds"
    }
  ]
}
```

#### **3. Refresh Permissions**
Trigger a permission refresh after updates:
```bash
curl -X POST "https://[service].search.windows.net/indexers('my-indexer')/search.resync?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-key]" \
  -d '{
    "options": ["permissions"]
  }'
```

---

### **Handy cURL Flags**
| **Flag**                  | **Purpose**                                                                 | **Example**                                      |
|---------------------------|-----------------------------------------------------------------------------|--------------------------------------------------|
| `-H "If-Match: \"ETAG\""`  | Optimistic concurrency for updates/deletes.                                | `-H "If-Match: \"08D6A2D3F5E1C2A4\""`            |
| `-H "Prefer: return=representation"` | Return updated resource after `PUT`.                     | `-H "Prefer: return=representation"`           |
| `@file.json`              | Load request body from a file (avoids shell escaping).                     | `-d @index.json`                                |
| `-i`                      | Include response headers (useful for debugging ETags).                     | `curl -i ...`                                   |
| `-v`                      | Verbose output (shows request/response details).                           | `curl -v ...`                                   |
| `--fail`                  | Fail silently on server errors (non-zero exit code).                        | `curl --fail ...`                               |

---

### **Performance Optimization**
#### **1. Indexing**
| **Technique**               | **Impact**                                                                 |
|------------------------------|-----------------------------------------------------------------------------|
| **Batch Size**               | Smaller batches (50–100) reduce memory pressure.                          |
| **Parallelism**              | Increase for large datasets (max: 8 parallel indexers).                  |
| **Skillset Caching**         | Enable for repeated enrichments (`"cache": { "enable": true }`).           |
| **Change Detection**         | Use `HighWaterMarkChangeDetectionPolicy` for incremental updates.         |

#### **2. Querying**
| **Technique**               | **Impact**                                                                 |
|------------------------------|-----------------------------------------------------------------------------|
| **`$select`**                | Reduce payload size by selecting only needed fields.                      |
| **`$top`**                   | Limit results to the first N (e.g., `$top=10`).                           |
| **`searchMode=any`**         | Faster but less precise than `all`.                                        |
| **Semantic Ranking**         | Improve relevance for natural language queries.                           |
| **Result Trimming**          | Use `scoringParameters` to filter low-scoring results.                     |

**Example Query with Optimizations**:
```bash
curl "https://[service].search.windows.net/indexes('my-index')/docs/search?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-key]" \
  -d '{
    "search": "AI advancements 2024",
    "select": "id,title,abstract",
    "top": 10,
    "searchMode": "any",
    "queryType": "semantic",
    "semanticConfiguration": "default",
    "scoringParameters": [
      { "name": "boostByRecency", "value": "2024-01-01..2024-12-31" }
    ]
  }'
```

#### **3. Caching**
- **Client-Side**: Cache frequent queries (TTL: 5–30 minutes).
- **Server-Side**: Enable semantic caching in the index:
  ```json
  {
    "name": "my-index",
    "semantic": {
      "configurations": [{
        "name": "default",
        "prioritizedFields": { ... },
        "semanticCachingMode": "always"  # or "auto"
      }]
    }
  }
  ```

---

### **Debugging Techniques**
#### **1. Analyze API**
Test tokenization and analyzers:
```bash
curl -X POST "https://[service].search.windows.net/indexes('my-index')/search.analyze?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-key]" \
  -d '{
    "text": "Artificial Intelligence advancements",
    "analyzer": "en.microsoft"
  }'
```

#### **2. Explain Scoring**
Debug ranking with `scoringProfile` explanations:
```bash
curl "https://[service].search.windows.net/indexes('my-index')/docs/search?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-key]" \
  -d '{
    "search": "AI healthcare",
    "scoringProfile": "custom-profile",
    "scoringParameters": ["param1=value1"],
    "queryType": "full",
    "scoringStatistics": true
  }'
```

#### **3. Indexer Status**
Monitor indexing progress and errors:
```bash
curl "https://[service].search.windows.net/indexers('my-indexer')/search.status?api-version=2025-08-01-preview" \
  -H "api-key: [your-key]"
```

---

### **Security Best Practices**
| **Practice**                     | **Implementation**                                                                 |
|----------------------------------|-----------------------------------------------------------------------------------|
| **Managed Identities**           | Replace connection strings with `@odata.type: "#Microsoft.Azure.Search.DataUserAssignedIdentity"`. |
| **Private Endpoints**           | Restrict service access to your VNet.                                             |
| **Key Vault Integration**        | Store secrets (API keys, connection strings) in Azure Key Vault.                 |
| **RBAC**                        | Assign least-privilege roles (e.g., `Search Index Data Contributor`).             |
| **Field-Level Security**        | Use `permissionFilter` for row-level security.                                    |
| **Audit Logging**               | Enable diagnostic logs for all operations.                                       |

**Example: Managed Identity for Data Source**
```json
{
  "name": "blob-ds",
  "type": "azureblob",
  "identity": {
    "@odata.type": "#Microsoft.Azure.Search.DataUserAssignedIdentity",
    "userAssignedIdentity": "/subscriptions/.../resourceGroups/.../providers/Microsoft.ManagedIdentity/userAssignedIdentities/my-identity"
  },
  "container": {
    "name": "docs"
  }
}
```

---

### **Common Error Codes**
| **Code**  | **Meaning**                          | **Solution**                                                                 |
|------------|--------------------------------------|-----------------------------------------------------------------------------|
| `400`      | Bad Request                          | Validate request body and parameters.                                      |
| `401`      | Unauthorized                         | Check `api-key` or managed identity permissions.                          |
| `403`      | Forbidden                            | Verify RBAC roles or resource permissions.                                 |
| `404`      | Not Found                            | Confirm resource name and existence.                                       |
| `409`      | Conflict                             | Ensure unique names or handle ETag conflicts.                              |
| `412`      | Precondition Failed                  | Verify `If-Match` ETag or resource state.                                  |
| `429`      | Too Many Requests                   | Implement retry with exponential backoff.                                  |
| `503`      | Service Unavailable                 | Check service status and retry.                                            |

---

### **Retry Patterns**
**Exponential Backoff Example (Bash):**
```bash
RETRY_COUNT=3
DELAY=1

for i in {1..3}; do
  response=$(curl -s -w "%{http_code}" "https://[service].search.windows.net/..." -H "api-key: [your-key]")
  status=${response: -3}
  body=${response%???}

  if [ "$status" -ne 429 ] && [ "$status" -ne 503 ]; then
    echo "$body"
    break
  else
    if [ $i -eq $RETRY_COUNT ]; then
      echo "Max retries reached. Last error: $body"
      exit 1
    fi
    sleep $DELAY
    DELAY=$((DELAY * 2))  # Exponential backoff
  fi
done
```

**Python Example:**
```python
import time
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

session = requests.Session()
retries = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504]
)
session.mount("https://", HTTPAdapter(max_retries=retries))

response = session.get(
    "https://[service].search.windows.net/...",
    headers={"api-key": "[your-key]"}
)
```

---

### **Migration Checklist**
| **Step**                          | **Details**                                                                 |
|-----------------------------------|-----------------------------------------------------------------------------|
| **1. Schema Validation**         | Use `GET /indexes('name')` to compare source/target schemas.               |
| **2. Data Export**                | Use `search=*&$count=true` to export documents.                            |
| **3. Indexer Pause**              | Disable indexers during migration (`"disabled": true`).                   |
| **4. Dual-Write Phase**           | Write to both old/new indexes temporarily.                               |
| **5. Validation**                 | Compare query results and metrics.                                          |
| **6. Cutover**                    | Update clients to use the new index.                                       |
| **7. Cleanup**                    | Delete old index after TTL (e.g., 7 days).                                |

**Example: Schema Comparison Script**
```bash
# Get source and target schemas
SOURCE_SCHEMA=$(curl -s "https://[service].search.windows.net/indexes('source-index')?api-version=2025-08-01-preview" -H "api-key: [your-key]")
TARGET_SCHEMA=$(curl -s "https://[service].search.windows.net/indexes('target-index')?api-version=2025-08-01-preview" -H "api-key: [your-key]")

# Compare fields
diff <(echo "$SOURCE_SCHEMA" | jq '.fields | sort_by(.name)') \
     <(echo "$TARGET_SCHEMA" | jq '.fields | sort_by(.name)')
```

---

### **Cost Optimization**
| **Area**               | **Technique**                                                                 |
|------------------------|-----------------------------------------------------------------------------|
| **Indexing**           | Use `indexingSchedule` for off-peak hours.                                |
| **Querying**           | Cache frequent queries client-side.                                       |
| **Storage**            | Compress vector fields (`scalarQuantization`).                            |
| **AI Enrichment**      | Limit skillset usage to essential documents.                             |
| **Semantic Search**    | Use `semanticCachingMode: "auto"` to balance cost/performance.             |

**Example: Indexing Schedule**
```json
{
  "name": "my-indexer",
  "schedule": {
    "interval": "P1D",
    "startTime": "2025-01-01T02:00:00Z"  # Off-peak (2 AM UTC)
  }
}
```

---

### **Monitoring and Alerts**
#### **1. Key Metrics**
| **Metric**               | **Threshold**               | **Action**                                  |
|--------------------------|-----------------------------|---------------------------------------------|
| `SearchLatency`          | > 500ms                     | Optimize queries or scale up.              |
| `IndexingLatency`        | > 10 minutes                | Reduce batch size or parallelism.          |
| `ThrottledRequests`      | > 0                         | Implement retry logic.                     |
| `DocumentCount`          | > 90% of quota              | Archive old data or request quota increase.|
| `VectorStorageUsage`     | > 80%                       | Enable compression or clean up.            |

#### **2. Log Analytics Queries**
```kusto
// Failed indexer runs
AzureDiagnostics
| where Category == "SearchServiceIndexers"
| where OperationName == "IndexerExecution"
| where Status == "Failed"
| project TimeGenerated, IndexerName, ErrorMessage, DurationMs

// Slow queries
AzureDiagnostics
| where Category == "SearchServiceQueries"
| where OperationName == "Search"
| where DurationMs > 500
| project TimeGenerated, Query, DurationMs, IndexName
```

#### **3. Alert Rules**
**Example (Azure Portal):**
1. **Metric**: `SearchLatency`
2. **Condition**: > 500ms for 5 minutes
3. **Action**: Email/SMS to admin team

---

### **Related Notes**
- [[Indexes]] (for schema design)
- [[Indexers]] (for data ingestion)
- [[DataSources]] (for connecting to data)
- [[Skillsets]] (for AI enrichment)
- [[SynonymMaps]] (for query expansion)
- [[KnowledgeAgents]] (for agentic retrieval)

---
### **Sources**
- [[Azure Search Service Data Plane Preview Specification 2025-08-01]]
- [[Manage using REST - Azure AI Search]]
- [[Indexers - Create Or Update - REST API (Azure Search Service)]]
- [[Indexes - Create Or Update - REST API (Azure Search Service)]]
- [[SearchServiceClientAPISpec]]
- [[VS Code REST Client File for Creating and Updating Azure AI Search Resources]]
- [[Quick Reference Azure AI Search REST API Skillset Guide]]

---
Would you like me to save this as a note in your vault titled **[[SearchService_Utilities]]**?

#### Sources:
- [[Azure Search Service Data Plane Preview Specification 2025-08-01]]
- [[Manage using REST - Azure AI Search]]
- [[Indexers - Create Or Update - REST API (Azure Search Service)]]
- [[Indexes - Create Or Update - REST API (Azure Search Service)]]
- [[SearchServiceClientAPISpec]]
- [[VS Code REST Client File for Creating and Updating Azure AI Search Resources]]
- [[Quick Reference Azure AI Search REST API Skillset Guide]]
- [[Class Constructor and Methods Overview]]
- [[IndexTools.ts]]
- [[index.ts]]
- [[tool-usage-analytics-guru-profile]]
- [[MCP Architecture Component Overview]]
- [[Core Tool Categories and Roles in MCP Architecture]]

#### Sources:

- [[azure-search]]
- [[MCP Architecture Component Overview]]
- [[Core Tool Categories and Roles in MCP Architecture]]
- [[prompt-engineer]]
- [[mcp-expert-agent-azure-ai-search-rag-code-tools]]
- [[Rewrite queries with semantic ranker in Azure AI Search - Azure AI Search 1]]
- [[codebase_search  Roo Code Documentation]]
- [[Build an agentic retrieval solution - Azure AI Search]]
- [[IndexTools.ts]]
- [[mcp-testing-engineer-azure-ai-search-rag-debug-validation]]
- [[tool-usage-analytics-guru-profile]]
- [[index.ts]]
- [[Class Constructor and Methods Overview]]