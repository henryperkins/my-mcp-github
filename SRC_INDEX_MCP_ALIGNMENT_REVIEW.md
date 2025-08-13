# src/index.ts MCP Alignment Review (2025-08-01-preview Azure Search)

This document reviews the current `src/index.ts` implementation against the MCP alignment goals and the 2025-08-01-preview Azure Search spec, and lists targeted changes to fully align.

## Summary

- Core tools for indexes, documents, indexers, skillsets, and synonyms are present and usable.
- Missing MCP-native resource exposure, structured error mapping, progress notifications, and some preview endpoints (agents, knowledge sources).
- Add minimal client support for headers/Prefer/ETag and extend tools accordingly.

## Already Aligned

- Index + docs tools: Implements `listIndexes`, `getIndex`, `getIndexStats`, `searchDocuments`, `getDocument`, `countDocuments`, and full document indexing ops (`upload/merge/mergeOrUpload/delete`).
- Indexers + skillsets + synonyms: Implements list/get/create-or-update/delete plus `runIndexer`, `resetIndexer`, `getIndexerStatus`.
- Safety messaging: Destructive tools (e.g., `deleteIndex`, `deleteDocuments`) include clear warnings in descriptions.
- Response sizing: `formatResponse` truncates/summarizes large payloads with optional Azure OpenAI summarization.

## Gaps vs MCP Alignment

- Resources: No `server.resource(...)` implementations (e.g., `indexes/{indexName}`, `servicestats`, `indexstats`) and `capabilities.resources` not declared.
- Errors: Returns plain text via `formatError`; does not mark `isError` or map HTTP → MCP error codes; no `x-ms-request-id` surfaced.
- Progress: `runIndexer` returns immediately; no MCP `notification("progress", ...)` while polling `getIndexerStatus`.
- Hints: SDK doesn’t expose tool hint flags; rely on consistent “⚠️ DESTRUCTIVE” descriptions for destructive ops and concise idempotency notes.
- Pagination: No cursor-based pagination for list endpoints (e.g., `listIndexes`); `searchDocuments` correctly supports `$top/$skip`.
- Request context: No `x-ms-client-request-id` threading through calls or echoing in responses/logs.
- Preview features: No coverage yet for Knowledge Agents (`/agents`) or Knowledge Sources (`/knowledgesources`).
- Prefer/ETag: PUTs don’t use `Prefer: return=representation`; delete/update tools don’t accept `If-Match` for safe concurrency.

## Concrete Changes (src/index.ts)

- Capabilities + resources:
  - Update `new McpServer({ ... capabilities })` to add `resources: {}` and (optionally) `tools: {}`/`logging: { levels: ["info","warning","error"] }`.
  - Add `server.resource` wrappers:
    - `indexes/{indexName}` → returns full index JSON with `mimeType: "application/json"`.
    - `servicestats` → wraps `client.getServiceStatistics()`.
    - `indexstats` → wraps `client.getIndexStatsSummary()`.
- Progress notifications:
  - Update `runIndexer` or add `runIndexerWithProgress` to poll `client.getIndexerStatus(name)`, compute progress from `lastResult.status`/history, and emit `this.server.notification("progress", { operation, progress })` until success/error.
- Error handling:
  - Replace `formatError` with a structured helper that sets `isError: true` and maps status codes to MCP categories: 400 `invalid_request`, 401/403 `unauthorized`, 404 `resource_not_found`, 409/412 `conflict` (ETag), 429 `rate_limited`, 5xx `server_error`. Include `x-ms-request-id` when present.
- Pagination:
  - Add `{ cursor, limit }` to `listIndexes` and slice locally, or add a new `listIndexesPaginated` to avoid breaking existing clients.
- Request context:
  - Add optional `clientRequestId` to long-running or important tools (`runIndexer`, create/update endpoints), pass as header `x-ms-client-request-id`, and echo it in results.
- Analyzer helper:
  - Add `analyzeText` tool for `indexes('{indexName}')/search.analyze` to test tokenization.

## Client Changes (src/azure-search-client.ts)

- Prefer header:
  - For all PUTs, send `Prefer: return=representation` so tools get the full resource after updates.
- ETag + request IDs:
  - Add method overloads to accept `options?: { headers?: Record<string,string> }` for PUT/DELETE/POST.
  - For non-OK responses, parse JSON error if possible and include `status`, `code`, `message`, and `requestId = response.headers.get('x-ms-request-id')` in a custom error object so the MCP error helper can map cleanly.
- New endpoints (preview):
  - Agents CRUD: `/agents('{agentName}')` and `/agents`.
  - Knowledge Sources CRUD: `/knowledgesources('{sourceName}')` and `/knowledgesources`.
  - Stats: `getServiceStatistics()` for `/servicestats`, and `getIndexStatsSummary()` for `/indexstats`.

## Tool Description Consistency

- Prefix destructive tools with “⚠️ DESTRUCTIVE” in descriptions: `deleteIndex`, `deleteDocuments`, `deleteSynonymMap`, `deleteIndexer`, `deleteDataSource`.
- Mention idempotency in descriptions: PUT=idempotent; POST=non-idempotent; DELETE=idempotent but destructive.
- Add optional `etag` inputs for deletes/updates and pass `If-Match` headers.

## Preview-Specific Additions (new tools/resources)

- Agents:
  - Tools: `createOrUpdateAgent`, `getAgent`, `deleteAgent`, `listAgents`.
  - Resource: `agents/{agentName}` returns full definition.
- Knowledge Sources:
  - Tools: `createOrUpdateKnowledgeSource`, `getKnowledgeSource`, `deleteKnowledgeSource`, `listKnowledgeSources`.
  - Resource: `knowledgesources/{sourceName}` returns full definition.
- Observability resources:
  - `servicestats` and `indexstats` resources for quick browsing/monitoring.

## Optional Next Steps

- Implement minimal error mapping helper and progress notifications first (low-risk, high UX impact).
- Add resource wrappers and capabilities.
- Extend client for headers/Prefer/ETag and introduce Agents/KnowledgeSources endpoints.
- Add a paginated variant for `listIndexes` to keep backward compatibility.

