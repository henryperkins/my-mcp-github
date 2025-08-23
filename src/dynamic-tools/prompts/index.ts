// src/dynamic-tools/prompts/index.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "../../types";

export function registerPrompts(server: McpServer, context: ToolContext) {
  // Create Search Index Prompt
  server.prompt(
    "create_search_index",
    "Create a search index quickly with the right template",
    {
      use_case: z.string().describe("Type of search: ecommerce, documents, knowledge, hybrid, or custom"),
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
          instructions = `Template: productCatalog. Facet category/price/rating. ${language ? `Language: ${language}. ` : ""}Example:
{
  "operation": "create",
  "params": { "indexName": "${index_name}", "template": "productCatalog"${language ? `, "language": "${language}"` : ""} }
}`;
          break;

        case "documents":
        case "document":
          instructions = `Template: documentSearch. Fields: title, content, tags. ${language ? `Language: ${language}. ` : ""}Example:
{
  "operation": "create",
  "params": { "indexName": "${index_name}", "template": "documentSearch"${language ? `, "language": "${language}"` : ""} }
}`;
          break;

        case "knowledge":
        case "knowledgebase":
        case "faq":
          instructions = `Template: knowledgeBase. Enable semantic. ${language ? `Language: ${language}. ` : ""}Example:
{
  "operation": "create",
  "params": { "indexName": "${index_name}", "template": "knowledgeBase"${language ? `, "language": "${language}"` : ""} }
}`;
          break;

        case "hybrid":
        case "hybrid-search":
        case "vector":
          instructions = `Template: hybridSearch. Add content_vector (~1536 dims). ${language ? `Language: ${language}. ` : ""}Example:
{
  "operation": "create",
  "params": { "indexName": "${index_name}", "template": "hybridSearch"${language ? `, "language": "${language}"` : ""}, "vectorDimensions": 1536 }
}`;
          break;

        case "custom":
          instructions = `Custom index: provide briefly
- Fields (name, type, searchable/filterable/sortable)
- Need vectors? (dims)
- Analyzers/scoring
Then call IndexManagement.create with a custom indexDefinition.`;
          break;

        default:
          instructions = `Choose a template:
- documentSearch: Articles/docs
- productCatalog: E‑commerce
- hybridSearch: Text + vectors
- knowledgeBase: Q&A/FAQ
Or say "custom". Example:
{ "operation":"create", "params":{ "indexName":"${index_name}", "template":"documentSearch" } }`;
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

  // Build Search Query Prompt
  server.prompt(
    "build_search_query",
    "Build a search call with optional filters/sort",
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

      let queryBuilder = `To search for "${search_intent}" in ${index_name}, call tool 'DocumentOperations' with arguments:\n\n{\n  "operation": "search",\n  "params": { "indexName": "${index_name}", "search": "${search_intent}" }\n}\n`;

      if (filters) {
        queryBuilder += `\nFor filters like "${filters}", use OData syntax:\n`;
        queryBuilder += `Examples:\n`;
        queryBuilder += `- Price range: filter: 'price ge 10 and price le 100'\n`;
        queryBuilder += `- Category: filter: 'category eq \\'Electronics\\''\n`;
        queryBuilder += `- Date range: filter: 'date ge 2024-01-01 and date le 2024-12-31'\n`;
        queryBuilder += `- Multiple: filter: 'category eq \\'Books\\' and rating ge 4'\n`;
      }

      if (sort_by) {
        queryBuilder += `\nFor sorting by "${sort_by}":\n`;
        queryBuilder += `- orderBy: '${sort_by} desc' (or 'asc' for ascending)\n`;
        queryBuilder += `- Multiple: orderBy: 'rating desc, price asc'\n`;
      }

      queryBuilder += `\nOptional pagination (cursor-based):\n`;
      queryBuilder += `- pageSize: 10 (number of results per page)\n`;
      queryBuilder += `- cursor: '<opaque string from previous response.nextCursor>'\n`;
      queryBuilder += `- select: ['field1', 'field2'] (specific fields to return)\n`;
      queryBuilder += `- includeTotalCount: true (get total matching documents)\n`;

      // Build concise guidance
      const conciseParts: string[] = [
        `Call DocumentOperations.search:`,
        `{`,
        `  "operation":"search",`,
        `  "params": { "indexName":"${index_name}", "search":"${search_intent}" }`,
        `}`
      ];
      if (filters) conciseParts.push(`Filter (OData): e.g. price ge 10 and price le 100`);
      if (sort_by) conciseParts.push(`Sort: orderBy: '${sort_by} desc' (or asc)`);
      conciseParts.push(`Pagination: pageSize, cursor. Use select to limit fields. Optional: includeTotalCount.`);
      const conciseBuilder = conciseParts.join("\\n");
      messages.push({
        role: "assistant" as const,
        content: {
          type: "text" as const,
          text: conciseBuilder
        }
      });

      return { messages };
    }
  );

  // Setup Indexer Pipeline Prompt
  server.prompt(
    "setup_indexer_pipeline",
    "Create an ingestion pipeline (source → index)",
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
      pipelineSteps += `Use tool 'IndexManagement' with arguments { "operation": "get", "params": { "indexName": "${target_index}" } } to verify the index schema\n\n`;

      pipelineSteps += `**Step 2: Create data source connection**\n`;
      switch (source_type?.toLowerCase()) {
        case "blob":
        case "storage":
          pipelineSteps += `Configure Azure Blob Storage connection using tool 'DataSourceManagement' with arguments { "operation": "createBlob", "params": { ... } }:\n`;
          pipelineSteps += `- Connection string to storage account\n`;
          pipelineSteps += `- Container name\n`;
          pipelineSteps += `- Optional: folder path, file extensions filter\n`;
          break;
        case "cosmos":
        case "cosmosdb":
          pipelineSteps += `Configure Cosmos DB connection using tool 'DataSourceManagement' (createOrUpdate):\n`;
          pipelineSteps += `- Connection string\n`;
          pipelineSteps += `- Database and collection names\n`;
          pipelineSteps += `- Optional: query for filtering\n`;
          break;
        case "sql":
          pipelineSteps += `Configure Azure SQL connection using tool 'DataSourceManagement' (createOrUpdate):\n`;
          pipelineSteps += `- Connection string\n`;
          pipelineSteps += `- Table or view name\n`;
          pipelineSteps += `- Optional: change detection policy\n`;
          break;
        case "table":
          pipelineSteps += `Configure Table Storage connection using tool 'DataSourceManagement' (createOrUpdate):\n`;
          pipelineSteps += `- Connection string\n`;
          pipelineSteps += `- Table name\n`;
          pipelineSteps += `- Optional: query filter\n`;
          break;
      }

      if (ai_enrichment) {
        pipelineSteps += `\n**Step 3: Create AI enrichment skillset**\n`;
        pipelineSteps += `Common enrichments using SkillsetManagement.create:\n`;
        pipelineSteps += `- OCR: Extract text from images\n`;
        pipelineSteps += `- Key phrases: Extract important terms\n`;
        pipelineSteps += `- Language detection\n`;
        pipelineSteps += `- Sentiment analysis\n`;
        pipelineSteps += `- Entity recognition (people, places, organizations)\n`;
        pipelineSteps += `Use SkillsetManagement.list to check existing skillsets\n\n`;
      }

      pipelineSteps += `**Step ${ai_enrichment ? '4' : '3'}: Create indexer**\n`;
      pipelineSteps += `Configure the indexer using tool 'IndexerManagement' with arguments { "operation": "create", "params": { ... } } including:\n`;
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
      pipelineSteps += `- Use IndexerManagement.run to start immediately\n`;
      pipelineSteps += `- Use IndexerManagement.status to monitor progress\n`;
      pipelineSteps += `- Check for errors and warnings in execution history\n`;

      // Override with concise pipeline steps
      {
        const lines: string[] = [];
        lines.push(`Pipeline for ${source_type} → ${target_index}:`);
        lines.push(`1) Verify index: IndexManagement.get { indexName: "${target_index}" }`);
        let ds = `2) Create data source: `;
        switch ((source_type || "").toLowerCase()) {
          case "blob":
          case "storage":
            ds += `DataSourceManagement.createBlob { connectionString, container, [path/ext] }`;
            break;
          case "cosmos":
          case "cosmosdb":
            ds += `DataSourceManagement.createOrUpdate { type:"cosmosdb", connStr, db, collection, [query] }`;
            break;
          case "sql":
            ds += `DataSourceManagement.createOrUpdate { type:"azuresql", connStr, table/view }`;
            break;
          case "table":
            ds += `DataSourceManagement.createOrUpdate { type:"azuretable", connStr, table }`;
            break;
          default:
            ds += `DataSourceManagement.createOrUpdate { type, connection, container/table }`;
        }
        lines.push(ds);
        if (ai_enrichment) {
          lines.push(`3) Optional AI enrichment: SkillsetManagement.create (lang, sentiment, entities)`);
        }
        const stepIdx = ai_enrichment ? 4 : 3;
        lines.push(`${stepIdx}) Create indexer: IndexerManagement.create { dataSource, index${ai_enrichment ? ", skillset" : ""}${schedule ? `, schedule:"${schedule}"` : ""} }`);
        lines.push(`${stepIdx + 1}) Run & monitor: IndexerManagement.run/status`);
        pipelineSteps = lines.join("\\n");
      }
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

  // Index Health Check Prompt
  server.prompt(
    "index_health_check",
    "Quick index health check and tips",
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
      healthCheck += `Use IndexManagement.stats with indexName='${index_name}' to get:\n`;
      healthCheck += `- Document count\n`;
      healthCheck += `- Storage size\n`;
      healthCheck += `- Look for: Unexpected growth, zero documents, storage issues\n\n`;

      healthCheck += `**2. Review Index Schema**\n`;
      healthCheck += `Use IndexManagement.get with indexName='${index_name}' to check:\n`;
      healthCheck += `- Field configurations (searchable, filterable, facetable)\n`;
      healthCheck += `- Analyzers and tokenizers\n`;
      healthCheck += `- Scoring profiles\n`;
      healthCheck += `- Suggestions configuration\n\n`;

      healthCheck += `**3. Test Search Performance**\n`;
      healthCheck += `Run sample searches with DocumentOperations.search:\n`;
      healthCheck += `- Simple keyword search: search='*', top=1\n`;
      healthCheck += `- Complex query with filters\n`;
      healthCheck += `- Check response times and result quality\n\n`;

      if (check_indexers === 'yes') {
        healthCheck += `**4. Check Indexer Health**\n`;
        healthCheck += `Use IndexerManagement.list to find associated indexers, then:\n`;
        healthCheck += `- IndexerManagement.getStatus for execution history\n`;
        healthCheck += `- Look for: Failed runs, warnings, slow performance\n`;
        healthCheck += `- Check last run time and success rate\n\n`;
      }

      healthCheck += `**Optimization Recommendations:**\n`;
      healthCheck += `- If storage > 50GB: Consider partitioning strategy\n`;
      healthCheck += `- If queries slow: Review scoring profiles and add caching\n`;
      healthCheck += `- If relevance poor: Tune analyzers and add synonyms\n`;
      healthCheck += `- If indexing slow: Adjust batch size and parallelism\n`;
      healthCheck += `- Regular maintenance: Reset indexers periodically for full refresh\n`;

      // Concise summary override
      {
        const lines: string[] = [];
        lines.push(`Health check for "${index_name}":`);
        lines.push(`1) IndexManagement.stats → docCount, storage (watch zero or spikes)`);
        lines.push(`2) IndexManagement.get → field flags, analyzers, scoring, suggesters`);
        lines.push(`3) DocumentOperations.search → quick keyword and filtered test; note latency/quality`);
        if (check_indexers === 'yes') {
          lines.push(`4) IndexerManagement.status → failures, warnings, last run, success rate`);
        }
        lines.push(`Tips: tune analyzers/synonyms; prefilter; batch uploads; watch storage; adjust scoring.`);
        healthCheck = lines.join("\\n");
      }
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

  // Migrate Index Safely Prompt
  server.prompt(
    "migrate_index_safely",
    "Migrate index schema with zero downtime",
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

      const plan: string[] = [];
      plan.push(`**Zero-Downtime Index Migration Plan for "${source_index}"**\n`);
      plan.push(`**Changes requested:** ${changes}\n`);

      plan.push(`**Step 1: Analyze Current Index**`);
      plan.push(`- Use IndexManagement.get to get current schema`);
      plan.push(`- Use IndexManagement.stats to check document count`);
      plan.push(`- Document all field mappings and configurations\n`);

      plan.push(`**Step 2: Create New Index**`);
      plan.push(`- Retrieve existing definition: IndexManagement.get for '${source_index}'`);
      plan.push(`- New index name: '${source_index}-v2' or '${source_index}-${new Date().toISOString().split('T')[0]}'`);
      plan.push(`- Apply your changes to the retrieved definition`);
      plan.push(`- Create the new index using IndexManagement.create with a full indexDefinition`);
      plan.push(`- Validate the new schema before creation
`);
      

      plan.push(`**Step 3: Migrate Data**`);
      plan.push(`Option A - Re-index from source:`);
      plan.push(`- Update indexers to point to new index`);
      plan.push(`- Run full indexing with IndexerManagement.reset + IndexerManagement.run\n`);
      plan.push(`Option B - Copy from old index:`);
      plan.push(`- Export documents using DocumentOperations.search with pagination`);
      plan.push(`- Import to new index using DocumentOperations.upload in batches`);
      plan.push(`- Monitor progress and handle errors\n`);

      plan.push(`**Step 4: Validate Migration**`);
      plan.push(`- Compare document counts between indexes`);
      plan.push(`- Run test queries on both indexes`);
      plan.push(`- Verify all features work correctly\n`);

      plan.push(`**Step 5: Switch Over**`);
      plan.push(`- Update application to use new index`);
      plan.push(`- Monitor for errors`);
      plan.push(`- Keep old index running during transition\n`);

      plan.push(`**Step 6: Cleanup**`);
      if (keep_old_index === 'yes') {
        plan.push(`- Keep old index '${source_index}' as backup`);
        plan.push(`- Consider renaming to '${source_index}-backup'`);
        plan.push(`- Set up retention policy for backup`);
      } else {
        plan.push(`- After verification period, delete old index`);
        plan.push(`- Use IndexManagement.delete with indexName='${source_index}'`);
        plan.push(`- Clean up old indexers and data sources`);
      }

      plan.push(`\n**Important Notes:**`);
      plan.push(`- Some changes (removing fields, changing field types) require full re-indexing`);
      plan.push(`- Test thoroughly in a dev environment first`);
      plan.push(`- Have a rollback plan ready`);
      plan.push(`- Monitor closely during and after migration`);

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
}
