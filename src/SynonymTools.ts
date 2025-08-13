// src/SynonymTools.ts
import { z } from "zod";
import { formatResponse, formatToolError, normalizeError } from "./utils/response";

type GetClient = () => any;

/**
 * Register synonym map management tools.
 * Tools:
 *  - listSynonymMaps
 *  - getSynonymMap
 *  - createOrUpdateSynonymMap
 *  - deleteSynonymMap
 */
export function registerSynonymTools(server: any, getClient: GetClient) {
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
        return await formatResponse({ synonymMaps: names, count: names.length });
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
        return await formatResponse(sm);
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
        return await formatResponse(result);
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
        return await formatResponse({ success: true, message: `Synonym map ${name} deleted` });
      } catch (e) {
        const { insight } = normalizeError(e, { tool: "deleteSynonymMap", name });
        return formatToolError(insight);
      }
    }
  );
}