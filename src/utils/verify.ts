export type VerifyResult = {
  ok: boolean;
  verified: boolean;
  verifyStatus?: number;
  etag?: string | null;
  details?: Record<string, any>;
};

export function extractEtag(obj: any): string | null {
  return obj?.["@odata.etag"] ?? obj?.etag ?? obj?.ETag ?? null;
}

export async function verifyExists<T>(
  getFn: () => Promise<T>
): Promise<VerifyResult> {
  const res = await getFn();
  return {
    ok: true,
    verified: true,
    verifyStatus: 200,
    etag: extractEtag(res as any),
    details: res as any,
  };
}

export async function verifyDeleted(
  getFn: () => Promise<any>
): Promise<VerifyResult> {
  try {
    await getFn();
    // still exists
    return { ok: false, verified: false, verifyStatus: 200 };
  } catch (e: any) {
    const status = e?.statusCode ?? e?.response?.status;
    if (status === 404) return { ok: true, verified: true, verifyStatus: 404 };
    return { ok: false, verified: false, verifyStatus: status };
  }
}

/** Polls indexer status until terminal state or timeout. */
export async function pollIndexerCompletion<
  T extends { lastResult?: any }
>(
  getStatusFn: () => Promise<T>,
  {
    intervalMs = 3000,
    timeoutMs = 300_000, // 5 min default
  }: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<VerifyResult> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const s = await getStatusFn();
    const last =
      (s as any).lastResult ?? (s as any).executionResult ?? {};
    const st = String(last.status ?? "").toLowerCase(); // success|inprogress|transientfailure|persistentfailure|reset
    if (
      st === "success" ||
      st === "reset" ||
      st === "persistentfailure" ||
      st === "transientfailure"
    ) {
      return {
        ok: st === "success",
        verified: true,
        verifyStatus: 200,
        details: { lastResult: last, status: st },
      };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { ok: false, verified: false, details: { reason: "timeout" } };
}
