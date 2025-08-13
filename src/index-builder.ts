// Enhanced Index Builder with TypeScript types and validation
import { resolveAnalyzerForLanguage } from "./utils/languageAnalyzers";
export interface FieldDefinition {
  name: string;
  type: 'Edm.String' | 'Edm.Int32' | 'Edm.Int64' | 'Edm.Double' | 'Edm.Boolean' | 
        'Edm.DateTimeOffset' | 'Edm.GeographyPoint' | 'Collection(Edm.String)' | 
        'Collection(Edm.Single)' | 'Collection(Edm.Int32)' | 'Collection(Edm.Double)';
  key?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  retrievable?: boolean;
  analyzer?: string;
  searchAnalyzer?: string;
  indexAnalyzer?: string;
  normalizer?: string;
  dimensions?: number; // For vector fields
  vectorSearchProfile?: string;
  synonymMaps?: string[];
}

export interface VectorSearchConfig {
  algorithms: Array<{
    name: string;
    kind: 'hnsw' | 'exhaustiveKnn';
    hnswParameters?: {
      metric: 'cosine' | 'euclidean' | 'dotProduct';
      m?: number;
      efConstruction?: number;
      efSearch?: number;
    };
    exhaustiveKnnParameters?: {
      metric: 'cosine' | 'euclidean' | 'dotProduct';
    };
  }>;
  profiles: Array<{
    name: string;
    algorithm: string;
    vectorizer?: string;
    compression?: string;
  }>;
  vectorizers?: Array<{
    name: string;
    kind: 'azureOpenAI' | 'customWebApi';
    azureOpenAIParameters?: any;
    customWebApiParameters?: any;
  }>;
}

export interface SemanticConfig {
  defaultConfiguration?: string;
  configurations: Array<{
    name: string;
    prioritizedFields: {
      titleField?: { fieldName: string };
      prioritizedContentFields?: Array<{ fieldName: string }>;
      prioritizedKeywordsFields?: Array<{ fieldName: string }>;
    };
  }>;
}

export interface IndexDefinition {
  name: string;
  fields: FieldDefinition[];
  suggesters?: any[];
  scoringProfiles?: any[];
  analyzers?: any[];
  tokenizers?: any[];
  tokenFilters?: any[];
  charFilters?: any[];
  normalizers?: any[];
  corsOptions?: any;
  encryptionKey?: any;
  similarity?: any;
  semantic?: SemanticConfig;
  vectorSearch?: VectorSearchConfig;
  '@odata.etag'?: string;
}

export class IndexBuilder {
  private definition: IndexDefinition;
  
  constructor(name: string) {
    this.definition = {
      name,
      fields: []
    };
  }
  
  // Field builders with validation
  /**
   * Add the required key field.
   * NOTE: Azure AI Search only allows Edm.String keys. Any other type will be rejected by the
   * service, so we enforce the rule here early.
   */
  addKeyField(name: string, type: 'Edm.String' = 'Edm.String'): this {
    if (type !== 'Edm.String') {
      throw new Error('Azure AI Search requires the key field to be type Edm.String');
    }

    // Check if key field already exists
    if (this.definition.fields.some(f => f.key)) {
      throw new Error('Index already has a key field');
    }
    
    this.definition.fields.push({
      name,
      type,
      key: true,
      // Required key-field flags per Azure Search spec
      searchable: false,
      filterable: true,
      retrievable: true,
      sortable: false,
      facetable: false
    });
    return this;
  }
  
  addTextField(name: string, options: {
    searchable?: boolean;
    filterable?: boolean;
    sortable?: boolean;
    facetable?: boolean;
    analyzer?: string;
    synonymMaps?: string[];
  } = {}): this {
    this.definition.fields.push({
      name,
      type: 'Edm.String',
      searchable: options.searchable ?? true,
      filterable: options.filterable ?? false,
      sortable: options.sortable ?? false,
      facetable: options.facetable ?? false,
      analyzer: options.analyzer ?? 'standard.lucene',
      synonymMaps: options.synonymMaps
    });
    return this;
  }
  
  addNumericField(name: string, type: 'Edm.Int32' | 'Edm.Int64' | 'Edm.Double', options: {
    filterable?: boolean;
    sortable?: boolean;
    facetable?: boolean;
  } = {}): this {
    this.definition.fields.push({
      name,
      type,
      searchable: false,
      filterable: options.filterable ?? true,
      sortable: options.sortable ?? true,
      facetable: options.facetable ?? false
    });
    return this;
  }
  
  addBooleanField(name: string, options: {
    filterable?: boolean;
    facetable?: boolean;
  } = {}): this {
    this.definition.fields.push({
      name,
      type: 'Edm.Boolean',
      searchable: false,
      filterable: options.filterable ?? true,
      sortable: true,
      facetable: options.facetable ?? true
    });
    return this;
  }
  
