// src/schemas.ts
import { z } from "zod";
import {
  MAX_SEARCH_RESULTS,
  DEFAULT_SEARCH_RESULTS,
  MAX_INDEXER_HISTORY,
  DEFAULT_INDEXER_HISTORY,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  MAX_DOCUMENTS_PER_BATCH,
  INDEX_NAME_PATTERN,
  FIELD_NAME_PATTERN,
  DEFAULT_INDEXER_SCHEDULE,
  DEFAULT_EXCLUDED_EXTENSIONS,
  DEFAULT_INDEXED_EXTENSIONS,
  ERROR_INVALID_INDEX_NAME,
  ERROR_INVALID_DOCUMENT_KEYS,
  ERROR_EMPTY_BATCH,
  ERROR_BATCH_TOO_LARGE
} from "./constants";

// Index name validation
export const IndexNameSchema = z.string()
  .min(1, "Index name is required")
  .max(128, "Index name must be at most 128 characters")
  .regex(INDEX_NAME_PATTERN, ERROR_INVALID_INDEX_NAME);

// Field name validation
export const FieldNameSchema = z.string()
  .min(1, "Field name is required")
  .max(128, "Field name must be at most 128 characters")
  .regex(FIELD_NAME_PATTERN, "Field name must start with a letter and contain only letters, numbers, and underscores");

// Document key validation
export const DocumentKeySchema = z.union([
  z.string().min(1, "Document key cannot be empty"),
  z.number()
]);

// Document schema for operations
export const DocumentSchema = z.object({
  "@search.action": z.enum(["upload", "merge", "mergeOrUpload", "delete"]).optional(),
}).catchall(z.unknown());

// Batch document validation
export const DocumentBatchSchema = z.array(DocumentSchema)
  .min(1, ERROR_EMPTY_BATCH)
  .max(MAX_DOCUMENTS_PER_BATCH, ERROR_BATCH_TOO_LARGE);

// Search parameters
export const SearchParamsSchema = z.object({
  indexName: IndexNameSchema,
  search: z.string().default("*").optional(),
  top: z.number()
    .int()
    .positive()
    .max(MAX_SEARCH_RESULTS)
    .default(DEFAULT_SEARCH_RESULTS)
    .describe(`Max ${MAX_SEARCH_RESULTS} to prevent large responses`),
  skip: z.number()
    .int()
    .nonnegative()
    .default(0)
    .describe("Skip N results for pagination"),
  select: z.array(z.string()).optional()
    .describe("Fields to return (reduces response size)"),
  filter: z.string().optional()
    .refine((val) => !val || !val.includes(";"), "Filter cannot contain semicolons for security"),
  orderBy: z.string().optional(),
  // Accept lowercase 'orderby' alias for convenience
  orderby: z.string().optional(),
  includeTotalCount: z.boolean().default(true)
});

// Pagination parameters
export const PaginationSchema = z.object({
  pageSize: z.number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  cursor: z.string().optional().describe("Opaque pagination cursor")
});

// Indexer configuration
export const IndexerConfigSchema = z.object({
  name: IndexNameSchema,
  dataSourceName: z.string().min(1),
  targetIndexName: IndexNameSchema,
  scheduleInterval: z.string().default(DEFAULT_INDEXER_SCHEDULE)
    .describe("ISO-8601 duration (e.g., PT2H)"),
  runNow: z.boolean().default(false),
  parsingMode: z.enum(["default", "jsonArray", "delimitedText", "lineSeparated"]).default("default"),
  dataToExtract: z.enum(["contentOnly", "contentAndMetadata", "storageMetadata"])
    .default("contentAndMetadata"),
  excludedFileNameExtensions: z.string().default(DEFAULT_EXCLUDED_EXTENSIONS),
  indexedFileNameExtensions: z.string().default(DEFAULT_INDEXED_EXTENSIONS),
  indexStorageMetadataOnlyForOversizedDocuments: z.boolean().default(true)
});

// Index field definition - use interface for recursive type
interface IndexFieldType {
  name: string;
  type: string;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  key?: boolean;
  retrievable?: boolean;
  analyzer?: string;
  searchAnalyzer?: string;
  indexAnalyzer?: string;
  normalizer?: string;
  synonymMaps?: string[];
  fields?: IndexFieldType[];
}

