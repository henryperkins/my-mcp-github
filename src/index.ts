/* src/index-simple.ts */
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AzureSearchClient } from "./azure-search-client";
import { registerResources } from "./resources";
import { AzureOpenAIClient } from "./azure-openai-client";
import type { ToolContext } from "./types";
import { registerIndexTools } from "./IndexTools";
import { registerDocumentTools } from "./DocumentTools";
import { registerDataTools } from "./DataTools";
import { registerIndexerTools } from "./IndexerTools";
import { registerSkillTools } from "./SkillTools";
import { registerSynonymTools } from "./SynonymTools";

// Type definitions for environment
interface Env {
  AZURE_SEARCH_ENDPOINT: string;
  AZURE_SEARCH_API_KEY: string;
  AZURE_OPENAI_ENDPOINT?: string;
  AZURE_OPENAI_API_KEY?: string;
  AZURE_OPENAI_DEPLOYMENT?: string;
  [key: string]: any;
}

class AzureSearchMCP extends McpAgent {
  server = new McpServer({
    name: "azure-ai-search-mcp",
    version: "1.3.0",
    capabilities: {
      prompts: {},
      elicitation: {},
      resources: { subscribe: true, listChanged: true },
      logging: { levels: ["debug","info","warning","error"] }
    }
  });

  private getClient(): AzureSearchClient {
    const env = this.env as Env;
    const endpoint = env.AZURE_SEARCH_ENDPOINT;
    const apiKey = env.AZURE_SEARCH_API_KEY;
    
    if (!endpoint) {
      throw new Error("AZURE_SEARCH_ENDPOINT is not configured. Please set it as a Worker secret.");
    }
    if (!apiKey) {
      throw new Error("AZURE_SEARCH_API_KEY is not configured. Please set it as a Worker secret.");
    }
    
    return new AzureSearchClient(endpoint, apiKey);
  }
  
  private getOpenAIClient(): AzureOpenAIClient | null {
    const env = this.env as Env;
    const endpoint = env.AZURE_OPENAI_ENDPOINT;
    const apiKey = env.AZURE_OPENAI_API_KEY;
    const deploymentName = env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";
    
    if (!endpoint || !apiKey) {
      console.log("Azure OpenAI not configured for summarization");
      return null;
    }
    
    return new AzureOpenAIClient(endpoint, apiKey, deploymentName);
  }

