// src/index.ts
// This file now redirects to the dynamic tools implementation
// The legacy tool architecture has been replaced with dynamic tools for better performance

export { AzureSearchMCPDynamic as AzureSearchMCP } from "./index-dynamic";
export { AzureSearchMCPDynamic as default } from "./index-dynamic";

// For backward compatibility, re-export the default handler
import defaultHandler from "./index-dynamic";
export const fetch = defaultHandler.fetch;