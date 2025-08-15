// src/SynonymTools.ts
import { z } from "zod";
import { ResponseFormatter } from "./utils/response";
import type { ToolContext } from "./types";
import { SynonymMapSchema } from "./schemas";
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
  server.tool("listSynonymMaps", "List synonym map names.", {}, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }, async () => {
    const client = getClient();
    return rf.executeWithTimeout(
      client.listSynonymMaps().then((synonymMaps: unknown[]) => {
        const names = (synonymMaps as Array<{ name?: string }>).map((sm) => sm.name || "").filter(Boolean);
        return { synonymMaps: names, count: names.length };
      }),
      DEFAULT_TIMEOUT_MS,
      "listSynonymMaps",
      { tool: "listSynonymMaps" },
    );
  });

  server.tool("getSynonymMap", "Get a synonym map definition.", { name: z.string() }, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }, async ({ name }: { name: string }) => {
    const client = getClient();
    return rf.executeWithTimeout(
      client.getSynonymMap(name).then((sm: unknown) => {
        const s = sm as { synonyms?: unknown } | undefined;
        if (s && typeof s.synonyms === "string") {
          const formattedSm: Record<string, unknown> = {
            ...(sm as Record<string, unknown>),
            synonymsFormatted: s.synonyms.split("\n").filter((line: string) => line.trim()),
            synonymsRaw: s.synonyms,
          };
          (formattedSm as any).synonyms = (formattedSm as any).synonymsFormatted;
          return formattedSm;
        }
        return sm;
      }),
      DEFAULT_TIMEOUT_MS,
      "getSynonymMap",
      { tool: "getSynonymMap", name },
    );
  });

  // Use raw shape (not z.object) so MCP registers params
  const CreateOrUpdateSynonymMapParams = {
    name: z.string(),
    synonymMapDefinition: SynonymMapSchema,
  } as const;

  server.tool(
    "createOrUpdateSynonymMap",
    "Create or update a synonym map to improve search relevance. Define equivalent terms (USA, United States), one-way mappings (cat => feline), or explicit mappings. Use Solr format for synonym rules.",
    CreateOrUpdateSynonymMapParams,
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
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

  server.tool("deleteSynonymMap", "Delete a synonym map.", { name: z.string() }, { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }, async ({ name }: { name: string }) => {
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
