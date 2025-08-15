// MCP Elicitation Protocol implementation for Azure Search tools
// Based on MCP Protocol Revision 2025-06-18

/**
 * MCP Primitive Schema Types for elicitation
 */
export type PrimitiveSchemaDefinition = 
  | StringSchema 
  | NumberSchema 
  | BooleanSchema 
  | EnumSchema;

export interface StringSchema {
  type: "string";
  title?: string;
  description?: string;
  default?: string;
  format?: "uri" | "email" | "date" | "date-time";
  minLength?: number;
  maxLength?: number;
}

export interface NumberSchema {
  type: "number" | "integer";
  title?: string;
  description?: string;
  default?: number;
  minimum?: number;
  maximum?: number;
}

export interface BooleanSchema {
  type: "boolean";
  title?: string;
  description?: string;
  default?: boolean;
}

export interface EnumSchema {
  type: "string";
  title?: string;
  description?: string;
  default?: string;
  enum: string[];
  enumNames?: string[];
}

/**
 * MCP Elicitation Request Parameters
 */
export interface ElicitationRequest {
  message: string;
  requestedSchema: {
    type: "object";
    properties: Record<string, PrimitiveSchemaDefinition>;
    required?: string[];
  };
}

/**
 * MCP Elicitation Result
 */
export interface ElicitationResult {
  action: "accept" | "decline" | "cancel";
  content?: Record<string, string | number | boolean>;
}

/**
 * Helper to create MCP-compliant elicitation requests for Azure Search tools
 */
export class ToolElicitationBuilder {
  static createIndexElicitation(): ElicitationRequest[] {
    return [
      {
        message: "Let's create a new search index. First, how would you like to proceed?",
        requestedSchema: {
          type: "object",
          properties: {
            approach: {
              type: "string",
              title: "Creation Approach",
              description: "Choose how to create your index",
              enum: ["template", "clone", "custom"],
              enumNames: ["Use a template", "Clone existing index", "Custom definition"]
            }
          },
          required: ["approach"]
        }
      },
      {
        message: "Which template would you like to use for your search index?",
        requestedSchema: {
          type: "object",
          properties: {
            template: {
              type: "string",
              title: "Template Type",
              description: "Pre-configured index structure for common scenarios",
              enum: ["documentSearch", "productCatalog", "hybridSearch", "knowledgeBase"],
              enumNames: [
                "Document Search (articles, blogs)",
                "Product Catalog (e-commerce)",
                "Hybrid Search (text + vector)",
                "Knowledge Base (FAQ, support docs)"
              ]
            }
          },
          required: ["template"]
        }
      },
      {
        message: "Please provide the index configuration details",
        requestedSchema: {
          type: "object",
          properties: {
            indexName: {
              type: "string",
              title: "Index Name",
              description: "Lowercase letters, numbers, and hyphens only (max 128 chars)",
              minLength: 1,
              maxLength: 128
            },
            language: {
              type: "string",
              title: "Primary Language",
              description: "Language for text analysis",
              enum: ["english", "spanish", "french", "german", "japanese", "chinese"],
              enumNames: ["English", "Spanish", "French", "German", "Japanese", "Chinese"]
            },
            vectorDimensions: {
              type: "integer",
              title: "Vector Dimensions",
              description: "For hybrid search: OpenAI (1536), Azure OpenAI ada-002 (1536)",
              minimum: 1,
              maximum: 4096
            }
          },
          required: ["indexName", "language"]
        }
      }
    ];
  }

  static deleteIndexElicitation(indexName?: string): ElicitationRequest {
    return {
      message: `⚠️ WARNING: You are about to permanently delete the index${indexName ? ` '${indexName}'` : ''}. This will delete all documents and cannot be undone. Please confirm.`,
      requestedSchema: {
        type: "object",
        properties: {
          indexName: {
            type: "string",
            title: "Index Name",
            description: "Enter the exact name of the index to delete"
          },
          confirmation: {
            type: "string",
            title: "Confirmation",
            description: "Type 'DELETE' to confirm deletion",
            enum: ["DELETE"]
          },
          understood: {
            type: "boolean",
            title: "Acknowledgment",
            description: "I understand this action is permanent and cannot be undone",
            default: false
          }
        },
        required: ["indexName", "confirmation", "understood"]
      }
    };
  }

  static deleteSkillsetElicitation(skillsetName?: string): ElicitationRequest {
    return {
      message: `⚠️ WARNING: You are about to permanently delete the skillset${skillsetName ? ` '${skillsetName}'` : ''}. Any indexers using this skillset will fail until updated. This action cannot be undone. Please confirm.`,
      requestedSchema: {
        type: "object",
        properties: {
          skillsetName: {
            type: "string",
            title: "Skillset Name",
            description: "Enter the exact name of the skillset to delete"
          },
          confirmation: {
            type: "string",
            title: "Confirmation",
            description: "Type 'DELETE' to confirm deletion",
            enum: ["DELETE"]
          },
          understood: {
            type: "boolean",
            title: "Acknowledgment",
            description: "I understand this action is permanent and any indexers using this skillset will fail",
            default: false
          }
        },
        required: ["skillsetName", "confirmation", "understood"]
      }
    };
  }

