Here’s the complete **[[DataSources]]** note, structured for clarity and ready to use in your Obsidian vault:

---

### **[[DataSources]]**
**Created**: 2025-08-11
**Modified**: 2025-08-11
**Tags**: `#azure-ai-search`, `#rest-api`, `#datasources`, `#azure-blob`, `#azure-sql`, `#cosmosdb`

---

### **What This Covers**
This note provides a **comprehensive guide** to managing **Azure AI Search data sources** via REST API, including:
- **CRUD operations**: Create, update, delete, get, and list data sources.
- **Supported types**: Azure Blob, Azure SQL, Cosmos DB, ADLS Gen2, and more.
- **Advanced features**: Change detection, deletion policies, managed identities, and encryption.

---

### **Endpoints**
| **Operation**               | **Endpoint**                                      | **HTTP Method** |
|-----------------------------|--------------------------------------------------|----------------|
| Create Data Source          | `/datasources`                                   | `POST`         |
| List Data Sources           | `/datasources`                                   | `GET`          |
| Get Data Source              | `/datasources('{dataSourceName}')`              | `GET`          |
| Update Data Source          | `/datasources('{dataSourceName}')`              | `PUT`          |
| Delete Data Source          | `/datasources('{dataSourceName}')`              | `DELETE`       |

---

### **Key Tips**
1. **Change Detection**:
   - **Azure Blob**: Uses `LastModified` timestamps automatically.
   - **Azure SQL/Cosmos DB**: Requires explicit policies (e.g., `HighWaterMarkChangeDetectionPolicy`).
   - Reset tracking with `/indexers('{name}')/search.reset`.

2. **Deletion Policies**:
   - Use `SoftDeleteColumnDeletionDetectionPolicy` for soft-deleted records.
   - Example: `"softDeleteColumnName": "IsDeleted", "softDeleteMarkerValue": "true"`.

3. **Managed Identities**:
   - Replace connection strings with `@odata.type: "#Microsoft.Azure.Search.DataUserAssignedIdentity"`.
   - Example:
     ```json
     "identity": {
       "@odata.type": "#Microsoft.Azure.Search.DataUserAssignedIdentity",
       "userAssignedIdentity": "/subscriptions/.../resourceGroups/.../providers/Microsoft.ManagedIdentity/userAssignedIdentities/myId"
     }
     ```

4. **Encryption**:
   - Use `encryptionKey` with Azure Key Vault for customer-managed keys (CMK).
   - Requires `keyVaultUri`, `keyVaultKeyName`, and `keyVaultKeyVersion`.

5. **Concurrency Control**:
   - Use `If-Match` with `@odata.etag` for safe updates/deletes.
   - Use `Prefer: return=representation` with `PUT` to return the updated data source.

---

### **SearchIndexerDataSource JSON Examples**
#### **1. Azure Blob Storage**
```json
{
  "name": "blob-ds",
  "type": "azureblob",
  "description": "Data source for PDF/DOCX files in Azure Blob Storage",
  "credentials": {
    "connectionString": "DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=mykey;EndpointSuffix=core.windows.net"
  },
  "container": {
    "name": "docs",
    "query": null
  },
  "dataChangeDetectionPolicy": {
    "@odata.type": "#Microsoft.Azure.Search.HighWaterMarkChangeDetectionPolicy",
    "highWaterMarkColumnName": "LastModified"
  },
  "dataDeletionDetectionPolicy": {
    "@odata.type": "#Microsoft.Azure.Search.NativeBlobSoftDeleteDeletionDetectionPolicy"
  },
  "identity": {
    "@odata.type": "#Microsoft.Azure.Search.DataNoneIdentity"
  },
  "encryptionKey": {
    "keyVaultKeyName": "my-key",
    "keyVaultKeyVersion": "1234567890abcdef",
    "keyVaultUri": "https://my-vault.vault.azure.net",
    "identity": {
      "@odata.type": "#Microsoft.Azure.Search.DataUserAssignedIdentity",
      "userAssignedIdentity": "/subscriptions/.../resourceGroups/.../providers/Microsoft.ManagedIdentity/userAssignedIdentities/myId"
    }
  }
}
```

#### **2. Azure SQL Database**
```json
{
  "name": "sql-ds",
  "type": "azuresql",
  "description": "Data source for Products table in Azure SQL",
  "credentials": {
    "connectionString": "Server=tcp:myserver.database.windows.net,1433;Database=mydb;User ID=myuser;Password=mypassword;Encrypt=true;"
  },
  "container": {
    "name": "dbo.Products",
    "query": null
  },
  "dataChangeDetectionPolicy": {
    "@odata.type": "#Microsoft.Azure.Search.SqlIntegratedChangeTrackingPolicy"
  },
  "indexerPermissionOptions": ["userIds", "groupIds"]
}
```

