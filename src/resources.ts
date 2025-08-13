// src/resources.ts
import { formatResponse } from "./utils/response";

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
      name,
      title,
      description,
      mimeType: "application/json",
      text: typeof content === "string" ? content : JSON.stringify(content, null, 2),
      ...(annotations && { annotations })
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
        const indexes = await c.listIndexes();
        
        // Get stats for each index
        const indexesWithStats = await Promise.all(
          indexes.map(async (idx: any) => {
            try {
              const stats = await c.getIndexStats(idx.name);
              return {
                name: idx.name,
                fields: idx.fields?.length || 0,
                documentCount: stats?.documentCount || 0,
                storageSize: stats?.storageSize || 0,
                features: {
                  semantic: !!idx.semantic,
                  vectorSearch: !!idx.vectorSearch,
                  suggesters: idx.suggesters?.length > 0,
                  scoringProfiles: idx.scoringProfiles?.length > 0
                }
              };
            } catch {
              return {
                name: idx.name,
                fields: idx.fields?.length || 0,
                error: "Could not retrieve stats"
              };
            }
          })
        );
        
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

  // Note: The server capabilities declare support for listChanged notifications.
  // In a production environment with proper MCP notification support,
  // you would implement periodic checks for resource list changes.
}