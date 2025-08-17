// src/index.ts
// This file now redirects to the dynamic tools implementation
// The legacy tool architecture has been replaced with dynamic tools for better performance

// Export the Durable Object class (required by Wrangler)
export { AzureSearchMCPDynamic } from "./index-dynamic";

// Export aliases
export { AzureSearchMCPDynamic as AzureSearchMCP } from "./index-dynamic";

// Export the default handler with fetch
import defaultHandler from "./index-dynamic";
export default defaultHandler;