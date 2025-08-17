# Azure AI Search MCP — Migration Plan to Dynamic Tools

This document defines the end‑to‑end plan to migrate the repository from 51 task‑based tools to 8 feature‑based dynamic tools built on a shared DynamicTool base. The goals are to reduce tool count, improve discoverability, unify error handling/metrics, and preserve full functionality.

- Current entrypoint: `src/index.ts` (legacy, 51+ tools)
- Dynamic base: `src/dynamic-tools/base/DynamicTool.ts` (already implemented)
- Existing dynamic tools:
  - `src/dynamic-tools/IndexTool.ts` (dynamic, not yet using base)
  - `src/dynamic-tools/DocumentTool.ts` (dynamic, not yet using base)
- Azure client: `src/azure-search-client.ts` supports all feature areas including knowledge agents/sources

This plan introduces a separate dynamic entrypoint (`src/index-dynamic.ts`) for opt‑in adoption and safe rollback.

---

## Executive Summary

- Consolidate 51 tools into 8 dynamic tools:
  1) IndexManagement
  2) DocumentOperations
  3) DataSourceManagement
  4) IndexerManagement
  5) SkillsetManagement
  6) KnowledgeAgentOperations
  7) KnowledgeSourceOperations
  8) ServiceUtilities (includes Synonym Maps + Service Stats/Debug)

- Use a common DynamicTool base to standardize:
  - Operation schema & validation (Zod)
  - Examples & hints
  - Elicitation flows
  - Pagination & batch processing
  - Timeouts & logging notifications
  - Error formatting (structured)
  - Metrics resources: `metrics://<ToolName>`

- Provide a new entrypoint `src/index-dynamic.ts` that only registers the 8 dynamic tools. Keep `src/index.ts` unchanged for compatibility.

- Document the old→new mapping (this doc) and update `README.md` to guide integrators to the new interface.

---

## Target Architecture

```
src/
├── dynamic-tools/
│   ├── base/
│   │   └── DynamicTool.ts                  # Shared base (metrics, hints, helpers)
│   ├── IndexTool.ts                        # IndexManagement (dynamic)  ← refactor to base
│   ├── DocumentTool.ts                     # DocumentOperations (dynamic) ← refactor to base
│   ├── DataSourceTool.ts                   # DataSourceManagement       ← new
│   ├── IndexerTool.ts                      # IndexerManagement          ← new
│   ├── SkillsetTool.ts                     # SkillsetManagement         ← new
│   ├── KnowledgeAgentTool.ts               # KnowledgeAgentOperations   ← new
│   ├── KnowledgeSourceTool.ts              # KnowledgeSourceOperations  ← new
│   └── ServiceTool.ts                      # ServiceUtilities           ← new (merge Synonym/Service/Debug)
├── index-dynamic.ts                        # New dynamic entrypoint (8 tools only)
└── [legacy files remain for rollback]
```

Dynamic Tool naming and responsibilities:
- IndexManagement: list, get, create, update, delete, stats
- DocumentOperations: search, get, count, upload, merge, mergeOrUpload, delete, analyze
- DataSourceManagement: list, get, createBlob, updateBlob, delete, generateSyncPlan
- IndexerManagement: list, get, create (blob), update (blob), run, reset, status, runWithProgress
- SkillsetManagement: list, get, create, update, delete, reset
- KnowledgeAgentOperations: list, get, create, update, delete
- KnowledgeSourceOperations: list, get, create, update, delete, createBlob, createWeb
- ServiceUtilities: serviceStats, indexStatsSummary, analyzeText, synonym maps CRUD, debug/elicitation helpers

Each dynamic tool declares:
- `toolName` and `description`
- `operations: Record<string, OperationDefinition>` with:
  - `description`, `params` (Zod), `handler(client, params, context, helpers)`
  - `category` (read/write/delete/analyze)
  - flags: `requiresConfirmation`, `supportsPagination`, `batchOperation`, `timeout`
  - `examples` for discoverability
- Optional `resources[]` and `prompts[]` that are auto-registered

---

