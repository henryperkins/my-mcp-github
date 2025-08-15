### **[[KnowledgeAgents]]**
**Created**: 2025-08-11
**Modified**: 2025-08-11
**Tags**: `#azure-ai-search`, `#rest-api`, `#knowledge-agents`, `#agentic-retrieval`, `#llm-integration`

---

### **What This Covers**
This note provides a **comprehensive guide** to managing **Azure AI Search Knowledge Agents** via REST API, including:
- **CRUD operations**: Create, update, delete, get, and list knowledge agents.
- **Agentic retrieval**: Query decomposition, subquery generation, and response merging.
- **LLM integration**: Connecting to Azure OpenAI for query planning and answer formulation.
- **Best practices**: Configuration, monitoring, and performance optimization.

---

### **Endpoints**
| **Operation**               | **Endpoint**                                      | **HTTP Method** |
|-----------------------------|--------------------------------------------------|----------------|
| Create Knowledge Agent      | `/knowledgeAgents`                              | `POST`         |
| List Knowledge Agents       | `/knowledgeAgents`                              | `GET`          |
| Get Knowledge Agent         | `/knowledgeAgents('{agentName}')`              | `GET`          |
| Update Knowledge Agent      | `/knowledgeAgents('{agentName}')`              | `PUT`          |
| Delete Knowledge Agent      | `/knowledgeAgents('{agentName}')`              | `DELETE`       |
| Execute Retrieval           | `/knowledgeAgents('{agentName}')/search.retrieve` | `POST`       |

---

### **Key Tips**
1. **Agentic Retrieval Workflow**:
   - **Query Planning**: LLM decomposes complex queries into subqueries.
   - **Parallel Execution**: Subqueries run simultaneously against the index.
   - **Response Merging**: Results are ranked, combined, and returned for LLM grounding.

2. **LLM Requirements**:
   - Only **gpt-4o** and **gpt-4.1** series are supported for query planning.
   - Configure the LLM connection in the agent definition:
     ```json
     "llmParameters": {
       "resourceUri": "https://your-aoai-endpoint.openai.azure.com",
       "deploymentId": "gpt-4o",
       "apiKey": "your-aoai-key"
     }
     ```

3. **Semantic Ranker**:
   - Required for agentic retrieval (provides L2 reranking).
   - Enable in the index definition:
     ```json
     "semantic": {
       "configurations": [{
         "name": "default",
         "prioritizedFields": {
           "titleField": { "fieldName": "title" },
           "prioritizedContentFields": [{ "fieldName": "content" }]
         }
       }]
     }
     ```

4. **Concurrency Control**:
   - Use `If-Match` with `@odata.etag` for safe updates/deletes.
   - Use `Prefer: return=representation` with `PUT` to return the updated agent.

5. **Performance Considerations**:
   - Agentic retrieval adds latency but improves recall for complex queries.
   - Use `$select` in list operations to reduce payload size.

---

### **KnowledgeAgent JSON Skeleton**
```json
{
  "name": "my-knowledge-agent",
  "description": "Agent for complex query decomposition and retrieval",
  "llmParameters": {
    "resourceUri": "https://your-aoai-endpoint.openai.azure.com",
    "deploymentId": "gpt-4o",
    "apiKey": "your-aoai-key",
    "parameters": {
      "temperature": 0.3,
      "topP": 1.0,
      "maxTokens": 1000
    }
  },
  "retrievalParameters": {
    "queryLanguage": "en-us",
    "speller": "lexicon",
    "semanticConfiguration": "default",
    "vectorSearchConfiguration": "vector-config",
    "select": ["id", "title", "content"],
    "topK": 50,
    "enableInDomain": true,
    "scoringProfile": "custom-profile"
  },
  "encryptionKey": {
    "keyVaultKeyName": "your-key-name",
    "keyVaultKeyVersion": "your-key-version",
    "keyVaultUri": "https://your-vault.vault.azure.net",
    "identity": {
      "@odata.type": "#Microsoft.Azure.Search.UserAssignedIdentity",
      "userAssignedIdentity": "/subscriptions/.../resourceGroups/.../providers/Microsoft.ManagedIdentity/userAssignedIdentities/your-identity"
    }
  }
}
```

---

