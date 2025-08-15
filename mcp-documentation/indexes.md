### **[[Search Documentation/Indexes|Indexes]]**
**Created**: 2025-08-11
**Modified**: 2025-08-11
**Tags**: `#azure-ai-search`, `#rest-api`, `#indexes`

---

### **What This Covers**
This note provides a **comprehensive guide** to managing **Azure AI Search indexes** via REST API, including:
- **CRUD operations**: Create, update, delete, get, and list indexes.
- **Utilities**: Get index statistics, test analyzers.
- **Best practices**: Concurrency control, downtime handling, and vector search configurations.

---

### **Endpoints**
| **Operation**        | **Endpoint**                             | **HTTP Method** |
| -------------------- | ---------------------------------------- | --------------- |
| Create Index         | `/indexes`                               | `POST`          |
| List Indexes         | `/indexes`                               | `GET`           |
| Get Index            | `/indexes('{indexName}')`                | `GET`           |
| Update Index         | `/indexes('{indexName}')`                | `PUT`           |
| Delete Index         | `/indexes('{indexName}')`                | `DELETE`        |
| Get Index Statistics | `/indexes('{indexName}')/search.stats`   | `GET`           |
| Test Analyzer        | `/indexes('{indexName}')/search.analyze` | `POST`          |

---

### **Key Tips**
1. **Downtime Handling**:
   Use `allowIndexDowntime=true` when updating an index to add new analyzers/tokenizers/filters. This takes the index offline briefly.
   ```bash
   PUT /indexes('my-index')?allowIndexDowntime=true&api-version=2025-08-01-preview
   ```

2. **Concurrency Control**:
   - Use `If-Match` with `@odata.etag` for safe updates/deletes.
   - Use `Prefer: return=representation` with `PUT` to get the updated index definition in the response.

3. **Vector Search**:
   - Define `vectorSearch` profiles with algorithms (e.g., `hnsw`), vectorizers (e.g., `azureOpenAI`), and compression options.
   - Example metrics: `cosine`, `euclidean`, `dotProduct`.

4. **Semantic Search**:
   Configure `semantic` settings with `prioritizedFields` for title, content, and keywords.

---

### **Minimal SearchIndex JSON Skeleton**
```json
{
  "name": "my-index",
  "fields": [
    {
      "name": "id",
      "type": "Edm.String",
      "key": true,
      "filterable": true,
      "sortable": true,
      "retrievable": true
    },
    {
      "name": "content",
      "type": "Edm.String",
      "searchable": true,
      "retrievable": true,
      "analyzer": "en.lucene"
    },
    {
      "name": "embedding",
      "type": "Collection(Edm.Single)",
      "dimensions": 1536,
      "vectorSearchProfile": "my-vector-profile",
      "retrievable": false
    }
  ],
  "similarity": {
    "@odata.type": "#Microsoft.Azure.Search.BM25Similarity",
    "k1": 1.2,
    "b": 0.75
  },
  "semantic": {
    "defaultConfiguration": "my-semantic-config",
    "configurations": [
      {
        "name": "my-semantic-config",
        "prioritizedFields": {
          "titleField": { "fieldName": "title" },
          "prioritizedContentFields": [{ "fieldName": "content" }]
        }
      }
    ]
  },
  "vectorSearch": {
    "algorithms": [
      {
        "name": "my-hnsw",
        "kind": "hnsw",
        "hnswParameters": {
          "metric": "cosine",
          "m": 4,
          "efConstruction": 400,
          "efSearch": 500
        }
      }
    ],
    "vectorizers": [
      {
        "name": "my-vectorizer",
        "kind": "azureOpenAI",
        "azureOpenAIParameters": {
          "resourceUri": "https://my-aoai.openai.azure.com",
          "deploymentId": "text-embedding-3-small",
          "modelName": "text-embedding-3-small"
        }
      }
    ],
    "profiles": [
      {
        "name": "my-vector-profile",
        "algorithm": "my-hnsw",
        "vectorizer": "my-vectorizer"
      }
    ]
  }
}
```

---

### **cURL Examples**
#### **1. Create an Index**
```bash
curl -X POST "https://[your-service].search.windows.net/indexes?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-admin-key]" \
  -d @index.json
```

#### **2. Update an Index (with Downtime Allowed)**
```bash
curl -X PUT "https://[your-service].search.windows.net/indexes('my-index')?allowIndexDowntime=true&api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-admin-key]" \
  -H "Prefer: return=representation" \
  -d @index.json
```

#### **3. Get an Index**
```bash
curl "https://[your-service].search.windows.net/indexes('my-index')?api-version=2025-08-01-preview" \
  -H "api-key: [your-admin-key]"
```

