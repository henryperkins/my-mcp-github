// src/SkillTools.ts
import { z } from "zod";
import { ResponseFormatter } from "./utils/response";
import { DEFAULT_TIMEOUT_MS } from "./constants";
import type { ToolContext } from "./types";
import getToolHints from "./utils/toolHints";
import { ToolElicitationBuilder } from "./tool-elicitation";
import { elicitIfNeeded } from "./utils/elicitation-integration";

/**
 * Register skillset management tools.
 * Tools:
 *  - listSkillsets, getSkillset
 *  - createOrUpdateSkillset, deleteSkillset
 */
export function registerSkillTools(server: any, context: ToolContext) {
  const { getClient } = context;
  const rf = new ResponseFormatter(() => {
    const s = context.getSummarizer?.();
    if (!s) return null;
    return (text: string, maxTokens?: number) => s(text, maxTokens ?? 800);
  });

  // ---------------- SKILLSETS ----------------
  server.tool(
    "listSkillsets", 
    "List skillset names.", 
    {}, 
    getToolHints("GET"),
    async () => {
      // Fetch skillsets and structure the response
      const client = getClient();
      const skillsets = (await client.listSkillsets()) as Array<{ name?: string } | unknown>;
      const names = (skillsets as Array<{ name?: string }>).map((ss) => ss.name || "").filter(Boolean);
      const structuredData = { skillsets: names, count: names.length };

      return rf.formatSuccess(structuredData);
    }
  );

  server.tool(
    "getSkillset", 
    "Get a skillset.", 
    { name: z.string() }, 
    getToolHints("GET"),
    async ({ name }: { name: string }) => {
      return rf.executeWithTimeout(() => getClient().getSkillset(name), DEFAULT_TIMEOUT_MS, "getSkillset", { tool: "getSkillset", name });
    }
  );

  server.tool(
    "createOrUpdateSkillset",
    "Create or update a skillset for AI enrichment. Supports built-in skills (OCR, NLP, vision) and custom skills (Web API, Azure OpenAI).",
    {
      skillsetName: z.string().describe("Skillset name (unique within the Search service)"),
      skillsetDefinition: z.object({
        name: z.string(),
        description: z.string().optional(),
        skills: z.array(z.any()).describe("Array of skill definitions"),
        cognitiveServices: z.any().optional().describe("Cognitive Services configuration"),
        knowledgeStore: z.any().optional().describe("Knowledge Store projections"),
        encryptionKey: z.any().optional().describe("Customer-managed encryption key"),
        "@odata.etag": z.string().optional()
      }),
      validate: z.boolean().optional().default(true).describe("Validate skillset definition before creation")
    },
    getToolHints("PUT"),
    async ({ skillsetName, skillsetDefinition, validate }: any) => {
      try {
        const client = getClient();

        // Basic validation
        if (validate) {
          if (!skillsetDefinition.skills || !Array.isArray(skillsetDefinition.skills) || skillsetDefinition.skills.length === 0) {
            throw new Error("Skillset must have at least one skill");
          }

          // Validate each skill has required fields
          for (const skill of skillsetDefinition.skills) {
            if (!skill["@odata.type"]) {
              throw new Error("Each skill must have an @odata.type field");
            }
            if (!skill.inputs || !Array.isArray(skill.inputs)) {
              throw new Error(`Skill ${skill["@odata.type"]} must have inputs array`);
            }
            if (!skill.outputs || !Array.isArray(skill.outputs)) {
              throw new Error(`Skill ${skill["@odata.type"]} must have outputs array`);
            }
          }

          // Check for duplicate skill names
          const skillNames = skillsetDefinition.skills
            .filter((s: any) => s.name)
            .map((s: any) => s.name);
          const duplicates = skillNames.filter((name: string, index: number) => skillNames.indexOf(name) !== index);
          if (duplicates.length > 0) {
            throw new Error(`Duplicate skill names found: ${duplicates.join(", ")}`);
          }
        }

        // Ensure the name matches
        skillsetDefinition.name = skillsetName;

        // Remove ETag from body (should be in If-Match header if updating)
        const cleanDefinition = { ...skillsetDefinition };
        delete cleanDefinition["@odata.etag"];

        return rf.executeWithTimeout(
          client.createOrUpdateSkillset(skillsetName, cleanDefinition),
          DEFAULT_TIMEOUT_MS,
          "createOrUpdateSkillset",
          { skillsetName }
        );
      } catch (e) {
        return rf.formatError(e, { tool: "createOrUpdateSkillset", skillsetName });
      }
    }
  );

  server.tool(
    "deleteSkillset",
    "⚠️ DESTRUCTIVE: Permanently delete a skillset. This action cannot be undone. Any indexers using this skillset will fail until updated.",
    { skillsetName: z.string() },
    getToolHints("DELETE"),
    async ({ skillsetName }: { skillsetName: string }) => {
      try {
        const client = getClient();

        // Use MCP elicitation for confirmation if supported
        const elicitRequest = ToolElicitationBuilder.deleteSkillsetElicitation(skillsetName);
        const confirmed = await elicitIfNeeded(context.agent || server, elicitRequest);

        // If elicitation was triggered, check confirmation
        if (confirmed !== undefined) {
          if (confirmed.skillsetName !== skillsetName) {
            throw new Error("Skillset name mismatch in confirmation");
          }
          if (confirmed.confirmation !== "DELETE") {
            throw new Error("Deletion not confirmed");
          }
          if (!confirmed.understood) {
            throw new Error("User did not acknowledge the permanent nature of this action");
          }
        }

        await rf.executeWithTimeout(
          client.deleteSkillset(skillsetName),
          DEFAULT_TIMEOUT_MS,
          "deleteSkillset",
          { skillsetName }
        );
        
        return rf.formatSuccess({ 
          success: true, 
          message: `Skillset ${skillsetName} deleted`,
          warning: "Any indexers using this skillset will fail until updated to use a different skillset or have the skillset reference removed."
        });
      } catch (e) {
        return rf.formatError(e, { tool: "deleteSkillset", skillsetName });
      }
    }
  );
}
