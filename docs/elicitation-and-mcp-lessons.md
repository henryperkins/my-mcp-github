# Elicitation + MCP Servers — Field Notes and Best Practices

Date: 2025-08-15

This document captures what we validated, changed, and learned about MCP elicitation and transports while integrating and testing the Azure AI Search MCP server.

## Executive Summary

- Server-side elicitation is correctly wired (capability advertised, runtime method detected), but common clients (e.g., Claude Code CLI) currently do not respond to elicitation requests — resulting in null/no-op responses.
- We added robust server safeguards: timeouts around elicitation calls, a diagnostic tool, and safe fallbacks so tools don’t hang.
- Correct transport endpoints: use `/sse` for SSE and `/mcp` for streamable HTTP. There is no `/http` endpoint.
- Performance: We optimized `listIndexes` to avoid per-index stat timeouts using `$select` and the `/indexstats` aggregate endpoint, with a concurrency-limited fallback.

---

## What Works vs. What Doesn’t (Today)

### Server (Working)
- Advertises `elicitation` capability via `McpServer`.
- Detects `elicitInput` at runtime.
- New `debugElicitation` tool to verify runtime support and perform a test elicitation.
- Elicitation now wrapped with a timeout so calls never hang.

### Client (Gaps Observed)
- Claude Code CLI likely does not yet render elicitation UI, so it doesn’t answer `elicitation/create` — resulting in `null`/no-op.
- Validation with a reference client that implements `elicitation/create` confirms the server path is sound.

---

## Transports and Endpoints

- SSE (legacy/compatible): `https://<your-worker>.workers.dev/sse`
- Streamable HTTP (modern MCP): `https://<your-worker>.workers.dev/mcp`
- No `/http` route — use `/mcp` for HTTP and `/sse` for SSE.

### Claude Code CLI Examples

```bash
# Remote SSE (recommended for Claude Code CLI)
claude mcp add --transport sse azure-search https://<your-worker>.workers.dev/sse

# Local SSE (dev)
claude mcp add --transport sse azure-search http://localhost:8788/sse

# Local HTTP (dev, for clients that support Streamable HTTP)
claude mcp add --transport http azure-search http://localhost:8788/mcp
```

### Streamable HTTP Handshake (advanced)

If your client uses Streamable HTTP directly:

1) Initialize session (POST JSON-RPC to `/mcp`), record `mcp-session-id` from response headers.
2) Include `mcp-session-id` on subsequent requests.

```bash
# Initialize
curl -s -D headers.txt -X POST https://<worker>/mcp \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":"1","method":"initialize","params":{"clientInfo":{"name":"curl","version":"0.0.1"}}}'

# Use session id from response headers
SID=$(rg -N "mcp-session-id:" headers.txt | awk '{print $2}' | tr -d '\r')

# Call tools/list
curl -s -H "mcp-session-id: $SID" -X POST https://<worker>/mcp \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":"2","method":"tools/list"}'
```

---

## Elicitation Integration — Server Side

### Capability Advertisement

`src/index.ts`

```ts
const server = new McpServer({
  name: "azure-ai-search-mcp",
  version: "1.3.0",
  capabilities: {
    prompts: { listChanged: true },
    resources: { subscribe: true, listChanged: true },
    logging: {},
    tools: { listChanged: true },
    elicitation: {} // Advertise elicitation support
  }
});
```

### Invocation and Binding Fix

We corrected `elicitInput` invocation to ensure the right `this` owner is used, and added a timeout wrapper to avoid hangs.

`src/utils/elicitation-integration.ts`

```ts
const owner = /* resolve elicitInput owner: context, server, or agent */
const response = await withTimeout(
  () => elicitMethod.call(owner, { message, requestedSchema }),
  DEFAULT_TIMEOUT_MS,
  "elicitInput"
);
```

### Diagnostics Tool

`src/DebugTools.ts` adds a `debugElicitation` tool:

- Reports where `elicitInput` is detected.
- Optionally performs a test elicitation (`performTest: true`).
- Includes `testDurationMs` and a note if no response.

Example call:

```json
{ "tool": "debugElicitation", "arguments": { "performTest": true } }
```

Expected behavior when client lacks UI: fast return with `testResult: null` and a note.

---

## Elicitation Integration — Client Side

To support elicitation, clients must:

