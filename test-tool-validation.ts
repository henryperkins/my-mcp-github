#!/usr/bin/env tsx
// Test script for MCP tool validation and error handling
// Run with: npx tsx test-tool-validation.ts

import { createToolWrapper, listAvailableTools, getToolInfo } from "./src/mcp-tool-wrapper";
import * as dotenv from "dotenv";

// Load environment variables from .dev.vars
dotenv.config({ path: ".dev.vars" });

// Create environment object
const env = {
  AZURE_SEARCH_ENDPOINT: process.env.AZURE_SEARCH_ENDPOINT || "https://test.search.windows.net",
  AZURE_SEARCH_API_KEY: process.env.AZURE_SEARCH_API_KEY || "test-key",
  AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT
};

async function testValidation() {
  console.log("=== MCP Tool Validation Testing ===\n");

  const testCases = [
    {
      name: "Invalid operation name",
      tool: "IndexManagement",
      input: { operation: "invalidOp", params: {} },
      expectError: true
    },
    {
      name: "Missing required parameters",
      tool: "IndexManagement",
      input: { operation: "get", params: {} },
      expectError: true
    },
    {
      name: "Invalid index name pattern",
      tool: "IndexManagement",
      input: { operation: "get", params: { indexName: "Invalid Name!" } },
      expectError: true
    },
    {
      name: "Exceeding max pagination size",
      tool: "DocumentOperations",
      input: { operation: "search", params: { indexName: "test", top: 10000 } },
      expectError: true
    },
    {
      name: "Invalid parameter type",
      tool: "DocumentOperations",
      input: { operation: "search", params: { indexName: "test", top: "not-a-number" } },
      expectError: true
    },
    {
      name: "Empty document batch",
      tool: "DocumentOperations",
      input: { operation: "upload", params: { indexName: "test", documents: [] } },
      expectError: true
    },
    {
      name: "Exceeding batch size limit",
      tool: "DocumentOperations",
      input: { 
        operation: "upload", 
        params: { 
          indexName: "test", 
          documents: Array(1001).fill({ id: "1", name: "test" }) 
        } 
      },
      expectError: true
    },
    {
      name: "Valid search with defaults",
      tool: "DocumentOperations",
      input: { operation: "search", params: { indexName: "test-index" } },
      expectError: false
    },
    {
      name: "Valid index creation",
      tool: "IndexManagement",
      input: { 
        operation: "create", 
        params: { 
          indexName: "test-index",
          template: "documentSearch"
        } 
      },
      expectError: false
    }
  ];

  console.log("Testing parameter validation:\n");
  
  for (const testCase of testCases) {
    try {
      const tool = createToolWrapper(testCase.tool, env);
      const result = await tool(testCase.input);
      
      if (testCase.expectError) {
        if (!result.success) {
          console.log(`✅ ${testCase.name}: Correctly rejected with error: ${result.error}`);
        } else {
          console.log(`❌ ${testCase.name}: Expected error but got success`);
        }
      } else {
        if (result.success || (!result.success && result.error.includes("403"))) {
          console.log(`✅ ${testCase.name}: Validation passed (API call may fail due to auth)`);
        } else {
          console.log(`❌ ${testCase.name}: Unexpected validation error: ${result.error}`);
        }
      }
    } catch (error: any) {
      if (testCase.expectError) {
        console.log(`✅ ${testCase.name}: Correctly threw error: ${error.message}`);
      } else {
        console.log(`❌ ${testCase.name}: Unexpected error: ${error.message}`);
      }
    }
  }
}

async function testSchemaIntrospection() {
  console.log("\n\n=== Schema Introspection ===\n");
  
  const tools = ["IndexManagement", "DocumentOperations", "ServiceUtilities"];
  
  for (const toolName of tools) {
    const info = getToolInfo(toolName);
    console.log(`\n📦 ${toolName}:`);
    
    // Check for dangerous operations
    const dangerousOps = info.operations.filter(op => 
      op.category === 'delete' || op.requiresConfirmation
    );
    
    if (dangerousOps.length > 0) {
      console.log("  ⚠️  Dangerous operations found:");
      dangerousOps.forEach(op => {
        console.log(`    - ${op.name} (${op.category}, confirmation: ${op.requiresConfirmation})`);
      });
    }
    
    // Check for pagination support
    const paginatedOps = info.operations.filter(op => op.supportsPagination);
    if (paginatedOps.length > 0) {
      console.log("  📄 Paginated operations:");
      paginatedOps.forEach(op => {
        console.log(`    - ${op.name}`);
      });
    }
    
    // Check for batch operations
    const batchOps = info.operations.filter(op => op.batchOperation);
    if (batchOps.length > 0) {
      console.log("  📦 Batch operations:");
      batchOps.forEach(op => {
        console.log(`    - ${op.name}`);
      });
    }
  }
}

async function testEdgeCases() {
  console.log("\n\n=== Edge Case Testing ===\n");
  
  const edgeCases = [
    {
      name: "Very long index name",
      tool: "IndexManagement",
      input: { 
        operation: "get", 
        params: { indexName: "a".repeat(200) } 
      }
    },
    {
      name: "Special characters in search",
      tool: "DocumentOperations",
      input: { 
        operation: "search", 
        params: { 
          indexName: "test",
          search: "'; DROP TABLE users; --"
        } 
      }
    },
    {
      name: "Negative pagination values",
      tool: "DocumentOperations",
      input: { 
        operation: "search", 
        params: { 
          indexName: "test",
          skip: -10,
          top: -5
        } 
      }
    },
    {
      name: "Unicode in parameters",
      tool: "DocumentOperations",
      input: { 
        operation: "search", 
        params: { 
          indexName: "test",
          search: "测试 🚀 テスト"
        } 
      }
    },
    {
      name: "Null values in optional params",
      tool: "DocumentOperations",
      input: { 
        operation: "search", 
        params: { 
          indexName: "test",
          filter: null,
          orderBy: null
        } 
      }
    }
  ];
  
  for (const testCase of edgeCases) {
    try {
      const tool = createToolWrapper(testCase.tool, env);
      const result = await tool(testCase.input);
      
      if (!result.success) {
        console.log(`⚠️  ${testCase.name}: ${result.error.split('\n')[0]}`);
      } else {
        console.log(`✅ ${testCase.name}: Handled successfully`);
      }
    } catch (error: any) {
      console.log(`❌ ${testCase.name}: Threw unexpected error: ${error.message}`);
    }
  }
}

async function main() {
  try {
    await testValidation();
    await testSchemaIntrospection();
    await testEdgeCases();
    
    console.log("\n\n=== Test Summary ===");
    console.log("✅ Validation testing complete");
    console.log("✅ Schema introspection complete");
    console.log("✅ Edge case testing complete");
    
  } catch (error: any) {
    console.error("\n❌ Test suite failed:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Run the test
main().catch(console.error);