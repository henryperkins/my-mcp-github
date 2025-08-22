// src/dynamic-tools/SkillsetTool.ts
import { z } from "zod";
import { DynamicTool, OperationDefinition } from "./base/DynamicTool";
import type { ToolContext } from "../types";

export class SkillsetTool extends DynamicTool {
  static readonly toolName = "SkillsetManagement";
  static readonly description = "Skillset management for Azure Search. USAGE: Call with {'operation': '<op>', 'params': {...}}. Operations: list, get, create, createOrUpdate, delete, validate.";

  static readonly operations: Record<string, OperationDefinition> = {
    list: {
      description: "List all skillsets in the search service",
      category: 'read',
      params: z.object({
        select: z.string().optional()
          .describe("Properties to retrieve (comma-separated JSON property names, or '*' for all)")
      }),
      examples: [
        {},
        { select: "name,description" }
      ],
      handler: async (client, params, context, helpers) => {
        const skillsets = await helpers.withTimeout(
          client.listSkillsets(params.select),
          undefined,
          "listSkillsets"
        ) as Array<any>;

        // If select parameter was used and doesn't include full details, return simplified list
        if (params.select && params.select !== '*') {
          const names = skillsets.map((ss) => ss.name || "").filter(Boolean);
          return { skillsets: names, count: names.length };
        }

        // Return full skillset definitions
        return { skillsets, count: skillsets.length };
      }
    },

    get: {
      description: "Get a specific skillset definition",
      category: 'read',
      params: z.object({
        skillsetName: z.string().describe("The name of the skillset to retrieve")
      }),
      examples: [
        { skillsetName: "document-skills" }
      ],
      handler: async (client, params, context, helpers) => {
        return await helpers.withTimeout(
          client.getSkillset(params.skillsetName),
          undefined,
          `getSkillset:${params.skillsetName}`
        );
      }
    },

    create: {
      description: "Create a new skillset for AI enrichment",
      category: 'write',
      params: z.object({
        name: z.string().describe("The name of the skillset"),
        description: z.string().optional().describe("The description of the skillset"),
        skills: z.array(z.any()).describe("A list of skills in the skillset"),
        cognitiveServices: z.any().optional().describe("Azure AI service resource configuration"),
        knowledgeStore: z.any().optional().describe("Knowledge Store projections"),
        encryptionKey: z.any().optional().describe("Encryption key for skillset definition"),
        exampleSkillType: z.enum(["entityRecognition", "keyPhrases", "ocr", "customWebApi", "none"])
          .optional().describe("Request an example skill configuration")
      }),
      examples: [
        {
          name: "document-skills",
          description: "Extract entities and key phrases from documents",
          skills: [
            {
              "@odata.type": "#Microsoft.Skills.Text.EntityRecognitionSkill",
              name: "entityRecognition",
              context: "/document",
              inputs: [{ name: "text", source: "/document/content" }],
              outputs: [
                { name: "persons", targetName: "people" },
                { name: "organizations", targetName: "organizations" },
                { name: "locations", targetName: "locations" }
              ]
            }
          ]
        }
      ],
      handler: async (client, params, context, helpers) => {
        // If example requested, return it
        if (params.exampleSkillType && params.exampleSkillType !== "none") {
          const example = SkillsetTool.getSkillExample(params.exampleSkillType);
          if (example) {
            return {
              message: `Example ${params.exampleSkillType} skill configuration`,
              example,
              usage: "Add this skill to your skills array and customize as needed"
            };
          }
        }

        // Validate skillset
        if (!params.name) {
          throw new Error("Skillset name is required");
        }
        if (!params.skills || !Array.isArray(params.skills) || params.skills.length === 0) {
          throw new Error("Skillset must have at least one skill");
        }

        // Validate each skill
        for (const skill of params.skills) {
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

        const skillsetDefinition: any = {
          name: params.name,
          description: params.description,
          skills: params.skills
        };

        if (params.cognitiveServices) {
          skillsetDefinition.cognitiveServices = params.cognitiveServices;
        }
        if (params.knowledgeStore) {
          skillsetDefinition.knowledgeStore = params.knowledgeStore;
        }
        if (params.encryptionKey) {
          skillsetDefinition.encryptionKey = params.encryptionKey;
        }

        const created = await helpers.withTimeout(
          client.createSkillset(skillsetDefinition),
          undefined,
          "createSkillset"
        );

        helpers.notify("tools/skillset_created", {
          name: params.name,
          skillCount: params.skills.length
        });

        // Emit MCP resource updates
        helpers.notifyResourceUpdated("skillsets");
        helpers.notifyResourceUpdated(`skillsets/${params.name}`);

        return {
          success: true,
          message: `Skillset '${params.name}' created with ${params.skills.length} skills`,
          skillset: created
        };
      }
    },

    update: {
      description: "Update an existing skillset",
      category: 'write',
      params: z.object({
        skillsetName: z.string().describe("Skillset name"),
        skillsetDefinition: z.object({
          name: z.string(),
          description: z.string().optional(),
          skills: z.array(z.any()),
          cognitiveServices: z.any().optional(),
          knowledgeStore: z.any().optional(),
          encryptionKey: z.any().optional(),
          "@odata.etag": z.string().optional()
        }),
        validate: z.boolean().optional().default(true)
          .describe("Validate skillset definition before updating"),
        exampleSkillType: z.enum(["entityRecognition", "keyPhrases", "ocr", "customWebApi", "none"])
          .optional().describe("Request an example skill configuration")
      }),
      examples: [
        {
          skillsetName: "document-skills",
          skillsetDefinition: {
            name: "document-skills",
            description: "Updated skillset for document processing",
            skills: []
          },
          validate: true
        }
      ],
      handler: async (client, params, context, helpers) => {
        // If example requested, return it
        if (params.exampleSkillType && params.exampleSkillType !== "none") {
          const example = SkillsetTool.getSkillExample(params.exampleSkillType);
          if (example) {
            return {
              message: `Example ${params.exampleSkillType} skill configuration`,
              example,
              usage: "Add this skill to your skillsetDefinition.skills array"
            };
          }
        }

        // Basic validation
        if (params.validate) {
          if (!params.skillsetDefinition.skills ||
              !Array.isArray(params.skillsetDefinition.skills) ||
              params.skillsetDefinition.skills.length === 0) {
            throw new Error("Skillset must have at least one skill");
          }

          // Validate each skill has required fields
          for (const skill of params.skillsetDefinition.skills) {
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
          const skillNames = params.skillsetDefinition.skills
            .filter((s: any) => s.name)
            .map((s: any) => s.name);
          const duplicates = skillNames.filter(
            (name: string, index: number) => skillNames.indexOf(name) !== index
          );
          if (duplicates.length > 0) {
            throw new Error(`Duplicate skill names found: ${duplicates.join(", ")}`);
          }
        }

        // Ensure the name matches
        params.skillsetDefinition.name = params.skillsetName;

        // Remove ETag from body (should be in If-Match header if updating)
        const cleanDefinition = { ...params.skillsetDefinition };
        delete cleanDefinition["@odata.etag"];

        const updated = await helpers.withTimeout(
          client.createOrUpdateSkillset(params.skillsetName, cleanDefinition),
          undefined,
          "updateSkillset"
        );

        helpers.notify("tools/skillset_updated", {
          name: params.skillsetName,
          skillCount: params.skillsetDefinition.skills.length
        });

        // Emit MCP resource updates
        helpers.notifyResourceUpdated("skillsets");
        helpers.notifyResourceUpdated(`skillsets/${params.skillsetName}`);

        return {
          success: true,
          message: `Skillset '${params.skillsetName}' updated successfully`,
          skillset: updated
        };
      }
    },

    delete: {
      description: "Delete a skillset permanently",
      category: 'delete',
      requiresConfirmation: true,
      params: z.object({
        skillsetName: z.string().describe("Skillset name to delete"),
        confirmation: z.literal("DELETE").optional()
          .describe("Type 'DELETE' to confirm deletion")
      }),
      examples: [
        { skillsetName: "old-skillset", confirmation: "DELETE" }
      ],
      handler: async (client, params, context, helpers) => {
        // Elicit confirmation if not provided
        if (params.confirmation !== "DELETE") {
          const response = await helpers.elicit({
            message: `⚠️ This will permanently delete skillset '${params.skillsetName}'. Any indexers using this skillset will fail. Type 'DELETE' to confirm.`,
            inputType: 'text',
            validation: (input: string) => input === "DELETE" ? null : "Please type 'DELETE' to confirm",
            timeout: 10000
          });

          if (response?.text !== "DELETE") {
            throw new Error("Delete operation cancelled");
          }
        }

        await helpers.withTimeout(
          client.deleteSkillset(params.skillsetName),
          undefined,
          `deleteSkillset:${params.skillsetName}`
        );

        helpers.notify("tools/skillset_deleted", {
          name: params.skillsetName,
          timestamp: new Date().toISOString()
        });

        // Emit MCP resource updates
        helpers.notifyResourceUpdated("skillsets");
        helpers.notifyResourceUpdated(`skillsets/${params.skillsetName}`);

        return {
          success: true,
          message: `Skillset '${params.skillsetName}' deleted`,
          warning: "Any indexers using this skillset will fail until updated"
        };
      }
    },

    reset: {
      description: "Reset skills cache for specific skills in a skillset",
      category: 'write',
      params: z.object({
        skillsetName: z.string().describe("The name of the skillset to reset"),
        skillNames: z.array(z.string()).optional()
          .describe("Names of skills to reset. If not provided, all skills are reset")
      }),
      examples: [
        { skillsetName: "document-skills" },
        { skillsetName: "document-skills", skillNames: ["entityRecognition", "keyPhrases"] }
      ],
      handler: async (client, params, context, helpers) => {
        await helpers.withTimeout(
          client.resetSkills(params.skillsetName, params.skillNames),
          undefined,
          `resetSkills:${params.skillsetName}`
        );

        helpers.notify("tools/skillset_reset", {
          skillsetName: params.skillsetName,
          skillNames: params.skillNames,
          timestamp: new Date().toISOString()
        });

        // Emit MCP resource updates
        helpers.notifyResourceUpdated("skillsets");
        helpers.notifyResourceUpdated(`skillsets/${params.skillsetName}`);

        return {
          success: true,
          message: params.skillNames
            ? `Skills ${params.skillNames.join(", ")} in skillset ${params.skillsetName} have been reset`
            : `All skills in skillset ${params.skillsetName} have been reset`,
          info: "The skill cache has been cleared. Skills will be re-executed on the next indexer run."
        };
      }
    }
  };

  // Resource definitions
  protected static resources = [
    {
      uri: "skillsets://list",
      description: "List of all skillsets with their configuration",
      handler: async (context: ToolContext) => {
        const client = context.getClient();
        const skillsets = await client.listSkillsets() as Array<any>;

        return {
          count: skillsets.length,
          skillsets: skillsets.map(ss => ({
            name: ss.name,
            description: ss.description,
            skillCount: ss.skills?.length || 0,
            hasCognitiveServices: !!ss.cognitiveServices,
            hasKnowledgeStore: !!ss.knowledgeStore
          }))
        };
      }
    }
  ];

  // Prompt definitions
  protected static prompts = [
    {
      name: "create_enrichment_pipeline",
      description: "Interactive setup for AI enrichment pipeline",
      params: z.object({
        contentType: z.enum(["documents", "images", "mixed"]),
        enrichmentGoals: z.string().describe("What insights do you want to extract?"),
        outputFormat: z.enum(["searchIndex", "knowledgeStore", "both"])
      }),
      handler: async (params: any, context: ToolContext) => {
        const pipeline = SkillsetTool.recommendEnrichmentPipeline(
          params.contentType,
          params.enrichmentGoals,
          params.outputFormat
        );

        return {
          messages: [
            {
              role: "assistant" as const,
              content: {
                type: "text" as const,
                text: `Recommended enrichment pipeline:\n\n${pipeline.explanation}\n\nSkillset configuration:\n${JSON.stringify(pipeline.skillset, null, 2)}`
              }
            }
          ]
        };
      }
    }
  ];

  // Helper methods
  private static getSkillExample(skillType: string): any {
    const examples: Record<string, any> = {
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
      keyPhrases: {
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

    return examples[skillType];
  }

  private static recommendEnrichmentPipeline(
    contentType: string,
    goals: string,
    outputFormat: string
  ): any {
    const skills: any[] = [];
    let explanation = "";

    // Add skills based on content type
    if (contentType === "documents" || contentType === "mixed") {
      // Text analysis skills
      if (goals.toLowerCase().includes("entit") || goals.toLowerCase().includes("people")) {
        skills.push(this.getSkillExample("entityRecognition"));
        explanation += "Entity recognition for extracting people, organizations, and locations. ";
      }
      if (goals.toLowerCase().includes("key") || goals.toLowerCase().includes("topic")) {
        skills.push(this.getSkillExample("keyPhrases"));
        explanation += "Key phrase extraction for identifying main topics. ";
      }
    }

    if (contentType === "images" || contentType === "mixed") {
      skills.push(this.getSkillExample("ocr"));
      explanation += "OCR for extracting text from images. ";
    }

    // Add cognitive services config
    const cognitiveServices = {
      "@odata.type": "#Microsoft.Azure.Search.DefaultCognitiveServices"
    };

    // Add knowledge store if needed
    let knowledgeStore = null;
    if (outputFormat === "knowledgeStore" || outputFormat === "both") {
      knowledgeStore = {
        storageConnectionString: "DefaultEndpointsProtocol=https;AccountName=...",
        projections: [
          {
            tables: [
              {
                tableName: "enrichedDocuments",
                generatedKeyName: "DocumentId",
                source: "/document/projection"
              }
            ]
          }
        ]
      };
      explanation += "\n\nKnowledge Store configured for persisting enriched data to Azure Storage.";
    }

    return {
      skillset: {
        name: `${contentType}-enrichment-skillset`,
        description: `AI enrichment pipeline for ${contentType}`,
        skills,
        cognitiveServices,
        knowledgeStore
      },
      explanation
    };
  }
}
