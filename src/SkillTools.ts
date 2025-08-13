// src/SkillTools.ts
import { z } from "zod";
import { formatResponse, normalizeError } from "./utils/response";

type GetClient = () => any;

/**
 * Register skillset management tools.
 * Tools:
 *  - listSkillsets
 *  - getSkillset
 */
export function registerSkillTools(server: any, getClient: GetClient) {
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
        return await formatResponse({ skillsets: names, count: names.length });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "listSkillsets" });
        return await formatResponse(insight);
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
        return await formatResponse(ss);
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "getSkillset", name });
        return await formatResponse(insight);
      }
    }
  );
}