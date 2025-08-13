// src/SkillTools.ts
import { z } from "zod";
import { ResponseFormatter } from "./utils/response-helper";
import { DEFAULT_TIMEOUT_MS } from "./constants";
import type { ToolContext } from "./types";

/**
 * Register skillset management tools.
 * Tools:
 *  - listSkillsets
 *  - getSkillset
 */
export function registerSkillTools(server: any, context: ToolContext) {
  const { getClient } = context;
  const rf = new ResponseFormatter(() => {
    const s = context.getSummarizer?.();
    if (!s) return null;
    return (text: string, maxTokens?: number) => s(text, maxTokens ?? 800);
  });

  // ---------------- SKILLSETS ----------------
  server.tool("listSkillsets", "List skillset names.", {}, async () => {
    // Fetch skillsets and structure the response
    const client = getClient();
    const skillsets = (await client.listSkillsets()) as Array<{ name?: string } | unknown>;
    const names = (skillsets as Array<{ name?: string }>).map((ss) => ss.name || "").filter(Boolean);
    const structuredData = { skillsets: names, count: names.length };

    return rf.formatSuccess(structuredData);
  });

  server.tool("getSkillset", "Get a skillset.", { name: z.string() }, async ({ name }: { name: string }) => {
    return rf.executeWithTimeout(getClient().getSkillset(name), DEFAULT_TIMEOUT_MS, "getSkillset", { tool: "getSkillset", name });
  });
}