#### **3. Cosmos DB (NoSQL)**
```json
{
  "name": "cosmos-ds",
  "type": "cosmosdb",
  "description": "Data source for Cosmos DB container",
  "credentials": {
    "connectionString": "AccountEndpoint=https://mycosmos.documents.azure.com;AccountKey=mykey;Database=mydb;"
  },
  "container": {
    "name": "mycontainer",
    "query": "SELECT * FROM c WHERE c._ts > @HighWaterMark"
  },
  "dataChangeDetectionPolicy": {
    "@odata.type": "#Microsoft.Azure.Search.HighWaterMarkChangeDetectionPolicy",
    "highWaterMarkColumnName": "_ts"
  }
}
```

#### **4. ADLS Gen2**
```json
{
  "name": "adls-ds",
  "type": "adlsgen2",
  "description": "Data source for ADLS Gen2 files",
  "credentials": {
    "connectionString": "DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=mykey;EndpointSuffix=core.windows.net"
  },
  "container": {
    "name": "mycontainer",
    "query": "folder_path = 'docs'"
  },
  "dataDeletionDetectionPolicy": {
    "@odata.type": "#Microsoft.Azure.Search.SoftDeleteColumnDeletionDetectionPolicy",
    "softDeleteColumnName": "isDeleted",
    "softDeleteMarkerValue": "true"
  }
}
```

---

### **cURL Examples**
#### **1. Create a Data Source**
```bash
curl -X POST "https://[your-service].search.windows.net/datasources?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-admin-key]" \
  -d @datasource.json
```

#### **2. Update a Data Source (with ETag)**
```bash
curl -X PUT "https://[your-service].search.windows.net/datasources('blob-ds')?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-admin-key]" \
  -H "Prefer: return=representation" \
  -H "If-Match: \"[etag-value]\"" \
  -d @datasource.json
```

#### **3. Get a Data Source**
```bash
curl "https://[your-service].search.windows.net/datasources('blob-ds')?api-version=2025-08-01-preview" \
  -H "api-key: [your-admin-key]"
```

#### **4. List Data Sources (Select Specific Fields)**
```bash
curl "https://[your-service].search.windows.net/datasources?api-version=2025-08-01-preview&$select=name,type,container" \
  -H "api-key: [your-admin-key]"
```

#### **5. Delete a Data Source (with ETag)**
```bash
curl -X DELETE "https://[your-service].search.windows.net/datasources('blob-ds')?api-version=2025-08-01-preview" \
  -H "api-key: [your-admin-key]" \
  -H "If-Match: \"[etag-value]\""  # Replace with the data source's ETag
```

---

### **Definitions and Concepts**
#### **1. Data Source Types**
| **Type**          | **Description**                                                                 | **Change Detection**                          |
|-------------------|---------------------------------------------------------------------------------|-----------------------------------------------|
| `azureblob`       | Azure Blob Storage containers.                                                  | Automatic (`LastModified`).                  |
| `azuresql`        | Azure SQL Database tables/views.                                                | SQL Integrated Change Tracking or timestamps.|
| `cosmosdb`        | Azure Cosmos DB containers.                                                     | `_ts` (timestamp) or custom queries.         |
| `adlsgen2`        | Azure Data Lake Storage Gen2.                                                   | Automatic (`LastModified`).                  |
| `mysql`           | Azure Database for MySQL.                                                       | Timestamps or binlog.                         |
| `azuretable`      | Azure Table Storage.                                                            | Automatic (`Timestamp`).                      |
| `onelake`         | Microsoft Fabric OneLake.                                                       | Automatic.                                    |

#### **2. Credentials**
- **Connection String**: For most data sources (e.g., Blob, SQL, Cosmos DB).
  - Example (Blob):
    ```json
    "credentials": {
      "connectionString": "DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=mykey;EndpointSuffix=core.windows.net"
    }
    ```
- **Managed Identity**: Replace credentials with `@odata.type: "#Microsoft.Azure.Search.DataUserAssignedIdentity"`.
  - Requires assigning the identity to the search service.

#### **3. Change Detection Policies**
| **Policy**                                | **Description**                                                                 | **Example**                                  |
|------------------------------------------|---------------------------------------------------------------------------------|----------------------------------------------|
| `HighWaterMarkChangeDetectionPolicy`     | Tracks changes using a timestamp or version column.                         | `"highWaterMarkColumnName": "LastModified"`  |
| `SqlIntegratedChangeTrackingPolicy`      | Uses SQL Server’s change tracking.                                            | `@odata.type: "#Microsoft.Azure.Search.SqlIntegratedChangeTrackingPolicy"` |
| `NativeBlobSoftDeleteDeletionDetectionPolicy` | Detects deletions using Blob Storage’s soft delete.                     | `@odata.type: "#Microsoft.Azure.Search.NativeBlobSoftDeleteDeletionDetectionPolicy"` |
| `SoftDeleteColumnDeletionDetectionPolicy` | Detects deletions using a soft-delete column.                              | `"softDeleteColumnName": "IsDeleted"`         |