### **cURL Examples**
#### **1. Create a Knowledge Agent**
```bash
curl -X POST "https://[your-service].search.windows.net/knowledgeAgents?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-admin-key]" \
  -d @knowledge-agent.json
```

#### **2. Update a Knowledge Agent (with ETag)**
```bash
curl -X PUT "https://[your-service].search.windows.net/knowledgeAgents('my-knowledge-agent')?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-admin-key]" \
  -H "Prefer: return=representation" \
  -H "If-Match: \"[etag-value]\"" \
  -d @knowledge-agent.json
```

#### **3. Get a Knowledge Agent**
```bash
curl "https://[your-service].search.windows.net/knowledgeAgents('my-knowledge-agent')?api-version=2025-08-01-preview" \
  -H "api-key: [your-admin-key]"
```

#### **4. List Knowledge Agents (Select Specific Fields)**
```bash
curl "https://[your-service].search.windows.net/knowledgeAgents?api-version=2025-08-01-preview&$select=name,description" \
  -H "api-key: [your-admin-key]"
```

#### **5. Delete a Knowledge Agent (with ETag)**
```bash
curl -X DELETE "https://[your-service].search.windows.net/knowledgeAgents('my-knowledge-agent')?api-version=2025-08-01-preview" \
  -H "api-key: [your-admin-key]" \
  -H "If-Match: \"[etag-value]\""  # Replace with the agent's ETag
```

#### **6. Execute Agentic Retrieval**
```bash
curl -X POST "https://[your-service].search.windows.net/knowledgeAgents('my-knowledge-agent')/search.retrieve?api-version=2025-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: [your-query-key]" \
  -d '{
    "query": "What are the latest advancements in AI for healthcare, including specific examples from 2024 and their impact on patient outcomes?",
    "chatHistory": [
      {"role": "user", "content": "Focus on diagnostic tools"},
      {"role": "assistant", "content": "Understood, I'll prioritize diagnostic advancements"}
    ],
    "options": {
      "semanticConfiguration": "default",
      "vectorSearchConfiguration": "vector-config",
      "topK": 30
    }
  }'
```

---

### **Definitions and Concepts**
#### **1. Knowledge Agent Components**
| **Component**          | **Description**                                                                 |
|-------------------------|---------------------------------------------------------------------------------|
| `llmParameters`         | Configuration for the LLM used in query planning and answer formulation.     |
| `retrievalParameters`   | Settings for query execution, including semantic and vector search.         |
| `encryptionKey`         | Customer-managed key for encrypting agent definitions.                       |

#### **2. LLM Parameters**
| **Property**            | **Type**   | **Description**                                                                 |
|-------------------------|------------|---------------------------------------------------------------------------------|
| `resourceUri`           | string     | Azure OpenAI endpoint (e.g., `https://your-aoai-endpoint.openai.azure.com`). |
| `deploymentId`         | string     | Model deployment name (e.g., `gpt-4o`).                                      |
| `apiKey`                | string     | Azure OpenAI API key.                                                          |
| `parameters`            | object     | Model parameters (e.g., `temperature`, `maxTokens`).                        |

#### **3. Retrieval Parameters**
| **Property**                | **Type**   | **Description**                                                                 |
|-----------------------------|------------|---------------------------------------------------------------------------------|
| `queryLanguage`            | string     | Language for query processing (e.g., `en-us`).                              |
| `speller`                   | string     | Spell correction mode (`lexicon` or `statistical`).                          |
| `semanticConfiguration`     | string     | Name of the semantic configuration in the index.                              |
| `vectorSearchConfiguration`| string     | Name of the vector search configuration.                                      |
| `select`                   | string[]   | Fields to return in results.                                                   |
| `topK`                     | integer    | Number of results to return per subquery.                                     |
| `enableInDomain`           | boolean    | Restrict results to the domain of the index.                                  |
| `scoringProfile`           | string     | Custom scoring profile name.                                                  |

#### **4. Agentic Retrieval Workflow**
1. **Query Planning**:
   - LLM analyzes the input query and chat history.
   - Decomposes into focused subqueries (e.g., "diagnostic tools" and "2024 examples").
2. **Parallel Execution**:
   - Subqueries run simultaneously against the index.
   - Combines keyword, semantic, and vector search results.
