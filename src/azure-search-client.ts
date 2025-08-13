// Simple Azure Search REST API client for Cloudflare Workers
import type {
  IndexDefinition,
  SynonymMap,
  DataSource,
  SearchRequestBody,
  SearchResults,
  IndexBatch,
  OperationResult,
  SearchDocument,
} from "./types";

export class AzureSearchClient {
  private endpoint: string;
  private apiKey: string;
  private apiVersion = "2025-08-01-preview";

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
    const url = `${this.endpoint}${path}${path.includes('?') ? '&' : '?'}api-version=${this.apiVersion}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure Search API error (${response.status}): ${errorText}`);
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
    return this.request(`/indexes/${indexName}`);
  }

  async createOrUpdateIndex(indexName: string, indexDefinition: IndexDefinition): Promise<IndexDefinition | unknown> {
    return this.request(`/indexes/${indexName}`, {
      method: 'PUT',
      body: JSON.stringify(indexDefinition),
    });
  }

  async deleteIndex(indexName: string): Promise<unknown> {
    return this.request(`/indexes/${indexName}`, {
      method: 'DELETE',
    });
  }

  async getIndexStats(indexName: string): Promise<unknown> {
    return this.request(`/indexes/${indexName}/stats`);
  }

  // Document operations
  async searchDocuments(indexName: string, searchParams: SearchRequestBody): Promise<SearchResults> {
    return this.request(`/indexes/${indexName}/docs/search`, {
      method: 'POST',
      body: JSON.stringify(searchParams),
    }) as Promise<SearchResults>;
  }

  async getDocument(indexName: string, key: string, select?: string[]): Promise<unknown> {
    const params = select ? `?$select=${select.join(',')}` : '';
    return this.request(`/indexes/${indexName}/docs/${encodeURIComponent(key)}${params}`);
  }

  async getDocumentCount(indexName: string): Promise<number> {
    const result = (await this.request(`/indexes/${indexName}/docs/$count`)) as number;
    return result;
  }

  // Data source operations
  async listDataSources(): Promise<unknown[]> {
    const result = (await this.request('/datasources')) as { value?: unknown[] };
    return result.value || [];
  }

  async getDataSource(name: string): Promise<unknown> {
    return this.request(`/datasources/${name}`);
  }

  async createOrUpdateDataSource(name: string, dataSourceDefinition: DataSource): Promise<DataSource | unknown> {
    return this.request(`/datasources/${name}`, {
      method: 'PUT',
      body: JSON.stringify(dataSourceDefinition),
    });
  }

  async deleteDataSource(name: string): Promise<unknown> {
    return this.request(`/datasources/${name}`, {
      method: 'DELETE',
    });
  }

  // Indexer operations
  async listIndexers(): Promise<unknown[]> {
    const result = (await this.request('/indexers')) as { value?: unknown[] };
    return result.value || [];
  }

  async getIndexer(name: string): Promise<unknown> {
    return this.request(`/indexers/${name}`);
  }

  async createOrUpdateIndexer(name: string, indexerDefinition: unknown): Promise<unknown> {
    return this.request(`/indexers/${name}`, {
      method: 'PUT',
      body: JSON.stringify(indexerDefinition),
    });
  }

  async deleteIndexer(name: string): Promise<unknown> {
    return this.request(`/indexers/${name}`, {
      method: 'DELETE',
    });
  }

  async runIndexer(name: string): Promise<unknown> {
    return this.request(`/indexers/${name}/run`, {
      method: 'POST',
    });
  }

  async resetIndexer(name: string): Promise<unknown> {
    return this.request(`/indexers/${name}/reset`, {
      method: 'POST',
    });
  }

  async getIndexerStatus(name: string): Promise<unknown> {
    return this.request(`/indexers/${name}/status`);
  }

  // Skillset operations
  async listSkillsets(): Promise<unknown[]> {
    const result = (await this.request('/skillsets')) as { value?: unknown[] };
    return result.value || [];
  }

  async getSkillset(name: string): Promise<unknown> {
    return this.request(`/skillsets/${name}`);
  }

  async createOrUpdateSkillset(name: string, skillsetDefinition: unknown): Promise<unknown> {
    return this.request(`/skillsets/${name}`, {
      method: 'PUT',
      body: JSON.stringify(skillsetDefinition),
    });
  }

  async deleteSkillset(name: string): Promise<unknown> {
    return this.request(`/skillsets/${name}`, {
      method: 'DELETE',
    });
  }

  // Synonym Map operations
  async listSynonymMaps(): Promise<unknown[]> {
    const result = (await this.request('/synonymmaps')) as { value?: unknown[] };
    return result.value || [];
  }

  async getSynonymMap(name: string): Promise<unknown> {
    return this.request(`/synonymmaps/${name}`);
  }

  async createOrUpdateSynonymMap(name: string, synonymMapDefinition: SynonymMap): Promise<SynonymMap | unknown> {
    return this.request(`/synonymmaps/${name}`, {
      method: 'PUT',
      body: JSON.stringify(synonymMapDefinition),
    });
  }

  async deleteSynonymMap(name: string): Promise<unknown> {
    return this.request(`/synonymmaps/${name}`, {
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
    return this.request(`/indexes/${indexName}/docs/index`, {
      method: 'POST',
      body: JSON.stringify(batch),
    }) as Promise<OperationResult>;
  }

  async uploadDocuments(indexName: string, documents: SearchDocument[]): Promise<OperationResult> {
    const batch = {
      value: documents.map(doc => ({
        '@search.action': 'upload' as const,
        ...doc
      }))
    };
    return this.indexDocuments(indexName, batch);
  }

  async mergeDocuments(indexName: string, documents: SearchDocument[]): Promise<OperationResult> {
    const batch = {
      value: documents.map(doc => ({
        '@search.action': 'merge' as const,
        ...doc
      }))
    };
    return this.indexDocuments(indexName, batch);
  }

  async mergeOrUploadDocuments(indexName: string, documents: SearchDocument[]): Promise<OperationResult> {
    const batch = {
      value: documents.map(doc => ({
        '@search.action': 'mergeOrUpload' as const,
        ...doc
      }))
    };
    return this.indexDocuments(indexName, batch);
  }

  async deleteDocuments(indexName: string, keys: Array<Record<string, unknown> | string | number>): Promise<OperationResult> {
    const batch: IndexBatch = {
      value: keys.map((key) =>
        typeof key === 'object' && key !== null
          ? { '@search.action': 'delete', ...(key as Record<string, unknown>) }
          : { '@search.action': 'delete', key }
      ) as IndexBatch["value"],
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
    return this.request(`/indexes/${encodeURIComponent(indexName)}/search.analyze`, {
      method: "POST",
      body: this.json(body),
      headers: this.headers(),
    });
  }
  async suggest(indexName: string, body: Record<string, unknown>): Promise<unknown> {
    return this.request(`/indexes/${encodeURIComponent(indexName)}/docs/suggest`, {
      method: "POST",
      body: this.json(body),
      headers: this.headers(),
    });
  }
  async autocomplete(indexName: string, body: Record<string, unknown>): Promise<unknown> {
    return this.request(`/indexes/${encodeURIComponent(indexName)}/docs/autocomplete`, {
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
      headers: this.headers(headers),
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