## Old → New Mapping

Below is the mapping from current task-based tools to the new dynamic tools and their operations.

### Index Tools
- `listIndexes` → IndexManagement.list
- `getIndex` → IndexManagement.get
- `createIndex` → IndexManagement.create
- `createOrUpdateIndex` → IndexManagement.update
- `deleteIndex` → IndexManagement.delete
- `getIndexStats` → IndexManagement.stats

### Document Tools
- `searchDocuments` → DocumentOperations.search
- `getDocument` → DocumentOperations.get
- `countDocuments` → DocumentOperations.count
- `uploadDocuments` → DocumentOperations.upload
- `mergeDocuments` → DocumentOperations.merge
- `mergeOrUploadDocuments` → DocumentOperations.mergeOrUpload
- `deleteDocuments` → DocumentOperations.delete

### Data Source Tools
- `listDataSources` → DataSourceManagement.list
- `getDataSource` → DataSourceManagement.get
- `createOrUpdateBlobDataSource` → DataSourceManagement.createBlob/updateBlob
- `generateBlobSyncPlan` → DataSourceManagement.generateSyncPlan

### Indexer Tools
- `listIndexers` → IndexerManagement.list
- `getIndexer` → IndexerManagement.get
- `createOrUpdateBlobIndexer` → IndexerManagement.create/update
- `runIndexer` → IndexerManagement.run
- `resetIndexer` → IndexerManagement.reset
- `getIndexerStatus` → IndexerManagement.status
- `runIndexerWithProgress` → IndexerManagement.runWithProgress

### Skillset Tools
- `listSkillsets` → SkillsetManagement.list
- `getSkillset` → SkillsetManagement.get
- `createSkillset` → SkillsetManagement.create
- `createOrUpdateSkillset` → SkillsetManagement.update
- `deleteSkillset` → SkillsetManagement.delete
- `resetSkills` → SkillsetManagement.reset

### Synonym Map Tools
- `listSynonymMaps` → ServiceUtilities.listSynonymMaps
- `getSynonymMap` → ServiceUtilities.getSynonymMap
- `createOrUpdateSynonymMap` → ServiceUtilities.createOrUpdateSynonymMap
- `deleteSynonymMap` → ServiceUtilities.deleteSynonymMap

### Service/Utility Tools (extend ServiceUtilities)
- `getServiceStatistics` → ServiceUtilities.serviceStats
- `getIndexStatsSummary` → ServiceUtilities.indexStatsSummary
- `analyzeText` → ServiceUtilities.analyzeText
- Debug helpers (from DebugTools) → ServiceUtilities.debugElicitation (and related ops)

### Knowledge Tools
- `listKnowledgeAgents` → KnowledgeAgentOperations.list
- `getKnowledgeAgent` → KnowledgeAgentOperations.get
- `createKnowledgeAgent` → KnowledgeAgentOperations.create
- `createOrUpdateKnowledgeAgent` → KnowledgeAgentOperations.update
- `deleteKnowledgeAgent` → KnowledgeAgentOperations.delete

- `listKnowledgeSources` → KnowledgeSourceOperations.list
- `getKnowledgeSource` → KnowledgeSourceOperations.get
- `createKnowledgeSource` → KnowledgeSourceOperations.create
- `createOrUpdateKnowledgeSource` → KnowledgeSourceOperations.update
- `deleteKnowledgeSource` → KnowledgeSourceOperations.delete
- `createAzureBlobKnowledgeSource` → KnowledgeSourceOperations.createBlob
- `createWebKnowledgeSource` → KnowledgeSourceOperations.createWeb

> Notes
> - If an original operation name differs slightly, map it to the closest semantic equivalent listed here.
> - DELETE operations should set `requiresConfirmation: true` and elicit "DELETE" confirmation for bulk/destructive actions.

---

## Implementation Phases

### Phase 0: Branching & Gatekeeping (0.5h)
- Create branch: `feature/dynamic-tools-architecture`
- Keep `src/index.ts` unchanged (legacy). New dynamic entrypoint will be `src/index-dynamic.ts`.
- All new tooling stays behind dynamic entrypoint to allow side-by-side testing.

