Here’s the complete **[[Skillsets]]** note, structured for clarity and ready to use in your Obsidian vault:

---

### **[[Skillsets]]**
**Created**: 2025-08-11
**Modified**: 2025-08-11
**Tags**: `#azure-ai-search`, `#rest-api`, `#skillsets`, `#ai-enrichment`, `#cognitive-services`

---

### **What This Covers**
This note provides a **comprehensive guide** to managing **Azure AI Search skillsets** via REST API, including:
- **CRUD operations**: Create, update, delete, get, and list skillsets.
- **Skill types**: Built-in (OCR, NLP, vision) and custom skills (Web API, Azure OpenAI).
- **Advanced features**: Cognitive Services integration, knowledge store projections, and encryption.
- **Execution patterns**: Chaining, branching, and context management.

---

### **Endpoints**
| **Operation**               | **Endpoint**                                      | **HTTP Method** |
|-----------------------------|--------------------------------------------------|----------------|
| Create Skillset             | `/skillsets`                                    | `POST`         |
| List Skillsets              | `/skillsets`                                    | `GET`          |
| Get Skillset                | `/skillsets('{skillsetName}')`                 | `GET`          |
| Update Skillset             | `/skillsets('{skillsetName}')`                 | `PUT`          |
| Delete Skillset             | `/skillsets('{skillsetName}')`                 | `DELETE`       |
| Reset Skills                | `/skillsets('{skillsetName}')/search.resetskills` | `POST`       |

---

### **Key Tips**
1. **Cognitive Services Integration**:
   - Attach an **Azure AI Services** resource for billable skills (e.g., OCR, entity recognition).
   - Use `DefaultCognitiveServicesAccount` for free tier (20 transactions/day).
   - Example:
     ```json
     "cognitiveServices": {
       "@odata.type": "#Microsoft.Azure.Search.CognitiveServicesAccountKey",
       "key": "your-cognitive-services-key"
     }
     ```

2. **Skill Chaining**:
   - Outputs from one skill can be inputs to another using **JSON paths** (e.g., `/document/pages/*`).
   - Example: `SplitSkill` → `KeyPhraseExtractionSkill`:
     ```json
     {
       "@odata.type": "#Microsoft.Skills.Text.KeyPhraseExtractionSkill",
       "context": "/document/pages/*",
       "inputs": [{ "name": "text", "source": "/document/pages/*" }]
     }
     ```

3. **Context Management**:
   - **`/document`**: Default context (runs once per document).
   - **`/document/pages/*`**: Runs once per page (e.g., after `SplitSkill`).
   - **`/document/normalized_images/*`**: Runs once per image.

4. **Knowledge Store**:
   - Project enriched data to **Azure Storage** (tables, blobs, files).
   - Example:
     ```json
     "knowledgeStore": {
       "storageConnectionString": "your-storage-connection-string",
       "projections": [
         {
           "tables": [{ "tableName": "KeyPhrases", "source": "/document/pages/*/keyPhrases" }],
           "objects": [],
           "files": []
         }
       ]
     }
     ```

5. **Concurrency Control**:
   - Use `If-Match` with `@odata.etag` for safe updates/deletes.
   - Use `Prefer: return=representation` with `PUT` to return the updated skillset.

6. **Custom Skills**:
   - Use `WebApiSkill` to call external APIs (e.g., Azure Functions, custom models).
   - Example:
     ```json
     {
       "@odata.type": "#Microsoft.Skills.Custom.WebApiSkill",
       "uri": "https://your-api.azurewebsites.net/api/analyze",
       "httpMethod": "POST",
       "inputs": [{ "name": "text", "source": "/document/content" }],
       "outputs": [{ "name": "result", "targetName": "customResult" }]
     }
     ```

---

