// Lightweight in-memory mock for Azure Search REST client
// Provides enough surface for local testing without real Azure credentials.
// Intended for use when AZURE_SEARCH_MOCK=true.

import type {
  IndexDefinition,
  DataSource,
  SearchRequestBody,
  SearchResults,
  IndexBatch,
  IndexAction,
  OperationResult,
  SearchDocument
} from "./types";

type IndexStore = {
  name: string;
  fields: Array<any>;
  documents: Map<string, any>;
  semantic?: any;
  vectorSearch?: any;
  etag?: string;
};

type IndexerStore = {
  name: string;
  dataSourceName: string;
  targetIndexName: string;
  schedule?: { interval?: string };
  parameters?: any;
  fieldMappings?: any[];
  description?: string;
  lastResult?: {
    status: string;
    itemsProcessed?: number;
    itemsFailed?: number;
    startTime?: string;
    endTime?: string;
    errorMessage?: string;
    warnings?: string[];
  };
  executionHistory?: Array<{
    status: string;
    itemsProcessed?: number;
    itemsFailed?: number;
    startTime?: string;
    endTime?: string;
  }>;
};

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function pick<T extends object, K extends keyof T>(obj: T, keys?: string | string[]): Partial<T> | T {
  if (!keys) return obj;
  const arr = Array.isArray(keys) ? keys : String(keys).split(",").map(s => s.trim()).filter(Boolean);
  const out: any = {};
  for (const k of arr) {
    if ((obj as any)[k] !== undefined) out[k] = (obj as any)[k];
  }
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

function parseSimpleFilter(filter?: string) {
  // Extremely naive OData-ish filter for demo: e.g., "price lt 1000" or "category eq 'Electronics'"
  // Supports: eq, ne, lt, le, gt, ge for primitives
  if (!filter) return null;
  const m = filter.match(/^\s*([a-zA-Z0-9_]+)\s+(eq|ne|lt|le|gt|ge)\s+(.+)\s*$/);
  if (!m) return null;
  let [, field, op, rhs] = m;
  // Strip quotes for strings
  rhs = rhs.replace(/^'(.*)'$/, "$1");
  let num = Number(rhs);
  const isNum = !isNaN(num);
  const val = isNum ? num : rhs;
  return { field, op, val };
}

function applySimpleFilter<T extends Record<string, any>>(docs: T[], filter?: string): T[] {
  const f = parseSimpleFilter(filter);
  if (!f) return docs;
  return docs.filter(d => {
    const v = d[f.field];
    switch (f.op) {
      case "eq": return v === f.val;
      case "ne": return v !== f.val;
      case "lt": return Number(v) < Number(f.val);
      case "le": return Number(v) <= Number(f.val);
      case "gt": return Number(v) > Number(f.val);
      case "ge": return Number(v) >= Number(f.val);
      default: return true;
    }
  });
}

function applyOrderBy<T extends Record<string, any>>(docs: T[], orderby?: string): T[] {
  if (!orderby) return docs;
  // e.g., "price desc" or "rating asc"
  const m = orderby.match(/^\s*([a-zA-Z0-9_]+)\s*(asc|desc)?\s*$/);
  if (!m) return docs;
  const [, field, dir] = m;
  const mult = (dir || "asc").toLowerCase() === "desc" ? -1 : 1;
  return [...docs].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av == null && bv == null) return 0;
    if (av == null) return -1 * mult;
    if (bv == null) return 1 * mult;
    if (av < bv) return -1 * mult;
    if (av > bv) return 1 * mult;
    return 0;
  });
}

function resolveKeyField(def: IndexStore): string {
  const k = def.fields.find((f: any) => f.key);
  return k?.name || "id";
}

export class AzureSearchClientMock {
  private indexes: Map<string, IndexStore> = new Map();
  private dataSources: Map<string, any> = new Map();
  private indexers: Map<string, IndexerStore> = new Map();
  private synonymMaps: Map<string, any> = new Map();

