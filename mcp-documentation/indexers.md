Here’s the complete **[[Indexers]]** note, structured for clarity and ready to use in your Obsidian vault:

---

### **[[Indexers]]**
**Created**: 2025-08-11
**Modified**: 2025-08-11
**Tags**: `#azure-ai-search`, `#rest-api`, `#indexers`, `#data-ingestion`

---

### **What This Covers**
This note provides a **comprehensive guide** to managing **Azure AI Search indexers** via REST API, including:
- **CRUD operations**: Create, update, delete, get, and list indexers.
- **Actions**: Run, reset, reset documents, resync, and monitor status.
- **Best practices**: Scheduling, error handling, and field mappings.

---

### **Endpoints**
| **Operation**                     | **Endpoint**                                      | **HTTP Method** |
|-----------------------------------|--------------------------------------------------|----------------|
| Create Indexer                    | `/indexers`                                      | `POST`         |
| List Indexers                     | `/indexers`                                      | `GET`          |
| Get Indexer                        | `/indexers('{indexerName}')`                    | `GET`          |
| Update Indexer                    | `/indexers('{indexerName}')`                    | `PUT`          |
| Delete Indexer                    | `/indexers('{indexerName}')`                    | `DELETE`       |
| Run Indexer                       | `/indexers('{indexerName}')/search.run`         | `POST`         |
| Reset Indexer                     | `/indexers('{indexerName}')/search.reset`       | `POST`         |
| Reset Documents                   | `/indexers('{indexerName}')/search.resetdocs`   | `POST`         |
| Resync Indexer                    | `/indexers('{indexerName}')/search.resync`      | `POST`         |
| Get Indexer Status                | `/indexers('{indexerName}')/search.status`      | `GET`          |

---

### **Key Tips**
1. **Scheduling**:
   - Use `schedule` to automate indexer runs (e.g., hourly/daily).
   - Example: `"schedule": { "interval": "PT1H", "startTime": "2025-01-01T00:00:00Z" }`.

2. **Error Handling**:
   - Set `maxFailedItems` and `maxFailedItemsPerBatch` to control tolerance for errors.
   - Use `-1` to ignore all errors (for testing only).

3. **Field Mappings**:
   - **`fieldMappings`**: Map source fields to target index fields *before* skillset execution.
   - **`outputFieldMappings`**: Map enriched outputs (from skills) to index fields *after* skillset execution.

4. **Execution Environment**:
   - Use `"executionEnvironment": "private"` for Standard2+ services to isolate processing.

5. **Concurrency Control**:
   - Use `If-Match` with `@odata.etag` for safe updates/deletes.
   - Use `Prefer: return=representation` with `PUT` to return the updated indexer definition.

---

### **SearchIndexer JSON Skeleton**
```json
{
  "name": "my-indexer",
  "description": "Indexer for AI-enriched content",
  "dataSourceName": "my-datasource",
  "targetIndexName": "my-index",
  "skillsetName": "my-skillset",
  "schedule": {
    "interval": "PT1H",
    "startTime": "2025-01-01T00:00:00Z"
  },
  "parameters": {
    "batchSize": 50,
    "maxFailedItems": 0,
    "maxFailedItemsPerBatch": 0,
    "configuration": {
      "parsingMode": "json",
      "executionEnvironment": "standard",
      "dataToExtract": "contentAndMetadata",
      "imageAction": "generateNormalizedImages"
    }
  },
  "fieldMappings": [
    {
      "sourceFieldName": "metadata_storage_path",
      "targetFieldName": "id",
      "mappingFunction": { "name": "base64Encode" }
    }
  ],
  "outputFieldMappings": [
    {
      "sourceFieldName": "/document/merged_text",
      "targetFieldName": "content"
    },
    {
      "sourceFieldName": "/document/organizations",
      "targetFieldName": "organizations"
    }
  ],
  "disabled": false,
  "encryptionKey": {
    "keyVaultKeyName": "my-key",
    "keyVaultUri": "https://my-vault.vault.azure.net"
  }
}
```