  static searchDocumentsElicitation(): ElicitationRequest {
    return {
      message: "Configure your document search parameters",
      requestedSchema: {
        type: "object",
        properties: {
          indexName: {
            type: "string",
            title: "Index Name",
            description: "The index to search"
          },
          searchQuery: {
            type: "string",
            title: "Search Query",
            description: "Search terms or * for all documents"
          },
          top: {
            type: "integer",
            title: "Results Count",
            description: "Number of results to return (1-50)",
            minimum: 1,
            maximum: 50
          },
          includeTotalCount: {
            type: "boolean",
            title: "Include Total Count",
            description: "Show total number of matching documents",
            default: true
          }
        },
        required: ["indexName", "searchQuery"]
      }
    };
  }

  static uploadDocumentsElicitation(): ElicitationRequest {
    return {
      message: "Prepare to upload documents to your search index",
      requestedSchema: {
        type: "object",
        properties: {
          indexName: {
            type: "string",
            title: "Index Name",
            description: "Target index for document upload"
          },
          documentCount: {
            type: "integer",
            title: "Number of Documents",
            description: "How many documents to upload (max 1000 per batch)",
            minimum: 1,
            maximum: 1000
          },
          validateSchema: {
            type: "boolean",
            title: "Validate Schema",
            description: "Validate documents against index schema before upload",
            default: true
          }
        },
        required: ["indexName", "documentCount"]
      }
    };
  }

  static synonymMapElicitation(): ElicitationRequest {
    return {
      message: "Create a synonym map to improve search relevance",
      requestedSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            title: "Synonym Map Name",
            description: "Letters, numbers, and underscores only"
          },
          format: {
            type: "string",
            title: "Format",
            description: "Synonym format (Solr is standard)",
            enum: ["solr"],
            enumNames: ["Apache Solr Format"]
          }
        },
        required: ["name"]
      }
    };
  }
}

/**
 * Process elicitation response and extract validated content
 */
export function processElicitationResponse(
  result: ElicitationResult,
  schema: ElicitationRequest["requestedSchema"]
): { valid: boolean; data?: any; error?: string } {
  if (result.action === "decline") {
    return { valid: false, error: "User declined the request" };
  }
  
  if (result.action === "cancel") {
    return { valid: false, error: "User cancelled the request" };
  }
  
  if (result.action === "accept") {
    if (!result.content) {
      return { valid: false, error: "No content provided" };
    }
    
    // Validate required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in result.content)) {
          return { valid: false, error: `Missing required field: ${field}` };
        }
      }
    }
    
    // Basic type validation
    for (const [key, value] of Object.entries(result.content)) {
      const propSchema = schema.properties[key];
      if (!propSchema) continue;
      
      if (propSchema.type === "string" && typeof value !== "string") {
        return { valid: false, error: `Field ${key} must be a string` };
      }
      
      if ((propSchema.type === "number" || propSchema.type === "integer") && typeof value !== "number") {
        return { valid: false, error: `Field ${key} must be a number` };
      }
      
      if (propSchema.type === "boolean" && typeof value !== "boolean") {
        return { valid: false, error: `Field ${key} must be a boolean` };
      }
      
      // Validate enum values
      if ("enum" in propSchema && propSchema.enum) {
        if (!propSchema.enum.includes(value as string)) {
          return { valid: false, error: `Field ${key} must be one of: ${propSchema.enum.join(", ")}` };
        }
      }
      
      // Validate string constraints
      if (propSchema.type === "string") {
        const strValue = value as string;
        const strSchema = propSchema as StringSchema;
        
        if (strSchema.minLength && strValue.length < strSchema.minLength) {
          return { valid: false, error: `Field ${key} must be at least ${strSchema.minLength} characters` };
        }
        
        if (strSchema.maxLength && strValue.length > strSchema.maxLength) {
          return { valid: false, error: `Field ${key} must be at most ${strSchema.maxLength} characters` };
        }
        
        // Validate format
        if (strSchema.format === "email" && !strValue.includes("@")) {
          return { valid: false, error: `Field ${key} must be a valid email address` };
        }
        
        if (strSchema.format === "uri" && !strValue.match(/^https?:\/\//)) {
          return { valid: false, error: `Field ${key} must be a valid URI` };
        }
      }
      
      // Validate number constraints
      if (propSchema.type === "number" || propSchema.type === "integer") {
        const numValue = value as number;
        const numSchema = propSchema as NumberSchema;
        
        if (numSchema.type === "integer" && !Number.isInteger(numValue)) {
          return { valid: false, error: `Field ${key} must be an integer` };
        }
        
        if (numSchema.minimum !== undefined && numValue < numSchema.minimum) {
          return { valid: false, error: `Field ${key} must be at least ${numSchema.minimum}` };
        }
        
        if (numSchema.maximum !== undefined && numValue > numSchema.maximum) {
          return { valid: false, error: `Field ${key} must be at most ${numSchema.maximum}` };
        }
      }
    }
    
    return { valid: true, data: result.content };
  }
  
  return { valid: false, error: "Unknown action" };
}

/**
 * Example of creating an elicitation request for MCP protocol
 */
export function createElicitationRequest(
  id: string | number,
  elicitation: ElicitationRequest
): any {
  return {
    jsonrpc: "2.0",
    id,
    method: "elicitation/create",
    params: elicitation
  };
}

/**
 * Example of processing an elicitation response from MCP protocol
 */
export function parseElicitationResponse(response: any): ElicitationResult {
  if (response.error) {
    throw new Error(`Elicitation error: ${response.error.message}`);
  }
  
  return response.result as ElicitationResult;
}