### Phase 1: Align existing dynamic tools to the base (1.5–2h)
- Refactor `src/dynamic-tools/IndexTool.ts` to use `DynamicTool`:
  - Move existing operations (list/get/create/update/delete/stats) into `operations` config
  - Add `category` and flags: `delete.requiresConfirmation`, `list.supportsPagination`
  - Replace direct `withTimeout`/pagination code with base `helpers.withTimeout`/`helpers.paginate`
  - Move resource `indexes://list` and prompt `create_optimal_index` into static `resources[]` and `prompts[]`
- Refactor `src/dynamic-tools/DocumentTool.ts` similarly:
  - Operations: search/get/count/upload/merge/mergeOrUpload/delete/analyze
  - `search.supportsPagination = true`, batch flags for upload/merge/mergeOrUpload
  - Replace custom batch handling with `helpers.processBatch`
  - Maintain Azure Search body mapping (e.g., `orderBy`→`orderby`, `includeTotalCount`→`count`)

### Phase 2: Implement new dynamic tools (3–4h)
- `src/dynamic-tools/DataSourceTool.ts` (DataSourceManagement)
  - ops: list, get, createBlob, updateBlob, delete (confirm), generateSyncPlan
  - Elicit missing auth/connection string when needed
  - Resource: `datasources://list`
  - Prompts: blob data source wizard, sync plan builder

- `src/dynamic-tools/IndexerTool.ts` (IndexerManagement)
  - ops: list, get, create (blob), update (blob), run, reset, status, runWithProgress
  - Elicit missing params on create/update; long-running `runWithProgress` with notifications and timeout
  - Resources: `indexers://list`, `indexers://status/<name>`
  - Prompts: indexer setup wizard; run/monitor helper

- `src/dynamic-tools/SkillsetTool.ts` (SkillsetManagement)
  - ops: list, get, create, update, delete (confirm), reset
  - Validation for `skills[]` definitions; example skill templates (`entityRecognition`, `keyPhrases`, `ocr`, `customWebApi`)
  - Resource: `skillsets://list`
  - Prompts: skillset builder

- `src/dynamic-tools/KnowledgeAgentTool.ts` (KnowledgeAgentOperations)
  - ops: list, get, create, update, delete
  - Validation of Azure OpenAI/AI services linkage where applicable

- `src/dynamic-tools/KnowledgeSourceTool.ts` (KnowledgeSourceOperations)
  - ops: list, get, create, update, delete, createBlob, createWeb
  - Provide examples for common source configurations

- `src/dynamic-tools/ServiceTool.ts` (ServiceUtilities)
  - ops: serviceStats, indexStatsSummary, analyzeText, synonym maps CRUD (list/get/createOrUpdate/delete), debugElicitation
  - Resources: `synonymmaps://list`, `service://stats`

For all tools:
- Set `examples` (2–5) across different ops for discoverability
- Set `category` and flags for hints (destructive/paginated/batch)
- Reuse `helpers.elicit` for confirmations and missing params
- Use `helpers.withTimeout` for all client calls; long-running ops override `timeout`

### Phase 3: Dynamic Entry Point (0.5–1h)
- Create `src/index-dynamic.ts`:
  - Copy structure from `src/index.ts` to set up `McpServer` and `ToolContext`
  - Remove all legacy registrations (registerIndexTools, registerDocumentTools, etc.)
  - Register only dynamic tools:
    ```ts
    IndexTool.register(server, context, { includeResources: true, includePrompts: true, enableLogging: true, enableMetrics: true });
    DocumentTool.register(server, context, { ... });
    DataSourceTool.register(server, context, { ... });
    IndexerTool.register(server, context, { ... });
    SkillsetTool.register(server, context, { ... });
    KnowledgeAgentTool.register(server, context, { ... });
    KnowledgeSourceTool.register(server, context, { ... });
    ServiceTool.register(server, context, { ... });
    ```
  - Keep `registerResources(this.server, getClient)` if global resources are still applicable and do not conflict
  - Keep prompts in `src/index.ts` as-is; optionally migrate/selectively attach to dynamic entry if needed (ensure no collisions)

