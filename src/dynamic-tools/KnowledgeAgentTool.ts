// src/dynamic-tools/KnowledgeAgentTool.ts
import { z } from "zod";
import { DynamicTool, OperationDefinition } from "./base/DynamicTool";
import type { ToolContext } from "../types";

export class KnowledgeAgentTool extends DynamicTool {
  static readonly toolName = "KnowledgeAgentOperations";
  static readonly description = "Manage Azure Search knowledge agents for intelligent search and Q&A capabilities.";

  static readonly operations: Record<string, OperationDefinition> = {
    list: {
      description: "List all knowledge agents in the search service",
      category: 'read',
      params: z.object({
        verbose: z.boolean().optional()
          .describe("Include full agent definitions")
      }),
      examples: [
        {},
        { verbose: true }
      ],
      handler: async (client, params, context, helpers) => {
        const agents = await helpers.withTimeout(
          client.listKnowledgeAgents(),
          undefined,
          "listKnowledgeAgents"
        ) as Array<any>;

        if (params.verbose) {
          return { agents, count: agents.length };
        }

        // Return simplified list
        const simplified = agents.map(agent => ({
          name: agent.name,
          description: agent.description,
          modelCount: agent.models?.length || 0,
          sourceCount: agent.knowledgeSources?.length || 0
        }));

        return { agents: simplified, count: agents.length };
      }
    },

    get: {
      description: "Get a specific knowledge agent definition",
      category: 'read',
      params: z.object({
        agentName: z.string()
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
          .max(128)
          .describe("The name of the agent to retrieve")
      }),
      examples: [
        { agentName: "customer-support-agent" }
      ],
      handler: async (client, params, context, helpers) => {
        return await helpers.withTimeout(
          client.getKnowledgeAgent(params.agentName),
          undefined,
          `getKnowledgeAgent:${params.agentName}`
        );
      }
    },

    create: {
      description: "Create a new knowledge agent for intelligent search",
      category: 'write',
      params: z.object({
        agentName: z.string()
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
          .max(128)
          .describe("Name of the agent to create"),
        agentDefinition: z.object({
          name: z.string()
            .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
            .max(128),
          description: z.string().optional(),
          models: z.array(z.object({
            kind: z.literal("azureOpenAI"),
            azureOpenAIParameters: z.object({
              resourceUri: z.string().url(),
              deploymentId: z.string(),
              apiKey: z.string().optional(),
              authIdentity: z.object({
                "@odata.type": z.enum([
                  "#Microsoft.Azure.Search.DataUserAssignedIdentity",
                  "#Microsoft.Azure.Search.DataNoneIdentity"
                ]),
                userAssignedIdentity: z.string().optional()
              }).optional(),
              modelName: z.enum([
                "text-embedding-ada-002",
                "text-embedding-3-large",
                "text-embedding-3-small",
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4.1",
                "gpt-4.1-mini",
                "gpt-4.1-nano"
              ]).optional()
            })
          })).describe("AI models for the agent"),
          knowledgeSources: z.array(z.object({
            name: z.string(),
            maxSubQueries: z.number().int().optional(),
            rerankerThreshold: z.number().optional(),
            alwaysQuerySource: z.boolean().optional(),
            includeReferences: z.boolean().optional(),
            includeReferenceSourceData: z.boolean().optional()
          })).describe("Knowledge sources to query"),
          outputConfiguration: z.object({
            modality: z.enum(["answerSynthesis", "extractiveData"]).optional(),
            answerInstructions: z.string().optional(),
            attemptFastPath: z.boolean().optional(),
            includeActivity: z.boolean().optional()
          }).optional(),
          requestLimits: z.object({
            maxOutputSize: z.number().int().optional(),
            maxRuntimeInSeconds: z.number().int().optional()
          }).optional(),
          retrievalInstructions: z.string().optional(),
          encryptionKey: z.any().optional()
        }),
        validate: z.boolean().optional().default(true)
      }),
      examples: [
        {
          agentName: "qa-agent",
          agentDefinition: {
            name: "qa-agent",
            description: "Q&A agent for product documentation",
            models: [{
              kind: "azureOpenAI",
              azureOpenAIParameters: {
                resourceUri: "https://myopenai-resource.openai.azure.com/",
                deploymentId: "gpt-4o",
                modelName: "gpt-4o"
              }
            }],
            knowledgeSources: [{
              name: "product-docs",
              includeReferences: true
            }],
            outputConfiguration: {
              modality: "answerSynthesis"
            }
          }
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Validation
        if (params.validate) {
          if (!params.agentDefinition.models || params.agentDefinition.models.length === 0) {
            throw new Error("At least one model is required");
          }
          if (!params.agentDefinition.knowledgeSources || params.agentDefinition.knowledgeSources.length === 0) {
            throw new Error("At least one knowledge source is required");
          }
        }

        // Ensure name matches
        params.agentDefinition.name = params.agentName;

        const created = await helpers.withTimeout(
          client.createKnowledgeAgent(params.agentDefinition),
          undefined,
          "createKnowledgeAgent"
        );

        helpers.notify("tools/knowledge_agent_created", {
          name: params.agentName,
          modelCount: params.agentDefinition.models.length,
          sourceCount: params.agentDefinition.knowledgeSources.length
        });

        return {
          success: true,
          message: `Knowledge agent '${params.agentName}' created successfully`,
          agent: created
        };
      }
    },

    update: {
      description: "Update an existing knowledge agent",
      category: 'write',
      params: z.object({
        agentName: z.string()
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
          .max(128)
          .describe("Name of the agent"),
        agentDefinition: z.object({
          name: z.string()
            .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
            .max(128),
          description: z.string().optional(),
          models: z.array(z.any()),
          knowledgeSources: z.array(z.any()),
          outputConfiguration: z.any().optional(),
          requestLimits: z.any().optional(),
          retrievalInstructions: z.string().optional(),
          encryptionKey: z.any().optional(),
          "@odata.etag": z.string().optional()
        }),
        ifMatch: z.string().optional()
          .describe("ETag for optimistic concurrency control"),
        ifNoneMatch: z.string().optional()
          .describe("ETag to prevent overwriting existing agent"),
        validate: z.boolean().optional().default(true)
      }),
      examples: [
        {
          agentName: "qa-agent",
          agentDefinition: {
            name: "qa-agent",
            description: "Updated Q&A agent",
            models: [],
            knowledgeSources: []
          }
        }
      ],
      handler: async (client, params, context, helpers) => {
        // Validation
        if (params.validate) {
          if (!params.agentDefinition.models || params.agentDefinition.models.length === 0) {
            throw new Error("At least one model is required");
          }
          if (!params.agentDefinition.knowledgeSources || params.agentDefinition.knowledgeSources.length === 0) {
            throw new Error("At least one knowledge source is required");
          }
        }

        // Ensure name matches
        params.agentDefinition.name = params.agentName;

        // Remove ETag from body
        const cleanDefinition = { ...params.agentDefinition };
        delete cleanDefinition["@odata.etag"];

        const updated = await helpers.withTimeout(
          client.createOrUpdateKnowledgeAgent(params.agentName, cleanDefinition),
          undefined,
          "updateKnowledgeAgent"
        );

        helpers.notify("tools/knowledge_agent_updated", {
          name: params.agentName
        });

        return {
          success: true,
          message: `Knowledge agent '${params.agentName}' updated successfully`,
          agent: updated
        };
      }
    },

    delete: {
      description: "Delete a knowledge agent permanently",
      category: 'delete',
      requiresConfirmation: true,
      params: z.object({
        agentName: z.string()
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
          .max(128)
          .describe("The name of the agent to delete"),
        confirmation: z.literal("DELETE").optional()
          .describe("Type 'DELETE' to confirm deletion")
      }),
      examples: [
        { agentName: "old-agent", confirmation: "DELETE" }
      ],
      handler: async (client, params, context, helpers) => {
        // Elicit confirmation if not provided
        if (params.confirmation !== "DELETE") {
          const response = await helpers.elicit({
            message: `⚠️ This will permanently delete knowledge agent '${params.agentName}'. Type 'DELETE' to confirm.`,
            inputType: 'confirm'
          });

          if (response?.text !== "DELETE") {
            throw new Error("Delete operation cancelled");
          }
        }

        await helpers.withTimeout(
          client.deleteKnowledgeAgent(params.agentName),
          undefined,
          `deleteKnowledgeAgent:${params.agentName}`
        );

        helpers.notify("tools/knowledge_agent_deleted", {
          name: params.agentName,
          timestamp: new Date().toISOString()
        });

        return {
          success: true,
          message: `Knowledge agent '${params.agentName}' deleted`
        };
      }
    }
  };

  // Resource definitions
  protected static resources = [
    {
      uri: "knowledge-agents://list",
      description: "List of all knowledge agents with their configuration",
      handler: async (context: ToolContext) => {
        const client = context.getClient();
        const agents = await client.listKnowledgeAgents() as Array<any>;

        return {
          count: agents.length,
          agents: agents.map(agent => ({
            name: agent.name,
            description: agent.description,
            modelCount: agent.models?.length || 0,
            sourceCount: agent.knowledgeSources?.length || 0,
            outputModality: agent.outputConfiguration?.modality,
            hasLimits: !!agent.requestLimits
          }))
        };
      }
    }
  ];

  // Prompt definitions
  protected static prompts = [
    {
      name: "setup_qa_agent",
      description: "Interactive setup for Q&A knowledge agent",
      params: z.object({
        domain: z.string().describe("What domain or topic area?"),
        sources: z.string().describe("What knowledge sources to use?"),
        responseStyle: z.enum(["concise", "detailed", "conversational"])
      }),
      handler: async (params: any, context: ToolContext) => {
        const config = KnowledgeAgentTool.recommendAgentConfig(
          params.domain,
          params.sources,
          params.responseStyle
        );

        return {
          messages: [
            {
              role: "assistant" as const,
              content: {
                type: "text" as const,
                text: `Recommended knowledge agent configuration:\n\n${config.explanation}\n\nAgent definition:\n${JSON.stringify(config.definition, null, 2)}`
              }
            }
          ]
        };
      }
    }
  ];

  // Helper methods
  private static recommendAgentConfig(
    domain: string,
    sources: string,
    responseStyle: string
  ): any {
    const definition: any = {
      name: `${domain.toLowerCase().replace(/\s+/g, '-')}-agent`,
      description: `Knowledge agent for ${domain}`,
      models: [{
        kind: "azureOpenAI",
        azureOpenAIParameters: {
          deploymentId: responseStyle === "detailed" ? "gpt-4" : "gpt-35-turbo",
          endpoint: "https://your-openai.openai.azure.com/"
        }
      }],
      knowledgeSources: [],
      outputConfiguration: {
        modality: "answerSynthesis",
        includeActivity: false
      }
    };

    // Parse sources
    const sourceList = sources.split(',').map(s => s.trim());
    definition.knowledgeSources = sourceList.map(source => ({
      name: source.toLowerCase().replace(/\s+/g, '-'),
      includeReferences: true,
      alwaysQuerySource: sourceList.length === 1
    }));

    // Response style configuration
    let explanation = `Agent configured for ${domain} domain with ${sourceList.length} knowledge source(s). `;

    switch (responseStyle) {
      case "concise":
        definition.outputConfiguration.answerInstructions = "Provide brief, direct answers. Limit responses to 2-3 sentences.";
        definition.requestLimits = { maxOutputSize: 500 };
        explanation += "Optimized for concise, quick responses.";
        break;
      case "detailed":
        definition.outputConfiguration.answerInstructions = "Provide comprehensive answers with examples and context.";
        definition.requestLimits = { maxOutputSize: 2000 };
        explanation += "Configured for detailed, thorough responses with GPT-4.";
        break;
      case "conversational":
        definition.outputConfiguration.answerInstructions = "Use a friendly, conversational tone. Ask clarifying questions when needed.";
        definition.outputConfiguration.attemptFastPath = true;
        explanation += "Set up for natural, conversational interactions.";
        break;
    }

    return { definition, explanation };
  }
}
