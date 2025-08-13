// src/SynonymTools.ts
import { z } from "zod";
import { ResponseFormatter } from "./utils/response-helper";
import type { ToolContext } from "./types";
import { DEFAULT_TIMEOUT_MS } from "./constants";

/**
 * Register synonym map management tools.
 * Tools:
 *  - listSynonymMaps
 *  - getSynonymMap
 *  - createOrUpdateSynonymMap
 *  - deleteSynonymMap
 */
export function registerSynonymTools(server: any, context: ToolContext) {
  const { getClient } = context;
  const rf = new ResponseFormatter(() => {
    const s = context.getSummarizer?.();
    if (!s) return null;
    return (text: string, maxTokens?: number) => s(text, maxTokens ?? 800);
  });
  // ---------------- SYNONYM MAPS ----------------
  server.tool("listSynonymMaps", "List synonym map names.", {}, async () => {
    const client = getClient();
    return rf.executeWithTimeout(
      client.listSynonymMaps().then((synonymMaps: any[]) => {
        const names = synonymMaps.map((sm: any) => sm.name);
        return { synonymMaps: names, count: names.length };
      }),
      DEFAULT_TIMEOUT_MS,
      "listSynonymMaps",
      { tool: "listSynonymMaps" },
    );
  });

  server.tool("getSynonymMap", "Get a synonym map definition.", { name: z.string() }, async ({ name }: any) => {
    const client = getClient();
    return rf.executeWithTimeout(
      client.getSynonymMap(name).then((sm: any) => {
        if (sm && sm.synonyms && typeof sm.synonyms === "string") {
          const formattedSm: any = {
            ...sm,
            synonymsFormatted: sm.synonyms.split("\n").filter((line: string) => line.trim()),
            synonymsRaw: sm.synonyms,
          };
          formattedSm.synonyms = formattedSm.synonymsFormatted;
          return formattedSm;
        }
        return sm;
      }),
      DEFAULT_TIMEOUT_MS,
      "getSynonymMap",
      { tool: "getSynonymMap", name },
    );
  });

  server.tool(
    "createOrUpdateSynonymMap",
    "Create or update a synonym map to improve search relevance. Define equivalent terms (USA, United States), one-way mappings (cat => feline), or explicit mappings. Use Solr format for synonym rules.",
    {
      name: z.string(),
      synonymMapDefinition: z.object({
        name: z.string(),
        format: z.string().default("solr"),
        synonyms: z.string().describe("Synonym rules in Solr format"),
        encryptionKey: z.any().optional(),
        "@odata.etag": z.string().optional(),
      }),
    },
    async ({ name, synonymMapDefinition }: any) => {
      const client = getClient();
      return rf.executeWithTimeout(
        client.createOrUpdateSynonymMap(name, synonymMapDefinition),
        DEFAULT_TIMEOUT_MS,
        "createOrUpdateSynonymMap",
        { tool: "createOrUpdateSynonymMap", name },
      );
    },
  );

  server.tool("deleteSynonymMap", "Delete a synonym map.", { name: z.string() }, async ({ name }: any) => {
    try {
      const client = getClient();
      await rf.executeWithTimeout(client.deleteSynonymMap(name), DEFAULT_TIMEOUT_MS, "deleteSynonymMap", {
        tool: "deleteSynonymMap",
        name,
      });
      return rf.formatSuccess({ success: true, message: `Synonym map ${name} deleted` });
    } catch (e) {
      return rf.formatError(e, { tool: "deleteSynonymMap", name });
    }
  });
}