### **SearchIndexerSkillset JSON Skeleton**
```json
{
  "name": "my-skillset",
  "description": "Skillset for OCR, text splitting, and entity recognition",
  "skills": [
    {
      "@odata.type": "#Microsoft.Skills.Vision.OcrSkill",
      "name": "ocr-skill",
      "context": "/document/normalized_images/*",
      "inputs": [{ "name": "image", "source": "/document/normalized_images/*" }],
      "outputs": [{ "name": "text", "targetName": "extractedText" }]
    },
    {
      "@odata.type": "#Microsoft.Skills.Text.SplitSkill",
      "name": "split-skill",
      "context": "/document",
      "textSplitMode": "pages",
      "maximumPageLength": 4000,
      "inputs": [{ "name": "text", "source": "/document/extractedText" }],
      "outputs": [{ "name": "textItems", "targetName": "pages" }]
    },
    {
      "@odata.type": "#Microsoft.Skills.Text.EntityRecognitionSkill",
      "name": "entity-skill",
      "context": "/document/pages/*",
      "categories": ["Organization", "Person"],
      "inputs": [{ "name": "text", "source": "/document/pages/*" }],
      "outputs": [
        { "name": "organizations", "targetName": "orgs" },
        { "name": "persons", "targetName": "people" }
      ]
    },
    {
      "@odata.type": "#Microsoft.Skills.Custom.WebApiSkill",
      "name": "custom-skill",
      "uri": "https://your-api.azurewebsites.net/api/analyze",
      "httpMethod": "POST",
      "inputs": [{ "name": "text", "source": "/document/content" }],
      "outputs": [{ "name": "result", "targetName": "customResult" }]
    }
  ],
  "cognitiveServices": {
    "@odata.type": "#Microsoft.Azure.Search.CognitiveServicesAccountKey",
    "key": "your-cognitive-services-key"
  },
  "knowledgeStore": {
    "storageConnectionString": "your-storage-connection-string",
    "projections": [
      {
        "tables": [
          { "tableName": "Organizations", "source": "/document/pages/*/orgs/*" },
          { "tableName": "People", "source": "/document/pages/*/people/*" }
        ]
      }
    ]
  },
  "encryptionKey": {
    "keyVaultKeyName": "your-key-name",
    "keyVaultKeyVersion": "your-key-version",
    "keyVaultUri": "https://your-vault.vault.azure.net"
  }
}
```

---

### **Supported Skill Types**
| **Category**               | **Skills**                                                                 |
|----------------------------|---------------------------------------------------------------------------|
| **Text/NLP**               | `SplitSkill`, `KeyPhraseExtractionSkill`, `EntityRecognitionSkill`, `SentimentSkill`, `LanguageDetectionSkill`, `TextTranslationSkill`, `PIIDetectionSkill` |
| **Vision/Documents**       | `OcrSkill`, `ImageAnalysisSkill`, `DocumentExtractionSkill`, `DocumentIntelligenceLayoutSkill` |
| **Custom/ML**              | `WebApiSkill`, `AzureOpenAIEmbeddingSkill`, `ChatCompletionSkill`, `AmlSkill` |
| **Utility**                | `ShaperSkill`, `MergeSkill`, `ConditionalSkill` |

---

### **cURL Examples**
#### **1. Create a Skillset**
```bash
curl -X POST "https://[your-service].search.windows.net/skillsets?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-admin-key]" \
  -d @skillset.json
```

#### **2. Update a Skillset (with ETag)**
```bash
curl -X PUT "https://[your-service].search.windows.net/skillsets('my-skillset')?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-admin-key]" \
  -H "Prefer: return=representation" \
  -H "If-Match: \"[etag-value]\"" \
  -d @skillset.json
```

#### **3. Get a Skillset**
```bash
curl "https://[your-service].search.windows.net/skillsets('my-skillset')?api-version=2025-08-01-preview" \
  -H "api-key: [your-admin-key]"
```

#### **4. List Skillsets (Select Specific Fields)**
```bash
curl "https://[your-service].search.windows.net/skillsets?api-version=2025-08-01-preview&$select=name,description" \
  -H "api-key: [your-admin-key]"
```

#### **5. Delete a Skillset (with ETag)**
```bash
curl -X DELETE "https://[your-service].search.windows.net/skillsets('my-skillset')?api-version=2025-08-01-preview" \
  -H "api-key: [your-admin-key]" \
  -H "If-Match: \"[etag-value]\""  # Replace with the skillset's ETag
```

#### **6. Reset Selected Skills**
```bash
curl -X POST "https://[your-service].search.windows.net/skillsets('my-skillset')/search.resetskills?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-admin-key]" \
  -d '{
    "skillNames": ["ocr-skill", "split-skill"]
  }'
```

---

### **Definitions and Concepts**
#### **1. Skill Anatomy**
Every skill has:
- **`@odata.type`**: Unique identifier (e.g., `#Microsoft.Skills.Text.SplitSkill`).
- **`context`**: Where the skill runs in the enrichment tree (default: `/document`).
- **`inputs`**: Array of `{name, source}` pairs (source is a JSON path).
- **`outputs`**: Array of `{name, targetName}` pairs (targetName disambiguates duplicates).