---

### **cURL Examples**
#### **1. Create an Indexer**
```bash
curl -X POST "https://[your-service].search.windows.net/indexers?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-admin-key]" \
  -d @indexer.json
```

#### **2. Update an Indexer (with ETag)**
```bash
curl -X PUT "https://[your-service].search.windows.net/indexers('my-indexer')?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-admin-key]" \
  -H "Prefer: return=representation" \
  -H "If-Match: \"[etag-value]\"" \
  -d @indexer.json
```

#### **3. Run an Indexer On-Demand**
```bash
curl -X POST "https://[your-service].search.windows.net/indexers('my-indexer')/search.run?api-version=2025-08-01-preview" \
  -H "api-key: [your-admin-key]"
```

#### **4. Reset All Change Tracking**
```bash
curl -X POST "https://[your-service].search.windows.net/indexers('my-indexer')/search.reset?api-version=2025-08-01-preview" \
  -H "api-key: [your-admin-key]"
```

#### **5. Reset Specific Documents**
```bash
curl -X POST "https://[your-service].search.windows.net/indexers('my-indexer')/search.resetdocs?api-version=2025-08-01-preview&overwrite=true" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-admin-key]" \
  -d '{
    "documentKeys": ["doc1", "doc2"],
    "datasourceDocumentIds": ["id1", "id2"]
  }'
```

#### **6. Resync Pre-Defined Options (e.g., Permissions)**
```bash
curl -X POST "https://[your-service].search.windows.net/indexers('my-indexer')/search.resync?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-admin-key]" \
  -d '{
    "options": ["permissions"]
  }'
```

#### **7. Get Indexer Status**
```bash
curl "https://[your-service].search.windows.net/indexers('my-indexer')/search.status?api-version=2025-08-01-preview" \
  -H "api-key: [your-admin-key]"
```

#### **8. List Indexers**
```bash
curl "https://[your-service].search.windows.net/indexers?api-version=2025-08-01-preview&$select=name,status" \
  -H "api-key: [your-admin-key]"
```

#### **9. Delete an Indexer (with ETag)**
```bash
curl -X DELETE "https://[your-service].search.windows.net/indexers('my-indexer')?api-version=2025-08-01-preview" \
  -H "api-key: [your-admin-key]" \
  -H "If-Match: \"[etag-value]\""  # Replace with the indexer's ETag
```

---

### **Definitions and Concepts**
#### **1. Indexer Components**
| **Component**          | **Description**                                                                 |
|------------------------|---------------------------------------------------------------------------------|
| `dataSourceName`       | Name of the connected data source (e.g., Azure Blob, SQL).                     |
| `targetIndexName`      | Name of the target search index.                                               |
| `skillsetName`         | Name of the skillset for AI enrichment (optional).                             |
| `fieldMappings`        | Maps source fields to index fields *before* skillset execution.                |
| `outputFieldMappings`  | Maps enriched outputs to index fields *after* skillset execution.             |
| `schedule`             | Defines automatic runs (e.g., hourly/daily).                                   |
| `parameters`           | Controls batch size, error handling, and execution environment.               |

#### **2. Execution Modes**
- **`indexingAllDocs`**: Full reindexing (default on creation).
- **`incremental`**: Processes only new/changed documents (requires change detection).
- **`reset`**: Clears internal state (e.g., high-water mark) for full reindexing.

#### **3. Change Detection**
- **Azure Blob Storage**: Uses `LastModified` timestamps.
- **Azure SQL**: Supports SQL integrated change tracking or timestamps.
- **Reset APIs**: Use `/search.reset` to clear tracking state.

#### **4. Error Handling**
- **`maxFailedItems`**: Total failures allowed before aborting the job.
- **`maxFailedItemsPerBatch`**: Failures allowed per batch.
- **Warnings**: Non-fatal issues (e.g., unprocessable files) are logged but don’t stop the job.

---