  async init() {
    // Verify credentials are available
    try {
      this.getClient();
      console.log(`Azure Search MCP initialized`);
    } catch (error) {
      console.error("Failed to initialize Azure Search MCP:", error);
      throw error;
    }

    // Create tool context with client and optional summarizer
    const toolContext: ToolContext = {
      getClient: () => this.getClient(),
      getSummarizer: () => {
        const openAI = this.getOpenAIClient();
        return openAI ? (text, maxTokens) => openAI.summarize(text, maxTokens) : null;
      }
    };

    registerIndexTools(this.server, toolContext);
    registerDocumentTools(this.server, () => this.getClient());
    registerDataTools(this.server, () => this.getClient());
    registerIndexerTools(this.server, () => this.getClient());
    registerSkillTools(this.server, () => this.getClient());
    registerSynonymTools(this.server, () => this.getClient());

    // Resources
    registerResources(this.server, () => this.getClient());
    // this.server.notification("resources/listChanged", { reason: "startup" });

    // ---------------- PROMPTS ----------------
    // Prompts provide guided workflows for complex operations
    this.server.prompt(
      "create_search_index",
      "Create a new search index with guided setup for your use case",
      {
        use_case: z.string().describe("Type of search: ecommerce, documents, knowledge, or custom"),
        index_name: z.string().describe("Name for the index (lowercase, hyphens allowed)"),
        language: z.string().optional().describe("Primary content language (e.g., english, spanish, french)")
      },
      async ({ use_case, index_name, language }) => {
        const messages = [];
        
        messages.push({
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `I need to create a search index named "${index_name}" for ${use_case} use case${language ? ` with ${language} language support` : ''}.`
          }
        });
        
        let instructions = "";
        
        switch (use_case?.toLowerCase()) {
          case "ecommerce":
          case "e-commerce":
            instructions = `Create a product catalog search index with:
1. Use the 'productCatalog' template via createIndex tool
2. Include fields for: product name, description, category, price, rating, availability
3. Enable faceting on category, price ranges, and ratings
4. Set up scoring profiles to boost popular/featured products
5. ${language ? `Configure ${language} language analyzers for text fields` : 'Use standard analyzers'}

Call createIndex with template='productCatalog', indexName='${index_name}'${language ? `, language='${language}'` : ''}`;
            break;
            
          case "documents":
          case "document":
            instructions = `Create a document search index with:
1. Use the 'documentSearch' template via createIndex tool
2. Include fields for: title, content, author, date, tags, file type
3. Enable highlighting and hit highlighting
4. ${language ? `Configure ${language} language analyzers` : 'Use standard text analyzers'}
5. Consider adding semantic search configuration for better relevance

Call createIndex with template='documentSearch', indexName='${index_name}'${language ? `, language='${language}'` : ''}`;
            break;
            
          case "knowledge":
          case "knowledgebase":
          case "faq":
            instructions = `Create a knowledge base search index with:
1. Use the 'knowledgeBase' template via createIndex tool
2. Include fields for: question, answer, category, tags, helpful_count
3. Enable semantic search for natural language queries
4. ${language ? `Configure ${language} language analyzers` : 'Use standard analyzers'}
5. Set up synonym maps for common terminology

Call createIndex with template='knowledgeBase', indexName='${index_name}'${language ? `, language='${language}'` : ''}`;
            break;
            
          case "custom":
            instructions = `For a custom index, I'll help you define the schema. Please provide:
1. What types of data will you be searching?
2. What fields do you need (name, type, searchable/filterable/sortable)?
3. Do you need vector search capabilities?
4. Any specific analyzers or scoring requirements?

Once you provide these details, I'll create the index using the createIndex tool with a custom definition.`;
            break;
            
          default:
            instructions = `To create an index for "${use_case}", I need more information:
1. What kind of data will be stored?
2. What search capabilities do you need?
3. Should I use a template or create a custom schema?

Available templates: documentSearch, productCatalog, hybridSearch, knowledgeBase`;
        }
        
        messages.push({
          role: "assistant" as const,
          content: {
            type: "text" as const,
            text: instructions
          }
        });
        
        return { messages };
      }
    );
    