3. **Response Merging**:
   - Results are semantically reranked (L2 reranking).
   - Returns a unified response with:
     - **Grounding data**: For LLM answer formulation.
     - **Reference data**: Source documents and passages.
     - **Activity plan**: Query execution steps and subqueries.

---

### **Response Structure**
```json
{
  "groundingData": {
    "documents": [
      {
        "id": "doc1",
        "title": "AI in Healthcare 2024",
        "content": "New diagnostic tools using LLMs...",
        "score": 0.95,
        "passages": [
          {
            "text": "LLM-based diagnostic tools achieved 92% accuracy in 2024 trials.",
            "score": 0.98
          }
        ]
      }
    ]
  },
  "referenceData": {
    "documents": [
      {
        "id": "doc1",
        "metadata": {
          "source": "https://example.com/ai-healthcare-2024",
          "lastUpdated": "2024-05-15"
        }
      }
    ]
  },
  "activityPlan": {
    "subQueries": [
      {
        "text": "diagnostic tools AND 2024",
        "type": "keyword",
        "resultsCount": 12
      },
      {
        "text": "impact on patient outcomes",
        "type": "semantic",
        "resultsCount": 8
      }
    ],
    "llmPrompt": "Combine these results to answer the user's question about AI advancements in healthcare..."
  }
}
```

---

### **Best Practices**
1. **LLM Configuration**:
   - Use **gpt-4o** or **gpt-4.1** for query planning (required for agentic retrieval).
   - Set `temperature` to **0.3-0.5** for deterministic query decomposition.

2. **Query Design**:
   - **Complex queries** benefit most from agentic retrieval (e.g., multi-part questions).
   - **Simple queries** may not need agentic decomposition (use standard search).

3. **Performance Optimization**:
   - Limit `topK` to **30-50** to balance recall and latency.
   - Use `select` to return only necessary fields (reduces payload size).

4. **Semantic Configuration**:
   - Define **prioritized fields** (title, content) in the index for better reranking.
   - Example:
     ```json
     "semantic": {
       "configurations": [{
         "name": "default",
         "prioritizedFields": {
           "titleField": { "fieldName": "title", "boost": 2.0 },
           "prioritizedContentFields": [{ "fieldName": "content" }]
         }
       }]
     }
     ```

5. **Monitoring**:
   - Track `activityPlan` in responses to debug query decomposition.
   - Monitor LLM token usage in `llmParameters` (affects cost).

6. **Security**:
   - Use **managed identities** for Azure OpenAI connections.
   - Encrypt agent definitions with **customer-managed keys (CMK)**.

---

### **Troubleshooting**
| **Issue**                          | **Solution**                                                                 |
|------------------------------------|-----------------------------------------------------------------------------|
| `400 Bad Request`                  | Validate `llmParameters` (only gpt-4o/4.1 supported).                     |
| `403 Forbidden`                    | Check Azure OpenAI API key or managed identity permissions.              |
| `409 Conflict`                     | Ensure the agent name is unique.                                            |
| `412 Precondition Failed`          | Verify the `If-Match` ETag is correct.                                     |
| No subqueries generated            | Increase query complexity or adjust LLM parameters (e.g., `temperature`).|
| Slow response times               | Reduce `topK` or simplify the query.                                       |
| Poor recall                        | Enable `semanticConfiguration` and adjust `prioritizedFields`.            |

---

### **Examples by Scenario**
#### **1. Healthcare Research Agent**
```json
{
  "name": "healthcare-research-agent",
  "description": "Agent for decomposing complex healthcare research queries",
  "llmParameters": {
    "resourceUri": "https://your-aoai-endpoint.openai.azure.com",
    "deploymentId": "gpt-4o",
    "parameters": {
      "temperature": 0.3,
      "topP": 0.9,
      "maxTokens": 1500
    }
  },
  "retrievalParameters": {
    "queryLanguage": "en-us",
    "semanticConfiguration": "healthcare-config",
    "vectorSearchConfiguration": "vector-config",
    "select": ["id", "title", "abstract", "publicationDate"],
    "topK": 40,
    "scoringProfile": "healthcare-profile"
  }
}
```