  addDateField(name: string, options: {
    filterable?: boolean;
    sortable?: boolean;
    facetable?: boolean;
  } = {}): this {
    this.definition.fields.push({
      name,
      type: 'Edm.DateTimeOffset',
      searchable: false,
      filterable: options.filterable ?? true,
      sortable: options.sortable ?? true,
      facetable: options.facetable ?? false
    });
    return this;
  }
  
  addVectorField(name: string, dimensions: number, profileName: string): this {
    this.definition.fields.push({
      name,
      type: 'Collection(Edm.Single)',
      searchable: true,
      filterable: false,
      sortable: false,
      facetable: false,
      retrievable: false, // Vectors are usually not retrieved
      dimensions,
      vectorSearchProfile: profileName,
      // Fix #2: Explicitly avoid setting 'stored' property - it's not allowed for vector fields
    });
    return this;
  }
  
  addCollectionField(name: string, itemType: 'String' | 'Int32' | 'Double', options: {
    searchable?: boolean;
    filterable?: boolean;
    facetable?: boolean;
  } = {}): this {
    const type = `Collection(Edm.${itemType})` as FieldDefinition['type'];
    this.definition.fields.push({
      name,
      type,
      searchable: options.searchable ?? (itemType === 'String'),
      // Collection fields cannot be filterable or sortable per service spec
      filterable: false,
      sortable: false,
      facetable: options.facetable ?? false
    });
    return this;
  }
  
  // Vector search configuration
  configureVectorSearch(dimensions: number, options: {
    metric?: 'cosine' | 'euclidean' | 'dotProduct';
    algorithmName?: string;
    profileName?: string;
    m?: number;
    efConstruction?: number;
    efSearch?: number;
  } = {}): this {
    const algorithmName = options.algorithmName || 'default-vector-algo';
    const profileName = options.profileName || 'default-vector-profile';
    
    this.definition.vectorSearch = {
      algorithms: [{
        name: algorithmName,
        kind: 'hnsw',
        hnswParameters: {
          metric: options.metric || 'cosine',
          m: options.m || 4,
          efConstruction: options.efConstruction || 400,
          efSearch: options.efSearch || 500
        }
      }],
      profiles: [{
        name: profileName,
        algorithm: algorithmName
      }]
    };
    
    return this;
  }
  
  // Semantic search configuration
  configureSemanticSearch(titleField: string, contentFields: string[], keywordFields?: string[]): this {
    this.definition.semantic = {
      configurations: [{
        name: 'default-semantic-config',
        prioritizedFields: {
          titleField: { fieldName: titleField },
          prioritizedContentFields: contentFields.map(f => ({ fieldName: f })),
          ...(keywordFields && {
            prioritizedKeywordsFields: keywordFields.map(f => ({ fieldName: f }))
          })
        }
      }]
    };
    return this;
  }
  
  // Language analyzer helpers
  setLanguageAnalyzer(fieldName: string, language: string): this {
    const field = this.definition.fields.find(f => f.name === fieldName);
    if (field) {
      field.analyzer = resolveAnalyzerForLanguage(language) ?? 'standard.lucene';
    }
    return this;
  }

  /** Apply a specific analyzer to all searchable Edm.String fields */
  applyAnalyzerToSearchableStrings(analyzer: string): this {
    for (const f of this.definition.fields) {
      if (f.type === 'Edm.String' && f.searchable) {
        f.analyzer = analyzer;
      }
    }
    return this;
  }

  /** Convenience: resolve analyzer from language and apply to all text fields */
  applyLanguageToAllText(language: string): this {
    const analyzer = resolveAnalyzerForLanguage(language);
    if (analyzer) {
      this.applyAnalyzerToSearchableStrings(analyzer);
    }
    return this;
  }
  
  // Add custom analyzer
  addCustomAnalyzer(name: string, tokenizerName: string, tokenFilters: string[]): this {
    if (!this.definition.analyzers) {
      this.definition.analyzers = [];
    }
    
    this.definition.analyzers.push({
      name,
      '@odata.type': '#Microsoft.Azure.Search.CustomAnalyzer',
      tokenizer: tokenizerName,
      tokenFilters
    });
    return this;
  }
  
  // Validation
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for key field
    const keyFields = this.definition.fields.filter(f => f.key);
    if (keyFields.length === 0) {
      errors.push('Index must have exactly one key field');
    } else if (keyFields.length > 1) {
      errors.push('Index can only have one key field');
    }
    