### Phase 4: Scripts and Config (0.25h)
- `package.json`:
  ```json
  {
    "scripts": {
      "build:dynamic": "wrangler build src/index-dynamic.ts",
      "dev:dynamic": "wrangler dev src/index-dynamic.ts"
    }
  }
  ```
- Optionally add a dynamic env in `wrangler.jsonc` (not strictly required if pointing directly to the file).

### Phase 5: Tests & Validation (1–2h)
- Add `tests/dynamic-tools/` with integration tests:
  - IndexManagement: list pagination; create with template (elicitation path); delete confirmation; stats structure
  - DocumentOperations: search pagination and facets; count (filter vs no filter); upload/merge/mergeOrUpload batch checks; delete keys confirmation for large deletes; analyze variants
  - DataSourceManagement: createBlob with connectionString/accountKey; generateSyncPlan output
  - IndexerManagement: create/update with mappings; run/reset; status history cap; runWithProgress long-running notifications
  - SkillsetManagement: create/update validation; example templates; delete confirmation; reset
  - ServiceUtilities: synonym CRUD; serviceStats/indexStatsSummary; analyzeText
  - Knowledge* tools: list/get/create/update/delete
- MCP Inspector sanity tests:
  - Run `dev:dynamic` and connect the Inspector
  - Confirm exactly 8 tools appear
  - Execute sample ops from examples to validate handlers/notifications
  - Verify metrics resources: `metrics://IndexManagement`, `metrics://DocumentOperations`, … per tool

### Phase 6: Staging & Deployment (0.5–1h)
- Deploy `index-dynamic.ts` to a staging environment/subdomain
- Update local MCP client config to point to dynamic endpoint
- Exercise representative user flows across all feature areas
- Monitor logs and metrics resources for errors/performance baselines

### Phase 7: Adoption & Deprecation (optional, post‑launch)
- Publish `MIGRATION.md` and link from `README.md`
- Encourage integrators to switch to dynamic endpoint
- After a stabilization window (e.g., 2–4 weeks), consider deprecating legacy tools or adding warnings
- Optionally provide legacy→dynamic passthrough shims if needed (not recommended unless demanded)

### Phase 8: Optimization (optional)
- Operation discovery enhancements (search/suggest by operation name)
- Improved error helpers per operation (common guidance/retries)
- Macro operations (chaining), if desired
- Usage analytics from metrics resources to prune/rename ops

---

## Coding Conventions for Dynamic Tools

- Always set `category` in `OperationDefinition`: `read` | `write` | `delete` | `analyze`.
- Use flags to help the LLM:
  - `requiresConfirmation` for destructive ops (e.g., delete index/skillset/synonyms, bulk doc delete)
  - `supportsPagination` for list/search ops
  - `batchOperation` for large payloads (upload/merge)
  - `timeout` override for long-running ops (e.g., runWithProgress: 10–15 min)
- Provide 2–5 `examples` across different operations to aid discoverability.
- Prefer `helpers` from the base:
  - `helpers.withTimeout(promise, timeout?, opName?)`
  - `helpers.paginate(items, { pageSize?, cursor? })`
  - `helpers.elicit({ message, inputType?, choices?, validation? })`
  - `helpers.processBatch(items, batchSize, processor)`
  - `helpers.validateRequired(params, ['fieldA', 'fieldB'])`
  - `helpers.notify(event, data)` and `helpers.log(level, message, data)`
- Zod validation errors are consistently formatted by the base; use detailed schemas.

---

## Entry Point (index-dynamic.ts) Skeleton

