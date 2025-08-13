// Simple Azure Search REST API client for Cloudflare Workers
import { AZURE_SEARCH_API_VERSION } from "./constants";
import type {
  IndexDefinition,
  SynonymMap,
  DataSource,
  SearchRequestBody,
  SearchResults,
  IndexBatch,
  IndexAction,
  OperationResult,
  SearchDocument,
} from "./types";

export class AzureSearchClient {
  private endpoint: string;
  private apiKey: string;

  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  private json(o: unknown) {
    return JSON.stringify(o);
  }

  private headers(extra: Record<string,string> = {}) {
    return {
      "api-key": this.apiKey,
      "content-type": "application/json",
      ...extra,
    };
  }

  private async request(path: string, options: RequestInit = {}): Promise<unknown> {
    const url = `${this.endpoint}${path}${path.includes('?') ? '&' : '?'}api-version=${AZURE_SEARCH_API_VERSION}`;
    // Fix #8: Avoid duplicate headers by merging carefully
    // Build headers defensively – avoid duplicates (case-insensitive) that Cloudflare
    // treats as immutable and will throw “immutable headers”.
    const mergedHeaders: Record<string, string> = {};

    const addHeader = (k: string, v: string) => {
      const exists = Object.keys(mergedHeaders).find(h => h.toLowerCase() === k.toLowerCase());
      if (!exists) mergedHeaders[k] = v;
    };

    // 1) Copy any existing headers from options (object or Headers instance).
    if (options.headers) {
      if (options.headers instanceof Headers) {
        for (const [k, v] of options.headers.entries()) {
          if (v !== undefined && v !== null) addHeader(k, String(v));
        }
      } else {
        for (const [k, v] of Object.entries(options.headers as Record<string, string>)) {
          if (v !== undefined && v !== null) addHeader(k, String(v));
        }
      }
    }

    // 2) Ensure required auth / content headers are present exactly once.
    addHeader("api-key", this.apiKey);
    addHeader("Content-Type", "application/json");

    const headers: HeadersInit = mergedHeaders;
    
    // Basic retry-with-backoff for 429/503
    const maxRetries = 3;
    let attempt = 0;
    let response: Response;

    while (true) {
      response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.ok || (attempt >= maxRetries) || (response.status !== 429 && response.status !== 503)) {
        break;
      }

      // Retry-after header in seconds or milliseconds
      const ra = response.headers.get("Retry-After") || response.headers.get("retry-after-ms");
      const delayMs = ra ? (/ms$/i.test(ra) ? parseInt(ra, 10) : parseInt(ra, 10) * 1000) : (500 * Math.pow(2, attempt));
      await new Promise(r => setTimeout(r, isFinite(delayMs) ? delayMs : 1000));
      attempt += 1;
    }

    if (!response!.ok) {
      const errorText = await response!.text();
      // Fix #10: Preserve status code in error for better error handling
      const error: any = new Error(`Azure Search API error (${response!.status}): ${errorText}`);
      error.statusCode = response!.status;
      error.response = {
        status: response!.status,
        headers: response!.headers,
        body: errorText
      };
      throw error;
    }

    // Handle responses with no content
    // 204 No Content - returned by DELETE operations
    // 202 Accepted - returned by async operations like runIndexer, resetIndexer
    if (response.status === 204 || response.status === 202) {
      return null;
    }