  constructor(_endpoint?: string, _apiKey?: string) {
    // Seed minimal demo data
    const products: IndexStore = {
      name: "products",
      fields: [
        { name: "id", type: "Edm.String", key: true },
        { name: "name", type: "Edm.String", searchable: true },
        { name: "price", type: "Edm.Double", filterable: true, sortable: true, facetable: true },
        { name: "category", type: "Edm.String", filterable: true, facetable: true },
        { name: "rating", type: "Edm.Double", filterable: true, sortable: true }
      ],
      documents: new Map<string, any>([
        ["1", { id: "1", name: "Laptop Pro 15", price: 1299, category: "Electronics", rating: 4.6 }],
        ["2", { id: "2", name: "Wireless Mouse", price: 29, category: "Electronics", rating: 4.1 }],
        ["3", { id: "3", name: "Standing Desk", price: 399, category: "Furniture", rating: 4.8 }]
      ])
    };

    const documents: IndexStore = {
      name: "documents",
      fields: [
        { name: "id", type: "Edm.String", key: true },
        { name: "title", type: "Edm.String", searchable: true },
        { name: "content", type: "Edm.String", searchable: true },
        { name: "timestamp", type: "Edm.DateTimeOffset", filterable: true, sortable: true }
      ],
      documents: new Map<string, any>([
        ["doc-001", { id: "doc-001", title: "Welcome", content: "Hello world", timestamp: nowIso() }],
        ["doc-002", { id: "doc-002", title: "Readme", content: "This is a mock document", timestamp: nowIso() }]
      ])
    };

    this.indexes.set(products.name, products);
    this.indexes.set(documents.name, documents);

    // Sample data sources
    this.dataSources.set("blob-datasource", { name: "blob-datasource", type: "azureblob", container: { name: "documents" } });

    // Sample indexers
    this.indexers.set("documents-indexer", {
      name: "documents-indexer",
      dataSourceName: "blob-datasource",
      targetIndexName: "documents",
      schedule: { interval: "PT2H" },
      parameters: {},
      fieldMappings: [{ sourceFieldName: "content", targetFieldName: "content" }],
      description: "Mock indexer",
      lastResult: {
        status: "success",
        itemsProcessed: 2,
        itemsFailed: 0,
        startTime: nowIso(),
        endTime: nowIso()
      },
      executionHistory: []
    });

    // Sample synonym map
    this.synonymMaps.set("product-synonyms", {
      name: "product-synonyms",
      format: "solr",
      synonyms: "laptop, notebook\nphone, smartphone\nTV, television"
    });
  }

  // --------- Index operations ---------
  async listIndexes(): Promise<Array<{ name: string; fields?: any[] }>> {
    return Array.from(this.indexes.values()).map(ix => ({ name: ix.name, fields: ix.fields }));
  }

  async listIndexesSelected(select: string): Promise<Array<{ name: string; [k: string]: any }>> {
    const all = Array.from(this.indexes.values()).map(ix => ({ name: ix.name, fields: ix.fields }));
    return all.map(ix => pick(ix, select) as any);
  }

  async getIndex(indexName: string): Promise<IndexDefinition | unknown> {
    const ix = this.indexes.get(indexName);
    if (!ix) throw new Error(`Index not found: ${indexName}`);
    return { name: ix.name, fields: deepClone(ix.fields) } as any;
    // Note: Add semantic / vectorSearch properties as needed by tests
  }

  async createIndex(indexDefinition: IndexDefinition): Promise<IndexDefinition | unknown> {
    const name = (indexDefinition as any).name || "unnamed";
    if (this.indexes.has(name)) throw new Error(`Index already exists: ${name}`);
    const store: IndexStore = {
      name,
      fields: deepClone((indexDefinition as any).fields || []),
      documents: new Map<string, any>()
    };
    this.indexes.set(name, store);
    return deepClone(indexDefinition);
  }

