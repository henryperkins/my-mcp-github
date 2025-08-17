// src/dynamic-tools/prompts/advanced.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "../../types";

export function registerAdvancedPrompts(server: McpServer, context: ToolContext) {
  // Create AI Enrichment Skillset Prompt
  server.prompt(
    "create_ai_enrichment_skillset",
    "Create an AI enrichment skillset with cognitive skills for text and image analysis",
    {
      skillset_name: z.string().describe("Name for the skillset (unique within the service)"),
      enrichment_type: z.string().describe("Type of enrichment: text_analytics, image_analysis, custom_skills, or combined"),
      source_field: z.string().describe("Primary content field to enrich (e.g., 'content', 'description')"),
      language: z.string().optional().describe("Language for text processing (e.g., 'en', 'es', 'fr'). Default: 'en'"),
      cognitive_services_key: z.string().optional().describe("Azure Cognitive Services key (or 'default' for free tier)")
    },
    async ({ skillset_name, enrichment_type, source_field, language = 'en', cognitive_services_key }) => {
      const messages = [];
      
      messages.push({
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Create ${enrichment_type} enrichment skillset "${skillset_name}" for field "${source_field}"`
        }
      });

      const plan: string[] = [];
      plan.push(`**AI Enrichment Skillset Creation Plan**\n`);
      plan.push(`**Skillset Name:** ${skillset_name}`);
      plan.push(`**Enrichment Type:** ${enrichment_type}`);
      plan.push(`**Source Field:** ${source_field}\n`);

      // Build skillset configuration based on type
      if (enrichment_type === 'text_analytics' || enrichment_type === 'combined') {
        plan.push(`**Text Analytics Skills:**`);
        plan.push(`1. **Entity Recognition** - Extract people, organizations, locations`);
        plan.push(`2. **Key Phrase Extraction** - Identify important phrases`);
        plan.push(`3. **Language Detection** - Detect document language`);
        plan.push(`4. **Sentiment Analysis** - Analyze sentiment scores`);
        plan.push(`5. **PII Detection** - Identify sensitive information\n`);
      }

      if (enrichment_type === 'image_analysis' || enrichment_type === 'combined') {
        plan.push(`**Image Analysis Skills:**`);
        plan.push(`1. **OCR** - Extract text from images`);
        plan.push(`2. **Image Analysis** - Generate tags and descriptions`);
        plan.push(`3. **Face Detection** - Detect faces in images`);
        plan.push(`4. **Object Detection** - Identify objects and their locations\n`);
      }

      if (enrichment_type === 'custom_skills') {
        plan.push(`**Custom Skills Configuration:**`);
        plan.push(`1. **Web API Skill** - Call your custom REST endpoint`);
        plan.push(`2. **Azure OpenAI Embedding** - Generate vector embeddings`);
        plan.push(`3. **Custom Entity Lookup** - Match against custom entity lists\n`);
      }

      plan.push(`**Implementation Steps:**\n`);
      plan.push(`1. **Configure Cognitive Services:**`);
      if (cognitive_services_key === 'default') {
        plan.push(`   - Use default (free tier with limitations)`);
      } else if (cognitive_services_key) {
        plan.push(`   - Use provided API key for full capabilities`);
      } else {
        plan.push(`   - Configure Azure AI Services resource`);
      }

      plan.push(`\n2. **Create Skillset:**`);
      plan.push(`   Use SkillsetManagement.create with:`);
      plan.push(`   - name: '${skillset_name}'`);
      plan.push(`   - skills: Array of skill definitions`);
      plan.push(`   - cognitiveServices: Configuration object`);
      plan.push(`   - Language: '${language}'`);

      plan.push(`\n3. **Example Skill Configuration:**`);
      plan.push(`   For ${enrichment_type}, include skills like:`);
      
      if (enrichment_type.includes('text')) {
        plan.push(`   - EntityRecognitionSkill for extracting entities`);
        plan.push(`   - KeyPhraseExtractionSkill for key terms`);
        plan.push(`   - SentimentSkill for sentiment analysis`);
      }
      
      if (enrichment_type.includes('image')) {
        plan.push(`   - OcrSkill for text extraction from images`);
        plan.push(`   - ImageAnalysisSkill for image understanding`);
      }

      plan.push(`\n4. **Attach to Indexer:**`);
      plan.push(`   Update or create indexer with skillset reference`);
      plan.push(`   Map skill outputs to index fields`);

      plan.push(`\n5. **Test and Monitor:**`);
      plan.push(`   - Run indexer to test enrichment`);
      plan.push(`   - Monitor skill execution in indexer status`);
      plan.push(`   - Adjust skill parameters based on results`);

      messages.push({
        role: "assistant" as const,
        content: {
          type: "text" as const,
          text: plan.join('\n')
        }
      });

      return { messages };
    }
  );

  // Build Custom Skill Pipeline Prompt
  server.prompt(
    "build_custom_skill_pipeline",
    "Build a custom skill pipeline with Azure Functions or Web APIs",
    {
      skill_name: z.string().describe("Name for the custom skill"),
      skill_type: z.string().describe("Type: azure_function, web_api, or azure_ml"),
      input_fields: z.string().describe("Comma-separated list of input fields"),
      output_fields: z.string().describe("Comma-separated list of output fields"),
      endpoint_url: z.string().optional().describe("API endpoint URL")
    },
    async ({ skill_name, skill_type, input_fields, output_fields, endpoint_url }) => {
      const messages = [];

      messages.push({
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Build custom ${skill_type} skill "${skill_name}" with inputs: ${input_fields}, outputs: ${output_fields}`
        }
      });

      const inputs = input_fields.split(',').map(f => f.trim());
      const outputs = output_fields.split(',').map(f => f.trim());

      let guide = `**Custom Skill Pipeline: ${skill_name}**\n\n`;
      
      guide += `**Skill Type:** ${skill_type}\n`;
      guide += `**Input Fields:** ${inputs.join(', ')}\n`;
      guide += `**Output Fields:** ${outputs.join(', ')}\n`;
      if (endpoint_url) {
        guide += `**Endpoint:** ${endpoint_url}\n`;
      }

      guide += `\n**Implementation Guide:**\n\n`;

      switch (skill_type) {
        case 'azure_function':
          guide += `**1. Azure Function Setup:**\n`;
          guide += `- Create HTTP-triggered Azure Function\n`;
          guide += `- Accept POST requests with JSON body\n`;
          guide += `- Input format: { "values": [{ "recordId": "1", "data": { ${inputs.map(i => `"${i}": "value"`).join(', ')} } }] }\n`;
          guide += `- Output format: { "values": [{ "recordId": "1", "data": { ${outputs.map(o => `"${o}": "value"`).join(', ')} } }] }\n\n`;
          break;

        case 'web_api':
          guide += `**1. Web API Setup:**\n`;
          guide += `- Create REST endpoint accepting POST\n`;
          guide += `- Implement authentication (API key or OAuth)\n`;
          guide += `- Handle batch processing for efficiency\n`;
          guide += `- Return results maintaining record IDs\n\n`;
          break;

        case 'azure_ml':
          guide += `**1. Azure ML Endpoint Setup:**\n`;
          guide += `- Deploy model to Azure ML endpoint\n`;
          guide += `- Configure scoring script\n`;
          guide += `- Set up authentication\n`;
          guide += `- Enable batch inference if needed\n\n`;
          break;
      }

      guide += `**2. Skill Definition in Skillset:**\n`;
      guide += `Use SkillsetManagement.create with WebApiSkill:\n`;
      guide += `{\n`;
      guide += `  "@odata.type": "#Microsoft.Skills.Custom.WebApiSkill",\n`;
      guide += `  "name": "${skill_name}",\n`;
      guide += `  "uri": "${endpoint_url || 'https://your-endpoint-url'}",\n`;
      guide += `  "httpMethod": "POST",\n`;
      guide += `  "timeout": "PT30S",\n`;
      guide += `  "batchSize": 10,\n`;
      guide += `  "context": "/document",\n`;
      guide += `  "inputs": [\n`;
      inputs.forEach(input => {
        guide += `    { "name": "${input}", "source": "/document/${input}" },\n`;
      });
      guide += `  ],\n`;
      guide += `  "outputs": [\n`;
      outputs.forEach(output => {
        guide += `    { "name": "${output}", "targetName": "${output}" },\n`;
      });
      guide += `  ]\n`;
      guide += `}\n\n`;

      guide += `**3. Error Handling:**\n`;
      guide += `- Implement retry logic\n`;
      guide += `- Return partial results on error\n`;
      guide += `- Log errors with record IDs\n`;
      guide += `- Handle timeouts gracefully\n\n`;

      guide += `**4. Testing:**\n`;
      guide += `- Test with single record first\n`;
      guide += `- Verify batch processing\n`;
      guide += `- Check error scenarios\n`;
      guide += `- Monitor performance metrics\n`;

      messages.push({
        role: "assistant" as const,
        content: {
          type: "text" as const,
          text: guide
        }
      });

      return { messages };
    }
  );

  // Setup Vector Search Prompt
  server.prompt(
    "setup_vector_search",
    "Set up hybrid search with vector embeddings and semantic ranking",
    {
      index_name: z.string().describe("Index name for vector search"),
      embedding_model: z.string().describe("Embedding model: openai, azure_openai, or custom"),
      vector_dimensions: z.string().optional().describe("Vector dimensions (default: 1536 for OpenAI)"),
      algorithm: z.string().optional().describe("Algorithm: hnsw (default) or exhaustive_knn")
    },
    async ({ index_name, embedding_model, vector_dimensions = "1536", algorithm = "hnsw" }) => {
      const messages = [];

      messages.push({
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Set up vector search for index "${index_name}" using ${embedding_model} embeddings`
        }
      });

      let setup = `**Vector Search Setup for "${index_name}"**\n\n`;
      
      setup += `**Configuration:**\n`;
      setup += `- Embedding Model: ${embedding_model}\n`;
      setup += `- Vector Dimensions: ${vector_dimensions}\n`;
      setup += `- Algorithm: ${algorithm}\n\n`;

      setup += `**Step 1: Create Hybrid Index**\n`;
      setup += `Use IndexManagement.create with:\n`;
      setup += `- template: 'hybridSearch'\n`;
      setup += `- indexName: '${index_name}'\n`;
      setup += `- vectorDimensions: ${vector_dimensions}\n\n`;

      setup += `**Step 2: Configure Vector Search**\n`;
      setup += `Index will include:\n`;
      setup += `- Text fields for keyword search\n`;
      setup += `- Vector fields for semantic search\n`;
      setup += `- Vector search configuration:\n`;
      
      if (algorithm === "hnsw") {
        setup += `  - Algorithm: HNSW (Hierarchical Navigable Small World)\n`;
        setup += `  - Parameters: m=4, efConstruction=400, efSearch=500\n`;
        setup += `  - Metric: cosine (for normalized vectors)\n`;
      } else {
        setup += `  - Algorithm: Exhaustive KNN\n`;
        setup += `  - Metric: cosine or euclidean\n`;
      }

      setup += `\n**Step 3: Generate Embeddings**\n`;
      
      switch (embedding_model) {
        case 'openai':
          setup += `OpenAI Embeddings:\n`;
          setup += `- Model: text-embedding-ada-002\n`;
          setup += `- Dimensions: 1536\n`;
          setup += `- API: OpenAI API or Azure OpenAI\n`;
          setup += `- Batch processing for efficiency\n`;
          break;
          
        case 'azure_openai':
          setup += `Azure OpenAI Embeddings:\n`;
          setup += `- Deploy embedding model in Azure\n`;
          setup += `- Use AzureOpenAIEmbeddingSkill in skillset\n`;
          setup += `- Automatic embedding during indexing\n`;
          break;
          
        case 'custom':
          setup += `Custom Embeddings:\n`;
          setup += `- Use your own embedding model\n`;
          setup += `- Ensure vectors are normalized\n`;
          setup += `- Match configured dimensions\n`;
          break;
      }

      setup += `\n**Step 4: Index Documents with Vectors**\n`;
      setup += `Use DocumentOperations.upload with:\n`;
      setup += `- Text content in content field\n`;
      setup += `- Vector embeddings in content_vector field\n`;
      setup += `- Batch upload for performance\n\n`;

      setup += `**Step 5: Hybrid Search Queries**\n`;
      setup += `Use DocumentOperations.search with:\n`;
      setup += `- search: "your text query" (for keyword search)\n`;
      setup += `- vectors: [{ value: [embedding], fields: "content_vector", k: 10 }]\n`;
      setup += `- Combine scores using RRF (Reciprocal Rank Fusion)\n\n`;

      setup += `**Step 6: Semantic Configuration (Optional)**\n`;
      setup += `Add semantic ranking:\n`;
      setup += `- Use IndexManagement.update to add semantic config\n`;
      setup += `- Define title, content, and keyword fields\n`;
      setup += `- Enable L2 semantic reranking\n\n`;

      setup += `**Performance Tips:**\n`;
      setup += `- Pre-filter with keywords before vector search\n`;
      setup += `- Use smaller k values for faster queries\n`;
      setup += `- Consider quantization for large indexes\n`;
      setup += `- Monitor vector index size and memory usage\n`;

      messages.push({
        role: "assistant" as const,
        content: {
          type: "text" as const,
          text: setup
        }
      });

      return { messages };
    }
  );

  // Troubleshoot Enrichment Errors Prompt
  server.prompt(
    "troubleshoot_enrichment_errors",
    "Diagnose and fix common enrichment pipeline errors",
    {
      indexer_name: z.string().describe("Name of the indexer with errors"),
      error_type: z.string().optional().describe("Specific error: skill_error, mapping_error, timeout, or quota")
    },
    async ({ indexer_name, error_type }) => {
      const messages = [];

      messages.push({
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Troubleshoot ${error_type ? `${error_type} in` : 'errors in'} indexer "${indexer_name}"`
        }
      });

      let troubleshooting = `**Enrichment Pipeline Troubleshooting for "${indexer_name}"**\n\n`;

      troubleshooting += `**Step 1: Check Indexer Status**\n`;
      troubleshooting += `Use IndexerManagement.status with:\n`;
      troubleshooting += `- indexerName: '${indexer_name}'\n`;
      troubleshooting += `- historyLimit: 10\n`;
      troubleshooting += `Look for:\n`;
      troubleshooting += `- Error messages and warnings\n`;
      troubleshooting += `- Failed document counts\n`;
      troubleshooting += `- Skill execution details\n\n`;

      if (!error_type || error_type === 'skill_error') {
        troubleshooting += `**Skill Errors:**\n`;
        troubleshooting += `Common causes and solutions:\n`;
        troubleshooting += `1. **Null or missing inputs:**\n`;
        troubleshooting += `   - Add conditional skill execution\n`;
        troubleshooting += `   - Use default values in skill inputs\n`;
        troubleshooting += `2. **Timeout errors:**\n`;
        troubleshooting += `   - Increase skill timeout\n`;
        troubleshooting += `   - Reduce batch size\n`;
        troubleshooting += `3. **API quota exceeded:**\n`;
        troubleshooting += `   - Throttle indexer execution\n`;
        troubleshooting += `   - Upgrade Cognitive Services tier\n`;
        troubleshooting += `4. **Invalid skill configuration:**\n`;
        troubleshooting += `   - Verify skill parameters\n`;
        troubleshooting += `   - Check API versions\n\n`;
      }

      if (!error_type || error_type === 'mapping_error') {
        troubleshooting += `**Field Mapping Errors:**\n`;
        troubleshooting += `Common issues:\n`;
        troubleshooting += `1. **Type mismatches:**\n`;
        troubleshooting += `   - Verify source and target field types\n`;
        troubleshooting += `   - Add type conversion in skillset\n`;
        troubleshooting += `2. **Missing fields:**\n`;
        troubleshooting += `   - Check if source fields exist\n`;
        troubleshooting += `   - Verify field paths are correct\n`;
        troubleshooting += `3. **Array handling:**\n`;
        troubleshooting += `   - Use proper array notation (/*/field)\n`;
        troubleshooting += `   - Consider flattening arrays\n\n`;
      }

      if (!error_type || error_type === 'timeout') {
        troubleshooting += `**Timeout Issues:**\n`;
        troubleshooting += `Solutions:\n`;
        troubleshooting += `1. **Indexer timeouts:**\n`;
        troubleshooting += `   - Increase maxRunTime in indexer config\n`;
        troubleshooting += `   - Reduce batch size\n`;
        troubleshooting += `2. **Skill timeouts:**\n`;
        troubleshooting += `   - Increase individual skill timeout\n`;
        troubleshooting += `   - Optimize skill processing\n`;
        troubleshooting += `3. **Data source timeouts:**\n`;
        troubleshooting += `   - Check network connectivity\n`;
        troubleshooting += `   - Optimize data source queries\n\n`;
      }

      if (!error_type || error_type === 'quota') {
        troubleshooting += `**Quota and Limit Errors:**\n`;
        troubleshooting += `Check and adjust:\n`;
        troubleshooting += `1. **Cognitive Services quota:**\n`;
        troubleshooting += `   - Monitor API usage\n`;
        troubleshooting += `   - Upgrade to higher tier\n`;
        troubleshooting += `   - Implement request throttling\n`;
        troubleshooting += `2. **Index size limits:**\n`;
        troubleshooting += `   - Check storage quota\n`;
        troubleshooting += `   - Optimize field storage\n`;
        troubleshooting += `3. **Document size limits:**\n`;
        troubleshooting += `   - Split large documents\n`;
        troubleshooting += `   - Extract only necessary content\n\n`;
      }

      troubleshooting += `**Debugging Steps:**\n`;
      troubleshooting += `1. **Enable debug session:**\n`;
      troubleshooting += `   - Run indexer with debug flag\n`;
      troubleshooting += `   - Capture detailed execution logs\n`;
      troubleshooting += `2. **Test individual documents:**\n`;
      troubleshooting += `   - Process single document\n`;
      troubleshooting += `   - Identify problematic content\n`;
      troubleshooting += `3. **Validate skillset:**\n`;
      troubleshooting += `   - Test skills independently\n`;
      troubleshooting += `   - Verify skill chain dependencies\n`;
      troubleshooting += `4. **Review field mappings:**\n`;
      troubleshooting += `   - Ensure all paths are valid\n`;
      troubleshooting += `   - Check output field names\n\n`;

      troubleshooting += `**Recovery Actions:**\n`;
      troubleshooting += `1. Reset and retry: IndexerManagement.reset + IndexerManagement.run\n`;
      troubleshooting += `2. Process failed docs separately\n`;
      troubleshooting += `3. Update skillset configuration\n`;
      troubleshooting += `4. Monitor next execution closely\n`;

      messages.push({
        role: "assistant" as const,
        content: {
          type: "text" as const,
          text: troubleshooting
        }
      });

      return { messages };
    }
  );
}