// Simple Azure Search REST API client for Cloudflare Workers
export class AzureSearchClient {
  private endpoint: string;
  private apiKey: string;
  private apiVersion = "2025-08-01-preview";

  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  private json(o: any) {
    return JSON.stringify(o);
  }

  private headers(extra: Record<string,string> = {}) {
    return {
      "api-key": this.apiKey,
      "content-type": "application/json",
      ...extra,
    };
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
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
  async listIndexes() {
    const result = await this.request('/indexes');
    return result.value || [];
  }

  async getIndex(indexName: string) {
    return this.request(`/indexes/${indexName}`);
  }

  async createOrUpdateIndex(indexName: string, indexDefinition: any) {
    return this.request(`/indexes/${indexName}`, {
      method: 'PUT',
      body: JSON.stringify(indexDefinition),
    });
  }

  async deleteIndex(indexName: string) {
    return this.request(`/indexes/${indexName}`, {
      method: 'DELETE',
    });
  }

  async getIndexStats(indexName: string) {
    return this.request(`/indexes/${indexName}/stats`);
  }

  // Document operations
  async searchDocuments(indexName: string, searchParams: any) {
    return this.request(`/indexes/${indexName}/docs/search`, {
      method: 'POST',
      body: JSON.stringify(searchParams),
    });
  }

  async getDocument(indexName: string, key: string, select?: string[]) {
    const params = select ? `?$select=${select.join(',')}` : '';
    return this.request(`/indexes/${indexName}/docs/${encodeURIComponent(key)}${params}`);
  }

  async getDocumentCount(indexName: string) {
    const result = await this.request(`/indexes/${indexName}/docs/$count`);
    return result;
  }

  // Data source operations
  async listDataSources() {
    const result = await this.request('/datasources');
    return result.value || [];
  }

  async getDataSource(name: string) {
    return this.request(`/datasources/${name}`);
  }

  async createOrUpdateDataSource(name: string, dataSourceDefinition: any) {
    return this.request(`/datasources/${name}`, {
      method: 'PUT',
      body: JSON.stringify(dataSourceDefinition),
    });
  }

  async deleteDataSource(name: string) {
    return this.request(`/datasources/${name}`, {
      method: 'DELETE',
    });
  }

  // Indexer operations
  async listIndexers() {
    const result = await this.request('/indexers');
    return result.value || [];
  }

  async getIndexer(name: string) {
    return this.request(`/indexers/${name}`);
  }

  async createOrUpdateIndexer(name: string, indexerDefinition: any) {
    return this.request(`/indexers/${name}`, {
      method: 'PUT',
      body: JSON.stringify(indexerDefinition),
    });
  }

  async deleteIndexer(name: string) {
    return this.request(`/indexers/${name}`, {
      method: 'DELETE',
    });
  }

  async runIndexer(name: string) {
    return this.request(`/indexers/${name}/run`, {
      method: 'POST',
    });
  }

  async resetIndexer(name: string) {
    return this.request(`/indexers/${name}/reset`, {
      method: 'POST',
    });
  }

  async getIndexerStatus(name: string) {
    return this.request(`/indexers/${name}/status`);
  }

  // Skillset operations
  async listSkillsets() {
    const result = await this.request('/skillsets');
    return result.value || [];
  }

  async getSkillset(name: string) {
    return this.request(`/skillsets/${name}`);
  }

  async createOrUpdateSkillset(name: string, skillsetDefinition: any) {
    return this.request(`/skillsets/${name}`, {
      method: 'PUT',
      body: JSON.stringify(skillsetDefinition),
    });
  }

  async deleteSkillset(name: string) {
    return this.request(`/skillsets/${name}`, {
      method: 'DELETE',
    });
  }

  // Synonym Map operations
  async listSynonymMaps() {
    const result = await this.request('/synonymmaps');
    return result.value || [];
  }

  async getSynonymMap(name: string) {
    return this.request(`/synonymmaps/${name}`);
  }

  async createOrUpdateSynonymMap(name: string, synonymMapDefinition: any) {
    return this.request(`/synonymmaps/${name}`, {
      method: 'PUT',
      body: JSON.stringify(synonymMapDefinition),
    });
  }

  async deleteSynonymMap(name: string) {
    return this.request(`/synonymmaps/${name}`, {
      method: 'DELETE',
    });
  }

  // Enhanced Index operations
  async createIndex(indexDefinition: any) {
    return this.request('/indexes', {
      method: 'POST',
      body: JSON.stringify(indexDefinition),
    });
  }

  // Enhanced Document operations
  async indexDocuments(indexName: string, batch: any) {
    return this.request(`/indexes/${indexName}/docs/index`, {
      method: 'POST',
      body: JSON.stringify(batch),
    });
  }

  async uploadDocuments(indexName: string, documents: any[]) {
    const batch = {
      value: documents.map(doc => ({
        '@search.action': 'upload',
        ...doc
      }))
    };
    return this.indexDocuments(indexName, batch);
  }

  async mergeDocuments(indexName: string, documents: any[]) {
    const batch = {
      value: documents.map(doc => ({
        '@search.action': 'merge',
        ...doc
      }))
    };
    return this.indexDocuments(indexName, batch);
  }

  async mergeOrUploadDocuments(indexName: string, documents: any[]) {
    const batch = {
      value: documents.map(doc => ({
        '@search.action': 'mergeOrUpload',
        ...doc
      }))
    };
    return this.indexDocuments(indexName, batch);
  }

  async deleteDocuments(indexName: string, keys: any[]) {
    const batch = {
      value: keys.map(key => ({
        '@search.action': 'delete',
        ...key
      }))
    };
    return this.indexDocuments(indexName, batch);
  }

  // -------- Service/Stats --------
  async getServiceStatistics() {
    return this.request(`/servicestats`);
  }
  async getIndexStatsSummary() {
    return this.request(`/indexstats`);
  }

  // -------- Analyze / Suggest / Autocomplete --------
  async analyzeText(indexName: string, body: any) {
    return this.request(`/indexes/${encodeURIComponent(indexName)}/search.analyze`, {
      method: "POST",
      body: this.json(body),
      headers: this.headers(),
    });
  }
  async suggest(indexName: string, body: any) {
    return this.request(`/indexes/${encodeURIComponent(indexName)}/docs/suggest`, {
      method: "POST",
      body: this.json(body),
      headers: this.headers(),
    });
  }
  async autocomplete(indexName: string, body: any) {
    return this.request(`/indexes/${encodeURIComponent(indexName)}/docs/autocomplete`, {
      method: "POST",
      body: this.json(body),
      headers: this.headers(),
    });
  }

  // -------- Knowledge Agents (preview) --------
  async listAgents() {
    return this.request(`/agents`);
  }
  async getAgent(agentName: string) {
    return this.request(`/agents('${encodeURIComponent(agentName)}')`);
  }
  async upsertAgent(agentName: string, agent: any, headers: Record<string,string> = {}) {
    return this.request(`/agents('${encodeURIComponent(agentName)}')`, {
      method: "PUT",
      headers: this.headers(headers),
      body: this.json(agent),
    });
  }
  async createAgent(agent: any) {
    return this.request(`/agents`, {
      method: "POST",
      headers: this.headers(),
      body: this.json(agent),
    });
  }
  async deleteAgent(agentName: string, headers: Record<string,string> = {}) {
    return this.request(`/agents('${encodeURIComponent(agentName)}')`, {
      method: "DELETE",
      headers: this.headers(headers),
    });
  }
}