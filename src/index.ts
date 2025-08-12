/* src/index-simple.ts */
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AzureSearchClient } from "./azure-search-client";
import { AzureOpenAIClient } from "./azure-openai-client";
import { IndexBuilder, IndexTemplates } from "./index-builder";

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
      prompts: {}
    }
  });

  // Helper function to format responses for MCP with pagination and summarization support
  private async formatResponse(data: any, maxSize: number = 20000): Promise<any> {
    const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    
    // Check if response is too large
    if (text.length > maxSize) {
      // For arrays, try to paginate
      if (Array.isArray(data)) {
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              message: "Response truncated due to size. Use pagination parameters (skip/top) to retrieve data in chunks.",
              totalItems: data.length,
              truncated: true,
              firstItems: data.slice(0, 10),
              recommendation: "Use skip and top parameters to paginate through results"
            }, null, 2)
          }]
        };
      }
      
      // For large single objects, try intelligent summarization
      if (typeof data === 'object' && data !== null) {
        const openAI = this.getOpenAIClient();
        
        // Try to summarize if OpenAI is available
        if (openAI) {
          try {
            console.log(`Large response detected (${text.length} chars), attempting summarization...`);
            const summary = await openAI.summarize(text, 800);
            console.log("Summarization successful");
            
            return {
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  summarized: true,
                  originalSize: text.length,
                  summary: summary,
                  message: "Response was too large and has been intelligently summarized using GPT-4o-mini.",
                  hint: "To see specific sections, use targeted queries or pagination parameters."
                }, null, 2)
              }]
            };
          } catch (error) {
            console.error("Summarization failed:", error);
            // Fall back to truncation
          }
        } else {
          console.log("OpenAI not configured, falling back to truncation");
        }
        
        // Fall back to truncation if summarization not available
        const truncated = this.truncateLargeArrays(data, maxSize);
        return { 
          content: [{ 
            type: "text", 
            text: JSON.stringify(truncated, null, 2) 
          }] 
        };
      }
    }
    
    return { content: [{ type: "text", text }] };
  }
  
  // Helper to truncate large arrays in objects
  private truncateLargeArrays(obj: any, maxSize: number): any {
    const str = JSON.stringify(obj);
    if (str.length <= maxSize) return obj;
    
    const result = { ...obj };
    
    // Special handling for specific response types
    if (result.executionHistory && Array.isArray(result.executionHistory)) {
      result.executionHistory = result.executionHistory.slice(0, 5);
      result.executionHistoryTruncated = true;
      result.totalExecutions = obj.executionHistory.length;
    }
    
    if (result.value && Array.isArray(result.value)) {
      const original = result.value.length;
      result.value = result.value.slice(0, 10);
      result.truncated = true;
      result.totalResults = original;
    }
    
    if (result.errors && Array.isArray(result.errors) && result.errors.length > 10) {
      result.errors = result.errors.slice(0, 10);
      result.errorsTruncated = true;
      result.totalErrors = obj.errors.length;
    }
    
    return result;
  }

  private formatError(error: any) {
    return { content: [{ type: "text", text: `Error: ${String(error)}` }] };
  }

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
      const client = this.getClient();
      console.log(`Azure Search MCP initialized`);
    } catch (error) {
      console.error("Failed to initialize Azure Search MCP:", error);
      throw error;
    }
    
    // ---------------- INDEX MANAGEMENT ----------------
    this.server.tool(
      "listIndexes",
      "List all index names with basic metadata.",
      { 
        includeStats: z.boolean().optional().describe("Include document count and storage size for each index"),
        verbose: z.boolean().optional().describe("Include full index definitions (fields, analyzers, etc.)")
      },
      async ({ includeStats, verbose }) => {
        try {
          const client = this.getClient();
          const indexes = await client.listIndexes();
          
          // If verbose mode, return full index definitions
          if (verbose) {
            return await this.formatResponse({ indexes, count: indexes.length });
          }
          
          // Process indexes to include stats if requested
          let indexInfo = indexes.map((idx: any) => ({
            name: idx.name,
            fields: idx.fields?.length || 0,
            ...(idx.defaultScoringProfile && { defaultScoringProfile: idx.defaultScoringProfile }),
            ...(idx.corsOptions && { corsEnabled: true }),
            ...(idx.semantic && { semanticSearchEnabled: true }),
            ...(idx.vectorSearch && { vectorSearchEnabled: true })
          }));
          
          // Add stats if requested
          if (includeStats) {
            indexInfo = await Promise.all(
              indexInfo.map(async (info: any) => {
                try {
                  const stats = await client.getIndexStats(info.name);
                  return {
                    ...info,
                    documentCount: stats.documentCount || 0,
                    storageSize: stats.storageSize || 0
                  };
                } catch (e) {
                  // If stats fail, return without stats
                  return info;
                }
              })
            );
          }
          
          return await this.formatResponse({ 
            indexes: indexInfo, 
            count: indexInfo.length 
          });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "getIndex",
      "Fetch full index definition.",
      { indexName: z.string() },
      async ({ indexName }) => {
        try {
          const client = this.getClient();
          const idx = await client.getIndex(indexName);
          return await this.formatResponse(idx);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "getIndexStats",
      "Get document count and storage usage.",
      { indexName: z.string() },
      async ({ indexName }) => {
        try {
          const client = this.getClient();
          const stats = await client.getIndexStats(indexName);
          return await this.formatResponse(stats);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "deleteIndex",
      "⚠️ DESTRUCTIVE: Permanently delete an index and all its documents. This action cannot be undone. Please confirm carefully before proceeding.",
      { indexName: z.string() },
      async ({ indexName }) => {
        try {
          const client = this.getClient();
          await client.deleteIndex(indexName);
          return await this.formatResponse({ success: true, message: `Index ${indexName} deleted` });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    // ---------------- DOCUMENTS ----------------
    this.server.tool(
      "searchDocuments",
      "Search for documents using keywords, filters, and sorting. Supports OData filter syntax, pagination (max 50 results per request), field selection, and relevance scoring. Use '*' to retrieve all documents.",
      {
        indexName: z.string(),
        search: z.string().default("*"),
        top: z.number().int().positive().max(50).default(10).describe("Max 50 to prevent large responses"),
        skip: z.number().int().nonnegative().default(0).describe("Skip N results for pagination"),
        select: z.array(z.string()).optional().describe("Fields to return (reduces response size)"),
        filter: z.string().optional(),
        orderBy: z.string().optional(),
        includeTotalCount: z.boolean().default(true)
      },
      async ({ indexName, search, top, skip, select, filter, orderBy, includeTotalCount }) => {
        try {
          const client = this.getClient();
          const searchParams = {
            search,
            top,
            skip,
            ...(select && { select: select.join(',') }),
            ...(filter && { filter }),
            ...(orderBy && { orderBy }),
            ...(includeTotalCount && { count: true })
          };
          const results = await client.searchDocuments(indexName, searchParams);
          return await this.formatResponse(results);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "getDocument",
      "Lookup a document by its primary key.",
      { indexName: z.string(), key: z.string(), select: z.array(z.string()).optional() },
      async ({ indexName, key, select }) => {
        try {
          const client = this.getClient();
          const doc = await client.getDocument(indexName, key, select);
          return await this.formatResponse(doc);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "countDocuments",
      "Return document count.",
      { indexName: z.string() },
      async ({ indexName }) => {
        try {
          const client = this.getClient();
          const count = await client.getDocumentCount(indexName);
          return await this.formatResponse({ count });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    // ---------------- DATA SOURCES ----------------
    this.server.tool(
      "listDataSources",
      "List data source connection names.",
      { },
      async () => {
        try {
          const client = this.getClient();
          const dataSources = await client.listDataSources();
          const names = dataSources.map((ds: any) => ds.name);
          return await this.formatResponse({ dataSources: names, count: names.length });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "getDataSource",
      "Get a data source connection.",
      { name: z.string() },
      async ({ name }) => {
        try {
          const client = this.getClient();
          const ds = await client.getDataSource(name);
          return await this.formatResponse(ds);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    // ---------------- INDEXERS ----------------
    this.server.tool(
      "listIndexers",
      "List indexer names.",
      { },
      async () => {
        try {
          const client = this.getClient();
          const indexers = await client.listIndexers();
          const names = indexers.map((ix: any) => ix.name);
          return await this.formatResponse({ indexers: names, count: names.length });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "getIndexer",
      "Get an indexer.",
      { name: z.string() },
      async ({ name }) => {
        try {
          const client = this.getClient();
          const ix = await client.getIndexer(name);
          return await this.formatResponse(ix);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "runIndexer",
      "Run an indexer now.",
      { name: z.string() },
      async ({ name }) => {
        try {
          const client = this.getClient();
          await client.runIndexer(name);
          return await this.formatResponse({ success: true, message: `Indexer ${name} started` });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "resetIndexer",
      "Reset change tracking for an indexer (full re-crawl).",
      { name: z.string() },
      async ({ name }) => {
        try {
          const client = this.getClient();
          await client.resetIndexer(name);
          return await this.formatResponse({ success: true, message: `Indexer ${name} reset` });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "getIndexerStatus",
      "Get execution history/status for an indexer.",
      { 
        name: z.string(),
        historyLimit: z.number().int().positive().max(50).default(5).describe("Limit execution history entries")
      },
      async ({ name, historyLimit }) => {
        try {
          const client = this.getClient();
          const status = await client.getIndexerStatus(name);
          
          // Limit execution history to prevent large responses
          if (status.executionHistory && Array.isArray(status.executionHistory)) {
            status.executionHistory = status.executionHistory.slice(0, historyLimit);
            if (status.executionHistory.length < historyLimit) {
              status.historyComplete = true;
            } else {
              status.historyTruncated = true;
              status.message = `Showing first ${historyLimit} execution history entries. Increase historyLimit to see more.`;
            }
          }
          
          return await this.formatResponse(status);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    // ---------------- SKILLSETS ----------------
    this.server.tool(
      "listSkillsets",
      "List skillset names.",
      { },
      async () => {
        try {
          const client = this.getClient();
          const skillsets = await client.listSkillsets();
          const names = skillsets.map((ss: any) => ss.name);
          return await this.formatResponse({ skillsets: names, count: names.length });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "getSkillset",
      "Get a skillset.",
      { name: z.string() },
      async ({ name }) => {
        try {
          const client = this.getClient();
          const ss = await client.getSkillset(name);
          return await this.formatResponse(ss);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

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

    // ---------------- SYNONYM MAPS ----------------
    this.server.tool(
      "listSynonymMaps",
      "List synonym map names.",
      { },
      async () => {
        try {
          const client = this.getClient();
          const synonymMaps = await client.listSynonymMaps();
          const names = synonymMaps.map((sm: any) => sm.name);
          return await this.formatResponse({ synonymMaps: names, count: names.length });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "getSynonymMap",
      "Get a synonym map definition.",
      { name: z.string() },
      async ({ name }) => {
        try {
          const client = this.getClient();
          const sm = await client.getSynonymMap(name);
          return await this.formatResponse(sm);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "createOrUpdateSynonymMap",
      "Create or update a synonym map to improve search relevance. Define equivalent terms (USA, United States), one-way mappings (cat => feline), or explicit mappings. Use Solr format for synonym rules.",
      { 
        name: z.string(),
        synonymMapDefinition: z.object({
          name: z.string(),
          format: z.string().default("solr"),
          synonyms: z.string().describe("Synonym rules in Solr format"),
          encryptionKey: z.any().optional(),
          "@odata.etag": z.string().optional()
        })
      },
      async ({ name, synonymMapDefinition }) => {
        try {
          const client = this.getClient();
          const result = await client.createOrUpdateSynonymMap(name, synonymMapDefinition);
          return await this.formatResponse(result);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "deleteSynonymMap",
      "Delete a synonym map.",
      { name: z.string() },
      async ({ name }) => {
        try {
          const client = this.getClient();
          await client.deleteSynonymMap(name);
          return await this.formatResponse({ success: true, message: `Synonym map ${name} deleted` });
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    // ---------------- INDEX MANAGEMENT ----------------
    this.server.tool(
      "createIndex",
      "Create a new search index. Choose from templates (document search, product catalog, hybrid search, knowledge base) or provide custom definition. Supports cloning existing indexes and automatic language configuration.",
      { 
        template: z.enum(['custom', 'documentSearch', 'productCatalog', 'hybridSearch', 'knowledgeBase']).optional()
          .describe("Use a pre-built template for common scenarios"),
        indexName: z.string().optional().describe("Index name (lowercase letters, numbers, hyphens only, max 128 chars)"),
        cloneFrom: z.string().optional().describe("Clone structure from an existing index (copies schema but not data)"),
        vectorDimensions: z.number().optional().describe("Vector dimensions for hybrid search template (default: 1536)"),
        language: z.string().optional().describe("Language for text analysis: english, spanish, french, german, italian, portuguese, japanese, chinese, korean, arabic, etc."),
        validate: z.boolean().optional().default(true).describe("Validate index definition before creation"),
        indexDefinition: z.object({
          name: z.string(),
          fields: z.array(z.any()).describe("Array of field definitions"),
          suggesters: z.array(z.any()).optional(),
          scoringProfiles: z.array(z.any()).optional(),
          analyzers: z.array(z.any()).optional(),
          tokenizers: z.array(z.any()).optional(),
          tokenFilters: z.array(z.any()).optional(),
          charFilters: z.array(z.any()).optional(),
          normalizers: z.array(z.any()).optional(),
          corsOptions: z.any().optional(),
          encryptionKey: z.any().optional(),
          semantic: z.any().optional(),
          vectorSearch: z.any().optional()
        }).optional().describe("Custom index definition (required if template is 'custom' or not specified)")
      },
      async ({ template, indexName, cloneFrom, vectorDimensions, language, validate, indexDefinition }) => {
        try {
          const client = this.getClient();
          let finalDefinition: any;
          
          // Handle cloning
          if (cloneFrom) {
            const sourceIndex = await client.getIndex(cloneFrom);
            finalDefinition = { ...sourceIndex };
            finalDefinition.name = indexName || `${cloneFrom}-copy`;
            delete finalDefinition['@odata.etag'];
            delete finalDefinition['@odata.context'];
          }
          // Handle templates
          else if (template && template !== 'custom') {
            if (!indexName) {
              throw new Error('indexName is required when using a template');
            }
            
            let builder: IndexBuilder;
            switch (template) {
              case 'documentSearch':
                builder = IndexTemplates.documentSearch(indexName);
                break;
              case 'productCatalog':
                builder = IndexTemplates.productCatalog(indexName);
                break;
              case 'hybridSearch':
                builder = IndexTemplates.hybridSearch(indexName, vectorDimensions || 1536);
                break;
              case 'knowledgeBase':
                builder = IndexTemplates.knowledgeBase(indexName);
                break;
              default:
                throw new Error(`Unknown template: ${template}`);
            }
            
            // Apply language analyzer if specified
            if (language && builder.definition.fields) {
              const languageAnalyzers: Record<string, string> = {
                'english': 'en.microsoft',
                'french': 'fr.microsoft',
                'german': 'de.microsoft',
                'spanish': 'es.microsoft',
                'italian': 'it.microsoft',
                'portuguese': 'pt-BR.microsoft',
                'japanese': 'ja.microsoft',
                'chinese': 'zh-Hans.microsoft',
                'korean': 'ko.microsoft',
                'arabic': 'ar.microsoft'
              };
              
              const analyzer = languageAnalyzers[language.toLowerCase()];
              if (analyzer) {
                builder.definition.fields.forEach(field => {
                  if (field.searchable && field.type === 'Edm.String') {
                    field.analyzer = analyzer;
                  }
                });
              }
            }
            
            finalDefinition = builder.build();
          }
          // Handle custom definition
          else {
            if (!indexDefinition) {
              throw new Error('indexDefinition is required when not using a template');
            }
            finalDefinition = indexDefinition;
          }
          
          // Validation
          if (validate) {
            const errors: string[] = [];
            
            // Check for key field
            const keyFields = finalDefinition.fields.filter((f: any) => f.key);
            if (keyFields.length === 0) {
              errors.push('Index must have exactly one key field');
            } else if (keyFields.length > 1) {
              errors.push('Index can only have one key field');
            }
            
            // Check field names
            const fieldNames = new Set<string>();
            for (const field of finalDefinition.fields) {
              if (fieldNames.has(field.name)) {
                errors.push(`Duplicate field name: ${field.name}`);
              }
              fieldNames.add(field.name);
              
              // Validate vector fields
              if (field.type === 'Collection(Edm.Single)' && (!field.dimensions || field.dimensions < 1)) {
                errors.push(`Vector field ${field.name} must have dimensions > 0`);
              }
            }
            
            if (errors.length > 0) {
              return this.formatError(new Error(`Validation failed:\n${errors.join('\n')}`));
            }
          }
          
          const result = await client.createIndex(finalDefinition);
          return await this.formatResponse(result);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "createOrUpdateIndex",
      "Create or update a search index with smart field addition.",
      { 
        indexName: z.string(),
        addFields: z.array(z.object({
          name: z.string(),
          type: z.string(),
          searchable: z.boolean().optional(),
          filterable: z.boolean().optional(),
          sortable: z.boolean().optional(),
          facetable: z.boolean().optional(),
          analyzer: z.string().optional()
        })).optional().describe("Fields to add to existing index"),
        updateSemanticConfig: z.object({
          titleField: z.string(),
          contentFields: z.array(z.string()),
          keywordFields: z.array(z.string()).optional()
        }).optional().describe("Update semantic search configuration"),
        validate: z.boolean().optional().default(true),
        mergeWithExisting: z.boolean().optional().default(true).describe("Merge with existing definition or replace"),
        indexDefinition: z.object({
          name: z.string(),
          fields: z.array(z.any()).describe("Array of field definitions"),
          suggesters: z.array(z.any()).optional(),
          scoringProfiles: z.array(z.any()).optional(),
          analyzers: z.array(z.any()).optional(),
          tokenizers: z.array(z.any()).optional(),
          tokenFilters: z.array(z.any()).optional(),
          charFilters: z.array(z.any()).optional(),
          normalizers: z.array(z.any()).optional(),
          corsOptions: z.any().optional(),
          encryptionKey: z.any().optional(),
          semantic: z.any().optional(),
          vectorSearch: z.any().optional(),
          "@odata.etag": z.string().optional()
        }).optional()
      },
      async ({ indexName, addFields, updateSemanticConfig, validate, mergeWithExisting, indexDefinition }) => {
        try {
          const client = this.getClient();
          let finalDefinition: any;
          
          if (mergeWithExisting || addFields || updateSemanticConfig) {
            // Get existing index
            const existingIndex = await client.getIndex(indexName);
            finalDefinition = { ...existingIndex };
            
            // Add new fields
            if (addFields) {
              const existingFieldNames = new Set(finalDefinition.fields.map((f: any) => f.name));
              for (const newField of addFields) {
                if (!existingFieldNames.has(newField.name)) {
                  finalDefinition.fields.push({
                    ...newField,
                    retrievable: true,
                    stored: true
                  });
                }
              }
            }
            
            // Update semantic config
            if (updateSemanticConfig) {
              finalDefinition.semantic = {
                configurations: [{
                  name: 'default-semantic-config',
                  prioritizedFields: {
                    titleField: { fieldName: updateSemanticConfig.titleField },
                    prioritizedContentFields: updateSemanticConfig.contentFields.map(f => ({ fieldName: f })),
                    ...(updateSemanticConfig.keywordFields && {
                      prioritizedKeywordsFields: updateSemanticConfig.keywordFields.map(f => ({ fieldName: f }))
                    })
                  }
                }]
              };
            }
            
            // Merge with provided definition if given
            if (indexDefinition) {
              finalDefinition = { ...finalDefinition, ...indexDefinition };
            }
          } else {
            if (!indexDefinition) {
              throw new Error('indexDefinition is required when not merging with existing');
            }
            finalDefinition = indexDefinition;
          }
          
          // Ensure name matches
          finalDefinition.name = indexName;
          
          // Validation
          if (validate) {
            const errors: string[] = [];
            
            // Check that we're not removing fields (not allowed)
            if (indexDefinition?.fields) {
              const existingIndex = await client.getIndex(indexName).catch(() => null);
              if (existingIndex) {
                const existingFieldNames = new Set(existingIndex.fields.map((f: any) => f.name));
                const newFieldNames = new Set(finalDefinition.fields.map((f: any) => f.name));
                for (const existingName of existingFieldNames) {
                  if (!newFieldNames.has(existingName)) {
                    errors.push(`Cannot remove existing field: ${existingName}`);
                  }
                }
              }
            }
            
            if (errors.length > 0) {
              return this.formatError(new Error(`Validation failed:\n${errors.join('\n')}`));
            }
          }
          
          const result = await client.createOrUpdateIndex(indexName, finalDefinition);
          return await this.formatResponse(result);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    // ---------------- DOCUMENT OPERATIONS ----------------
    this.server.tool(
      "uploadDocuments",
      "Upload new documents to an index. Documents must match the index schema. Maximum 1000 documents per batch. For existing documents, use mergeDocuments instead.",
      { 
        indexName: z.string(),
        documents: z.array(z.any()).describe("Array of documents to upload")
      },
      async ({ indexName, documents }) => {
        try {
          const client = this.getClient();
          const result = await client.uploadDocuments(indexName, documents);
          return await this.formatResponse(result);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "mergeDocuments",
      "Merge documents in an index (updates existing documents).",
      { 
        indexName: z.string(),
        documents: z.array(z.any()).describe("Array of documents to merge")
      },
      async ({ indexName, documents }) => {
        try {
          const client = this.getClient();
          const result = await client.mergeDocuments(indexName, documents);
          return await this.formatResponse(result);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "mergeOrUploadDocuments",
      "Merge or upload documents (updates existing or creates new).",
      { 
        indexName: z.string(),
        documents: z.array(z.any()).describe("Array of documents to merge or upload")
      },
      async ({ indexName, documents }) => {
        try {
          const client = this.getClient();
          const result = await client.mergeOrUploadDocuments(indexName, documents);
          return await this.formatResponse(result);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );

    this.server.tool(
      "deleteDocuments",
      "⚠️ Delete specific documents from an index by their key values. This is permanent and cannot be undone. Provide an array of document keys to delete.",
      { 
        indexName: z.string(),
        keys: z.array(z.any()).describe("Array of document keys to delete")
      },
      async ({ indexName, keys }) => {
        try {
          const client = this.getClient();
          const result = await client.deleteDocuments(indexName, keys);
          return await this.formatResponse(result);
        } catch (e) {
          return this.formatError(e);
        }
      }
    );
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