// src/types.ts
import type { AzureSearchClient } from "./azure-search-client";
import type { Summarizer } from "./utils/response";

export type GetClient = () => AzureSearchClient;
export type GetSummarizer = () => Summarizer | null;

export interface ToolContext {
  getClient: GetClient;
  getSummarizer?: GetSummarizer;
  agent?: any; // Reference to the McpAgent instance for elicitation support
}