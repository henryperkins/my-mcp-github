// src/types.ts
import type { AzureSearchClient } from "./azure-search-client";
import type { Summarizer } from "./utils/response";
import { z } from "zod";
import {
  IndexDefinitionSchema,
  IndexFieldSchema,
  SearchResultsSchema,
  DataSourceSchema,
  SynonymMapSchema,
  SearchParamsSchema,
  DocumentSchema,
  DocumentBatchSchema,
  OperationResultSchema,
  PaginationSchema,
  IndexerStatusSchema,
} from "./schemas";

export type GetClient = () => AzureSearchClient;
export type GetSummarizer = () => Summarizer | null;

export interface ToolContext {
  getClient: GetClient;
  getSummarizer?: GetSummarizer;
  agent?: unknown; // Reference to the McpAgent instance for elicitation support
}

// Zod-inferred types for stronger safety across modules
export type IndexDefinition = z.infer<typeof IndexDefinitionSchema>;
export type IndexField = z.infer<typeof IndexFieldSchema>;
export type SearchResults = z.infer<typeof SearchResultsSchema>;
export type DataSource = z.infer<typeof DataSourceSchema>;
export type SynonymMap = z.infer<typeof SynonymMapSchema>;
export type SearchParams = z.infer<typeof SearchParamsSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type DocumentBatch = z.infer<typeof DocumentBatchSchema>;
export type OperationResult = z.infer<typeof OperationResultSchema>;
export type PaginationParams = z.infer<typeof PaginationSchema>;
export type IndexerStatus = z.infer<typeof IndexerStatusSchema>;

// Narrowed request/response shapes used by clients
export interface SearchRequestBody {
  search: string;
  top?: number;
  skip?: number;
  select?: string;
  filter?: string;
  orderby?: string;
  count?: boolean;
}

export type SearchDocument = Record<string, unknown>;
export type IndexActionType = "upload" | "merge" | "mergeOrUpload" | "delete";
export type IndexAction = { "@search.action": IndexActionType } & SearchDocument;
export interface IndexBatch { value: IndexAction[]; }
