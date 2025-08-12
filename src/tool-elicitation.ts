// Tool elicitation helpers for better user interaction
// Based on MCP specification for client elicitation

export interface ElicitationHint {
  type: 'choice' | 'text' | 'number' | 'boolean' | 'confirm';
  prompt: string;
  options?: string[];
  default?: any;
  validation?: (value: any) => boolean | string;
  helpText?: string;
  examples?: string[];
}

export interface ToolElicitation {
  description: string;
  requiredCapabilities?: string[];
  elicitationSteps?: ElicitationHint[];
  confirmationRequired?: boolean;
  confirmationPrompt?: string;
}

// Elicitation configurations for complex tools
export const toolElicitations: Record<string, ToolElicitation> = {
  createIndex: {
    description: "I'll help you create a new search index. Let me guide you through the options.",
    elicitationSteps: [
      {
        type: 'choice',
        prompt: 'How would you like to create your index?',
        options: ['Use a template', 'Clone existing index', 'Custom definition'],
        helpText: 'Templates provide pre-configured index structures for common scenarios'
      },
      {
        type: 'choice',
        prompt: 'Which template would you like to use?',
        options: ['documentSearch', 'productCatalog', 'hybridSearch', 'knowledgeBase'],
        helpText: `
• documentSearch: For articles, blogs, documentation
• productCatalog: For e-commerce products with prices and categories
• hybridSearch: Combines text and vector search for semantic similarity
• knowledgeBase: For FAQ systems and support documentation`
      },
      {
        type: 'text',
        prompt: 'What name should the index have?',
        validation: (value: string) => {
          if (!value) return 'Index name is required';
          if (!/^[a-z][a-z0-9-]*$/.test(value)) {
            return 'Index name must start with lowercase letter and contain only lowercase letters, numbers, and hyphens';
          }
          if (value.length > 128) return 'Index name must be 128 characters or less';
          return true;
        },
        examples: ['product-catalog', 'knowledge-base-v2', 'customer-documents']
      },
      {
        type: 'choice',
        prompt: 'What language will your content primarily be in?',
        options: ['English', 'Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Other'],
        default: 'English',
        helpText: 'This configures the text analyzer for better search results in your language'
      },
      {
        type: 'number',
        prompt: 'For hybrid search: What vector dimensions will you use?',
        default: 1536,
        helpText: 'Common dimensions: OpenAI (1536), Azure OpenAI ada-002 (1536), OpenAI 3-large (3072)',
        validation: (value: number) => {
          if (value < 1 || value > 4096) return 'Dimensions must be between 1 and 4096';
          return true;
        }
      }
    ]
  },

  createOrUpdateIndex: {
    description: "I'll help you update an existing index. You can add fields or modify configurations.",
    elicitationSteps: [
      {
        type: 'text',
        prompt: 'Which index do you want to update?',
        validation: (value: string) => value ? true : 'Index name is required'
      },
      {
        type: 'choice',
        prompt: 'What would you like to do?',
        options: ['Add new fields', 'Update semantic search', 'Both', 'Full replacement'],
        helpText: 'Note: You cannot remove existing fields or change their types'
      },
      {
        type: 'confirm',
        prompt: 'Do you want to validate changes before applying?',
        default: true,
        helpText: 'Validation checks for breaking changes and schema errors'
      }
    ]
  },

  deleteIndex: {
    description: "⚠️ This will permanently delete the index and all its documents.",
    confirmationRequired: true,
    confirmationPrompt: "Are you sure you want to delete index '{indexName}'? This action cannot be undone and will delete all documents.",
    elicitationSteps: [
      {
        type: 'text',
        prompt: 'Enter the exact name of the index to delete:',
        validation: (value: string) => value ? true : 'Index name is required'
      },
      {
        type: 'text',
        prompt: 'Type "DELETE" to confirm:',
        validation: (value: string) => value === 'DELETE' ? true : 'Please type DELETE to confirm'
      }
    ]
  },

  uploadDocuments: {
    description: "I'll help you upload documents to your search index.",
    elicitationSteps: [
      {
        type: 'text',
        prompt: 'Which index should the documents be uploaded to?',
        validation: (value: string) => value ? true : 'Index name is required'
      },
      {
        type: 'choice',
        prompt: 'How would you like to provide the documents?',
        options: ['JSON array', 'CSV file path', 'Individual document'],
        helpText: 'Documents must match the index schema'
      },
      {
        type: 'number',
        prompt: 'How many documents are you uploading?',
        validation: (value: number) => {
          if (value < 1) return 'Must upload at least 1 document';
          if (value > 1000) return 'Maximum 1000 documents per batch. Consider using multiple batches.';
          return true;
        }
      },
      {
        type: 'confirm',
        prompt: 'Validate documents against index schema before upload?',
        default: true
      }
    ]
  },

  searchDocuments: {
    description: "I'll help you search for documents. Let me guide you through the search options.",
    elicitationSteps: [
      {
        type: 'text',
        prompt: 'Which index do you want to search?',
        validation: (value: string) => value ? true : 'Index name is required'
      },
      {
        type: 'text',
        prompt: 'Enter your search query (or * for all documents):',
        default: '*',
        examples: ['microsoft', 'product AND "in stock"', 'category:electronics']
      },
      {
        type: 'number',
        prompt: 'How many results would you like?',
        default: 10,
        validation: (value: number) => {
          if (value < 1 || value > 50) return 'Must be between 1 and 50';
          return true;
        }
      },
      {
        type: 'choice',
        prompt: 'Would you like to add filters?',
        options: ['No filters', 'Filter by field', 'Date range', 'Numeric range', 'Custom OData filter'],
        helpText: 'Filters narrow down results based on field values'
      },
      {
        type: 'choice',
        prompt: 'Sort results by:',
        options: ['Relevance (default)', 'Date (newest)', 'Date (oldest)', 'Custom field'],
        default: 'Relevance (default)'
      },
      {
        type: 'boolean',
        prompt: 'Include total count of matching documents?',
        default: true,
        helpText: 'Shows the total number of matches (not just returned results)'
      }
    ]
  },

  createOrUpdateSynonymMap: {
    description: "I'll help you create or update a synonym map for better search relevance.",
    elicitationSteps: [
      {
        type: 'text',
        prompt: 'What name should the synonym map have?',
        validation: (value: string) => {
          if (!value) return 'Synonym map name is required';
          if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
            return 'Name must start with a letter and contain only letters, numbers, and underscores';
          }
          return true;
        }
      },
      {
        type: 'choice',
        prompt: 'How would you like to define synonyms?',
        options: ['Common synonyms', 'Industry-specific', 'Custom rules'],
        helpText: `
• Common: General synonyms (e.g., big => large, small => tiny)
• Industry: Domain-specific terms (e.g., IT, medical, legal)
• Custom: Define your own synonym rules`
      },
      {
        type: 'text',
        prompt: 'Enter synonym rules (one per line):',
        helpText: `Format examples:
• Equivalent: USA, United States, America
• One-way: cat => feline
• Explicit: ms, Microsoft => Microsoft`,
        examples: [
          'phone, telephone, mobile',
          'laptop => computer',
          'TV, television => television'
        ]
      }
    ]
  }
};

