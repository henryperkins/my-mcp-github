// Tail Worker implementation for processing logs and exceptions from the producer Worker.
// - If TAIL_ENDPOINT is set, events are POSTed in batches to that endpoint.
// - If not set, a concise structured summary is logged via console for quick debugging.
// - Optional auth via TAIL_BEARER_TOKEN header when posting to the endpoint.

export interface Env {
  TAIL_ENDPOINT?: string;
  TAIL_BEARER_TOKEN?: string;
  // Optionally add a KV binding for quick debugging (uncomment and bind in wrangler):
  // TAIL_KV: KVNamespace;
}

type LogRecord = {
  message: unknown[];
  level: "debug" | "log" | "info" | "warn" | "error";
  timestamp: number;
};

type ExceptionRecord = {
  name: string;
  message: string;
  timestamp: number;
};

type DiagnosticsChannelEvent = {
  channel: string;
  message: unknown;
  timestamp: number;
};

type TailEvent = {
  scriptName: string;
  outcome: "ok" | "exception" | "canceled";
  eventTimestamp: number;
  event?: {
    request?: {
      url?: string;
      method?: string;
      headers?: Record<string, string>;
      cf?: { colo?: string; [k: string]: unknown };
    };
    [k: string]: unknown;
  };
  logs?: LogRecord[];
  exceptions?: ExceptionRecord[];
  diagnosticsChannelEvents?: DiagnosticsChannelEvent[];
};

function summarizeEvent(e: TailEvent) {
  const req = e.event?.request;
  const url = req?.url ? new URL(req.url) : undefined;
  const path = url?.pathname || "";
  const colo = req?.cf && typeof req.cf === "object" ? (req.cf as any).colo : undefined;

  const logs = e.logs?.length ?? 0;
  const errors = e.exceptions?.length ?? 0;

  return {
    scriptName: e.scriptName,
    outcome: e.outcome,
    ts: e.eventTimestamp,
    method: req?.method,
    path,
    status: e.outcome === "ok" ? "ok" : e.outcome,
    colo,
    logs,
    errors,
  };
}

async function postBatch(endpoint: string, token: string | undefined, batch: TailEvent[]) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(batch),
  });
  // Best-effort; do not throw in tail path
  if (!res.ok) {
    console.warn("Tail post failed", res.status, await safeText(res));
  }
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
}

export default {
  async tail(events: TailEvent[], env: Env, _ctx: ExecutionContext) {
    try {
      if (env.TAIL_ENDPOINT) {
        // Optionally chunk very large batches to keep payload sizes reasonable
        const CHUNK = 100;
        for (let i = 0; i < events.length; i += CHUNK) {
          const slice = events.slice(i, i + CHUNK);
          // Fire-and-forget; no await between chunks to reduce tail duration
          // eslint-disable-next-line no-void
          void postBatch(env.TAIL_ENDPOINT, env.TAIL_BEARER_TOKEN, slice);
        }
      } else {
        // Log concise summaries if no sink is configured
        for (const e of events) {
          const summary = summarizeEvent(e);
          console.log("[TailWorker]", JSON.stringify(summary));
          // If you need deeper visibility, uncomment below:
          // if (e.exceptions?.length) console.error("[TailWorker][exceptions]", e.exceptions);
          // if (e.logs?.length) console.log("[TailWorker][logs]", e.logs);
        }
      }

      // Example: write a small rolling log to KV (bind TAIL_KV in wrangler if needed)
      // if ("TAIL_KV" in env && env.TAIL_KV) {
      //   const key = `tail:${Date.now()}`;
      //   await env.TAIL_KV.put(key, JSON.stringify(events), { expirationTtl: 86400 });
      // }
    } catch (err) {
      // Never throw from tail handler; just log
      console.error("[TailWorker] handler error", err);
    }
  },
};