---

### **[[SynonymMaps]]**
**Created**: 2025-08-11
**Modified**: 2025-08-11
**Tags**: `#azure-ai-search`, `#rest-api`, `#synonym-maps`, `#query-expansion`, `#solr`

---

### **What This Covers**
This note provides a **comprehensive guide** to managing **Azure AI Search synonym maps** via REST API, including:
- **CRUD operations**: Create, update, delete, get, and list synonym maps.
- **Synonym formats**: Solr syntax for equivalent terms, one-way mappings, and explicit mappings.
- **Best practices**: Integration with search indexes, encryption, and concurrency control.

---

### **Endpoints**
| **Operation**               | **Endpoint**                                      | **HTTP Method** |
|-----------------------------|--------------------------------------------------|----------------|
| Create Synonym Map          | `/synonymmaps`                                   | `POST`         |
| List Synonym Maps           | `/synonymmaps`                                   | `GET`          |
| Get Synonym Map             | `/synonymmaps('{synonymMapName}')`              | `GET`          |
| Update Synonym Map          | `/synonymmaps('{synonymMapName}')`              | `PUT`          |
| Delete Synonym Map          | `/synonymmaps('{synonymMapName}')`              | `DELETE`       |

---

### **Key Tips**
1. **Solr Format**:
   - **Equivalent terms**: `usa, united states, u.s.a.` (all terms are expanded to each other).
   - **One-way mappings**: `wash. => washington` (maps "wash." to "washington" but not vice versa).
   - **Explicit mappings**: `ny, new york => nyc` (maps both "ny" and "new york" to "nyc").

2. **Integration with Indexes**:
   - Assign synonym maps to **searchable fields** in the index schema:
     ```json
     {
       "name": "description",
       "type": "Edm.String",
       "searchable": true,
       "synonymMaps": ["my-synonym-map"]
     }
     ```

3. **Encryption**:
   - Use **Azure Key Vault** for customer-managed keys (CMK) to encrypt synonym map definitions.
   - Example:
     ```json
     "encryptionKey": {
       "keyVaultKeyName": "my-key",
       "keyVaultKeyVersion": "1234567890abcdef",
       "keyVaultUri": "https://my-vault.vault.azure.net"
     }
     ```

4. **Concurrency Control**:
   - Use `If-Match` with `@odata.etag` for safe updates/deletes.
   - Use `Prefer: return=representation` with `PUT` to return the updated synonym map.

5. **Limitations**:
   - Only **one synonym map per field** is supported.
   - Synonym maps **do not apply to vector fields**.

---

### **SynonymMap JSON Skeleton**
```json
{
  "name": "my-synonym-map",
  "format": "solr",
  "description": "Synonyms for geographic terms and abbreviations",
  "synonyms": "
    # Equivalent terms
    usa, united states, u.s.a.
    ny, new york

    # One-way mappings
    wash. => washington
    nyc => new york city

    # Explicit mappings
    db, database
    ai, artificial intelligence
  ",
  "encryptionKey": {
    "keyVaultKeyName": "my-key",
    "keyVaultKeyVersion": "1234567890abcdef",
    "keyVaultUri": "https://my-vault.vault.azure.net",
    "accessCredentials": {
      "applicationId": "00000000-0000-0000-0000-000000000000",
      "applicationSecret": "your-secret"
    }
  }
}
```

---

### **cURL Examples**
#### **1. Create a Synonym Map**
```bash
curl -X POST "https://[your-service].search.windows.net/synonymmaps?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-admin-key]" \
  -d @synonym-map.json
```

#### **2. Update a Synonym Map (with ETag)**
```bash
curl -X PUT "https://[your-service].search.windows.net/synonymmaps('my-synonym-map')?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-admin-key]" \
  -H "Prefer: return=representation" \
  -H "If-Match: \"[etag-value]\"" \
  -d @synonym-map.json
```

#### **3. Get a Synonym Map**
```bash
curl "https://[your-service].search.windows.net/synonymmaps('my-synonym-map')?api-version=2025-08-01-preview" \
  -H "api-key: [your-admin-key]"
```

#### **4. List Synonym Maps (Select Specific Fields)**
```bash
curl "https://[your-service].search.windows.net/synonymmaps?api-version=2025-08-01-preview&$select=name,format" \
  -H "api-key: [your-admin-key]"
```

#### **5. Delete a Synonym Map (with ETag)**
```bash
curl -X DELETE "https://[your-service].search.windows.net/synonymmaps('my-synonym-map')?api-version=2025-08-01-preview" \
  -H "api-key: [your-admin-key]" \
  -H "If-Match: \"[etag-value]\""  # Replace with the synonym map's ETag
```

---

### **Definitions and Concepts**
#### **1. Solr Synonym Formats**
| **Format**               | **Example**                          | **Behavior**                                                                 |
|--------------------------|--------------------------------------|-----------------------------------------------------------------------------|
| Equivalent terms         | `usa, united states, u.s.a.`         | All terms are expanded to each other in queries.                           |
| One-way mapping          | `wash. => washington`               | "wash." is expanded to "washington" but not vice versa.                  |
| Explicit mapping         | `ny, new york => nyc`               | Both "ny" and "new york" are expanded to "nyc".                          |

