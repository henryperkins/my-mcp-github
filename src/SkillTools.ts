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
 *  - createSkillset, createOrUpdateSkillset
 *  - deleteSkillset, resetSkills
 */
// Helper to create skill template examples
function getSkillExamples() {
  return {
    entityRecognition: {
      "@odata.type": "#Microsoft.Skills.Text.EntityRecognitionSkill",
      name: "entityRecognition",
      description: "Extract entities from text",
      context: "/document",
      inputs: [
        { name: "text", source: "/document/content" }
      ],
      outputs: [
        { name: "persons", targetName: "people" },
        { name: "organizations", targetName: "organizations" },
        { name: "locations", targetName: "locations" }
      ]
    },
    keyPhraseExtraction: {
      "@odata.type": "#Microsoft.Skills.Text.KeyPhraseExtractionSkill",
      name: "keyPhrases",
      description: "Extract key phrases",
      context: "/document",
      inputs: [
        { name: "text", source: "/document/content" }
      ],
      outputs: [
        { name: "keyPhrases", targetName: "keyPhrases" }
      ]
    },
    ocr: {
      "@odata.type": "#Microsoft.Skills.Vision.OcrSkill",
      name: "ocr",
      description: "Extract text from images",
      context: "/document/normalized_images/*",
      inputs: [
        { name: "image", source: "/document/normalized_images/*" }
      ],
      outputs: [
        { name: "text", targetName: "text" }
      ]
    },
    customWebApi: {
      "@odata.type": "#Microsoft.Skills.Custom.WebApiSkill",
      name: "customEnrichment",
      description: "Call custom web API",
      uri: "https://your-api.com/enrichment",
      httpMethod: "POST",
      httpHeaders: {
        "Api-Key": "your-api-key"
      },
      timeout: "PT30S",
      batchSize: 10,
      context: "/document",
      inputs: [
        { name: "text", source: "/document/content" }
      ],
      outputs: [
        { name: "enrichedData", targetName: "customData" }
      ]
    }
  };
}

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
    "List all skillsets in a search service.", 
    {
      select: z.string().optional().describe("Selects which top-level properties of the skillsets to retrieve. Specified as a comma-separated list of JSON property names, or '*' for all properties. The default is all properties.")
    }, 
    getToolHints("GET"),
    async ({ select }: { select?: string }) => {
      try {
        const client = getClient();
        const skillsets = await client.listSkillsets(select) as Array<any>;
        
        // If select parameter was used and doesn't include full details, return simplified list
        if (select && select !== '*') {
          const names = skillsets.map((ss) => ss.name || "").filter(Boolean);
          return rf.formatSuccess({ skillsets: names, count: names.length });
        }
        
        // Return full skillset definitions
        return rf.formatSuccess({ skillsets, count: skillsets.length });
      } catch (e) {
        return rf.formatError(e, { tool: "listSkillsets" });
      }
    }
  );

  server.tool(
    "getSkillset", 
    "Retrieves a skillset in a search service.", 
    { 
      skillsetName: z.string().describe("The name of the skillset to retrieve.") 
    }, 
    getToolHints("GET"),
    async ({ skillsetName }: { skillsetName: string }) => {
      return rf.executeWithTimeout(
        () => getClient().getSkillset(skillsetName), 
        DEFAULT_TIMEOUT_MS, 
        "getSkillset", 
        { tool: "getSkillset", skillsetName }
      );
    }
  );

  server.tool(
    "createSkillset",
    `Creates a new skillset in a search service. Skillsets define a pipeline of AI skills that extract and enrich content during indexing.

Available skill types:
TEXT SKILLS:
- EntityRecognitionSkill: Extract people, organizations, locations
- KeyPhraseExtractionSkill: Extract key phrases
- LanguageDetectionSkill: Detect language
- SentimentSkill: Analyze sentiment
- PIIDetectionSkill: Detect personal information
- SplitSkill: Split text into chunks
- MergeSkill: Merge text from multiple fields
- TranslationSkill: Translate text

VISION SKILLS:
- OcrSkill: Extract text from images (OCR)
- ImageAnalysisSkill: Analyze images for tags, descriptions

CUSTOM SKILLS:
- WebApiSkill: Call custom Web API
- AzureOpenAIEmbeddingSkill: Generate embeddings

Each skill requires:
- @odata.type: The skill type identifier
- name: Unique name within skillset
- context: Path in document (e.g., "/document")
- inputs: Array of input mappings
- outputs: Array of output mappings`,
    {
      skillset: z.object({
        name: z.string().describe("The name of the skillset."),
        description: z.string().optional().describe("The description of the skillset."),
        skills: z.array(z.any()).describe(`A list of skills in the skillset. Each skill must have:
- @odata.type: e.g., "#Microsoft.Skills.Text.EntityRecognitionSkill"
- name: unique identifier
- context: document path
- inputs: array with {name, source} objects
- outputs: array with {name, targetName} objects`),
        cognitiveServices: z.any().optional().describe(`Azure AI service resource attached to a skillset:
- For default: {"@odata.type": "#Microsoft.Azure.Search.DefaultCognitiveServices"}
- For key-based: {"@odata.type": "#Microsoft.Azure.Search.CognitiveServicesByKey", "key": "your-key"}
- For identity-based: {"@odata.type": "#Microsoft.Azure.Search.AIServicesByIdentity", "subdomainUrl": "https://your-resource.cognitiveservices.azure.com"}`),
        knowledgeStore: z.any().optional().describe("Knowledge Store projections for saving enriched data to Azure Storage"),
        encryptionKey: z.any().optional().describe("Encryption key for skillset definition."),
        "@odata.etag": z.string().optional().describe("The ETag of the skillset.")
      }).describe("The skillset containing one or more skills to create in a search service."),
      exampleSkillType: z.enum(["entityRecognition", "keyPhrases", "ocr", "customWebApi", "none"]).optional().describe("Request an example skill configuration")
    },
    getToolHints("POST"),
    async ({ skillset, exampleSkillType }: { skillset: any; exampleSkillType?: string }) => {
      try {
        const client = getClient();
        
        // If example requested, return it
        if (exampleSkillType && exampleSkillType !== "none") {
          const examples = getSkillExamples();
          const example = examples[exampleSkillType as keyof typeof examples];
          if (example) {
            return rf.formatSuccess({
              message: `Example ${exampleSkillType} skill configuration`,
              example,
              usage: "Add this skill to your skillset.skills array and customize as needed"
            });
          }
        }
        
        // Validate skillset
        if (!skillset.name) {
          throw new Error("Skillset name is required");
        }
        if (!skillset.skills || !Array.isArray(skillset.skills) || skillset.skills.length === 0) {
          throw new Error("Skillset must have at least one skill");
        }
        
        // Validate each skill
        for (const skill of skillset.skills) {
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
        
        return rf.executeWithTimeout(
          () => client.createSkillset(skillset),
          DEFAULT_TIMEOUT_MS,
          "createSkillset",
          { skillsetName: skillset.name }
        );
      } catch (e) {
        return rf.formatError(e, { tool: "createSkillset" });
      }
    }
  );

  server.tool(
    "createOrUpdateSkillset",
    `Create or update a skillset for AI enrichment. Skillsets define a pipeline of AI skills that extract and enrich content during indexing.

Available skill types:
TEXT SKILLS:
- EntityRecognitionSkill: Extract people, organizations, locations
- KeyPhraseExtractionSkill: Extract key phrases
- LanguageDetectionSkill: Detect language
- SentimentSkill: Analyze sentiment
- PIIDetectionSkill: Detect personal information
- SplitSkill: Split text into chunks
- MergeSkill: Merge text from multiple fields
- TranslationSkill: Translate text

VISION SKILLS:
- OcrSkill: Extract text from images (OCR)
- ImageAnalysisSkill: Analyze images for tags, descriptions

CUSTOM SKILLS:
- WebApiSkill: Call custom Web API
- AzureOpenAIEmbeddingSkill: Generate embeddings

Each skill requires:
- @odata.type: The skill type identifier
- name: Unique name within skillset
- context: Path in document (e.g., "/document")
- inputs: Array of input mappings
- outputs: Array of output mappings`,
    {
      skillsetName: z.string().describe("Skillset name (unique within the Search service)"),
      skillsetDefinition: z.object({
        name: z.string(),
        description: z.string().optional(),
        skills: z.array(z.any()).describe(`Array of skill definitions. Each skill must have:
- @odata.type: e.g., "#Microsoft.Skills.Text.EntityRecognitionSkill"
- name: unique identifier
- context: document path
- inputs: array with {name, source} objects
- outputs: array with {name, targetName} objects`),
        cognitiveServices: z.any().optional().describe(`Cognitive Services configuration:
- For default: {"@odata.type": "#Microsoft.Azure.Search.DefaultCognitiveServices"}
- For key-based: {"@odata.type": "#Microsoft.Azure.Search.CognitiveServicesByKey", "key": "your-key"}
- For identity-based: {"@odata.type": "#Microsoft.Azure.Search.AIServicesByIdentity", "subdomainUrl": "https://your-resource.cognitiveservices.azure.com"}`),
        knowledgeStore: z.any().optional().describe("Knowledge Store projections for saving enriched data to Azure Storage"),
        encryptionKey: z.any().optional().describe("Customer-managed encryption key"),
        "@odata.etag": z.string().optional()
      }),
      validate: z.boolean().optional().default(true).describe("Validate skillset definition before creation"),
      exampleSkillType: z.enum(["entityRecognition", "keyPhrases", "ocr", "customWebApi", "none"]).optional().describe("Request an example skill configuration")
    },
    getToolHints("PUT"),
    async ({ skillsetName, skillsetDefinition, validate, exampleSkillType }: any) => {
      try {
        const client = getClient();
        
        // If example requested, return it
        if (exampleSkillType && exampleSkillType !== "none") {
          const examples = getSkillExamples();
          const example = examples[exampleSkillType as keyof typeof examples];
          if (example) {
            return rf.formatSuccess({
              message: `Example ${exampleSkillType} skill configuration`,
              example,
              usage: "Add this skill to your skillsetDefinition.skills array and customize as needed"
            });
          }
        }

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

  server.tool(
    "resetSkills",
    "Reset skills in an existing skillset in a search service. This resets the skill cache for specific skills.",
    {
      skillsetName: z.string().describe("The name of the skillset to reset."),
      skillNames: z.array(z.string()).optional().describe("Names of skills to reset. If not provided, all skills are reset.")
    },
    getToolHints("POST"),
    async ({ skillsetName, skillNames }: { skillsetName: string; skillNames?: string[] }) => {
      try {
        const client = getClient();
        
        await rf.executeWithTimeout(
          () => client.resetSkills(skillsetName, skillNames),
          DEFAULT_TIMEOUT_MS,
          "resetSkills",
          { skillsetName, skillNames }
        );
        
        return rf.formatSuccess({
          success: true,
          message: skillNames
            ? `Skills ${skillNames.join(", ")} in skillset ${skillsetName} have been reset`
            : `All skills in skillset ${skillsetName} have been reset`,
          info: "The skill cache has been cleared. Skills will be re-executed on the next indexer run."
        });
      } catch (e) {
        return rf.formatError(e, { tool: "resetSkills", skillsetName });
      }
    }
  );
}