    return response.json();
  }

  // Index operations
  async listIndexes(): Promise<Array<{ name: string; defaultScoringProfile?: string; corsOptions?: unknown; fields?: unknown[] }>> {
    const result = (await this.request('/indexes')) as { value?: Array<{ name: string; defaultScoringProfile?: string; corsOptions?: unknown; fields?: unknown[] }> };
    return result.value || [];
  }

  async getIndex(indexName: string): Promise<IndexDefinition | unknown> {
    return this.request(`/indexes('${encodeURIComponent(indexName)}')`);
  }

  async createOrUpdateIndex(indexName: string, indexDefinition: IndexDefinition, etag?: string): Promise<IndexDefinition | unknown> {
    // Fix #5: Use If-Match header for ETag, not in body
    const headers: HeadersInit = {};
    if (etag) {
      headers['If-Match'] = etag;
    }
    headers['Prefer'] = 'return=representation';
    
    // Remove @odata.etag from body if present
    const cleanDefinition = { ...indexDefinition };
    delete cleanDefinition['@odata.etag'];
    
    return this.request(`/indexes('${encodeURIComponent(indexName)}')`, {
      method: 'PUT',
      body: JSON.stringify(cleanDefinition),
      headers,
    });
  }

  async deleteIndex(indexName: string): Promise<unknown> {
    return this.request(`/indexes('${encodeURIComponent(indexName)}')`, {
      method: 'DELETE',
    });
  }

  async getIndexStats(indexName: string): Promise<unknown> {
    return this.request(`/indexes('${encodeURIComponent(indexName)}')/search.stats`);
  }

  // Document operations
  async searchDocuments(indexName: string, searchParams: SearchRequestBody): Promise<SearchResults> {
    return this.request(`/indexes('${encodeURIComponent(indexName)}')/docs/search`, {
      method: 'POST',
      body: JSON.stringify(searchParams),
    }) as Promise<SearchResults>;
  }

  async getDocument(indexName: string, key: string, select?: string[]): Promise<unknown> {
    const params = select ? `?$select=${select.join(',')}` : '';
    return this.request(`/indexes('${encodeURIComponent(indexName)}')/docs/${encodeURIComponent(key)}${params}`);
  }

  async getDocumentCount(indexName: string): Promise<number> {
    const result = (await this.request(`/indexes('${encodeURIComponent(indexName)}')/docs/$count`)) as number;
    return result;
  }

  // Data source operations
  async listDataSources(): Promise<unknown[]> {
    const result = (await this.request('/datasources')) as { value?: unknown[] };
    return result.value || [];
  }

  async getDataSource(name: string): Promise<unknown> {
    return this.request(`/datasources('${encodeURIComponent(name)}')`);
  }

  async createOrUpdateDataSource(name: string, dataSourceDefinition: DataSource): Promise<DataSource | unknown> {
    return this.request(`/datasources('${encodeURIComponent(name)}')`, {
      method: 'PUT',
      body: JSON.stringify(dataSourceDefinition),
      headers: this.headers({ Prefer: "return=representation" }),
    });
  }

  async deleteDataSource(name: string): Promise<unknown> {
    return this.request(`/datasources('${encodeURIComponent(name)}')`, {
      method: 'DELETE',
    });
  }

  // Indexer operations
  async listIndexers(): Promise<unknown[]> {
    const result = (await this.request('/indexers')) as { value?: unknown[] };
    return result.value || [];
  }

  async getIndexer(name: string): Promise<unknown> {
    return this.request(`/indexers('${encodeURIComponent(name)}')`);
  }

  async createOrUpdateIndexer(name: string, indexerDefinition: unknown): Promise<unknown> {
    return this.request(`/indexers('${encodeURIComponent(name)}')`, {
      method: 'PUT',
      body: JSON.stringify(indexerDefinition),
      headers: this.headers({ Prefer: "return=representation" }),
    });
  }

  async deleteIndexer(name: string): Promise<unknown> {
    return this.request(`/indexers('${encodeURIComponent(name)}')`, {
      method: 'DELETE',
    });
  }

  async runIndexer(name: string): Promise<unknown> {
    return this.request(`/indexers('${encodeURIComponent(name)}')/search.run`, {
      method: 'POST',
    });
  }

  async resetIndexer(name: string): Promise<unknown> {
    return this.request(`/indexers('${encodeURIComponent(name)}')/search.reset`, {
      method: 'POST',
    });
  }

  async getIndexerStatus(name: string): Promise<unknown> {
    return this.request(`/indexers('${encodeURIComponent(name)}')/search.status`);
  }

  // Skillset operations
  async listSkillsets(): Promise<unknown[]> {
    const result = (await this.request('/skillsets')) as { value?: unknown[] };
    return result.value || [];
  }

  async getSkillset(name: string): Promise<unknown> {
    return this.request(`/skillsets('${encodeURIComponent(name)}')`);
  }

  async createOrUpdateSkillset(name: string, skillsetDefinition: unknown): Promise<unknown> {
    return this.request(`/skillsets('${encodeURIComponent(name)}')`, {
      method: 'PUT',
      body: JSON.stringify(skillsetDefinition),
      headers: this.headers({ Prefer: "return=representation" }),
    });
  }

  async deleteSkillset(name: string): Promise<unknown> {
    return this.request(`/skillsets('${encodeURIComponent(name)}')`, {
      method: 'DELETE',
    });
  }

  // Synonym Map operations
  async listSynonymMaps(): Promise<unknown[]> {
    const result = (await this.request('/synonymmaps')) as { value?: unknown[] };
    return result.value || [];
  }

  async getSynonymMap(name: string): Promise<unknown> {
    return this.request(`/synonymmaps('${encodeURIComponent(name)}')`);
  }

  async createOrUpdateSynonymMap(name: string, synonymMapDefinition: SynonymMap): Promise<SynonymMap | unknown> {
    return this.request(`/synonymmaps('${encodeURIComponent(name)}')`, {
      method: 'PUT',
      body: JSON.stringify(synonymMapDefinition),
      headers: this.headers({ Prefer: "return=representation" }),
    });
  }

  async deleteSynonymMap(name: string): Promise<unknown> {
    return this.request(`/synonymmaps('${encodeURIComponent(name)}')`, {
      method: 'DELETE',
    });
  }

  // Enhanced Index operations
  async createIndex(indexDefinition: IndexDefinition): Promise<IndexDefinition | unknown> {
    return this.request('/indexes', {
      method: 'POST',
      body: JSON.stringify(indexDefinition),
    });
  }

  // Enhanced Document operations
  async indexDocuments(indexName: string, batch: IndexBatch): Promise<OperationResult> {
    return this.request(`/indexes('${encodeURIComponent(indexName)}')/docs/index`, {
      method: 'POST',
      body: JSON.stringify(batch),
    }) as Promise<OperationResult>;
  }

  async uploadDocuments(indexName: string, documents: SearchDocument[]): Promise<OperationResult> {
    const batch = {
      value: documents.map(doc => 
        doc['@search.action'] ? doc : {
          '@search.action': 'upload' as const,
          ...doc
        }
      ) as IndexAction[]
    };
    return this.indexDocuments(indexName, batch);
  }

  async mergeDocuments(indexName: string, documents: SearchDocument[]): Promise<OperationResult> {
    const batch = {
      value: documents.map(doc => 
        doc['@search.action'] ? doc : {
          '@search.action': 'merge' as const,
          ...doc
        }
      ) as IndexAction[]
    };
    return this.indexDocuments(indexName, batch);
  }

  async mergeOrUploadDocuments(indexName: string, documents: SearchDocument[]): Promise<OperationResult> {
    const batch = {
      value: documents.map(doc => 
        doc['@search.action'] ? doc : {
          '@search.action': 'mergeOrUpload' as const,
          ...doc
        }
      ) as IndexAction[]
    };
    return this.indexDocuments(indexName, batch);
  }

  async deleteDocuments(indexName: string, keyDocuments: Array<Record<string, unknown>>): Promise<OperationResult> {
    // keyDocuments should be objects with the key field(s) set, e.g., [{"id": "123"}, {"id": "456"}]
    // where "id" is the actual key field name in the index schema
    const batch: IndexBatch = {
      value: keyDocuments.map((doc) => {
        // If it already has an action, use it as-is, otherwise add delete action
        return doc['@search.action'] ? doc : { '@search.action': 'delete', ...doc };
      }) as IndexAction[],
    };
    return this.indexDocuments(indexName, batch);
  }

  // -------- Service/Stats --------
  async getServiceStatistics(): Promise<unknown> {
    return this.request(`/servicestats`);
  }
  async getIndexStatsSummary(): Promise<unknown> {
    return this.request(`/indexstats`);
  }

  // -------- Analyze / Suggest / Autocomplete --------
  async analyzeText(indexName: string, body: Record<string, unknown>): Promise<unknown> {
    return this.request(`/indexes('${encodeURIComponent(indexName)}')/search.analyze`, {
      method: "POST",
      body: this.json(body),
      headers: this.headers(),
    });
  }
  async suggest(indexName: string, body: Record<string, unknown>): Promise<unknown> {
    return this.request(`/indexes('${encodeURIComponent(indexName)}')/docs/suggest`, {
      method: "POST",
      body: this.json(body),
      headers: this.headers(),
    });
  }
  async autocomplete(indexName: string, body: Record<string, unknown>): Promise<unknown> {
    return this.request(`/indexes('${encodeURIComponent(indexName)}')/docs/autocomplete`, {
      method: "POST",
      body: this.json(body),
      headers: this.headers(),
    });
  }

  // -------- Knowledge Agents (preview) --------
  async listAgents(): Promise<unknown> {
    return this.request(`/agents`);
  }
  async getAgent(agentName: string): Promise<unknown> {
    return this.request(`/agents('${encodeURIComponent(agentName)}')`);
  }
  async upsertAgent(agentName: string, agent: unknown, headers: Record<string,string> = {}): Promise<unknown> {
    return this.request(`/agents('${encodeURIComponent(agentName)}')`, {
      method: "PUT",
      headers: this.headers({ Prefer: "return=representation", ...headers }),
      body: this.json(agent),
    });
  }
  async createAgent(agent: unknown): Promise<unknown> {
    return this.request(`/agents`, {
      method: "POST",
      headers: this.headers(),
      body: this.json(agent),
    });
  }
  async deleteAgent(agentName: string, headers: Record<string,string> = {}): Promise<unknown> {
    return this.request(`/agents('${encodeURIComponent(agentName)}')`, {
      method: "DELETE",
      headers: this.headers(headers),
    });
  }
}