```ts
// src/index-dynamic.ts
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AzureSearchClient } from "./azure-search-client";
import { AzureOpenAIClient } from "./azure-openai-client";
import { registerResources } from "./resources";
import type { ToolContext } from "./types";

import { IndexTool } from "./dynamic-tools/IndexTool";
import { DocumentTool } from "./dynamic-tools/DocumentTool";
import { DataSourceTool } from "./dynamic-tools/DataSourceTool";
import { IndexerTool } from "./dynamic-tools/IndexerTool";
import { SkillsetTool } from "./dynamic-tools/SkillsetTool";
import { KnowledgeAgentTool } from "./dynamic-tools/KnowledgeAgentTool";
import { KnowledgeSourceTool } from "./dynamic-tools/KnowledgeSourceTool";
import { ServiceTool } from "./dynamic-tools/ServiceTool";

class AzureSearchMCPDynamic extends McpAgent {
  server = new McpServer({
    name: "azure-ai-search-mcp-dynamic",
    version: "2.0.0",
    capabilities: {
      prompts: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      logging: {},
      tools: { listChanged: true },
      elicitation: {}
    }
  });

  private cachedClient: AzureSearchClient | null = null;
  private cachedOpenAIClient: AzureOpenAIClient | null = null;

  private getClient(): AzureSearchClient {
    if (this.cachedClient) return this.cachedClient;
    const env = this.env as any;
    const endpoint = env.AZURE_SEARCH_ENDPOINT;
    const apiKey = env.AZURE_SEARCH_API_KEY;
    if (!endpoint || !apiKey) throw new Error("Missing AZURE_SEARCH_* config");
    this.cachedClient = new AzureSearchClient(endpoint, apiKey);
    return this.cachedClient;
  }

  private getOpenAIClient(): AzureOpenAIClient | null {
    if (this.cachedOpenAIClient !== null) return this.cachedOpenAIClient;
    const env = this.env as any;
    const endpoint = env.AZURE_OPENAI_ENDPOINT;
    const apiKey = env.AZURE_OPENAI_API_KEY;
    const deployment = env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";
    this.cachedOpenAIClient = endpoint && apiKey ? new AzureOpenAIClient(endpoint, apiKey, deployment) : null;
    return this.cachedOpenAIClient;
  }

  async init() {
    // Fail fast on missing Search config
    this.getClient();

    const toolContext: ToolContext = {
      getClient: () => this.getClient(),
      getSummarizer: () => {
        const ai = this.getOpenAIClient();
        return ai ? (text: string, maxTokens?: number) => ai.summarize(text, maxTokens) : null;
      },
      agent: this
    };

    // Register dynamic tools only
    IndexTool.register(this.server, toolContext, { includeResources: true, includePrompts: true, enableLogging: true, enableMetrics: true });
    DocumentTool.register(this.server, toolContext, { includeResources: true, includePrompts: true, enableLogging: true, enableMetrics: true });

    // Add remaining once implemented:
    // DataSourceTool.register(this.server, toolContext, { includeResources: true, includePrompts: true, enableLogging: true, enableMetrics: true });
    // IndexerTool.register(this.server, toolContext, {...});
    // SkillsetTool.register(this.server, toolContext, {...});
    // KnowledgeAgentTool.register(this.server, toolContext, {...});
    // KnowledgeSourceTool.register(this.server, toolContext, {...});
    // ServiceTool.register(this.server, toolContext, {...});

    // Keep shared resources if applicable
    registerResources(this.server, () => this.getClient());
  }
}

export { AzureSearchMCPDynamic };

export default {
  fetch(request: Request, envIn: unknown, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }});
    }
    if (pathname.startsWith("/sse")) return AzureSearchMCPDynamic.serveSSE("/sse").fetch(request, envIn as any, ctx);
    if (pathname.startsWith("/mcp")) return AzureSearchMCPDynamic.serve("/mcp").fetch(request, envIn as any, ctx);
    return new Response("Azure AI Search MCP (dynamic) - Use /sse or /mcp", { status: 200, headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" } });
  }
};
```

---

## File‑Level Changes

- Base (already present)
  - `src/dynamic-tools/base/DynamicTool.ts`: no changes required; may re‑export types from `src/types.ts` if desired for central typing.