  async createOrUpdateIndex(indexName: string, indexDefinition: IndexDefinition, _etag?: string): Promise<IndexDefinition | unknown> {
    const exists = this.indexes.get(indexName);
    const store: IndexStore = exists || {
      name: indexName,
      fields: [],
      documents: new Map<string, any>()
    };
    store.fields = deepClone((indexDefinition as any).fields || store.fields);
    (store as any).semantic = (indexDefinition as any).semantic || store.semantic;
    (store as any).vectorSearch = (indexDefinition as any).vectorSearch || store.vectorSearch;
    this.indexes.set(indexName, store);
    return deepClone(indexDefinition);
  }

  async deleteIndex(indexName: string): Promise<unknown> {
    this.indexes.delete(indexName);
    return null;
  }

  async getIndexStats(indexName: string): Promise<unknown> {
    const ix = this.indexes.get(indexName);
    if (!ix) throw new Error(`Index not found: ${indexName}`);
    let storage = 0;
    for (const doc of ix.documents.values()) {
      storage += JSON.stringify(doc).length;
    }
    return {
      documentCount: ix.documents.size,
      storageSize: storage
    };
  }

  // --------- Document operations ---------
  async searchDocuments(indexName: string, searchParams: SearchRequestBody & any): Promise<SearchResults> {
    const ix = this.indexes.get(indexName);
    if (!ix) throw new Error(`Index not found: ${indexName}`);
    const keyField = resolveKeyField(ix);

    let items = Array.from(ix.documents.values());

    // "search": super naive full-text over string fields
    const query = String(searchParams.search ?? "*").trim();
    if (query !== "*" && query.length > 0) {
      const q = query.toLowerCase();
      items = items.filter(doc =>
        Object.values(doc).some(v => typeof v === "string" && v.toLowerCase().includes(q))
      );
    }

    // filter/orderby
    items = applySimpleFilter(items, searchParams.filter || searchParams.$filter);
    items = applyOrderBy(items, searchParams.orderby || searchParams.$orderby);

    const total = searchParams.count ? items.length : undefined;

    // pagination
    const top = Number(searchParams.top ?? 10);
    const skip = Number(searchParams.skip ?? 0);
    const paged = items.slice(skip, skip + top);

    // select
    const selected = paged.map(d => {
      const sel = searchParams.select;
      if (!sel) return d;
      const keys = Array.isArray(sel) ? sel.join(",") : sel;
      return pick(d, keys);
    });

    const results = selected.map(d => ({
      "@search.score": 1.0,
      ...d
    }));

    // Facets: naive placeholder
    const facets = searchParams.facets
      ? searchParams.facets.reduce((acc: any, f: string) => {
          const counts: Record<string, number> = {};
          for (const doc of items) {
            const v = (doc as any)[f];
            if (v == null) continue;
            const key = String(v);
            counts[key] = (counts[key] || 0) + 1;
          }
          acc[f] = Object.entries(counts).map(([value, count]) => ({ value, count }));
          return acc;
        }, {})
      : undefined;

    const resp: any = {
      value: results
    };
    if (total !== undefined) resp["@odata.count"] = total;
    if (facets) resp["@search.facets"] = facets;
    return resp;
  }

  async getDocument(indexName: string, key: string, select?: string[]): Promise<unknown> {
    const ix = this.indexes.get(indexName);
    if (!ix) throw new Error(`Index not found: ${indexName}`);
    const doc = ix.documents.get(String(key));
    if (!doc) throw new Error(`Document not found: ${key}`);
    if (!select || select.length === 0) return deepClone(doc);
    return pick(doc, select) as any;
  }

  async getDocumentCount(indexName: string): Promise<number> {
    const ix = this.indexes.get(indexName);
    if (!ix) throw new Error(`Index not found: ${indexName}`);
    return ix.documents.size;
  }

