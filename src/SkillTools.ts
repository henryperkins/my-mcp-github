// src/SkillTools.ts
import { z } from "zod";
import { formatResponse, formatToolError, normalizeError } from "./utils/response";
import type { ToolContext } from "./types";

/**
 * Register skillset management tools.
 * Tools:
 *  - listSkillsets
 *  - getSkillset
 */
export function registerSkillTools(server: any, context: ToolContext) {
  const { getClient, getSummarizer } = context;
  // ---------------- SKILLSETS ----------------
  server.tool(
    "listSkillsets",
    "List skillset names.",
    {},
    async () => {
      try {
        const client = getClient();
        const skillsets = await client.listSkillsets();
        const names = skillsets.map((ss: any) => ss.name);
        const structuredData = { skillsets: names, count: names.length };
        return await formatResponse(structuredData, {
          summarizer: getSummarizer?.() || undefined,
          structuredContent: structuredData
        });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "listSkillsets" });
        return formatToolError(insight);
      }
    }
  );

  server.tool(
    "getSkillset",
    "Get a skillset.",
    { name: z.string() },
    async ({ name }: any) => {
      try {
        const client = getClient();
        const ss = await client.getSkillset(name);
        return await formatResponse(ss, {
          summarizer: getSummarizer?.() || undefined,
          structuredContent: ss
        });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "getSkillset", name });
        return formatToolError(insight);
      }
    }
  );
}