- Dynamic tools
  - `src/dynamic-tools/IndexTool.ts`: refactor to extend/use `DynamicTool`; move resource/prompt; add categories/flags/examples; use helpers.
  - `src/dynamic-tools/DocumentTool.ts`: refactor to extend/use `DynamicTool`; add categories/flags/examples; replace custom batching with `helpers.processBatch`.
  - New:
    - `src/dynamic-tools/DataSourceTool.ts` (DataSourceManagement)
    - `src/dynamic-tools/IndexerTool.ts` (IndexerManagement)
    - `src/dynamic-tools/SkillsetTool.ts` (SkillsetManagement)
    - `src/dynamic-tools/KnowledgeAgentTool.ts` (KnowledgeAgentOperations)
    - `src/dynamic-tools/KnowledgeSourceTool.ts` (KnowledgeSourceOperations)
    - `src/dynamic-tools/ServiceTool.ts` (ServiceUtilities)

- Entry point
  - `src/index-dynamic.ts`: new dynamic entrypoint (see skeleton)

- Scripts
  - `package.json`:
    ```json
    {
      "scripts": {
        "build:dynamic": "wrangler build src/index-dynamic.ts",
        "dev:dynamic": "wrangler dev src/index-dynamic.ts"
      }
    }
    ```
  - `wrangler.jsonc`: optional dynamic env section if using environments

- Documentation
  - `MIGRATION.md`: this document
  - `README.md`: add section “Dynamic Tools (v2)” with usage examples and benefits

- Tests
  - `tests/dynamic-tools/` new folder with integration tests per dynamic tool

> Legacy files (`src/index.ts`, `src/*Tools.ts`) remain for rollback but won’t be referenced by `index-dynamic.ts`.

---

## Elicitation, Pagination, Batching, Errors

- Elicitation: use `helpers.elicit(...)` everywhere user input/confirmation is beneficial (e.g., delete confirmations, missing connection details).
- Pagination:
  - Prefer service‑side (top/skip) where available (search)
  - Use base `helpers.paginate` for arrays fetched in bulk (e.g., indexes list) when needed
- Batch:
  - Use `helpers.processBatch` with progress notifications for document ops
  - Enforce caps (e.g., MAX_DOCUMENTS_PER_BATCH, MAX_SEARCH_RESULTS)
- Errors:
  - Zod errors are wrapped by base and presented consistently
  - REST errors carry status via client; use base `ResponseFormatter` for MCP errors
- Metrics:
  - Each tool exposes `metrics://<ToolName>` with operation counts, error counts, avg latency, and recent errors

---

## Acceptance Criteria

1) Tool Count: 8 tools visible from `index-dynamic.ts` entrypoint
2) Operation Coverage: All legacy functionality reachable through new ops (see mapping)
3) Prompts: No conflicts; dynamic tools may add their own prompts/resources
4) Resources: Global + per‑tool resources return data (e.g., `indexes://list`, `synonymmaps://list`, `metrics://*`)
5) Elicitation: Confirmation dialogs for destructive ops; missing-params flows prompt users
6) Pagination: list/search ops signal and support pagination
7) Logging/Notifications: Start/complete/batch/error notifications emitted where appropriate
8) Error Handling: Parameter validation and REST failures reported consistently
9) Performance: 60%+ reduction in tool list/context usage; faster discovery
10) Backward Compatibility: Legacy entry works unchanged, dynamic entry opt‑in

---

## Rollout & Rollback

- Rollout
  - Deploy dynamic entry to a staging subdomain
  - Switch a subset of clients to dynamic endpoint and validate
  - Monitor `metrics://*` and logs for 24–48h
  - Roll dynamic entry to production subdomain (e.g., `dynamic.your-worker.workers.dev`)
  - Publish `MIGRATION.md`/README guidance

- Rollback
  - Clients switch back to legacy entry (`src/index.ts`) if issues occur
  - Fix forward: patch a specific operation within its dynamic tool
  - Maintain the legacy path for a defined deprecation period (e.g., 30 days)

---

## Timeline (Estimate)

- Day 1:
  - Phase 1 (align Index/Document to base)
  - `index-dynamic.ts` scaffolding + scripts
