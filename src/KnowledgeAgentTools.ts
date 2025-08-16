// src/KnowledgeAgentTools.ts
import { z } from "zod";
import { ResponseFormatter } from "./utils/response";
import type { ToolContext } from "./types";
import { withTimeout } from "./utils/timeout";
import { DEFAULT_TIMEOUT_MS } from "./constants";

// Schemas for Knowledge Agents
const KnowledgeAgentNameSchema = z.string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/, "Agent name must start with alphanumeric and contain only alphanumeric, hyphens, and underscores");

// Azure OpenAI Parameters schema
const AzureOpenAIParametersSchema = z.object({
  apiVersion: z.string().optional(),
  deploymentId: z.string(),
  endpoint: z.string().url()
}).passthrough();

// Knowledge Agent Model schema
const KnowledgeAgentModelSchema = z.object({
  kind: z.enum(["azureOpenAI"]),
  azureOpenAIParameters: AzureOpenAIParametersSchema.optional()
});

// Knowledge Source Reference schema
const KnowledgeSourceReferenceSchema = z.object({
  name: z.string(),
  includeReferences: z.boolean().optional(),
  includeReferenceSourceData: z.boolean().optional(),
  alwaysQuerySource: z.boolean().optional(),
  maxSubQueries: z.number().int().optional(),
  rerankerThreshold: z.number().optional()
});

// Output Configuration schema
const KnowledgeAgentOutputConfigurationSchema = z.object({
  modality: z.enum(["answerSynthesis", "extractiveData"]).optional(),
  answerInstructions: z.string().optional(),
  attemptFastPath: z.boolean().optional(),
  includeActivity: z.boolean().optional()
});

// Request Limits schema
const KnowledgeAgentRequestLimitsSchema = z.object({
  maxRuntimeInSeconds: z.number().int().optional(),
  maxOutputSize: z.number().int().optional()
});

const KnowledgeAgentSchema = z.object({
  name: KnowledgeAgentNameSchema,
  description: z.string().optional(),
  models: z.array(KnowledgeAgentModelSchema),
  knowledgeSources: z.array(KnowledgeSourceReferenceSchema),
  outputConfiguration: KnowledgeAgentOutputConfigurationSchema.optional(),
  requestLimits: KnowledgeAgentRequestLimitsSchema.optional(),
  retrievalInstructions: z.string().optional(),
  "@odata.etag": z.string().optional(),
  encryptionKey: z.object({
    keyVaultKeyName: z.string(),
    keyVaultKeyVersion: z.string(),
    keyVaultUri: z.string().url(),
    accessCredentials: z.any().optional()
  }).optional()
});

/**
 * Register Knowledge Agent management tools on the provided MCP server.
 * Tools:
 *  - listKnowledgeAgents, getKnowledgeAgent, deleteKnowledgeAgent
 *  - createKnowledgeAgent, createOrUpdateKnowledgeAgent
 */