  private async applyIndexBatch(indexName: string, batch: IndexBatch): Promise<OperationResult> {
    const ix = this.indexes.get(indexName);
    if (!ix) throw new Error(`Index not found: ${indexName}`);
    const keyField = resolveKeyField(ix);

    const results: Array<{ key: string; status: number; errorMessage?: string }> = [];

    for (const action of batch.value as IndexAction[]) {
      const act = (action as any)["@search.action"];
      const keyVal = (action as any)[keyField];
      const key = keyVal != null ? String(keyVal) : undefined;

      if (!key) {
        results.push({ key: "<missing>", status: 400, errorMessage: `Missing key field '${keyField}'` });
        continue;
      }

      try {
        if (act === "upload") {
          ix.documents.set(key, deepClone(action));
          results.push({ key, status: 201 });
        } else if (act === "merge") {
          const existing = ix.documents.get(key);
          if (!existing) throw new Error("Document not found for merge");
          ix.documents.set(key, { ...existing, ...deepClone(action) });
          results.push({ key, status: 200 });
        } else if (act === "mergeOrUpload") {
          const existing = ix.documents.get(key);
          if (existing) {
            ix.documents.set(key, { ...existing, ...deepClone(action) });
            results.push({ key, status: 200 });
          } else {
            ix.documents.set(key, deepClone(action));
            results.push({ key, status: 201 });
          }
        } else if (act === "delete") {
          ix.documents.delete(key);
          results.push({ key, status: 200 });
        } else {
          results.push({ key, status: 400, errorMessage: `Unknown action: ${act}` });
        }
      } catch (err: any) {
        results.push({ key, status: 500, errorMessage: err?.message || String(err) });
      }
    }

    return {
      // Azure returns a batch result; we return minimal info
      results
    } as any;
  }

  async indexDocuments(indexName: string, batch: IndexBatch): Promise<OperationResult> {
    return this.applyIndexBatch(indexName, batch);
  }

  async uploadDocuments(indexName: string, documents: SearchDocument[]): Promise<OperationResult> {
    const batch: IndexBatch = {
      value: (documents as any[]).map(d => (d["@search.action"] ? d : { "@search.action": "upload", ...d })) as IndexAction[]
    };
    return this.applyIndexBatch(indexName, batch);
  }

  async mergeDocuments(indexName: string, documents: SearchDocument[]): Promise<OperationResult> {
    const batch: IndexBatch = {
      value: (documents as any[]).map(d => (d["@search.action"] ? d : { "@search.action": "merge", ...d })) as IndexAction[]
    };
    return this.applyIndexBatch(indexName, batch);
  }

  async mergeOrUploadDocuments(indexName: string, documents: SearchDocument[]): Promise<OperationResult> {
    const batch: IndexBatch = {
      value: (documents as any[]).map(d => (d["@search.action"] ? d : { "@search.action": "mergeOrUpload", ...d })) as IndexAction[]
    };
    return this.applyIndexBatch(indexName, batch);
  }

  async deleteDocuments(indexName: string, keyDocuments: Array<Record<string, unknown>>): Promise<OperationResult> {
    const ix = this.indexes.get(indexName);
    if (!ix) throw new Error(`Index not found: ${indexName}`);
    const keyField = resolveKeyField(ix);
    const batch: IndexBatch = {
      value: keyDocuments.map(d => (d["@search.action"] ? d : { "@search.action": "delete", ...d })) as any
    };
    return this.applyIndexBatch(indexName, batch);
  }

  // --------- Data source operations ---------
  async listDataSources(_select?: string): Promise<unknown[]> {
    return Array.from(this.dataSources.values()).map(ds => deepClone(ds));
  }

  async getDataSource(name: string): Promise<unknown> {
    const ds = this.dataSources.get(name);
    if (!ds) throw new Error(`Data source not found: ${name}`);
    return deepClone(ds);
  }

  async createOrUpdateDataSource(name: string, dataSourceDefinition: DataSource): Promise<DataSource | unknown> {
    const ds = deepClone(dataSourceDefinition as any);
    ds.name = name;
    this.dataSources.set(name, ds);
    return ds;
  }

  async deleteDataSource(name: string): Promise<unknown> {
    this.dataSources.delete(name);
    return null;
  }

  // --------- Indexer operations ---------
  async listIndexers(): Promise<unknown[]> {
    return Array.from(this.indexers.values()).map(ix => ({ name: ix.name }));
  }

  async getIndexer(name: string): Promise<unknown> {
    const ix = this.indexers.get(name);
    if (!ix) throw new Error(`Indexer not found: ${name}`);
    return deepClone(ix);
  }