#### **2. Context Examples**
| **Context**                     | **Description**                                                                 |
|---------------------------------|---------------------------------------------------------------------------------|
| `/document`                     | Runs once per document.                                                         |
| `/document/pages/*`             | Runs once per page (e.g., after `SplitSkill`).                                |
| `/document/normalized_images/*` | Runs once per image (e.g., for `OcrSkill`).                                   |
| `/document/orgs/*`              | Runs once per organization (e.g., after `EntityRecognitionSkill`).            |

#### **3. Input/Output Paths**
- **Source Paths**:
  - `/document/content`: Raw text content.
  - `/document/normalized_images/*`: Extracted images.
  - `/document/pages/*`: Split pages (from `SplitSkill`).
- **Target Names**:
  - Use `targetName` to avoid naming conflicts (e.g., `targetName: "myKeyPhrases"`).

#### **4. Cognitive Services**
- **Required for billable skills** (e.g., OCR, entity recognition).
- **Free tier**: Limited to 20 transactions/day per indexer.
- **Attach via**:
  ```json
  "cognitiveServices": {
    "@odata.type": "#Microsoft.Azure.Search.CognitiveServicesAccountKey",
    "key": "your-key"
  }
  ```

#### **5. Knowledge Store**
- Projects enriched data to **Azure Storage** (tables, blobs, files).
- **Example**:
  ```json
  "knowledgeStore": {
    "storageConnectionString": "your-connection-string",
    "projections": [
      {
        "tables": [{ "tableName": "Entities", "source": "/document/entities/*" }],
        "objects": [{ "storageContainer": "images", "source": "/document/normalized_images/*" }]
      }
    ]
  }
  ```

#### **6. Encryption**
- Uses **Azure Key Vault** for customer-managed keys (CMK).
- **Example**:
  ```json
  "encryptionKey": {
    "keyVaultKeyName": "your-key",
    "keyVaultKeyVersion": "your-version",
    "keyVaultUri": "https://your-vault.vault.azure.net"
  }
  ```

---

### **Best Practices**
1. **Skill Ordering**:
   - Place **document-cracking skills** (e.g., `OcrSkill`) early.
   - Follow with **text-processing skills** (e.g., `SplitSkill`, `KeyPhraseExtractionSkill`).
   - Use **`ConditionalSkill`** for branching logic.

2. **Error Handling**:
   - Test skills individually before chaining.
   - Use `degreeOfParallelism` in custom skills to control concurrency.

3. **Performance**:
   - Limit the number of skills to **3–5 per skillset** (max: 30).
   - Use **`textSplitMode: "pages"`** for large documents to avoid timeouts.

4. **Cost Optimization**:
   - Enable **enrichment caching** (`"cache": { "enable": true }`) for development.
   - Use **free tier** for testing (20 transactions/day).

5. **Custom Skills**:
   - For **Azure OpenAI**, use `ChatCompletionSkill` or `AzureOpenAIEmbeddingSkill`.
   - Example:
     ```json
     {
       "@odata.type": "#Microsoft.Skills.Custom.ChatCompletionSkill",
       "uri": "https://your-aoai-endpoint.openai.azure.com/openai/deployments/your-deployment/chat/completions",
       "inputs": [
         { "name": "text", "source": "/document/content" },
         { "name": "systemMessage", "source": "/document/systemPrompt" }
       ],
       "outputs": [{ "name": "response", "targetName": "chatResponse" }],
       "commonModelParameters": { "model": "gpt-4o" }
     }
     ```

---

### **Troubleshooting**
| **Issue**                          | **Solution**                                                                 |
|------------------------------------|-----------------------------------------------------------------------------|
| `400 Bad Request`                  | Validate `@odata.type` and required fields.                                |
| `403 Forbidden`                    | Check Cognitive Services key or managed identity permissions.              |
| `429 Too Many Requests`           | Reduce `degreeOfParallelism` or enable caching.                           |
| Skill outputs not appearing        | Verify `context` and `source` paths in downstream skills.                  |
| Timeouts in custom skills          | Increase `timeout` (e.g., `"PT30S"`).                                     |
| Knowledge Store projection failures| Check `storageConnectionString` and container permissions.               |

---

