// src/SynonymTools.ts
import { z } from "zod";
import { formatResponse, formatToolError, normalizeError } from "./utils/response";
import type { ToolContext } from "./types";

/**
 * Register synonym map management tools.
 * Tools:
 *  - listSynonymMaps
 *  - getSynonymMap
 *  - createOrUpdateSynonymMap
 *  - deleteSynonymMap
 */
export function registerSynonymTools(server: any, context: ToolContext) {
  const { getClient, getSummarizer } = context;
  // ---------------- SYNONYM MAPS ----------------
  server.tool(
    "listSynonymMaps",
    "List synonym map names.",
    {},
    async () => {
      try {
        const client = getClient();
        const synonymMaps = await client.listSynonymMaps();
        const names = synonymMaps.map((sm: any) => sm.name);
        const structuredData = { synonymMaps: names, count: names.length };
        return await formatResponse(structuredData, {
          summarizer: getSummarizer?.() || undefined,
          structuredContent: structuredData
        });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "listSynonymMaps" });
        return formatToolError(insight);
      }
    }
  );

  server.tool(
    "getSynonymMap",
    "Get a synonym map definition.",
    { name: z.string() },
    async ({ name }: any) => {
      try {
        const client = getClient();
        const sm = await client.getSynonymMap(name);
        
        // Format synonym rules for better readability
        if (sm && sm.synonyms && typeof sm.synonyms === 'string') {
          // Create a formatted version with parsed synonym rules
          const formattedSm = {
            ...sm,
            synonymsFormatted: sm.synonyms.split('\n').filter((line: string) => line.trim()),
            synonymsRaw: sm.synonyms // Keep original for reference
          };
          
          // Replace the original synonyms with the formatted version
          formattedSm.synonyms = formattedSm.synonymsFormatted;
          
          return await formatResponse(formattedSm, {
            summarizer: getSummarizer?.() || undefined,
            structuredContent: formattedSm
          });
        }
        
        return await formatResponse(sm, {
          summarizer: getSummarizer?.() || undefined,
          structuredContent: sm
        });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "getSynonymMap", name });
        return formatToolError(insight);
      }
    }
  );

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
        "@odata.etag": z.string().optional()
      })
    },
    async ({ name, synonymMapDefinition }: any) => {
      try {
        const client = getClient();
        const result = await client.createOrUpdateSynonymMap(name, synonymMapDefinition);
        return await formatResponse(result, {
          summarizer: getSummarizer?.() || undefined,
          structuredContent: result
        });
      } catch (e) {
        const { insight } = normalizeError(e, {
          tool: "createOrUpdateSynonymMap",
          name,
          synonymMapDefinition
        });
        return formatToolError(insight);
      }
    }
  );

  server.tool(
    "deleteSynonymMap",
    "Delete a synonym map.",
    { name: z.string() },
    async ({ name }: any) => {
      try {
        const client = getClient();
        await client.deleteSynonymMap(name);
        const structuredData = { success: true, message: `Synonym map ${name} deleted` };
        return await formatResponse(structuredData, {
          summarizer: getSummarizer?.() || undefined,
          structuredContent: structuredData
        });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "deleteSynonymMap", name });
        return formatToolError(insight);
      }
    }
  );
}