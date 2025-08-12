// Simple Azure Search REST API client for Cloudflare Workers
export class AzureSearchClient {
  private endpoint: string;
  private apiKey: string;
  private apiVersion = "2024-07-01";

  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  private async request(path: string, options: RequestInit = {}) {
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
    const params = select ? `&$select=${select.join(',')}` : '';
    return this.request(`/indexes/${indexName}/docs/${key}${params}`);
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
}