// Helper function to format elicitation prompts for better UX
export function formatElicitationPrompt(hint: ElicitationHint): string {
  let prompt = hint.prompt;
  
  if (hint.helpText) {
    prompt += `\n💡 ${hint.helpText}`;
  }
  
  if (hint.options) {
    prompt += '\n\nOptions:';
    hint.options.forEach((opt, i) => {
      prompt += `\n  ${i + 1}. ${opt}`;
    });
  }
  
  if (hint.examples && hint.examples.length > 0) {
    prompt += '\n\nExamples:';
    hint.examples.forEach(ex => {
      prompt += `\n  • ${ex}`;
    });
  }
  
  if (hint.default !== undefined) {
    prompt += `\n\nDefault: ${hint.default}`;
  }
  
  return prompt;
}

// Helper to generate interactive parameter collection
export function generateParameterElicitation(toolName: string): any {
  const elicitation = toolElicitations[toolName];
  if (!elicitation) return null;
  
  return {
    description: elicitation.description,
    steps: elicitation.elicitationSteps?.map(step => ({
      ...step,
      formattedPrompt: formatElicitationPrompt(step)
    })),
    requiresConfirmation: elicitation.confirmationRequired,
    confirmationPrompt: elicitation.confirmationPrompt
  };
}

// Validation helper for user inputs
export function validateUserInput(
  value: any, 
  hint: ElicitationHint
): { valid: boolean; error?: string } {
  if (hint.validation) {
    const result = hint.validation(value);
    if (result === true) {
      return { valid: true };
    }
    return { valid: false, error: result as string };
  }
  
  // Basic type validation
  switch (hint.type) {
    case 'number':
      if (isNaN(value)) {
        return { valid: false, error: 'Must be a valid number' };
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        return { valid: false, error: 'Must be true or false' };
      }
      break;
    case 'choice':
      if (hint.options && !hint.options.includes(value)) {
        return { valid: false, error: `Must be one of: ${hint.options.join(', ')}` };
      }
      break;
  }
  
  return { valid: true };
}

// Template-based parameter generation
export function generateTemplateParameters(template: string, answers: Record<string, any>): any {
  switch (template) {
    case 'documentSearch':
      return {
        template: 'documentSearch',
        indexName: answers.indexName,
        language: answers.language?.toLowerCase(),
        validate: true
      };
    
    case 'productCatalog':
      return {
        template: 'productCatalog',
        indexName: answers.indexName,
        language: answers.language?.toLowerCase(),
        validate: true
      };
    
    case 'hybridSearch':
      return {
        template: 'hybridSearch',
        indexName: answers.indexName,
        vectorDimensions: answers.vectorDimensions || 1536,
        language: answers.language?.toLowerCase(),
        validate: true
      };
    
    case 'knowledgeBase':
      return {
        template: 'knowledgeBase',
        indexName: answers.indexName,
        language: answers.language?.toLowerCase(),
        validate: true
      };
    
    default:
      return answers;
  }
}