export function registerKnowledgeAgentTools(server: any, context: ToolContext) {
  const { getClient } = context;
  const rf = new ResponseFormatter(() => {
    const s = context.getSummarizer?.();
    if (!s) return null;
    return (text: string, maxTokens?: number) => s(text, maxTokens);
  });

  // List all knowledge agents
  server.tool(
    "listKnowledgeAgents",
    "List all knowledge agents available in the search service.",
    {
      verbose: z.boolean().optional().describe("Include full agent definitions")
    },
    async (args: any) => {
      try {
        const client = getClient();
        const result = await withTimeout(
          client.listKnowledgeAgents(args.verbose),
          DEFAULT_TIMEOUT_MS
        );
        return rf.formatSuccess(result);
      } catch (error: any) {
        return rf.formatError(error, { tool: "listKnowledgeAgents", verbose: args.verbose });
      }
    }
  );

  // Get a specific knowledge agent
  server.tool(
    "getKnowledgeAgent",
    "Get the definition of a specific knowledge agent.",
    {
      agentName: KnowledgeAgentNameSchema.describe("The name of the agent to retrieve")
    },
    async (args: any) => {
      try {
        const client = getClient();
        const result = await withTimeout(
          client.getKnowledgeAgent(args.agentName),
          DEFAULT_TIMEOUT_MS
        );
        return rf.formatSuccess(result);
      } catch (error: any) {
        return rf.formatError(error, { tool: "getKnowledgeAgent", agentName: args.agentName });
      }
    }
  );

  // Create a new knowledge agent
  server.tool(
    "createKnowledgeAgent",
    "Create a new knowledge agent for intelligent search and Q&A.",
    {
      agentName: KnowledgeAgentNameSchema.describe("Name of the agent to create"),
      agentDefinition: KnowledgeAgentSchema.describe("The agent definition"),
      validate: z.boolean().optional().describe("Validate the agent definition before creation")
    },
    async (args: any) => {
      try {
        // Ensure name consistency
        if (!args.agentDefinition.name) {
          args.agentDefinition.name = args.agentName;
        } else if (args.agentDefinition.name !== args.agentName) {
          throw new Error(`Agent name mismatch: ${args.agentName} vs ${args.agentDefinition.name}`);
        }

        // Validate if requested
        if (args.validate) {
          const errors = validateKnowledgeAgent(args.agentDefinition);
          if (errors.length > 0) {
            return rf.formatSuccess({
              success: false,
              errors,
              message: "Knowledge agent validation failed"
            });
          }
        }

        const client = getClient();
        const result = await withTimeout(
          client.createKnowledgeAgent(args.agentDefinition),
          DEFAULT_TIMEOUT_MS
        );
        return rf.formatSuccess(result);
      } catch (error: any) {
        return rf.formatError(error, { tool: "createKnowledgeAgent", agentName: args.agentName });
      }
    }
  );

  // Create or update a knowledge agent
  server.tool(
    "createOrUpdateKnowledgeAgent",
    "Create a new knowledge agent or update an existing one.",
    {
      agentName: KnowledgeAgentNameSchema.describe("Name of the agent"),
      agentDefinition: KnowledgeAgentSchema.describe("The agent definition"),
      ifMatch: z.string().optional().describe("ETag for optimistic concurrency control"),
      ifNoneMatch: z.string().optional().describe("ETag to prevent overwriting existing agent"),
      validate: z.boolean().optional().describe("Validate the agent definition before creation")
    },
    async (args: any) => {
      try {
        // Ensure name consistency
        if (!args.agentDefinition.name) {
          args.agentDefinition.name = args.agentName;
        } else if (args.agentDefinition.name !== args.agentName) {
          throw new Error(`Agent name mismatch: ${args.agentName} vs ${args.agentDefinition.name}`);
        }

        // Validate if requested
        if (args.validate) {
          const errors = validateKnowledgeAgent(args.agentDefinition);
          if (errors.length > 0) {
            return rf.formatSuccess({
              success: false,
              errors,
              message: "Knowledge agent validation failed"
            });
          }
        }

        const client = getClient();
        const result = await withTimeout(
          client.createOrUpdateKnowledgeAgent(
            args.agentName,
            args.agentDefinition,
            {
              ifMatch: args.ifMatch,
              ifNoneMatch: args.ifNoneMatch
            }
          ),
          DEFAULT_TIMEOUT_MS
        );
        return rf.formatSuccess(result);
      } catch (error: any) {
        return rf.formatError(error, { tool: "createOrUpdateKnowledgeAgent", agentName: args.agentName });
      }
    }
  );

  // Delete a knowledge agent
  server.tool(
    "deleteKnowledgeAgent",
    "⚠️ DESTRUCTIVE: Permanently delete a knowledge agent. This action cannot be undone.",
    {
      agentName: KnowledgeAgentNameSchema.describe("The name of the agent to delete"),
      confirmation: z.string().optional().describe("Type 'DELETE' to confirm deletion")
    },
    async (args: any) => {
      try {
        // Check for explicit confirmation
        if (args.confirmation !== "DELETE") {
          return rf.formatSuccess({
            success: false,
            message: "Delete operation requires explicit confirmation. Please provide confirmation='DELETE'"
          });
        }

        const client = getClient();
        await withTimeout(
          client.deleteKnowledgeAgent(args.agentName),
          DEFAULT_TIMEOUT_MS
        );
        
        return rf.formatSuccess({
          success: true,
          message: `Knowledge agent '${args.agentName}' has been permanently deleted`
        });
      } catch (error: any) {
        return rf.formatError(error, { tool: "deleteKnowledgeAgent", agentName: args.agentName });
      }
    }
  );
}

// Validation helper for knowledge agents
function validateKnowledgeAgent(agent: any): string[] {
  const errors: string[] = [];

  if (!agent.name) {
    errors.push("Agent must have a name");
  }

  if (!agent.models || !Array.isArray(agent.models) || agent.models.length === 0) {
    errors.push("Agent must have at least one model configured");
  }

  if (!agent.knowledgeSources || !Array.isArray(agent.knowledgeSources) || agent.knowledgeSources.length === 0) {
    errors.push("Agent must have at least one knowledge source");
  }

  // Validate temperature if provided
  if (agent.temperature !== undefined) {
    if (agent.temperature < 0 || agent.temperature > 1) {
      errors.push("Temperature must be between 0 and 1");
    }
  }

  // Validate max tokens if provided
  if (agent.maxTokens !== undefined) {
    if (agent.maxTokens < 1) {
      errors.push("Max tokens must be at least 1");
    }
  }

  // Validate knowledge sources if provided
  if (agent.knowledgeSources && !Array.isArray(agent.knowledgeSources)) {
    errors.push("Knowledge sources must be an array");
  }

  return errors;
}