#### **2. SynonymMap Properties**
| **Property**       | **Type**   | **Description**                                                                 |
|--------------------|------------|---------------------------------------------------------------------------------|
| `name`             | string     | Unique name of the synonym map.                                                 |
| `format`           | string     | Only `"solr"` is supported.                                                     |
| `synonyms`         | string     | Newline-separated synonym rules.                                               |
| `encryptionKey`    | object     | Customer-managed encryption key (Azure Key Vault).                             |
| `@odata.etag`      | string     | ETag for concurrency control.                                                  |

#### **3. Encryption Key**
- **Required Fields**:
  - `keyVaultKeyName`: Name of the key in Azure Key Vault.
  - `keyVaultKeyVersion`: Version of the key.
  - `keyVaultUri`: URI of the Key Vault (e.g., `https://my-vault.vault.azure.net`).
- **Optional**:
  - `accessCredentials`: Azure AD credentials for accessing the Key Vault.
  - `identity`: Managed identity for Key Vault access.

---

### **Best Practices**
1. **Synonym Design**:
   - Group related terms (e.g., geographic names, product aliases).
   - Avoid overly broad mappings (e.g., mapping "car" to "vehicle" may introduce noise).

2. **Testing**:
   - Test synonym maps with sample queries to validate expansion behavior.
   - Use the **Search Explorer** in the Azure Portal to verify results.

3. **Performance**:
   - Limit the number of synonym maps per index to **avoid query latency**.
   - Use **one synonym map per field** (current limitation).

4. **Encryption**:
   - Use **customer-managed keys (CMK)** for synonym maps containing sensitive terms.
   - Rotate keys periodically using `keyVaultKeyVersion`.

5. **Index Integration**:
   - Assign synonym maps to **searchable fields** only (not vector or numeric fields).
   - Example:
     ```json
     {
       "name": "product_name",
       "type": "Edm.String",
       "searchable": true,
       "synonymMaps": ["product-synonyms"]
     }
     ```

---

### **Troubleshooting**
| **Issue**                          | **Solution**                                                                 |
|------------------------------------|-----------------------------------------------------------------------------|
| `400 Bad Request`                  | Validate the `format` is `"solr"` and `synonyms` are properly formatted.   |
| `403 Forbidden`                    | Check the `api-key` or managed identity permissions.                     |
| `409 Conflict`                     | Ensure the synonym map name is unique.                                     |
| `412 Precondition Failed`          | Verify the `If-Match` ETag is correct.                                     |
| Synonyms not expanding in queries   | Confirm the synonym map is assigned to the field in the index schema.      |
| Slow queries with synonyms          | Reduce the number of synonym rules or maps.                               |

---

### **Examples by Scenario**
#### **1. Geographic Synonyms**
```json
{
  "name": "geo-synonyms",
  "format": "solr",
  "synonyms": "
    usa, united states, u.s.a.
    uk, united kingdom, great britain
    ny, new york
    la => los angeles
    sf => san francisco
  "
}
```

#### **2. Product Synonyms**
```json
{
  "name": "product-synonyms",
  "format": "solr",
  "synonyms": "
    iphone, apple phone
    galaxy, samsung phone
    macbook, macbook pro, macbook air
  "
}
```

#### **3. Technical Terms with Encryption**
```json
{
  "name": "tech-synonyms",
  "format": "solr",
  "synonyms": "
    ai, artificial intelligence
    ml, machine learning
    db, database
    api, application programming interface
  ",
  "encryptionKey": {
    "keyVaultKeyName": "my-key",
    "keyVaultKeyVersion": "1234567890abcdef",
    "keyVaultUri": "https://my-vault.vault.azure.net",
    "accessCredentials": {
      "applicationId": "00000000-0000-0000-0000-000000000000",
      "applicationSecret": "your-secret"
    }
  }
}
```

#### **4. Medical Terms**
```json
{
  "name": "medical-synonyms",
  "format": "solr",
  "synonyms": "
    bp, blood pressure
    hbp, high blood pressure
    diabetes, diabetes mellitus
    flu, influenza
  "
}
```

---

### **Integration with Indexes**
#### **1. Assigning Synonym Maps to Fields**
In your index schema, assign the synonym map to a **searchable field**:
```json
{
  "name": "my-index",
  "fields": [
    {
      "name": "description",
      "type": "Edm.String",
      "searchable": true,
      "synonymMaps": ["geo-synonyms", "product-synonyms"]
    }
  ]
}
```

#### **2. Testing Synonym Expansion**
Use the **Search API** to test synonym expansion:
```bash
curl "https://[your-service].search.windows.net/indexes('my-index')/docs/search?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-query-key]" \
  -d '{
    "search": "new york",
    "searchFields": ["description"],
    "select": "description"
  }'
```
**Expected**: Results for "new york" will also include documents containing "ny" or "nyc".

---

### **Related Notes**
- [[Indexes]] (for assigning synonym maps to fields)
- [[Indexers]] (for data ingestion pipelines)
- [[DataSources]] (for connecting to data sources)
- [[SearchService_Utilities]] (for service-level operations)

---
### **Sources**
- [[Synonym Maps - Create Or Update - REST API (Azure Search Service)]]
- [[Synonym Maps - Create - REST API (Azure Search Service)]]
- [[Azure Search Service Data Plane Preview Specification 2025-08-01]]
- [[Create a synonym map - Azure AI Search]]
- [[Synonyms in Azure AI Search]]