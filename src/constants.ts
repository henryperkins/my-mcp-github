// src/constants.ts
/**
 * Application-wide constants for Azure Search MCP
 */

// Pagination limits
export const MAX_SEARCH_RESULTS = 50;
export const DEFAULT_SEARCH_RESULTS = 10;
export const MAX_INDEXER_HISTORY = 50;
export const DEFAULT_INDEXER_HISTORY = 5;
export const MAX_PAGE_SIZE = 200;
export const DEFAULT_PAGE_SIZE = 50;

// Timeouts (in milliseconds)
export const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
export const INDEXER_POLL_TIMEOUT_MS = 300000; // 5 minutes
export const DEFAULT_POLL_INTERVAL_MS = 5000; // 5 seconds

// Response size limits
export const MAX_RESPONSE_SIZE_BYTES = 20 * 1024; // 20KB threshold for summarization
export const MAX_RESPONSE_CHARS = 30000; // Maximum characters in response
export const DEFAULT_SUMMARY_MAX_TOKENS = 800; // Default max tokens for summarization

// Azure Search limits
export const MAX_DOCUMENTS_PER_BATCH = 1000;
export const MAX_FIELD_NAME_LENGTH = 128;
export const MAX_INDEX_NAME_LENGTH = 128;

// Default configurations
export const DEFAULT_OPENAI_DEPLOYMENT = "gpt-4o-mini";
export const DEFAULT_INDEXER_SCHEDULE = "PT2H"; // 2 hours
export const DEFAULT_EXCLUDED_EXTENSIONS = ".png,.jpg,.gif,.svg,.ico";
export const DEFAULT_INDEXED_EXTENSIONS = ".md,.ts,.js,.json,.yml,.yaml,.txt";

// API versions
export const AZURE_SEARCH_API_VERSION = "2025-08-01-preview";
export const AZURE_OPENAI_API_VERSION = "2024-08-01-preview";

// Error messages
export const ERROR_MISSING_ENDPOINT = "AZURE_SEARCH_ENDPOINT is not configured. Please set it as a Worker secret.";
export const ERROR_MISSING_API_KEY = "AZURE_SEARCH_API_KEY is not configured. Please set it as a Worker secret.";
export const ERROR_INVALID_INDEX_NAME = "Index name must contain only lowercase letters, numbers, and hyphens, and be at most 128 characters.";
export const ERROR_INVALID_DOCUMENT_KEYS = "Document keys must be strings or numbers.";
export const ERROR_EMPTY_BATCH = "At least one document must be provided.";
export const ERROR_BATCH_TOO_LARGE = `Maximum ${MAX_DOCUMENTS_PER_BATCH} documents per batch.`;

// Validation patterns
export const INDEX_NAME_PATTERN = /^[a-z0-9-]{1,128}$/;
export const FIELD_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;