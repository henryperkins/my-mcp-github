// src/insights.ts
// import type { PipelineResponse } from "@azure/core-rest-pipeline";
type PipelineResponse = any; // Using any since we don't have Azure SDK installed

export type InsightCode =
  | "ERR_AUTH" | "ERR_NOT_FOUND" | "ERR_CONFLICT"
  | "ERR_RATE_LIMIT" | "ERR_STORAGE_LIMIT" | "ERR_TIER_LIMIT"
  | "ERR_DOWNTIME_REQUIRED" | "ERR_VECTOR_DIM_MISMATCH"
  | "ERR_BAD_FILTER" | "ERR_INDEXER_COOLDOWN" | "ERR_NETWORK"
  | "OK";

export type Insight = {
  ok: boolean;
  code: InsightCode;
  message: string;
  recommendation?: string;
  retryAfterSec?: number;
  extras?: Record<string, any>;
};

function retryAfterSeconds(resp?: PipelineResponse | null) {
  const h = (resp as any)?.headers;
  if (!h) return undefined;
  const get = typeof h.get === "function" ? (k: string) => h.get(k) : (k: string) => h[k];
  const ra = get("Retry-After") ?? get("retry-after") ?? get("retry-after-ms");
  if (!ra) return undefined;
  const s = String(ra).trim().toLowerCase();
  const n = Number(s.replace("ms", ""));
  if (!Number.isFinite(n)) return undefined;
  return s.endsWith("ms") ? Math.ceil(n / 1000) : n;
}

export function success(extras?: Record<string, any>): { insight: Insight } {
  return { insight: { ok: true, code: "OK", message: "Success", extras } };
}

export function normalizeError(e: any, context?: Record<string, any>): { insight: Insight } {
  const status = e?.statusCode ?? e?.response?.status;
  const code = (e?.code as string) || "";
  const msg = String(e?.message ?? e?.toString?.() ?? e);

  let insight: Insight = {
    ok: false,
    code: "ERR_NETWORK",
    message: msg,
    recommendation: "Check connectivity, endpoint, or service availability.",
    extras: { status, code, ...context }
  };

  // Treat 429 and 503 as retryable/busy conditions
  if (status === 429 || status === 503) {
    insight = {
      ok: false,
      code: "ERR_RATE_LIMIT",
      message: msg,
      recommendation:
        "Back off with jitter; if creating objects, you may be at tier/object limits or low on storage. Reduce request rate, delete unused objects/documents, or upgrade SKU.",
      retryAfterSec: retryAfterSeconds(e?.response),
      extras: { status, code, ...context }
    };
  } else if (status === 401 || status === 403) {
    insight = {
      ok: false,
      code: "ERR_AUTH",
      message: msg,
      recommendation:
        "Use an ADMIN key for management ops (indexes/indexers/skillsets/datasources) or configure Entra RBAC. Verify network/Private Link and audience.",
      extras: { status, code, ...context }
    };
  } else if (status === 404) {
    insight = {
      ok: false,
      code: "ERR_NOT_FOUND",
      message: msg,
      recommendation: "List resources first and correct the name; the resource likely does not exist.",
      extras: { status, code, ...context }
    };
  } else if (status === 409) {
    insight = {
      ok: false,
      code: "ERR_CONFLICT",
      message: msg,
      recommendation: "Serialize management operations and retry with exponential backoff.",
      extras: { status, code, ...context }
    };
  }

  // Heuristic refinements
  if (/allowIndexDowntime/i.test(msg) || /analyzer|tokenizer|vectorizer.+cannot/i.test(msg)) {
    insight.code = "ERR_DOWNTIME_REQUIRED";
    insight.recommendation =
      "Retry createOrUpdateIndex with { allowIndexDowntime: true } or plan a rebuild/alias swap for breaking changes.";
  }
  if (/dimension/i.test(msg) && /vector/i.test(msg)) {
    insight.code = "ERR_VECTOR_DIM_MISMATCH";
    insight.recommendation =
      "Ensure the field's vectorSearchDimensions equals the embedding length; regenerate embeddings or fix schema.";
  }
  if (/Invalid expression/i.test(msg) || /\$filter/i.test(msg)) {
    insight.code = "ERR_BAD_FILTER";
    insight.recommendation =
      "Fix OData syntax, use parentheses, any/all for collections, and consider search.in(...) for set filters.";
  }
  if (/Indexer invocation is once every 180 seconds/i.test(msg)) {
    insight.code = "ERR_INDEXER_COOLDOWN";
    insight.recommendation = "Wait ~180s between runs on Free tier or upgrade to a paid tier.";
  }

  return { insight };
}