#!/usr/bin/env tsx
// Test script for MCP dynamic tools
// Run with: npx tsx test-mcp-tools.ts

import { createToolWrapper, listAvailableTools, getToolInfo } from "./src/mcp-tool-wrapper";
import * as dotenv from "dotenv";

// Load environment variables from .dev.vars
dotenv.config({ path: ".dev.vars" });

// Create environment object
const env = {
  AZURE_SEARCH_ENDPOINT: process.env.AZURE_SEARCH_ENDPOINT,
  AZURE_SEARCH_API_KEY: process.env.AZURE_SEARCH_API_KEY,
  AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT
};

async function main() {
  console.log("=== Azure Search MCP Tools Test ===\n");

  // List all available tools
  console.log("Available Tools:");
  console.log("----------------");
  const tools = listAvailableTools();
  for (const [name, info] of Object.entries(tools)) {
    console.log(`\n📦 ${name}`);
    console.log(`   ${(info as any).description}`);
    console.log(`   Operations: ${(info as any).operations.map((op: any) => op.name).join(', ')}`);
  }

  console.log("\n\n=== Testing Tools ===\n");

  try {
    // Test 1: IndexManagement - List indexes
    console.log("1️⃣ Testing IndexManagement.list:");
    const indexTool = createToolWrapper("IndexManagement", env);
    const indexListResult = await indexTool({
      operation: "list",
      params: { includeStats: true }
    });
    
    if (indexListResult.success) {
      console.log("✅ Success!");
      const indexes = indexListResult.result.indexes || [];
      console.log(`   Found ${indexes.length} indexes`);
      indexes.slice(0, 3).forEach((idx: any) => {
        console.log(`   - ${idx.name} (${idx.documentCount || 'N/A'} docs, ${idx.formattedSize || 'N/A'})`);
      });
    } else {
      console.log(`❌ Error: ${indexListResult.error}`);
    }

    // Test 2: DocumentOperations - Count documents
    console.log("\n2️⃣ Testing DocumentOperations.count:");
    const docTool = createToolWrapper("DocumentOperations", env);
    
    // First get an index name to test with
    if (indexListResult.success && indexListResult.result.indexes?.length > 0) {
      const testIndex = indexListResult.result.indexes[0].name;
      
      const countResult = await docTool({
        operation: "count",
        params: { indexName: testIndex }
      });
      
      if (countResult.success) {
        console.log("✅ Success!");
        console.log(`   Index '${testIndex}' has ${countResult.result.count} documents`);
      } else {
        console.log(`❌ Error: ${countResult.error}`);
      }
    } else {
      console.log("⚠️  No indexes available to test document count");
    }

    // Test 3: DataSourceManagement - List data sources
    console.log("\n3️⃣ Testing DataSourceManagement.list:");
    const dataSourceTool = createToolWrapper("DataSourceManagement", env);
    const dataSourceResult = await dataSourceTool({
      operation: "list",
      params: {}
    });
    
    if (dataSourceResult.success) {
      console.log("✅ Success!");
      const sources = dataSourceResult.result.dataSources || [];
      console.log(`   Found ${sources.length} data sources`);
      sources.slice(0, 3).forEach((src: any) => {
        console.log(`   - ${src.name} (${src.type || 'unknown type'})`);
      });
    } else {
      console.log(`❌ Error: ${dataSourceResult.error}`);
    }

    // Test 4: IndexerManagement - List indexers
    console.log("\n4️⃣ Testing IndexerManagement.list:");
    const indexerTool = createToolWrapper("IndexerManagement", env);
    const indexerResult = await indexerTool({
      operation: "list",
      params: { includeStatus: true }
    });
    
    if (indexerResult.success) {
      console.log("✅ Success!");
      const indexers = indexerResult.result.indexers || [];
      console.log(`   Found ${indexers.length} indexers`);
      indexers.slice(0, 3).forEach((idx: any) => {
        console.log(`   - ${idx.name} (${idx.status || 'unknown status'})`);
      });
    } else {
      console.log(`❌ Error: ${indexerResult.error}`);
    }

    // Test 5: ServiceUtilities - Get service stats
    console.log("\n5️⃣ Testing ServiceUtilities.serviceStats:");
    const serviceTool = createToolWrapper("ServiceUtilities", env);
    const statsResult = await serviceTool({
      operation: "serviceStats",
      params: {}
    });
    
    if (statsResult.success) {
      console.log("✅ Success!");
      const stats = statsResult.result;
      console.log(`   Service: ${stats.serviceName || 'unknown'}`);
      console.log(`   Tier: ${stats.tier || 'unknown'}`);
      console.log(`   Limits: ${stats.limits?.maxIndexesPerService || 'N/A'} indexes, ${stats.limits?.maxStoragePerServiceInMb || 'N/A'} MB storage`);
    } else {
      console.log(`❌ Error: ${statsResult.error}`);
    }

    // Test 6: Get detailed tool info
    console.log("\n\n=== Tool Details Example ===");
    const toolInfo = getToolInfo("IndexManagement");
    console.log(`\n📋 ${toolInfo.name}: ${toolInfo.description}`);
    console.log("\nOperations:");
    toolInfo.operations.slice(0, 3).forEach(op => {
      console.log(`\n  ▸ ${op.name}: ${op.description}`);
      console.log(`    Category: ${op.category}`);
      console.log(`    Pagination: ${op.supportsPagination ? 'Yes' : 'No'}`);
      if (op.examples.length > 0) {
        console.log(`    Example: ${JSON.stringify(op.examples[0])}`);
      }
    });

  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }

  console.log("\n=== Test Complete ===");
}

// Run the test
main().catch(console.error);