### **Examples by Scenario**
#### **1. OCR + Text Splitting + Entity Recognition**
```json
{
  "name": "ocr-entity-skillset",
  "skills": [
    {
      "@odata.type": "#Microsoft.Skills.Vision.OcrSkill",
      "context": "/document/normalized_images/*",
      "inputs": [{ "name": "image", "source": "/document/normalized_images/*" }],
      "outputs": [{ "name": "text" }]
    },
    {
      "@odata.type": "#Microsoft.Skills.Text.SplitSkill",
      "textSplitMode": "pages",
      "maximumPageLength": 4000,
      "inputs": [{ "name": "text", "source": "/document/normalized_images/*/text" }],
      "outputs": [{ "name": "textItems", "targetName": "pages" }]
    },
    {
      "@odata.type": "#Microsoft.Skills.Text.EntityRecognitionSkill",
      "context": "/document/pages/*",
      "categories": ["Organization"],
      "inputs": [{ "name": "text", "source": "/document/pages/*" }],
      "outputs": [{ "name": "organizations", "targetName": "orgs" }]
    }
  ]
}
```

#### **2. Custom Web API Skill**
```json
{
  "@odata.type": "#Microsoft.Skills.Custom.WebApiSkill",
  "name": "custom-api-skill",
  "uri": "https://your-api.azurewebsites.net/api/analyze",
  "httpMethod": "POST",
  "timeout": "PT30S",
  "inputs": [
    { "name": "text", "source": "/document/content" },
    { "name": "language", "source": "/document/language" }
  ],
  "outputs": [{ "name": "result", "targetName": "customAnalysis" }]
}
```

#### **3. Azure OpenAI Chat Completion**
```json
{
  "@odata.type": "#Microsoft.Skills.Custom.ChatCompletionSkill",
  "name": "chat-skill",
  "uri": "https://your-aoai-endpoint.openai.azure.com/openai/deployments/your-model/chat/completions",
  "inputs": [
    { "name": "text", "source": "/document/content" },
    { "name": "systemMessage", "source": "/document/systemPrompt" }
  ],
  "outputs": [{ "name": "response", "targetName": "chatResponse" }],
  "commonModelParameters": {
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 1000
  }
}
```

#### **4. Document Intelligence Layout**
```json
{
  "@odata.type": "#Microsoft.Skills.Util.DocumentIntelligenceLayoutSkill",
  "name": "layout-skill",
  "context": "/document",
  "outputFormat": "markdown",
  "extractionOptions": ["images", "tables"],
  "inputs": [{ "name": "file_data", "source": "/document/content" }],
  "outputs": [
    { "name": "markdown_document", "targetName": "markdown" },
    { "name": "normalized_images", "targetName": "images" }
  ]
}
```

---

### **Related Notes**
- [[Indexes]] (for target index schemas)
- [[Indexers]] (for data ingestion pipelines)
- [[DataSources]] (for connecting to Azure Blob, SQL, etc.)
- [[SearchService_Utilities]] (for service-level operations)

---
### **Sources**
- [[Skillsets - Create Or Update - REST API (Azure Search Service)]]
- [[Create a skillset - Azure AI Search]]
- [[Skillset concepts - Azure AI Search]]
- [[Quick Reference Azure AI Search REST API Skillset Guide]]
- [[Tutorial - Skillsets - Azure AI Search]]
- [[Azure Search Service Data Plane Preview Specification 2025-08-01]]

---
Would you like me to save this as a note in your vault titled **[[Skillsets]]**?

#### Sources:

- [[Skillsets - Create Or Update - REST API (Azure Search Service)]]
- [[Skillsets - Create - REST API (Azure Search Service)]]
- [[Create a skillset - Azure AI Search]]
- [[Skillset concepts - Azure AI Search]]
- [[Quick Reference Azure AI Search REST API Skillset Guide]]
- [[Tutorial -  Skillsets - Azure AI Search]]
- [[Azure Search Service Data Plane Preview Specification 2025-08-01]]

#### Sources:

- [[Quick Reference Azure AI Search REST API Skillset Guide]]
- [[Create a skillset - Azure AI Search]]
- [[Skillset concepts - Azure AI Search]]
- [[Skillsets - Create Or Update - REST API (Azure Search Service)]]
- [[Tutorial -  Skillsets - Azure AI Search]]
- [[VS Code REST Client File for Creating and Updating Azure AI Search Resources]]
- [[Skillsets - Create - REST API (Azure Search Service)]]