  async createOrUpdateIndexer(
    name: string,
    indexerDefinition: unknown,
    _options: {
      ignoreResetRequirements?: boolean;
      disableCacheReprocessingChangeDetection?: boolean;
      ifMatch?: string;
      ifNoneMatch?: string;
    } = {}
  ): Promise<unknown> {
    const input = deepClone(indexerDefinition as any);
    const current = this.indexers.get(name);
    const merged: IndexerStore = {
      name,
      dataSourceName: input.dataSourceName ?? current?.dataSourceName,
      targetIndexName: input.targetIndexName ?? current?.targetIndexName,
      schedule: input.schedule ?? current?.schedule,
      parameters: input.parameters ?? current?.parameters,
      fieldMappings: input.fieldMappings ?? current?.fieldMappings,
      description: input.description ?? current?.description,
      lastResult: current?.lastResult,
      executionHistory: current?.executionHistory || []
    } as IndexerStore;

    this.indexers.set(name, merged);
    return deepClone(merged);
  }

  async deleteIndexer(name: string): Promise<unknown> {
    this.indexers.delete(name);
    return null;
  }

  async runIndexer(name: string): Promise<unknown> {
    const ix = this.indexers.get(name);
    if (!ix) throw new Error(`Indexer not found: ${name}`);

    const target = this.indexes.get(ix.targetIndexName);
    const processed = target ? target.documents.size : 0;
    const start = nowIso();
    const end = nowIso();

    const result = {
      status: "success",
      itemsProcessed: processed,
      itemsFailed: 0,
      startTime: start,
      endTime: end
    };

    ix.lastResult = result;
    ix.executionHistory = ix.executionHistory || [];
    ix.executionHistory.unshift(result);

    return null;
  }

  async resetIndexer(_name: string): Promise<unknown> {
    return null;
  }

  async resetIndexerDocs(_name: string, _keysOrIds?: { documentKeys?: string[]; datasourceDocumentIds?: string[] }, _overwrite = false): Promise<unknown> {
    return null;
  }

  async resyncIndexer(_name: string, _options: Array<"permissions">): Promise<unknown> {
    return null;
  }

  async getIndexerStatus(name: string): Promise<unknown> {
    const ix = this.indexers.get(name);
    if (!ix) throw new Error(`Indexer not found: ${name}`);
    return deepClone({
      name: ix.name,
      status: ix.lastResult?.status || "success",
      lastResult: ix.lastResult,
      executionHistory: ix.executionHistory || []
    });
  }

  // --------- Skillsets (minimal) ---------
  async listSkillsets(_select?: string): Promise<unknown[]> {
    return [];
  }
  async getSkillset(_name: string): Promise<unknown> {
    throw new Error("Skillset not found");
  }
  async createSkillset(skillsetDefinition: unknown): Promise<unknown> {
    return deepClone(skillsetDefinition as any);
  }
  async createOrUpdateSkillset(name: string, skillsetDefinition: unknown, _additionalHeaders?: Record<string, string>): Promise<unknown> {
    return { name, ...(skillsetDefinition as any) };
  }
  async deleteSkillset(_name: string, _additionalHeaders?: Record<string, string>): Promise<unknown> {
    return null;
  }
  async resetSkills(_skillsetName: string, _skillNames?: string[]): Promise<unknown> {
    return null;
  }

  // --------- Synonym maps ---------
  async listSynonymMaps(): Promise<unknown[]> {
    return Array.from(this.synonymMaps.values()).map(sm => deepClone(sm));
  }
  async getSynonymMap(name: string): Promise<unknown> {
    const sm = this.synonymMaps.get(name);
    if (!sm) throw new Error(`Synonym map not found: ${name}`);
    return deepClone(sm);
  }
  async createOrUpdateSynonymMap(name: string, synonymMapDefinition: any): Promise<any> {
    const def = { ...deepClone(synonymMapDefinition), name };
    this.synonymMaps.set(name, def);
    return def;
  }
  async deleteSynonymMap(name: string): Promise<unknown> {
    this.synonymMaps.delete(name);
    return null;
  }