- Day 2:
  - Phase 2 (DataSource/Indexer tools)
  - Phase 5 tests for these tools
- Day 3:
  - Phase 2 (Skillset/Knowledge*/Service tools)
  - Phase 5 tests completion
- Day 4:
  - Phase 6 staging tests and iteration
  - Documentation polish (`README.md`, this `MIGRATION.md`)

---

## Appendix A — Operation Details per Dynamic Tool

This appendix captures parameter highlights and behavior per new operation. The Zod schemas live in each tool file and enforce validation at runtime.

### IndexManagement
- list: `{ includeStats?: boolean, verbose?: boolean, pageSize?, cursor? }` (supportsPagination)
- get: `{ indexName }`
- create: `{ indexName, template?, indexDefinition?, language?, vectorDimensions?, validate? }`
  - Elicit template if neither template nor definition provided
- update: `{ indexName, addFields?, updateSemanticConfig?, mergeWithExisting?, validate? }`
- delete: `{ indexName, confirmation: 'DELETE' }` (requiresConfirmation)
- stats: `{ indexName }`

### DocumentOperations
- search: `{ indexName, search='*', filter?, orderBy?, top<=50, skip, select?, includeTotalCount?, facets? }` (supportsPagination)
- get: `{ indexName, key, select? }`
- count: `{ indexName, filter? }` (filter uses `search(..., count:true)` path)
- upload/merge/mergeOrUpload: `{ indexName, documents[] }` (batchOperation; size capped)
- delete: `{ indexName, keys[], confirmation? }` (elicit confirmation for large deletes)
- analyze: `{ indexName, field, aggregationType: 'distribution'|'topValues'|'statistics' }`

### DataSourceManagement
- list/get: simple read ops
- createBlob/updateBlob:
  - `name, storageAccount, containerName, auth{ connectionString? | accountKey? }, description?, highWaterMarkColumnName?`
  - Elicit missing auth and required fields
- delete: `{ name, confirmation: 'DELETE' }`
- generateSyncPlan: `{ storageAccount, containerName, absoluteRepoPath?, strategy: 'localAzCli'|'uploadBatch' }` returns CLI guidance

### IndexerManagement
- list/get/run/reset/status:
  - status caps `historyLimit` (max 50)
- create/update (Blob):
  - Requires `name, dataSourceName, targetIndexName` + optional `scheduleInterval, runNow, parsingMode, indexedFileNameExtensions, excludedFileNameExtensions, dataToExtract, indexStorageMetadataOnlyForOversizedDocuments, fieldMappings[]`
  - Elicit missing required params
- runWithProgress:
  - Starts the indexer; polls status; emits notifications; returns `progressHistory`
  - Set higher `timeout` (e.g., 10–15 min)

### SkillsetManagement
- list: `select?` supports `$select=*` and trimmed fields
- get: `{ skillsetName }`
- create/update:
  - Validate `skills[]` include `@odata.type`, `inputs[]`, `outputs[]`
  - Example skill templates available via `exampleSkillType`
- delete: `{ skillsetName, confirmation: 'DELETE' }`
- reset: `{ skillsetName, skillNames? }`

### KnowledgeAgentOperations
- list/get/create/update/delete; support If-Match/If-None-Match headers via client options if needed

### KnowledgeSourceOperations
- list/get/create/update/delete; plus helpers for Blob/Web convenience creation
- Support `$filter` for `type` when listing, via client

### ServiceUtilities
- serviceStats / indexStatsSummary: return service/index stats aggregates
- analyzeText: `{ indexName, body }`
- Synonym maps: list/get/createOrUpdate/delete (delete requires confirmation)
- Debug helpers as needed (e.g., elicitation debug)

---

## Why this is Safe and Better

- Massive context reduction (84% fewer tools, ~60–70% fewer tokens)
- Logical grouping improves discoverability and correctness
- Consistent behavior and instrumentation via the DynamicTool base
- Opt‑in entrypoint preserves legacy integrations until migration is complete