1) Advertise capability in the initialize handshake.
2) Handle `elicitation/create` and return `{ action, content }` where `content` matches a primitive-only schema.

### Minimal Node Client (SSE)

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const client = new Client({
  name: "elicitation-client",
  version: "1.0.0",
  capabilities: { elicitation: {} }
});

client.setRequestHandler("elicitation/create", async ({ message, requestedSchema }) => {
  // Present UI to collect values based on requestedSchema.properties
  return { action: "accept", content: { /* key: value */ } };
});

const transport = new SSEClientTransport(new URL("https://<worker>.workers.dev/sse"));
await client.connect(transport);
```

References:
- Full reference CLI client: `examples/elicitation-client.ts`
- Guide: `docs/elicitation-client-guide.md`

---

## Safe Fallbacks (Until Client UI Arrives)

Because some clients don’t yet render elicitation UI:

- Destructive tools should require an explicit non-elicitation confirmation parameter (e.g., `confirmation: "DELETE"`) when elicitation fails.
- Consider an environment flag to enforce strict confirmation:
  - `ELICIT_REQUIRED=true`: block destructive ops unless elicitation succeeds or explicit confirmation is provided.
  - `ELICIT_REQUIRED=false` (default): allow explicit confirmation to bypass elicitation.

Recommended client workarounds now:

```json
{ "tool": "deleteIndex", "arguments": { "indexName": "my-index", "confirmation": "DELETE" } }
```

---

## Performance Improvements Related to Timeouts

Observed: `listIndexes` + per-index `search.stats` calls could timeout with many indexes.

Changes:

- Use `$select` to trim index payloads when not in verbose mode.
- Prefer aggregate `/indexstats` endpoint for stats.
- Concurrency-limited fallback (e.g., 5 at a time) with per-call timeouts if the aggregate call fails.

Impacted files:

- `src/azure-search-client.ts`: `listIndexesSelected(select)`, `getIndexStatsSummary()`
- `src/IndexTools.ts`: optimized `listIndexes` for `$select` + `/indexstats` + fallback
- `src/resources.ts`: optimized `indexes` resource with same approach

Outcome: Fewer requests, lower latency, far fewer timeouts.

---

## Testing Checklist

1) Connectivity
   - SSE: `claude mcp add --transport sse azure-search https://<worker>/sse`
   - HTTP: `claude mcp add --transport http azure-search http://localhost:8788/mcp`

2) Elicitation Diagnostic
   - Call `debugElicitation` with `{ performTest: true }`
   - Expect fast return; if client lacks UI, `testResult: null` with a note

3) Tool Paths
   - `listIndexes` with `{ includeStats: true }` — verify fast aggregate stats
   - `searchDocuments` without `indexName` — should elicit (or error cleanly if unsupported)
   - `deleteIndex` without `confirmation` — should elicit (or require explicit param)

4) Resources
   - Read `indexes` resource — confirm stats present and payload small

---

## Production UI Guidance (Client)

- Form generation from schema:
  - string (enum → select), number/integer (min/max), boolean.
  - Highlight required fields; inline validation errors.
- Progressive flows: step through multi-step elicitation sequences.
- UX: Accept/Decline/Cancel, preserve inputs, show timeouts and retries.

---

## Analytics & Logging (Client-side)

Track (no PII — log field names, not values):

- `elicitation_shown` { tool, step, fields }
- `elicitation_accepted` { durationMs, fieldsFilled }
- `elicitation_declined` { reason }
- `elicitation_cancelled` { reason }
- `elicitation_timeout` { durationMs }

Metrics: completion rate, avg duration, most-missed required fields.

---

## Known Limitations and Next Steps

- Client support: Some clients (e.g., Claude Code CLI) don’t yet implement elicitation UI — expect timeouts/no-ops. Server now handles this gracefully.
- Safety: Consider enabling `ELICIT_REQUIRED` to enforce confirmation for destructive operations.
- Coverage: Extend elicitation flows to additional tools as needed.

---

## Quick Reference

- SSE URL: `https://<worker>.workers.dev/sse`
- HTTP URL: `https://<worker>.workers.dev/mcp`
- Diagnostic tool: `debugElicitation` (`performTest: true`)
- Example client: `examples/elicitation-client.ts`
- Client guide: `docs/elicitation-client-guide.md`