export const IndexFieldSchema: z.ZodType<IndexFieldType> = z.object({
  name: FieldNameSchema,
  type: z.enum([
    "Edm.String",
    "Edm.Int32",
    "Edm.Int64",
    "Edm.Double",
    "Edm.Boolean",
    "Edm.DateTimeOffset",
    "Edm.GeographyPoint",
    "Collection(Edm.String)",
    "Collection(Edm.Int32)",
    "Collection(Edm.Int64)",
    "Collection(Edm.Double)",
    "Collection(Edm.Boolean)",
    "Collection(Edm.DateTimeOffset)",
    "Collection(Edm.GeographyPoint)",
    "Edm.ComplexType",
    "Collection(Edm.ComplexType)"
  ]),
  searchable: z.boolean().optional(),
  filterable: z.boolean().optional(),
  sortable: z.boolean().optional(),
  facetable: z.boolean().optional(),
  key: z.boolean().optional(),
  retrievable: z.boolean().optional(),
  analyzer: z.string().optional(),
  searchAnalyzer: z.string().optional(),
  indexAnalyzer: z.string().optional(),
  normalizer: z.string().optional(),
  synonymMaps: z.array(z.string()).optional(),
  fields: z.lazy((): z.ZodType<IndexFieldType[]> => z.array(IndexFieldSchema)).optional()
});

// Index definition
export const IndexDefinitionSchema = z.object({
  name: IndexNameSchema,
  fields: z.array(IndexFieldSchema).min(1, "At least one field is required"),
  suggesters: z.array(z.any()).optional(),
  scoringProfiles: z.array(z.any()).optional(),
  analyzers: z.array(z.any()).optional(),
  charFilters: z.array(z.any()).optional(),
  tokenizers: z.array(z.any()).optional(),
  tokenFilters: z.array(z.any()).optional(),
  normalizers: z.array(z.any()).optional(),
  encryptionKey: z.any().optional(),
  similarity: z.any().optional(),
  semantic: z.any().optional(),
  vectorSearch: z.any().optional(),
  corsOptions: z.any().optional(),
  "@odata.etag": z.string().optional()
});

// Synonym map definition
export const SynonymMapSchema = z.object({
  name: z.string().min(1),
  synonyms: z.string().min(1, "Synonyms are required"),
  format: z.literal("solr").default("solr"),
  encryptionKey: z.any().optional(),
  "@odata.etag": z.string().optional()
});

// Data source connection
export const DataSourceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["azureblob", "azuresql", "cosmosdb", "azuretable"]),
  credentials: z.object({
    connectionString: z.string().min(1)
  }),
  container: z.object({
    name: z.string().min(1),
    query: z.string().optional()
  }),
  description: z.string().optional(),
  dataChangeDetectionPolicy: z.any().optional(),
  dataDeletionDetectionPolicy: z.any().optional(),
  "@odata.etag": z.string().optional()
});

// Indexer status
export const IndexerStatusSchema = z.object({
  status: z.enum(["running", "error", "unknown"]),
  lastResult: z.object({
    status: z.enum(["success", "transientFailure", "persistentFailure", "reset", "inProgress"]).optional(),
    errorMessage: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    itemsProcessed: z.number().optional(),
    itemsFailed: z.number().optional(),
    warnings: z.array(z.string()).optional()
  }).optional(),
  executionHistory: z.array(z.any()).optional(),
  limits: z.any().optional()
});

// Response schemas
export const SearchResultsSchema = z.object({
  value: z.array(z.any()),
  "@odata.count": z.number().optional(),
  "@search.nextPageParameters": z.any().optional(),
});

export const IndexListSchema = z.object({
  value: z.array(z.object({
    name: z.string(),
    defaultScoringProfile: z.string().optional(),
    corsOptions: z.any().optional(),
    fields: z.array(z.any()).optional()
  }))
});

export const OperationResultSchema = z.object({
  value: z.array(z.object({
    key: z.string(),
    status: z.boolean(),
    errorMessage: z.string().optional(),
    statusCode: z.number()
  }))
});

// Timeout wrapper configuration
export const TimeoutConfigSchema = z.object({
  timeoutMs: z.number().positive().default(30000),
  operation: z.string()
});