    // Check field names
    const fieldNames = new Set<string>();
    for (const field of this.definition.fields) {
      if (fieldNames.has(field.name)) {
        errors.push(`Duplicate field name: ${field.name}`);
      }
      fieldNames.add(field.name);
      
      // Validate field name format
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.name)) {
        errors.push(`Invalid field name: ${field.name}. Must start with letter and contain only letters, numbers, and underscores`);
      }
      
      // Validate vector fields
      if (field.type === 'Collection(Edm.Single)') {
        if (!field.dimensions || field.dimensions < 1) {
          errors.push(`Vector field ${field.name} must have dimensions > 0`);
        }
        if (!field.vectorSearchProfile) {
          errors.push(`Vector field ${field.name} must have a vectorSearchProfile`);
        }
      }
      
      // Validate collection fields
      if (field.type.startsWith('Collection(') && field.sortable) {
        errors.push(`Collection field ${field.name} cannot be sortable`);
      }
      // Collection fields are never filterable
      if (field.type.startsWith('Collection(') && field.filterable) {
        errors.push(`Collection field ${field.name} cannot be filterable`);
      }
    }
    
    // Validate semantic configuration
    if (this.definition.semantic) {
      for (const config of this.definition.semantic.configurations) {
        if (config.prioritizedFields.titleField) {
          const titleField = this.definition.fields.find(
            f => f.name === config.prioritizedFields.titleField?.fieldName
          );
          if (!titleField || !titleField.searchable) {
            errors.push(`Semantic title field ${config.prioritizedFields.titleField.fieldName} must exist and be searchable`);
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  // Build the final definition
  build(): IndexDefinition {
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`Index validation failed:\n${validation.errors.join('\n')}`);
    }
    
    // Fix #2: Clean up any 'stored' properties from vector fields before returning
    const cleanedDefinition = { ...this.definition };
    cleanedDefinition.fields = this.definition.fields.map(field => {
      if (field.type === 'Collection(Edm.Single)') {
        const { stored, ...cleanField } = field as any;
        return cleanField;
      }
      return field;
    });
    
    return cleanedDefinition;
  }
  
  // Clone an existing index with modifications
  static fromExisting(existingIndex: IndexDefinition, newName: string): IndexBuilder {
    const builder = new IndexBuilder(newName);
    builder.definition = JSON.parse(JSON.stringify(existingIndex));
    builder.definition.name = newName;
    delete builder.definition['@odata.etag'];
    return builder;
  }
}

// Pre-built index templates
export class IndexTemplates {
  static documentSearch(name: string): IndexBuilder {
    return new IndexBuilder(name)
      .addKeyField('id')
      .addTextField('title', { searchable: true, filterable: true, sortable: true })
      .addTextField('content', { searchable: true })
      .addTextField('summary', { searchable: true })
      .addTextField('author', { searchable: true, filterable: true, facetable: true })
      .addDateField('createdDate', { filterable: true, sortable: true })
      .addDateField('modifiedDate', { filterable: true, sortable: true })
      .addCollectionField('tags', 'String', { searchable: true, filterable: true, facetable: true })
      .addTextField('category', { filterable: true, facetable: true })
      .addNumericField('wordCount', 'Edm.Int32', { filterable: true, sortable: true });
  }
  
  static productCatalog(name: string): IndexBuilder {
    return new IndexBuilder(name)
      .addKeyField('productId')
      .addTextField('productName', { searchable: true, filterable: true, sortable: true })
      .addTextField('description', { searchable: true })
      .addTextField('brand', { searchable: true, filterable: true, facetable: true })
      .addTextField('category', { filterable: true, facetable: true })
      .addNumericField('price', 'Edm.Double', { filterable: true, sortable: true, facetable: true })
      .addNumericField('rating', 'Edm.Double', { filterable: true, sortable: true })
      .addNumericField('reviewCount', 'Edm.Int32', { filterable: true, sortable: true })
      .addBooleanField('inStock', { filterable: true, facetable: true })
      .addBooleanField('onSale', { filterable: true, facetable: true })
      .addCollectionField('colors', 'String', { filterable: true, facetable: true })
      .addCollectionField('sizes', 'String', { filterable: true, facetable: true });
  }
  
  static hybridSearch(name: string, vectorDimensions: number = 1536): IndexBuilder {
    return new IndexBuilder(name)
      .addKeyField('id')
      .addTextField('content', { searchable: true })
      .addTextField('title', { searchable: true, filterable: true, sortable: true })
      .addVectorField('contentVector', vectorDimensions, 'default-vector-profile')
      .addTextField('source', { filterable: true, facetable: true })
      .addDateField('lastModified', { filterable: true, sortable: true })
      .configureVectorSearch(vectorDimensions)
      .configureSemanticSearch('title', ['content'], ['source']);
  }
  
  static knowledgeBase(name: string): IndexBuilder {
    return new IndexBuilder(name)
      .addKeyField('id')
      .addTextField('question', { searchable: true, filterable: true })
      .addTextField('answer', { searchable: true })
      .addTextField('category', { searchable: true, filterable: true, facetable: true })
      .addTextField('subcategory', { filterable: true, facetable: true })
      .addCollectionField('relatedQuestions', 'String', { searchable: true })
      .addNumericField('helpfulVotes', 'Edm.Int32', { filterable: true, sortable: true })
      .addNumericField('viewCount', 'Edm.Int32', { filterable: true, sortable: true })
      .addDateField('createdDate', { filterable: true, sortable: true })
      .addDateField('updatedDate', { filterable: true, sortable: true })
      .addTextField('author', { filterable: true, facetable: true })
      .addBooleanField('isVerified', { filterable: true, facetable: true });
  }
}