### **Best Practices**
1. **Field Mappings**:
   - Use `base64Encode` for binary fields (e.g., `metadata_storage_path`).
   - Ensure `targetFieldName` matches the index schema.

2. **Performance**:
   - Adjust `batchSize` (default: 10) based on document size/complexity.
   - For large datasets, use `executionEnvironment: "private"` (Standard2+).

3. **Monitoring**:
   - Check `/search.status` for `itemsProcessed`, `itemsFailed`, and `warnings`.
   - Use `disabled: true` to pause an indexer without deleting it.

4. **Security**:
   - Use **managed identities** for data source connections (avoid hardcoded credentials).
   - Encrypt sensitive indexer definitions with `encryptionKey`.

5. **Incremental Indexing**:
   - Enable change detection on the data source.
   - Use `/search.resetdocs` to reprocess specific documents.

---

### **Troubleshooting**
| **Issue**                          | **Solution**                                                                 |
|------------------------------------|-----------------------------------------------------------------------------|
| `409 Conflict` on creation         | Ensure the indexer name is unique.                                         |
| `412 Precondition Failed`          | Verify the `If-Match` ETag is correct.                                     |
| Indexer stuck in `running` state   | Check `/search.status` for errors or warnings.                           |
| No documents processed             | Verify `dataToExtract` and field mappings.                                |
| Skillset failures                  | Test the skillset independently; check `outputFieldMappings`.              |
| Permission errors                  | Ensure the search service’s managed identity has access to the data source.|

---

### **Examples by Scenario**
#### **1. Content-Only Indexing (No Skillset)**
```json
{
  "name": "content-only-indexer",
  "dataSourceName": "my-blob-datasource",
  "targetIndexName": "my-content-index",
  "parameters": {
    "configuration": {
      "indexedFileNameExtensions": ".pdf,.docx"
    }
  }
}
```

#### **2. AI-Enriched Indexing (With Skillset)**
```json
{
  "name": "ai-indexer",
  "dataSourceName": "my-blob-datasource",
  "targetIndexName": "my-ai-index",
  "skillsetName": "my-skillset",
  "outputFieldMappings": [
    { "sourceFieldName": "/document/merged_text", "targetFieldName": "content" },
    { "sourceFieldName": "/document/organizations", "targetFieldName": "orgs" }
  ],
  "parameters": {
    "configuration": {
      "dataToExtract": "contentAndMetadata",
      "imageAction": "generateNormalizedImages"
    }
  }
}
```

#### **3. Scheduled Indexer (Hourly)**
```json
{
  "name": "hourly-indexer",
  "dataSourceName": "my-sql-datasource",
  "targetIndexName": "my-sql-index",
  "schedule": {
    "interval": "PT1H",
    "startTime": "2025-01-01T00:00:00Z"
  }
}
```

---

### **Related Notes**
- [[Indexes]] (for target index schemas)
- [[DataSources]] (for connecting to Azure Blob, SQL, etc.)
- [[Skillsets]] (for AI enrichment pipelines)
- [[SearchService_Utilities]] (for service-level operations)

---
### **Sources**
- [[Indexers - Create Or Update - REST API (Azure Search Service)]]
- [[Create an indexer - Azure AI Search]]
- [[Indexer overview - Azure AI Search]]
- [[Tutorial - Skillsets - Azure AI Search]]
- [[Azure Search Service Data Plane Preview Specification 2025-08-01]]

---
Would you like me to save this as a note in your vault titled **[[Indexers]]**?

#### Sources:

- [[Create an indexer - Azure AI Search]]
- [[VS Code REST Client File for Creating and Updating Azure AI Search Resources]]
- [[Indexer overview - Azure AI Search]]
- [[Indexers - Create Or Update - REST API (Azure Search Service)]]
- [[Tutorial -  Skillsets - Azure AI Search]]
- [[Azure Search Service Data Plane Preview Specification 2025-08-01]]
- [[Indexers - Get Status - REST API (Azure Search Service)]]