    this.server.prompt(
      "build_search_query",
      "Build an advanced search query with filters, facets, and sorting",
      {
        index_name: z.string().describe("Name of the index to search"),
        search_intent: z.string().describe("What are you looking for?"),
        filters: z.string().optional().describe("Any specific filters (price range, category, date)?"),
        sort_by: z.string().optional().describe("How to sort results?")
      },
      async ({ index_name, search_intent, filters, sort_by }) => {
        const messages = [];
        
        messages.push({
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Search in index "${index_name}" for: ${search_intent}${filters ? `. Filters: ${filters}` : ''}${sort_by ? `. Sort by: ${sort_by}` : ''}`
          }
        });
        
        let queryBuilder = `To search for "${search_intent}" in ${index_name}:\n\n`;
        queryBuilder += `Use the searchDocuments tool with:\n`;
        queryBuilder += `- indexName: '${index_name}'\n`;
        queryBuilder += `- search: '${search_intent}'\n`;
        
        if (filters) {
          queryBuilder += `\nFor filters like "${filters}", use OData syntax:\n`;
          queryBuilder += `Examples:\n`;
          queryBuilder += `- Price range: filter: 'price ge 10 and price le 100'\n`;
          queryBuilder += `- Category: filter: 'category eq \'Electronics\''\n`;
          queryBuilder += `- Date range: filter: 'date ge 2024-01-01 and date le 2024-12-31'\n`;
          queryBuilder += `- Multiple: filter: 'category eq \'Books\' and rating ge 4'\n`;
        }
        
        if (sort_by) {
          queryBuilder += `\nFor sorting by "${sort_by}":\n`;
          queryBuilder += `- orderBy: '${sort_by} desc' (or 'asc' for ascending)\n`;
          queryBuilder += `- Multiple: orderBy: 'rating desc, price asc'\n`;
        }
        
        queryBuilder += `\nOptional parameters:\n`;
        queryBuilder += `- top: 10 (number of results, max 50)\n`;
        queryBuilder += `- skip: 0 (for pagination)\n`;
        queryBuilder += `- select: ['field1', 'field2'] (specific fields to return)\n`;
        queryBuilder += `- includeTotalCount: true (get total matching documents)\n`;
        
        messages.push({
          role: "assistant" as const,
          content: {
            type: "text" as const,
            text: queryBuilder
          }
        });
        
        return { messages };
      }
    );
    
    this.server.prompt(
      "setup_indexer_pipeline",
      "Set up automated data ingestion from various sources",
      {
        source_type: z.string().describe("Data source type: blob, cosmos, sql, or table"),
        target_index: z.string().describe("Destination index name"),
        schedule: z.string().optional().describe("How often to run (e.g., hourly, daily)?"),
        ai_enrichment: z.string().optional().describe("Need AI enrichment (OCR, key phrases, sentiment)?")
      },
      async ({ source_type, target_index, schedule, ai_enrichment }) => {
        const messages = [];
        
        messages.push({
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Set up data ingestion from ${source_type} to index "${target_index}"${schedule ? ` running ${schedule}` : ''}${ai_enrichment ? ` with AI enrichment: ${ai_enrichment}` : ''}`
          }
        });
        
        let pipelineSteps = `To set up a data ingestion pipeline from ${source_type} to ${target_index}:\n\n`;
        
        pipelineSteps += `**Step 1: Check target index exists**\n`;
        pipelineSteps += `Use getIndex with indexName='${target_index}' to verify the index schema\n\n`;
        
        pipelineSteps += `**Step 2: Create data source connection**\n`;
        switch (source_type?.toLowerCase()) {
          case "blob":
          case "storage":
            pipelineSteps += `Configure Azure Blob Storage connection:\n`;
            pipelineSteps += `- Connection string to storage account\n`;
            pipelineSteps += `- Container name\n`;
            pipelineSteps += `- Optional: folder path, file extensions filter\n`;
            break;
          case "cosmos":
          case "cosmosdb":
            pipelineSteps += `Configure Cosmos DB connection:\n`;
            pipelineSteps += `- Connection string\n`;
            pipelineSteps += `- Database and collection names\n`;
            pipelineSteps += `- Optional: query for filtering\n`;
            break;
          case "sql":
            pipelineSteps += `Configure Azure SQL connection:\n`;
            pipelineSteps += `- Connection string\n`;
            pipelineSteps += `- Table or view name\n`;
            pipelineSteps += `- Optional: change detection policy\n`;
            break;
          case "table":
            pipelineSteps += `Configure Table Storage connection:\n`;
            pipelineSteps += `- Connection string\n`;
            pipelineSteps += `- Table name\n`;
            pipelineSteps += `- Optional: query filter\n`;
            break;
        }
        
        if (ai_enrichment) {
          pipelineSteps += `\n**Step 3: Create AI enrichment skillset**\n`;
          pipelineSteps += `Common enrichments:\n`;
          pipelineSteps += `- OCR: Extract text from images\n`;
          pipelineSteps += `- Key phrases: Extract important terms\n`;
          pipelineSteps += `- Language detection\n`;
          pipelineSteps += `- Sentiment analysis\n`;
          pipelineSteps += `- Entity recognition (people, places, organizations)\n`;
          pipelineSteps += `Use getSkillset to check existing skillsets\n\n`;
        }
        
        pipelineSteps += `**Step ${ai_enrichment ? '4' : '3'}: Create indexer**\n`;
        pipelineSteps += `Configure the indexer with:\n`;
        pipelineSteps += `- Data source reference\n`;
        pipelineSteps += `- Target index reference\n`;
        if (ai_enrichment) {
          pipelineSteps += `- Skillset reference\n`;
        }
        pipelineSteps += `- Field mappings (source to index fields)\n`;
        if (schedule) {
          pipelineSteps += `- Schedule: ${schedule} (e.g., PT1H for hourly, P1D for daily)\n`;
        }
        
        pipelineSteps += `\n**Step ${ai_enrichment ? '5' : '4'}: Run and monitor**\n`;
        pipelineSteps += `- Use runIndexer to start immediately\n`;
        pipelineSteps += `- Use getIndexerStatus to monitor progress\n`;
        pipelineSteps += `- Check for errors and warnings in execution history\n`;
        
        messages.push({
          role: "assistant" as const,
          content: {
            type: "text" as const,
            text: pipelineSteps
          }
        });
        
        return { messages };
      }
    );
    
    this.server.prompt(
      "index_health_check",
      "Analyze index performance and get optimization recommendations",
      {
        index_name: z.string().describe("Index to analyze"),
        check_indexers: z.string().optional().describe("Also check associated indexers? (yes/no)")
      },
      async ({ index_name, check_indexers }) => {
        const messages = [];
        
        messages.push({
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Perform health check on index "${index_name}"${check_indexers === 'yes' ? ' including indexers' : ''}`
          }
        });
        
        let healthCheck = `To analyze the health of index "${index_name}":\n\n`;
        
        healthCheck += `**1. Check Index Statistics**\n`;
        healthCheck += `Use getIndexStats with indexName='${index_name}' to get:\n`;
        healthCheck += `- Document count\n`;
        healthCheck += `- Storage size\n`;
        healthCheck += `- Look for: Unexpected growth, zero documents, storage issues\n\n`;
        
        healthCheck += `**2. Review Index Schema**\n`;
        healthCheck += `Use getIndex with indexName='${index_name}' to check:\n`;
        healthCheck += `- Field configurations (searchable, filterable, facetable)\n`;
        healthCheck += `- Analyzers and tokenizers\n`;
        healthCheck += `- Scoring profiles\n`;
        healthCheck += `- Suggestions configuration\n\n`;
        
        healthCheck += `**3. Test Search Performance**\n`;
        healthCheck += `Run sample searches with searchDocuments:\n`;
        healthCheck += `- Simple keyword search: search='*', top=1\n`;
        healthCheck += `- Complex query with filters\n`;
        healthCheck += `- Check response times and result quality\n\n`;
        
        if (check_indexers === 'yes') {
          healthCheck += `**4. Check Indexer Health**\n`;
          healthCheck += `Use listIndexers to find associated indexers, then:\n`;
          healthCheck += `- getIndexerStatus for execution history\n`;
          healthCheck += `- Look for: Failed runs, warnings, slow performance\n`;
          healthCheck += `- Check last run time and success rate\n\n`;
        }
        
        healthCheck += `**Optimization Recommendations:**\n`;
        healthCheck += `- If storage > 50GB: Consider partitioning strategy\n`;
        healthCheck += `- If queries slow: Review scoring profiles and add caching\n`;
        healthCheck += `- If relevance poor: Tune analyzers and add synonyms\n`;
        healthCheck += `- If indexing slow: Adjust batch size and parallelism\n`;
        healthCheck += `- Regular maintenance: Reset indexers periodically for full refresh\n`;
        
        messages.push({
          role: "assistant" as const,
          content: {
            type: "text" as const,
            text: healthCheck
          }
        });
        
        return { messages };
      }
    );
    
    this.server.prompt(
      "migrate_index_safely",
      "Safely migrate or update index schema with zero downtime",
      {
        source_index: z.string().describe("Current index name"),
        changes: z.string().describe("What changes are needed?"),
        keep_old_index: z.string().optional().describe("Keep old index as backup? (yes/no)")
      },
      async ({ source_index, changes, keep_old_index }) => {
        const messages = [];
        
        messages.push({
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Migrate index "${source_index}" with changes: ${changes}${keep_old_index === 'yes' ? ' (keeping old index as backup)' : ''}`
          }
        });
        
        let migrationPlan = `**Zero-Downtime Index Migration Plan for "${source_index}"**\n\n`;
        
        migrationPlan += `**Changes requested:** ${changes}\n\n`;
        
        migrationPlan += `**Step 1: Analyze Current Index**\n`;
        migrationPlan += `- Use getIndex to get current schema\n`;
        migrationPlan += `- Use getIndexStats to check document count\n`;
        migrationPlan += `- Document all field mappings and configurations\n\n`;
        
        migrationPlan += `**Step 2: Create New Index**\n`;
        migrationPlan += `- Clone existing index: createIndex with cloneFrom='${source_index}'\n`;
        migrationPlan += `- New index name: '${source_index}-v2' or '${source_index}-${new Date().toISOString().split('T')[0]}'\n`;
        migrationPlan += `- Apply your changes to the new index definition\n`;
        migrationPlan += `- Validate the new schema before creation\n\n`;
        
        migrationPlan += `**Step 3: Migrate Data**\n`;
        migrationPlan += `Option A - Re-index from source:\n`;
        migrationPlan += `- Update indexers to point to new index\n`;
        migrationPlan += `- Run full indexing with resetIndexer + runIndexer\n\n`;
        migrationPlan += `Option B - Copy from old index:\n`;
        migrationPlan += `- Export documents using searchDocuments with pagination\n`;
        migrationPlan += `- Import to new index using uploadDocuments in batches\n`;
        migrationPlan += `- Monitor progress and handle errors\n\n`;
        
        migrationPlan += `**Step 4: Validate Migration**\n`;
        migrationPlan += `- Compare document counts between indexes\n`;
        migrationPlan += `- Run test queries on both indexes\n`;
        migrationPlan += `- Verify all features work correctly\n\n`;
        
        migrationPlan += `**Step 5: Switch Over**\n`;
        migrationPlan += `- Update application to use new index\n`;
        migrationPlan += `- Monitor for errors\n`;
        migrationPlan += `- Keep old index running during transition\n\n`;
        
        migrationPlan += `**Step 6: Cleanup**\n`;
        if (keep_old_index === 'yes') {
          migrationPlan += `- Keep old index '${source_index}' as backup\n`;
          migrationPlan += `- Consider renaming to '${source_index}-backup'\n`;
          migrationPlan += `- Set up retention policy for backup\n`;
        } else {
          migrationPlan += `- After verification period, delete old index\n`;
          migrationPlan += `- Use deleteIndex with indexName='${source_index}'\n`;
          migrationPlan += `- Clean up old indexers and data sources\n`;
        }
        
        migrationPlan += `\n**Important Notes:**\n`;
        migrationPlan += `- Some changes (removing fields, changing field types) require full re-indexing\n`;
        migrationPlan += `- Test thoroughly in a dev environment first\n`;
        migrationPlan += `- Have a rollback plan ready\n`;
        migrationPlan += `- Monitor closely during and after migration\n`;
        
        messages.push({
          role: "assistant" as const,
          content: {
            type: "text" as const,
            text: migrationPlan
          }
        });
        
        return { messages };
      }
    );

    // (Optional) logging controls
    // this.server.method("logging/setLevel", ({ level }: any) => {
    //   // no-op placeholder; wire to utils/logging if desired
    //   return { ok: true };
    // });
  }
}

// Export the class for Durable Object binding
export { AzureSearchMCP };

// Expose both transports (SSE + Streamable HTTP)
export default {
  fetch(request: Request, envIn: unknown, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/sse")) {
      return AzureSearchMCP.serveSSE("/sse").fetch(request, envIn as any, ctx);
    }
    if (pathname.startsWith("/mcp")) {
      return AzureSearchMCP.serve("/mcp").fetch(request, envIn as any, ctx);
    }
    return new Response("Azure AI Search MCP Server - Use /sse or /mcp endpoints", { status: 200 });
  }
};