  // --------- Service/Stats ---------
  async getServiceStatistics(): Promise<unknown> {
    let documents = 0;
    for (const ix of this.indexes.values()) {
      documents += ix.documents.size;
    }
    return {
      serviceName: "mock-azure-search",
      tier: "free",
      counters: {
        indexesCount: this.indexes.size,
        documentCount: documents,
        indexersCount: this.indexers.size,
        dataSourcesCount: this.dataSources.size,
        synonymMapsCount: this.synonymMaps.size
      },
      limits: {
        maxIndexesPerService: 3,
        maxStoragePerServiceInMb: 2048
      }
    };
  }

  async getIndexStatsSummary(): Promise<unknown> {
    return {
      value: Array.from(this.indexes.values()).map(ix => {
        let storage = 0;
        for (const doc of ix.documents.values()) storage += JSON.stringify(doc).length;
        return { name: ix.name, documentCount: ix.documents.size, storageSize: storage };
      })
    };
  }

  // --------- Analyze / Suggest / Autocomplete ---------
  async analyzeText(_indexName: string, body: Record<string, unknown>): Promise<unknown> {
    const text = String((body as any).text || "");
    const tokens = text.split(/\s+/).filter(Boolean);
    // Can return either array or { tokens: [...] } per ServiceTool usage
    return tokens;
  }

  async suggest(_indexName: string, body: Record<string, unknown>): Promise<unknown> {
    const t = String((body as any).search || "");
    return { value: t ? [{ text: t }] : [] };
  }

  async autocomplete(_indexName: string, body: Record<string, unknown>): Promise<unknown> {
    const t = String((body as any).search || "");
    return { value: t ? [{ queryPlusText: t }] : [] };
  }

  // --------- Knowledge Agents/Sources (stubs) ---------
  async listKnowledgeAgents(_verbose?: boolean): Promise<unknown> {
    return { value: [] };
  }
  async getKnowledgeAgent(_agentName: string): Promise<unknown> {
    throw new Error("Knowledge agent not found");
  }
  async createKnowledgeAgent(agent: unknown): Promise<unknown> {
    return deepClone(agent as any);
  }
  async createOrUpdateKnowledgeAgent(agentName: string, agent: unknown, _options: { ifMatch?: string; ifNoneMatch?: string } = {}): Promise<unknown> {
    return { name: agentName, ...(agent as any) };
  }
  async deleteKnowledgeAgent(_agentName: string, _options: { ifMatch?: string; ifNoneMatch?: string } = {}): Promise<unknown> {
    return null;
  }

  async listKnowledgeSources(_verbose?: boolean): Promise<unknown> {
    return { value: [] };
  }
  async getKnowledgeSource(_sourceName: string): Promise<unknown> {
    throw new Error("Knowledge source not found");
  }
  async createKnowledgeSource(source: unknown): Promise<unknown> {
    return deepClone(source as any);
  }
  async createOrUpdateKnowledgeSource(sourceName: string, source: unknown, _options: { ifMatch?: string; ifNoneMatch?: string } = {}): Promise<unknown> {
    return { name: sourceName, ...(source as any) };
  }
  async deleteKnowledgeSource(_sourceName: string, _options: { ifMatch?: string; ifNoneMatch?: string } = {}): Promise<unknown> {
    return null;
  }

  // --------- Index Aliases (stubs) ---------
  async listAliases(): Promise<unknown[]> {
    return [];
  }
  async getAlias(_aliasName: string): Promise<unknown> {
    throw new Error("Alias not found");
  }
  async createAlias(alias: { name: string; indexes: string[] }): Promise<unknown> {
    return deepClone(alias);
  }
  async createOrUpdateAlias(aliasName: string, alias: { name?: string; indexes: string[] }, _options: { ifMatch?: string; ifNoneMatch?: string } = {}): Promise<unknown> {
    return { name: aliasName, ...alias };
  }
  async deleteAlias(_aliasName: string, _options: { ifMatch?: string; ifNoneMatch?: string } = {}): Promise<unknown> {
    return null;
  }
}