#### **4. Container**
- **Name**: The table, collection, or container name (e.g., `dbo.Products`, `mycontainer`).
- **Query**: Optional filter (e.g., `folder_path = 'docs'` for ADLS Gen2).

#### **5. Encryption**
- **Customer-Managed Keys (CMK)**: Encrypt data source definitions using Azure Key Vault.
  - Requires:
    ```json
    "encryptionKey": {
      "keyVaultKeyName": "my-key",
      "keyVaultKeyVersion": "1234567890abcdef",
      "keyVaultUri": "https://my-vault.vault.azure.net",
      "identity": { ... }
    }
    ```

---

### **Best Practices**
1. **Connection Strings**:
   - Store secrets in **Azure Key Vault** and use managed identities.
   - Avoid hardcoding credentials in JSON files.

2. **Change Detection**:
   - For **Azure SQL**, use `SqlIntegratedChangeTrackingPolicy` for efficiency.
   - For **Cosmos DB**, use `_ts` (timestamp) or custom queries.

3. **Deletion Policies**:
   - Use `SoftDeleteColumnDeletionDetectionPolicy` for logical deletes.
   - For **Blob Storage**, use `NativeBlobSoftDeleteDeletionDetectionPolicy`.

4. **Performance**:
   - Limit the scope of `container.query` to reduce data volume.
   - Use **managed identities** to avoid connection string rotation issues.

5. **Security**:
   - Restrict data source access using **private endpoints** or **firewall rules**.
   - Audit permissions with `indexerPermissionOptions` (e.g., `userIds`, `groupIds`).

---

### **Troubleshooting**
| **Issue**                          | **Solution**                                                                 |
|------------------------------------|-----------------------------------------------------------------------------|
| `400 Bad Request`                  | Validate the `type` and `container` fields.                                |
| `403 Forbidden`                    | Check credentials or managed identity permissions.                       |
| `409 Conflict`                     | Ensure the data source name is unique.                                      |
| `412 Precondition Failed`          | Verify the `If-Match` ETag is correct.                                     |
| No documents indexed               | Check `dataChangeDetectionPolicy` and `container.query`.                 |
| Slow indexing                      | Reduce batch size or optimize the data source query.                      |

---

### **Examples by Scenario**
#### **1. Blob Storage with Soft Delete**
```json
{
  "name": "blob-with-softdelete",
  "type": "azureblob",
  "credentials": { "connectionString": "..." },
  "container": { "name": "docs" },
  "dataDeletionDetectionPolicy": {
    "@odata.type": "#Microsoft.Azure.Search.NativeBlobSoftDeleteDeletionDetectionPolicy"
  }
}
```

#### **2. SQL with Change Tracking**
```json
{
  "name": "sql-with-changetracking",
  "type": "azuresql",
  "credentials": { "connectionString": "..." },
  "container": { "name": "dbo.Products" },
  "dataChangeDetectionPolicy": {
    "@odata.type": "#Microsoft.Azure.Search.SqlIntegratedChangeTrackingPolicy"
  }
}
```

#### **3. Cosmos DB with Managed Identity**
```json
{
  "name": "cosmos-with-mi",
  "type": "cosmosdb",
  "identity": {
    "@odata.type": "#Microsoft.Azure.Search.DataUserAssignedIdentity",
    "userAssignedIdentity": "/subscriptions/.../userAssignedIdentities/myId"
  },
  "container": { "name": "mycontainer" }
}
```

---

### **Related Notes**
- [[Indexes]] (for target index schemas)
- [[Indexers]] (for data ingestion pipelines)
- [[Skillsets]] (for AI enrichment)
- [[SearchService_Utilities]] (for service-level operations)

---
### **Sources**
- [[Data Sources - Create Or Update - REST API (Azure Search Service)]]
- [[Data Sources - Create - REST API (Azure Search Service)]]
- [[Azure Search Service Data Plane Preview Specification 2025-08-01]]
- [[Indexer overview - Azure AI Search]]
- [[Create an indexer - Azure AI Search]]
- [[VS Code REST Client File for Creating and Updating Azure AI Search Resources]]

---
Would you like me to save this as a note in your vault titled **[[DataSources]]**?

#### Sources:

- [[Data Sources - Create Or Update - REST API (Azure Search Service)]]
- [[Data Sources - Create - REST API (Azure Search Service)]]
- [[Azure Search Service Data Plane Preview Specification 2025-08-01]]
- [[Indexer overview - Azure AI Search]]
- [[Create an indexer - Azure AI Search]]
- [[VS Code REST Client File for Creating and Updating Azure AI Search Resources]]

#### Sources:

- [[Data Sources - Create Or Update - REST API (Azure Search Service)]]
- [[Data Sources - Create - REST API (Azure Search Service)]]
- [[Azure Search Service Data Plane Preview Specification 2025-08-01]]
- [[VS Code REST Client File for Creating and Updating Azure AI Search Resources]]
- [[Indexer overview - Azure AI Search]]
- [[Tutorial -  Skillsets - Azure AI Search]]
- [[Create an indexer - Azure AI Search]]