#### **4. List Indexes (Select Specific Fields)**
```bash
curl "https://[your-service].search.windows.net/indexes?api-version=2025-08-01-preview&$select=name,fields" \
  -H "api-key: [your-admin-key]"
```

#### **5. Delete an Index (with ETag)**
```bash
curl -X DELETE "https://[your-service].search.windows.net/indexes('my-index')?api-version=2025-08-01-preview" \
  -H "api-key: [your-admin-key]" \
  -H "If-Match: \"[etag-value]\""  # Replace with the index's ETag
```

#### **6. Get Index Statistics**
```bash
curl "https://[your-service].search.windows.net/indexes('my-index')/search.stats?api-version=2025-08-01-preview" \
  -H "api-key: [your-admin-key]"
```

#### **7. Test an Analyzer**
```bash
curl -X POST "https://[your-service].search.windows.net/indexes('my-index')/search.analyze?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-admin-key]" \
  -d '{
    "text": "The quick brown fox",
    "analyzer": "en.lucene"
  }'
```

---

### **Definitions and Concepts**
#### **1. Index Fields**
- **Key Field**: Must be `Edm.String` and marked with `"key": true`. Used as the document identifier.
- **Vector Fields**: Require `dimensions`, `vectorSearchProfile`, and typically `type: "Collection(Edm.Single)"`.
- **Searchable Fields**: Enable full-text search with `searchable: true` and specify an `analyzer`.

#### **2. Similarity Algorithms**
- **ClassicSimilarity**: Default (TF-IDF).
- **BM25Similarity**: Tunable with `k1` and `b` parameters (better for short fields).

#### **3. Semantic Search**
- **Prioritized Fields**: Define `titleField`, `prioritizedContentFields`, and `prioritizedKeywordsFields` to guide semantic ranking.
- **Ranking Order**: Options like `BoostedRerankerScore` or `Default`.

#### **4. Vector Search**
- **Algorithms**:
  - `hnsw` (Hierarchical Navigable Small World) for approximate nearest neighbor search.
  - Metrics: `cosine`, `euclidean`, `dotProduct`.
- **Vectorizers**:
  - `azureOpenAI`: Integrates with Azure OpenAI embeddings.
  - `customWebApi`: For custom embedding models.
- **Compression**:
  - `scalarQuantization`: Reduces vector size (e.g., `int8`).
  - `binaryQuantization`: Further compression with binary vectors.

---

### **Best Practices**
1. **Avoid Downtime**:
   - Use `allowIndexDowntime=true` only when necessary (e.g., adding analyzers).
   - For structural changes (e.g., field type changes), consider creating a new index and reindexing.

2. **ETag Handling**:
   - Always include `If-Match` with the current `@odata.etag` for updates/deletes to avoid conflicts.

3. **Vector Search Optimization**:
   - Choose `efConstruction` and `efSearch` based on recall/performance tradeoffs.
   - Use `compression` to reduce storage costs for large vectors.

4. **Index Design**:
   - Use `retrievable: false` for vector fields to save storage (vectors are not returned in search results by default).
   - Limit the number of `facetable` fields to improve query performance.

5. **Testing**:
   - Use the **Analyze API** to verify tokenization before finalizing the index schema.
   - Test semantic configurations with sample queries to validate ranking behavior.

---

### **Troubleshooting**
| **Issue**                          | **Solution**                                                                 |
|------------------------------------|-----------------------------------------------------------------------------|
| `409 Conflict` on index creation   | Ensure the index name is unique.                                           |
| `412 Precondition Failed`          | Verify the `If-Match` ETag is correct.                                     |
| Slow queries with vector search    | Adjust `efSearch` or reduce vector dimensions.                            |
| Analyzer not working as expected  | Test with the **Analyze API** and check the tokenizer/filters.             |
| Index update fails                 | Use `allowIndexDowntime=true` if adding analyzers/tokenizers.              |

---

### **Related Notes**
- [[Indexers]] (for data ingestion pipelines)
- [[DataSources]] (for connecting to Azure Blob, SQL, etc.)
- [[Skillsets]] (for AI enrichment)
- [[SearchService_Utilities]] (for service-level operations)

---
**Sources**:
- [[Indexes - Create Or Update - REST API (Azure Search Service)]]
- [[Search index overview - Azure AI Search 1]]
- [[Azure Search Service Data Plane Preview Specification 2025-08-01]]

---
Would you like me to save this as a note in your vault titled **[[Indexes]]**?

#### Sources:

- [[Indexes - Create Or Update - REST API (Azure Search Service)]]
- [[Indexes - Create - REST API (Azure Search Service)]]
- [[Azure Search Service Data Plane Preview Specification 2025-08-01]]
- [[Search index overview - Azure AI Search 1]]
- [[Update or rebuild an index - Azure AI Search]]