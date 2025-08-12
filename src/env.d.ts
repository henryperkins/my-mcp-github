declare module "cloudflare:workers" {
  export interface Env {
    // Azure Search Configuration
    AZURE_SEARCH_ENDPOINT: string;
    AZURE_SEARCH_API_KEY: string;
    
    // Azure OpenAI Configuration (Optional)
    AZURE_OPENAI_ENDPOINT?: string;
    AZURE_OPENAI_API_KEY?: string;
    AZURE_OPENAI_DEPLOYMENT?: string;
    
    // Durable Object binding
    MCP_OBJECT: DurableObjectNamespace;
  }
  
  export const env: Env;
}