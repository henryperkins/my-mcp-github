// src/resources.ts
import { withTimeout } from "./utils/timeout";
import { DEFAULT_TIMEOUT_MS } from "./constants";

/**
 * MCP Resource annotations for better client integration
 */
interface ResourceAnnotations {
  audience?: ("user" | "assistant")[];
  priority?: number;
  lastModified?: string;
}

/**
 * Helper to create resource response with annotations
 */
function createResourceResponse(
  uri: string,
  name: string,
  title: string,
  description: string,
  content: any,
  annotations?: ResourceAnnotations
) {
  return {
    contents: [{
      uri,
      mimeType: "application/json",
      text: typeof content === "string" ? content : JSON.stringify(content, null, 2)
    }]
  };
}

/**
 * Register MCP resources for Azure Search service
 * Provides read-only access to index definitions, stats, and service information
 */
export function registerResources(server: any, getClient: () => any) {
  // ---------------- STATIC RESOURCES ----------------
  
  // Service-level statistics and quotas
  server.resource(
    "servicestats",
    "Service-level statistics and quotas",
    async () => {
      try {
        const c = getClient();
        const stats = await c.getServiceStatistics();
        
        return createResourceResponse(
          "servicestats",
          "Service Statistics",
          "📊 Azure Search Service Statistics",
          "Current usage, quotas, and service limits",
          stats,
          {
            audience: ["assistant"],
            priority: 0.6,
            lastModified: new Date().toISOString()
          }
        );
      } catch (error) {
        return createResourceResponse(
          "servicestats",
          "Service Statistics",
          "📊 Service Statistics (Error)",
          "Failed to retrieve service statistics",
          { error: String(error) },
          { audience: ["assistant"], priority: 0.3 }
        );
      }
    }
  );

  // List of all indexes (overview)
  server.resource(
    "indexes",
    "List of all search indexes",
    async () => {
      try {
        const c = getClient();
        // Use lightweight $select to reduce payload size
        const indexes = await c.listIndexesSelected(
          "name,fields,semantic,vectorSearch,suggesters,scoringProfiles"
        );

        // Try aggregate stats endpoint first
        let indexesWithStats: any[];
        try {
          const summary: any = await withTimeout(
            c.getIndexStatsSummary(),
            DEFAULT_TIMEOUT_MS,
            "getIndexStatsSummary"
          );
          const byName = new Map<string, any>();
          const items = Array.isArray(summary?.value) ? summary.value : [];
          for (const s of items) {
            if (s?.name) byName.set(s.name, s);
          }

          indexesWithStats = indexes.map((idx: any) => {
            const s = byName.get(idx.name);
            const base: any = {
              name: idx.name,
              fields: idx.fields?.length || 0,
              features: {
                semantic: !!idx.semantic,
                vectorSearch: !!idx.vectorSearch,
                suggesters: idx.suggesters?.length > 0,
                scoringProfiles: idx.scoringProfiles?.length > 0,
              },
            };
            if (s) {
              base.documentCount = s.documentCount || 0;
              base.storageSize = s.storageSize || 0;
              if (typeof s.vectorIndexSize === "number") {
                base.vectorIndexSize = s.vectorIndexSize;
              }
            }
            return base;
          });
        } catch {
          // Fallback: per-index stats with modest concurrency and timeouts
          const concurrency = 5;
          const out: any[] = [];
          for (let i = 0; i < indexes.length; i += concurrency) {
            const slice = indexes.slice(i, i + concurrency);
            const chunk = await Promise.all(
              slice.map(async (idx: any) => {
                try {
                  const stats: any = await withTimeout(
                    c.getIndexStats(idx.name),
                    DEFAULT_TIMEOUT_MS,
                    `getIndexStats:${idx.name}`
                  );
                  const result: any = {
                    name: idx.name,
                    fields: idx.fields?.length || 0,
                    documentCount: stats?.documentCount || 0,
                    storageSize: stats?.storageSize || 0,
                    features: {
                      semantic: !!idx.semantic,
                      vectorSearch: !!idx.vectorSearch,
                      suggesters: idx.suggesters?.length > 0,
                      scoringProfiles: idx.scoringProfiles?.length > 0,
                    },
                  };
                  if (typeof stats?.vectorIndexSize === "number") {
                    result.vectorIndexSize = stats.vectorIndexSize;
                  }
                  return result;
                } catch {
                  return {
                    name: idx.name,
                    fields: idx.fields?.length || 0,
                    features: {
                      semantic: !!idx.semantic,
                      vectorSearch: !!idx.vectorSearch,
                      suggesters: idx.suggesters?.length > 0,
                      scoringProfiles: idx.scoringProfiles?.length > 0,
                    },
                    error: "Could not retrieve stats",
                  };
                }
              })
            );
            out.push(...chunk);
          }
          indexesWithStats = out;
        }
        
        return createResourceResponse(
          "indexes",
          "All Indexes",
          "🔍 Search Indexes Overview",
          `${indexes.length} index${indexes.length !== 1 ? 'es' : ''} configured`,
          { indexes: indexesWithStats, count: indexes.length },
          {
            audience: ["user", "assistant"],
            priority: 0.9,
            lastModified: new Date().toISOString()
          }
        );
      } catch (error) {
        return createResourceResponse(
          "indexes",
          "All Indexes",
          "🔍 Indexes (Error)",
          "Failed to retrieve index list",
          { error: String(error) },
          { audience: ["assistant"], priority: 0.3 }
        );
      }
    }
  );

  // List of all data sources
  server.resource(
    "datasources",
    "List of all data source connections",
    async () => {
      try {
        const c = getClient();
        const dataSources = await c.listDataSources();
        
        const dataSourceInfo = dataSources.map((ds: any) => ({
          name: ds.name,
          type: ds.type,
          container: ds.container?.name,
          description: ds.description,
          dataChangeDetection: !!ds.dataChangeDetectionPolicy,
          dataDeletion: !!ds.dataDeletionDetectionPolicy
        }));
        
        return createResourceResponse(
          "datasources",
          "Data Sources",
          "🔌 Data Source Connections",
          `${dataSources.length} data source${dataSources.length !== 1 ? 's' : ''} configured`,
          { dataSources: dataSourceInfo, count: dataSources.length },
          {
            audience: ["assistant"],
            priority: 0.7,
            lastModified: new Date().toISOString()
          }
        );
      } catch (error) {
        return createResourceResponse(
          "datasources",
          "Data Sources",
          "🔌 Data Sources (Error)",
          "Failed to retrieve data sources",
          { error: String(error) },
          { audience: ["assistant"], priority: 0.3 }
        );
      }
    }
  );

  // List of all indexers with status
  server.resource(
    "indexers",
    "List of all indexers with current status",
    async () => {
      try {
        const c = getClient();
        const indexers = await c.listIndexers();
        
        const indexersWithStatus = await Promise.all(
          indexers.map(async (indexer: any) => {
            try {
              const status = await c.getIndexerStatus(indexer.name);
              const lastExecution = status?.lastResult;
              return {
                name: indexer.name,
                dataSource: indexer.dataSourceName,
                targetIndex: indexer.targetIndexName,
                schedule: indexer.schedule?.interval,
                status: lastExecution?.status || "unknown",
                lastRun: lastExecution?.endTime,
                itemsProcessed: lastExecution?.itemsProcessed,
                errors: lastExecution?.errors?.length || 0
              };
            } catch {
              return {
                name: indexer.name,
                dataSource: indexer.dataSourceName,
                targetIndex: indexer.targetIndexName,
                status: "error retrieving status"
              };
            }
          })
        );
        
        return createResourceResponse(
          "indexers",
          "Indexers",
          "⚙️ Indexers Status",
          `${indexers.length} indexer${indexers.length !== 1 ? 's' : ''} configured`,
          { indexers: indexersWithStatus, count: indexers.length },
          {
            audience: ["assistant"],
            priority: 0.7,
            lastModified: new Date().toISOString()
          }
        );
      } catch (error) {
        return createResourceResponse(
          "indexers",
          "Indexers",
          "⚙️ Indexers (Error)",
          "Failed to retrieve indexers",
          { error: String(error) },
          { audience: ["assistant"], priority: 0.3 }
        );
      }
    }
  );

  // List of all synonym maps
  server.resource(
    "synonymmaps",
    "List of all synonym maps",
    async () => {
      try {
        const c = getClient();
        const synonymMaps = await c.listSynonymMaps();
        
        const synonymInfo = synonymMaps.map((sm: any) => ({
          name: sm.name,
          format: sm.format || "solr",
          synonymCount: sm.synonyms?.split('\n').filter((s: string) => s.trim()).length || 0
        }));
        
        return createResourceResponse(
          "synonymmaps",
          "Synonym Maps",
          "📝 Synonym Maps",
          `${synonymMaps.length} synonym map${synonymMaps.length !== 1 ? 's' : ''} configured`,
          { synonymMaps: synonymInfo, count: synonymMaps.length },
          {
            audience: ["assistant"],
            priority: 0.5,
            lastModified: new Date().toISOString()
          }
        );
      } catch (error) {
        return createResourceResponse(
          "synonymmaps",
          "Synonym Maps",
          "📝 Synonym Maps (Error)",
          "Failed to retrieve synonym maps",
          { error: String(error) },
          { audience: ["assistant"], priority: 0.3 }
        );
      }
    }
  );

  // List of all skillsets - AI enrichment pipelines
  server.resource(
    "skillsets",
    "List of all AI enrichment skillsets",
    async () => {
      try {
        const c = getClient();
        const skillsets = await c.listSkillsets();
        
        const skillsetInfo = (skillsets as any[]).map((s: any) => ({
          name: s.name,
          description: s.description,
          skillCount: s.skills ? s.skills.length : 0,
          skills: s.skills ? s.skills.map((skill: any) => ({
            type: skill["@odata.type"]?.split('.').pop()?.replace('Skill', ''),
            name: skill.name,
            description: skill.description
          })) : [],
          cognitiveServices: s.cognitiveServices ? s.cognitiveServices["@odata.type"]?.split('.').pop() : "none",
          knowledgeStore: s.knowledgeStore ? "configured" : "none",
          etag: s["@odata.etag"]
        }));
        
        return createResourceResponse(
          "skillsets",
          "Skillsets",
          "🧠 AI Enrichment Skillsets",
          `${skillsets.length} skillset${skillsets.length !== 1 ? 's' : ''} for cognitive enrichment`,
          { 
            skillsets: skillsetInfo, 
            count: skillsets.length,
            totalSkills: skillsetInfo.reduce((sum, s) => sum + s.skillCount, 0)
          },
          {
            audience: ["assistant", "user"],
            priority: 0.7,
            lastModified: new Date().toISOString()
          }
        );
      } catch (error) {
        return createResourceResponse(
          "skillsets",
          "Skillsets",
          "🧠 Skillsets (Error)",
          "Failed to retrieve skillsets",
          { error: String(error) },
          { audience: ["assistant"], priority: 0.2 }
        );
      }
    }
  );

  // Query examples and best practices
  server.resource(
    "query-examples",
    "Azure Search query examples and patterns",
    async () => {
      const examples = {
        basic: {
          description: "Simple text search",
          query: {
            search: "azure cloud",
            searchMode: "all",
            top: 10
          }
        },
        filtered: {
          description: "Search with filters",
          query: {
            search: "*",
            filter: "category eq 'documentation' and lastModified ge 2024-01-01",
            orderby: "lastModified desc",
            top: 20
          }
        },
        faceted: {
          description: "Search with facets for filtering UI",
          query: {
            search: "*",
            facets: ["category,count:10", "tags,count:20"],
            top: 10
          }
        },
        semantic: {
          description: "Semantic search with answers",
          query: {
            search: "how to configure authentication",
            queryType: "semantic",
            semanticConfiguration: "default",
            answers: "extractive|count-3",
            captions: "extractive|highlight-true"
          }
        },
        vector: {
          description: "Vector similarity search",
          query: {
            vectorQueries: [{
              kind: "text",
              text: "modern cloud architecture patterns",
              k: 10,
              fields: "contentVector"
            }]
          }
        },
        hybrid: {
          description: "Combined keyword and vector search",
          query: {
            search: "microservices",
            vectorQueries: [{
              kind: "text",
              text: "microservices architecture patterns",
              k: 5,
              fields: "contentVector"
            }],
            top: 10
          }
        },
        autocomplete: {
          description: "Autocomplete/suggestions",
          query: {
            search: "azur",
            suggesterName: "default-suggester",
            autocompleteMode: "oneTerm",
            top: 5
          }
        }
      };
      
      return createResourceResponse(
        "query-examples",
        "Query Examples",
        "🔍 Azure Search Query Examples",
        "Common query patterns and best practices",
        {
          examples,
          tips: [
            "Use searchMode='all' to require all search terms",
            "Apply filters for better performance than post-filtering",
            "Use facets to build filter UI components",
            "Enable semantic search for natural language queries",
            "Combine vector and keyword search for best results",
            "Use field-specific searches with searchFields parameter",
            "Leverage scoring profiles for custom relevance"
          ]
        },
        {
          audience: ["user", "assistant"],
          priority: 0.9,
          lastModified: new Date().toISOString()
        }
      );
    }
  );

  // Schema documentation - field types and capabilities
  server.resource(
    "schema-reference",
    "Azure Search field types and capabilities reference",
    async () => {
      const fieldTypes = {
        "Edm.String": {
          description: "Text data",
          capabilities: ["searchable", "filterable", "sortable", "facetable", "retrievable"],
          maxLength: 32766,
          useCase: "General text content, titles, descriptions"
        },
        "Edm.Int32": {
          description: "32-bit integer",
          capabilities: ["filterable", "sortable", "facetable", "retrievable"],
          range: "-2^31 to 2^31-1",
          useCase: "Counts, IDs, numeric codes"
        },
        "Edm.Int64": {
          description: "64-bit integer",
          capabilities: ["filterable", "sortable", "facetable", "retrievable"],
          range: "-2^63 to 2^63-1",
          useCase: "Large IDs, timestamps"
        },
        "Edm.Double": {
          description: "Double-precision floating point",
          capabilities: ["filterable", "sortable", "facetable", "retrievable"],
          useCase: "Prices, measurements, coordinates"
        },
        "Edm.Boolean": {
          description: "Boolean value",
          capabilities: ["filterable", "sortable", "facetable", "retrievable"],
          useCase: "Flags, binary states"
        },
        "Edm.DateTimeOffset": {
          description: "Date and time with timezone",
          capabilities: ["filterable", "sortable", "facetable", "retrievable"],
          format: "yyyy-MM-ddTHH:mm:ss.fffZ",
          useCase: "Timestamps, scheduling"
        },
        "Edm.GeographyPoint": {
          description: "Geographic coordinates",
          capabilities: ["filterable", "sortable", "retrievable"],
          format: "POINT(longitude latitude)",
          useCase: "Location-based search"
        },
        "Collection(Edm.String)": {
          description: "Array of strings",
          capabilities: ["searchable", "filterable", "facetable", "retrievable"],
          maxElements: 3000,
          useCase: "Tags, categories, multi-valued attributes"
        },
        "Collection(Edm.Single)": {
          description: "Vector embeddings",
          capabilities: ["searchable", "retrievable"],
          dimensions: "configurable (e.g., 1536)",
          useCase: "Vector similarity search, embeddings"
        }
      };
      
      const capabilities = {
        searchable: "Full-text search with linguistic analysis",
        filterable: "Can be used in filter expressions",
        sortable: "Can be used in orderby expressions",
        facetable: "Can be used for faceted navigation",
        retrievable: "Can be returned in search results",
        key: "Unique identifier for documents"
      };
      
      return createResourceResponse(
        "schema-reference",
        "Schema Reference",
        "📘 Field Types & Capabilities Reference",
        "Complete guide to Azure Search field types",
        {
          fieldTypes,
          capabilities,
          bestPractices: [
            "Mark only necessary fields as retrievable to reduce payload size",
            "Use Collection(Edm.String) for tags and categories",
            "Enable searchable only on fields that need full-text search",
            "Use filterable for fields used in WHERE clauses",
            "Consider field size limits when designing schema",
            "Use Edm.GeographyPoint for geo-spatial queries",
            "Configure analyzers for language-specific text processing"
          ]
        },
        {
          audience: ["user", "assistant"],
          priority: 0.8,
          lastModified: new Date().toISOString()
        }
      );
    }
  );

  // ---------------- PARAMETERIZED RESOURCES ----------------
  
  // Individual index definition + stats
  server.resource(
    "indexes/{indexName}",
    "Detailed index definition with statistics",
    async ({ indexName }: any) => {
      try {
        const c = getClient();
        const [def, stats] = await Promise.all([
          c.getIndex(indexName),
          c.getIndexStats(indexName).catch(() => null)
        ]);
        
        // Extract key information
        const metadata = {
          fieldCount: def?.fields?.length ?? 0,
          keyField: def?.fields?.find((f: any) => f.key)?.name,
          searchableFields: def?.fields?.filter((f: any) => f.searchable).map((f: any) => f.name),
          filterableFields: def?.fields?.filter((f: any) => f.filterable).map((f: any) => f.name),
          sortableFields: def?.fields?.filter((f: any) => f.sortable).map((f: any) => f.name),
          facetableFields: def?.fields?.filter((f: any) => f.facetable).map((f: any) => f.name),
          vectorFields: def?.fields?.filter((f: any) => f.type === "Collection(Edm.Single)").map((f: any) => ({
            name: f.name,
            dimensions: f.dimensions
          })),
          features: {
            semantic: !!def?.semantic,
            vectorSearch: !!def?.vectorSearch,
            suggesters: def?.suggesters?.length > 0,
            scoringProfiles: def?.scoringProfiles?.length > 0,
            analyzers: def?.analyzers?.length > 0
          }
        };
        
        return createResourceResponse(
          `indexes/${indexName}`,
          indexName,
          `📋 Index: ${indexName}`,
          `Schema, configuration, and statistics for ${indexName}`,
          {
            definition: def,
            statistics: stats,
            metadata
          },
          {
            audience: ["assistant"],
            priority: 0.8,
            lastModified: def?.["@odata.etag"] ? new Date().toISOString() : undefined
          }
        );
      } catch (error) {
        return createResourceResponse(
          `indexes/${indexName}`,
          indexName,
          `📋 Index: ${indexName} (Error)`,
          `Failed to retrieve index ${indexName}`,
          { error: String(error) },
          { audience: ["assistant"], priority: 0.3 }
        );
      }
    }
  );

  // Individual data source details
  server.resource(
    "datasources/{name}",
    "Data source connection details",
    async ({ name }: any) => {
      try {
        const c = getClient();
        const ds = await c.getDataSource(name);
        
        // Sanitize sensitive information
        const sanitized = {
          ...ds,
          credentials: { 
            connectionString: ds.credentials?.connectionString ? "***REDACTED***" : undefined 
          }
        };
        
        return createResourceResponse(
          `datasources/${name}`,
          name,
          `🔌 Data Source: ${name}`,
          `Configuration for data source ${name}`,
          sanitized,
          {
            audience: ["assistant"],
            priority: 0.6,
            lastModified: new Date().toISOString()
          }
        );
      } catch (error) {
        return createResourceResponse(
          `datasources/${name}`,
          name,
          `🔌 Data Source: ${name} (Error)`,
          `Failed to retrieve data source ${name}`,
          { error: String(error) },
          { audience: ["assistant"], priority: 0.3 }
        );
      }
    }
  );

  // Individual indexer status with history
  server.resource(
    "indexers/{name}",
    "Indexer configuration and execution history",
    async ({ name }: any) => {
      try {
        const c = getClient();
        const [indexer, status] = await Promise.all([
          c.getIndexer(name),
          c.getIndexerStatus(name).catch(() => null)
        ]);
        
        return createResourceResponse(
          `indexers/${name}`,
          name,
          `⚙️ Indexer: ${name}`,
          `Configuration and status for indexer ${name}`,
          {
            configuration: indexer,
            status: status,
            summary: {
              dataSource: indexer.dataSourceName,
              targetIndex: indexer.targetIndexName,
              schedule: indexer.schedule?.interval,
              lastRun: status?.lastResult?.endTime,
              lastStatus: status?.lastResult?.status,
              itemsProcessed: status?.lastResult?.itemsProcessed,
              errors: status?.lastResult?.errors?.length || 0
            }
          },
          {
            audience: ["assistant"],
            priority: 0.7,
            lastModified: status?.lastResult?.endTime || new Date().toISOString()
          }
        );
      } catch (error) {
        return createResourceResponse(
          `indexers/${name}`,
          name,
          `⚙️ Indexer: ${name} (Error)`,
          `Failed to retrieve indexer ${name}`,
          { error: String(error) },
          { audience: ["assistant"], priority: 0.3 }
        );
      }
    }
  );

  // Individual synonym map
  server.resource(
    "synonymmaps/{name}",
    "Synonym map definition",
    async ({ name }: any) => {
      try {
        const c = getClient();
        const sm = await c.getSynonymMap(name);
        
        // Parse synonym rules for better display
        const rules = sm.synonyms?.split('\n')
          .filter((s: string) => s.trim())
          .map((rule: string) => {
            const parts = rule.split('=>').map(p => p.trim());
            if (parts.length === 2) {
              return { type: "one-way", from: parts[0], to: parts[1] };
            } else {
              return { type: "equivalent", terms: rule.split(',').map(t => t.trim()) };
            }
          });
        
        return createResourceResponse(
          `synonymmaps/${name}`,
          name,
          `📝 Synonym Map: ${name}`,
          `Synonym rules for ${name}`,
          {
            definition: sm,
            parsedRules: rules,
            ruleCount: rules?.length || 0
          },
          {
            audience: ["assistant"],
            priority: 0.5,
            lastModified: new Date().toISOString()
          }
        );
      } catch (error) {
        return createResourceResponse(
          `synonymmaps/${name}`,
          name,
          `📝 Synonym Map: ${name} (Error)`,
          `Failed to retrieve synonym map ${name}`,
          { error: String(error) },
          { audience: ["assistant"], priority: 0.3 }
        );
      }
    }
  );

  // Sample documents from an index
  server.resource(
    "indexes/{indexName}/sample",
    "Sample documents from an index",
    async ({ indexName }: any) => {
      try {
        const c = getClient();
        
        // Get a small sample of documents
        const searchResult = await c.searchDocuments(indexName, {
          search: "*",
          top: 5,
          select: undefined // Get all fields
        });
        
        return createResourceResponse(
          `indexes/${indexName}/sample`,
          `${indexName} Sample`,
          `📄 Sample Documents: ${indexName}`,
          `Sample of up to 5 documents from ${indexName}`,
          {
            indexName,
            documentCount: searchResult["@odata.count"] || "unknown",
            sample: searchResult.value,
            sampleSize: searchResult.value?.length || 0
          },
          {
            audience: ["assistant"],
            priority: 0.6,
            lastModified: new Date().toISOString()
          }
        );
      } catch (error) {
        return createResourceResponse(
          `indexes/${indexName}/sample`,
          `${indexName} Sample`,
          `📄 Sample Documents: ${indexName} (Error)`,
          `Failed to retrieve sample from ${indexName}`,
          { error: String(error) },
          { audience: ["assistant"], priority: 0.3 }
        );
      }
    }
  );

  // ---------------- RESOURCE TEMPLATES ----------------
  
  // Dynamic search results resource template
  server.resourceTemplate?.(
    "search/{indexName}/{query}",
    "Live search results from an index",
    async ({ indexName, query }: any) => {
      try {
        const c = getClient();
        
        const searchResult = await c.searchDocuments(indexName, {
          search: query || "*",
          top: 10,
          count: true
        });
        
        return createResourceResponse(
          `search/${indexName}/${query || "*"}`,
          `Search: ${query || "all"}`,
          `🔎 Search Results: ${query || "*"} in ${indexName}`,
          `Top 10 results for "${query || "*"}" in ${indexName}`,
          {
            query: query || "*",
            indexName,
            totalResults: searchResult["@odata.count"],
            returnedResults: searchResult.value?.length || 0,
            results: searchResult.value
          },
          {
            audience: ["assistant"],
            priority: 0.7,
            lastModified: new Date().toISOString()
          }
        );
      } catch (error) {
        return createResourceResponse(
          `search/${indexName}/${query}`,
          `Search: ${query}`,
          `🔎 Search Error`,
          `Failed to search ${indexName}`,
          { error: String(error) },
          { audience: ["assistant"], priority: 0.3 }
        );
      }
    }
  );

  // Individual skillset details
  server.resource(
    "skillsets/{name}",
    "AI enrichment skillset configuration",
    async ({ name }: any) => {
      try {
        const c = getClient();
        const skillset = await c.getSkillset(name);
        
        // Enhanced skillset information
        const enhanced = {
          ...skillset,
          summary: {
            totalSkills: (skillset as any).skills?.length || 0,
            skillTypes: [...new Set((skillset as any).skills?.map((s: any) => 
              s["@odata.type"]?.split('.').pop()?.replace('Skill', '')
            ) || [])],
            hasKnowledgeStore: !!(skillset as any).knowledgeStore,
            cognitiveServicesType: (skillset as any).cognitiveServices?.["@odata.type"]?.split('.').pop() || "none"
          }
        };
        
        return createResourceResponse(
          `skillsets/${name}`,
          name,
          `🧠 Skillset: ${name}`,
          (skillset as any).description || "AI enrichment pipeline",
          enhanced,
          {
            audience: ["assistant", "user"],
            priority: 0.7,
            lastModified: new Date().toISOString()
          }
        );
      } catch (error) {
        return createResourceResponse(
          `skillsets/${name}`,
          name,
          `🧠 Skillset: ${name} (Error)`,
          "Failed to retrieve skillset",
          { error: String(error) },
          { audience: ["assistant"], priority: 0.2 }
        );
      }
    }
  );
// Additional dynamic Resource Templates

// 1) Live search via template with optional keyword, filter, and vector params
server.resourceTemplate?.(
  "indexes/{indexName}/search",
  "Live search within an index (supports q, top, select, filter, queryType, semanticConfiguration, vectorText, vectorK, vectorFields)",
  async (params: any) => {
    try {
      const c = getClient();
      const {
        indexName,
        q,
        top,
        select,
        filter,
        queryType,
        semanticConfiguration,
        vectorText,
        vectorK,
        vectorFields
      } = params || {};

      const body: Record<string, any> = {
        search: (q ?? "*"),
        count: true
      };

      if (top !== undefined) {
        const n = Number(top);
        if (!Number.isNaN(n)) body.top = n;
      }
      if (select) body.select = String(select);
      if (filter) body.filter = String(filter);
      if (queryType) body.queryType = String(queryType);
      if (semanticConfiguration) body.semanticConfiguration = String(semanticConfiguration);

      // Optional vector query (hybrid or pure vector)
      if (vectorText) {
        const k = vectorK !== undefined ? Number(vectorK) : 10;
        body.vectorQueries = [
          {
            kind: "text",
            text: String(vectorText),
            k: Number.isFinite(k) ? k : 10,
            ...(vectorFields ? { fields: String(vectorFields) } : {})
          }
        ];
      }

      const result = await c.searchDocuments(String(indexName), body);

      return createResourceResponse(
        `indexes/${indexName}/search`,
        `Search ${indexName}`,
        `🔎 Search: ${indexName}`,
        `Search results for ${q ?? "*"}`,
        {
          params: { indexName, q, top, select, filter, queryType, semanticConfiguration, vectorText, vectorK, vectorFields },
          totalResults: result["@odata.count"],
          returnedResults: Array.isArray((result as any).value) ? (result as any).value.length : 0,
          results: (result as any).value
        },
        {
          audience: ["assistant", "user"],
          priority: 0.9,
          lastModified: new Date().toISOString()
        }
      );
    } catch (error) {
      return createResourceResponse(
        `indexes/${params?.indexName}/search`,
        `Search ${params?.indexName}`,
        `🔎 Search Error`,
        `Failed to search index ${params?.indexName}`,
        { error: String(error) },
        { audience: ["assistant"], priority: 0.3 }
      );
    }
  }
);

// 2) Individual field details within an index
server.resourceTemplate?.(
  "indexes/{indexName}/fields/{fieldName}",
  "Inspect an index field definition and capabilities",
  async ({ indexName, fieldName }: any) => {
    try {
      const c = getClient();
      const def: any = await c.getIndex(String(indexName));
      const fields: any[] = Array.isArray(def?.fields) ? def.fields : [];
      const field = fields.find(
        (f: any) => String(f?.name || "").toLowerCase() === String(fieldName || "").toLowerCase()
      );

      if (!field) {
        return createResourceResponse(
          `indexes/${indexName}/fields/${fieldName}`,
          String(fieldName),
          `📌 Field: ${fieldName} (Not Found)`,
          `Field ${fieldName} not found in index ${indexName}`,
          { error: "Resource not found", indexName, fieldName },
          { audience: ["assistant"], priority: 0.2 }
        );
      }

      const derived = {
        isKey: !!field.key,
        isVectorField: field.type === "Collection(Edm.Single)",
        capabilities: {
          searchable: !!field.searchable,
          filterable: !!field.filterable,
          sortable: !!field.sortable,
          facetable: !!field.facetable,
          retrievable: field.retrievable !== false
        },
        analyzers: {
          analyzer: field.analyzer || null,
          searchAnalyzer: field.searchAnalyzer || null,
          indexAnalyzer: field.indexAnalyzer || null,
          normalizer: field.normalizer || null
        },
        vector: field.type === "Collection(Edm.Single)" ? {
          dimensions: field.dimensions ?? null,
          vectorSearchProfile: field.vectorSearchProfile ?? null
        } : null
      };

      return createResourceResponse(
        `indexes/${indexName}/fields/${fieldName}`,
        String(fieldName),
        `📌 Field: ${fieldName}`,
        `Field definition for ${fieldName} in index ${indexName}`,
        {
          indexName,
          fieldName,
          field,
          derived
        },
        {
          audience: ["assistant", "user"],
          priority: 0.6,
          lastModified: new Date().toISOString()
        }
      );
    } catch (error) {
      return createResourceResponse(
        `indexes/${indexName}/fields/${fieldName}`,
        String(fieldName),
        `📌 Field: ${fieldName} (Error)`,
        `Failed to retrieve field ${fieldName} in ${indexName}`,
        { error: String(error) },
        { audience: ["assistant"], priority: 0.3 }
      );
    }
  }
);

// 3) Specific skill details within a skillset
server.resourceTemplate?.(
  "skillsets/{name}/skills/{skillName}",
  "Inspect a specific skill configuration in a skillset",
  async ({ name, skillName }: any) => {
    try {
      const c = getClient();
      const skillset: any = await c.getSkillset(String(name));
      const skills: any[] = Array.isArray(skillset?.skills) ? skillset.skills : [];
      const skill = skills.find(
        (s: any) => String(s?.name || "").toLowerCase() === String(skillName || "").toLowerCase()
      );

      if (!skill) {
        return createResourceResponse(
          `skillsets/${name}/skills/${skillName}`,
          String(skillName),
          `🧩 Skill: ${skillName} (Not Found)`,
          `Skill ${skillName} not found in skillset ${name}`,
          { error: "Resource not found", skillset: name, skillName },
          { audience: ["assistant"], priority: 0.2 }
        );
      }

      const type = skill["@odata.type"]?.split(".").pop() || "Unknown";
      const summary = {
        type,
        inputs: Array.isArray(skill.inputs) ? skill.inputs.map((i: any) => ({ name: i.name, source: i.source })) : [],
        outputs: Array.isArray(skill.outputs) ? skill.outputs.map((o: any) => ({ name: o.name, targetName: o.targetName })) : [],
        context: skill.context || "/document"
      };

      return createResourceResponse(
        `skillsets/${name}/skills/${skillName}`,
        String(skillName),
        `🧩 Skill: ${skillName}`,
        `Skill configuration for ${skillName} in ${name}`,
        {
          skillset: name,
          skillName,
          skill,
          summary
        },
        {
          audience: ["assistant", "user"],
          priority: 0.6,
          lastModified: new Date().toISOString()
        }
      );
    } catch (error) {
      return createResourceResponse(
        `skillsets/${name}/skills/${skillName}`,
        String(skillName),
        `🧩 Skill: ${skillName} (Error)`,
        `Failed to retrieve skill ${skillName} in ${name}`,
        { error: String(error) },
        { audience: ["assistant"], priority: 0.3 }
      );
    }
  }
);


  // Note: The server capabilities declare support for listChanged notifications.
  // In a production environment with proper MCP notification support,
  // you would implement periodic checks for resource list changes.
}