#### **2. Financial Analysis Agent**
```json
{
  "name": "financial-analysis-agent",
  "description": "Agent for decomposing financial research queries with temporal focus",
  "llmParameters": {
    "resourceUri": "https://your-aoai-endpoint.openai.azure.com",
    "deploymentId": "gpt-4o",
    "parameters": {
      "temperature": 0.4,
      "maxTokens": 2000
    }
  },
  "retrievalParameters": {
    "queryLanguage": "en-us",
    "semanticConfiguration": "financial-config",
    "select": ["id", "title", "content", "date", "ticker"],
    "topK": 30,
    "enableInDomain": true
  },
  "encryptionKey": {
    "keyVaultKeyName": "financial-key",
    "keyVaultUri": "https://your-vault.vault.azure.net"
  }
}
```

#### **3. Multi-Lingual Support Agent**
```json
{
  "name": "multilingual-agent",
  "description": "Agent supporting queries in English, Spanish, and French",
  "llmParameters": {
    "resourceUri": "https://your-aoai-endpoint.openai.azure.com",
    "deploymentId": "gpt-4o",
    "parameters": {
      "temperature": 0.3
    }
  },
  "retrievalParameters": {
    "queryLanguage": "en-us, es-es, fr-fr",
    "speller": "lexicon",
    "semanticConfiguration": "multilingual-config",
    "select": ["id", "title", "content", "language"],
    "topK": 50
  }
}
```

---

### **Agentic Retrieval vs. Standard Search**
| **Feature**               | **Agentic Retrieval**                          | **Standard Search**               |
|---------------------------|-----------------------------------------------|-----------------------------------|
| **Query Complexity**      | Handles multi-part, ambiguous queries        | Best for simple, focused queries |
| **Subquery Generation**   | LLM decomposes into multiple subqueries       | Single query execution           |
| **Latency**               | Higher (LLM planning + parallel execution)   | Lower                            |
| **Recall**                | Improved (semantic + vector + keyword merge)  | Standard                         |
| **Cost**                  | Higher (LLM token usage)                      | Lower                            |
| **Use Cases**             | Research, complex analysis, chatbots         | Simple lookup, filtering         |

---

### **Integration with Chat Applications**
#### **1. Using Grounding Data for LLM Responses**
```python
# Example: Formulating an answer with grounding data
grounding_data = response["groundingData"]
prompt = f"""
Answer the user's question using only the provided documents.
If the answer isn't in the documents, say you don't know.

Documents:
{grounding_data}

Question: {user_query}
"""
llm_response = call_llm(prompt)
```

#### **2. Citing Sources from Reference Data**
```json
{
  "answer": "LLM-based diagnostic tools achieved 92% accuracy in 2024 trials...",
  "sources": [
    {
      "title": "AI in Healthcare 2024",
      "url": "https://example.com/ai-healthcare-2024",
      "passages": [
        {
          "text": "LLM-based diagnostic tools achieved 92% accuracy...",
          "score": 0.98
        }
      ]
    }
  ]
}
```

---

### **Related Notes**
- [[Indexes]] (for semantic and vector search configurations)
- [[Indexers]] (for data ingestion pipelines)
- [[DataSources]] (for connecting to data sources)
- [[Skillsets]] (for AI enrichment)
- [[SearchService_Utilities]] (for service-level operations)
- [[Agentic Retrieval - Azure AI Search]] (conceptual overview)

---
### **Sources**
- [[Agentic Retrieval - Azure AI Search]]
- [[Knowledge Agents - Create Or Update - REST API (Azure Search Service)]]
- [[Build an agent-to-agent retrieval solution - Azure AI Search]]
- [[Azure Search Service Data Plane Preview Specification 2025-08-01]]
- [[Use a knowledge agent to retrieve data - Azure AI Search]]
- [[Create a knowledge agent - Azure AI Search]]

---
Would you like me to save this as a note in your vault titled **[[KnowledgeAgents]]**?

#### Sources:
- [[Agentic Retrieval - Azure AI Search]]
- [[Knowledge Agents - Create Or Update - REST API (Azure Search Service)]]
- [[Build an agent-to-agent retrieval solution - Azure AI Search]]
- [[Use a knowledge agent to retrieve data - Azure AI Search]]
- [[Create a knowledge agent - Azure AI Search]]
- [[Azure Search Service Data Plane Preview Specification 2025-08-01]]
- [[Quickstart-Agentic-Retrieval: Python]]
- [[Quickstart-Agentic-Retrieval:.NET]]
- [[Quickstart-Agentic-Retrieval: REST]]