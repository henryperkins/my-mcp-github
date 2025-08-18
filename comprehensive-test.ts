#!/usr/bin/env tsx
// Comprehensive test of Azure Search MCP tools
// Run with: npx tsx comprehensive-test.ts

import { createToolWrapper } from "./src/mcp-tool-wrapper";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".dev.vars" });

const env = {
  AZURE_SEARCH_ENDPOINT: process.env.AZURE_SEARCH_ENDPOINT,
  AZURE_SEARCH_API_KEY: process.env.AZURE_SEARCH_API_KEY,
  AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT
};

async function testIndexOperations() {
  console.log("\n=== INDEX OPERATIONS ===\n");
  const indexTool = createToolWrapper("IndexManagement", env);

  // Get detailed index info
  console.log("📊 Getting detailed index information...");
  const indexDetails = await indexTool({
    operation: "get",
    params: { indexName: "codebase-mcp-sota" }
  });

  if (indexDetails.success) {
    const index = indexDetails.result;
    console.log(`✅ Index: ${index.name}`);
    console.log(`   Fields: ${index.fields?.length || 0}`);
    console.log(`   Scoring Profiles: ${index.scoringProfiles?.length || 0}`);
    console.log(`   Suggesters: ${index.suggesters?.length || 0}`);
    console.log(`   Analyzers: ${index.analyzers?.length || 0}`);
    
    // Show first few fields
    if (index.fields?.length > 0) {
      console.log("\n   Sample Fields:");
      index.fields.slice(0, 5).forEach((field: any) => {
        console.log(`   - ${field.name} (${field.type}${field.searchable ? ', searchable' : ''}${field.facetable ? ', facetable' : ''})`);
      });
    }
  }

  // Get index statistics
  console.log("\n📈 Getting index statistics...");
  const stats = await indexTool({
    operation: "stats",
    params: { indexName: "codebase-mcp-sota" }
  });

  if (stats.success) {
    console.log(`✅ Statistics for codebase-mcp-sota:`);
    console.log(`   Documents: ${stats.result.documentCount}`);
    console.log(`   Storage: ${stats.result.storageSize} bytes`);
  }
}

async function testDocumentOperations() {
  console.log("\n=== DOCUMENT OPERATIONS ===\n");
  const docTool = createToolWrapper("DocumentOperations", env);

  // Search documents
  console.log("🔍 Searching for 'azure' in codebase-mcp-sota...");
  const searchResult = await docTool({
    operation: "search",
    params: {
      indexName: "codebase-mcp-sota",
      search: "azure",
      top: 5,
      select: ["path", "content"],
      includeTotalCount: true
    }
  });

  if (searchResult.success) {
    const results = searchResult.result;
    console.log(`✅ Found ${results.totalCount || results.value?.length || 0} results`);
    if (results.value?.length > 0) {
      console.log("\n   Top Results:");
      results.value.slice(0, 3).forEach((doc: any, i: number) => {
        console.log(`   ${i + 1}. ${doc.path || doc.id || 'Unknown'}`);
        if (doc["@search.score"]) {
          console.log(`      Score: ${doc["@search.score"]}`);
        }
      });
    }
  }

  // Get a specific document (if we found any)
  if (searchResult.success && searchResult.result.value?.length > 0) {
    const firstDoc = searchResult.result.value[0];
    const docId = firstDoc.id || firstDoc.key;
    
    if (docId) {
      console.log(`\n📄 Getting document with ID: ${docId}...`);
      const getResult = await docTool({
        operation: "get",
        params: {
          indexName: "codebase-mcp-sota",
          key: docId
        }
      });

      if (getResult.success) {
        console.log(`✅ Retrieved document successfully`);
        const doc = getResult.result;
        console.log(`   Path: ${doc.path || 'N/A'}`);
        console.log(`   Size: ${doc.size || 'N/A'} bytes`);
      }
    }
  }

  // Analyze text
  console.log("\n🔤 Analyzing text with standard analyzer...");
  const analyzeResult = await docTool({
    operation: "analyze",
    params: {
      indexName: "codebase-mcp-sota",
      text: "The Azure-Search MCP server is running on port 8080",
      analyzer: "standard"
    }
  });

  if (analyzeResult.success) {
    console.log(`✅ Text analysis result:`);
    const tokens = analyzeResult.result.tokens || [];
    console.log(`   Tokens: ${tokens.map((t: any) => t.token).join(', ')}`);
  }
}

async function testDataSources() {
  console.log("\n=== DATA SOURCE OPERATIONS ===\n");
  const dsTool = createToolWrapper("DataSourceManagement", env);

  // List data sources with details
  console.log("📊 Getting data sources...");
  const listResult = await dsTool({
    operation: "list",
    params: {}
  });

  if (listResult.success && listResult.result.dataSources?.length > 0) {
    console.log(`✅ Found ${listResult.result.dataSources.length} data sources`);
    
    // Get details for first data source
    const firstDs = listResult.result.dataSources[0];
    if (firstDs.name) {
      const detailResult = await dsTool({
        operation: "get",
        params: { dataSourceName: firstDs.name }
      });

      if (detailResult.success) {
        const ds = detailResult.result;
        console.log(`\n   Data Source: ${ds.name}`);
        console.log(`   Type: ${ds.type || 'unknown'}`);
        console.log(`   Container: ${ds.container?.name || 'N/A'}`);
        console.log(`   Description: ${ds.description || 'N/A'}`);
      }
    }
  }
}

async function testIndexers() {
  console.log("\n=== INDEXER OPERATIONS ===\n");
  const indexerTool = createToolWrapper("IndexerManagement", env);

  // Get indexer status
  console.log("⚙️ Getting indexer status...");
  const listResult = await indexerTool({
    operation: "list",
    params: { includeStatus: true }
  });

  if (listResult.success && listResult.result.indexers?.length > 0) {
    console.log(`✅ Found ${listResult.result.indexers.length} indexers`);
    
    // Get detailed status for first indexer
    const firstIndexer = listResult.result.indexers[0];
    if (firstIndexer.name) {
      const statusResult = await indexerTool({
        operation: "status",
        params: { 
          indexerName: firstIndexer.name,
          historyLimit: 3
        }
      });

      if (statusResult.success) {
        const status = statusResult.result;
        console.log(`\n   Indexer: ${firstIndexer.name}`);
        console.log(`   Status: ${status.status || 'unknown'}`);
        console.log(`   Last Run: ${status.lastResult?.endTime || 'N/A'}`);
        console.log(`   Items Processed: ${status.lastResult?.itemsProcessed || 0}`);
        console.log(`   Items Failed: ${status.lastResult?.itemsFailed || 0}`);
        
        if (status.executionHistory?.length > 0) {
          console.log(`\n   Recent Execution History:`);
          status.executionHistory.slice(0, 3).forEach((exec: any, i: number) => {
            console.log(`   ${i + 1}. ${exec.status} - ${exec.itemsProcessed || 0} items (${exec.endTime || 'in progress'})`);
          });
        }
      }
    }
  }
}

async function testServiceUtilities() {
  console.log("\n=== SERVICE UTILITIES ===\n");
  const serviceTool = createToolWrapper("ServiceUtilities", env);

  // Get service statistics
  console.log("📊 Getting service statistics...");
  const statsResult = await serviceTool({
    operation: "serviceStats",
    params: {}
  });

  if (statsResult.success) {
    const stats = statsResult.result;
    console.log(`✅ Service Statistics:`);
    console.log(`   Name: ${stats.serviceName || 'N/A'}`);
    console.log(`   Tier: ${stats.tier || 'N/A'}`);
    console.log(`   Replica Count: ${stats.replicaCount || 'N/A'}`);
    console.log(`   Partition Count: ${stats.partitionCount || 'N/A'}`);
    
    if (stats.limits) {
      console.log(`\n   Service Limits:`);
      console.log(`   Max Indexes: ${stats.limits.maxIndexesPerService || 'N/A'}`);
      console.log(`   Max Storage: ${stats.limits.maxStoragePerServiceInMb || 'N/A'} MB`);
      console.log(`   Max Fields per Index: ${stats.limits.maxFieldsPerIndex || 'N/A'}`);
    }

    if (stats.counters) {
      console.log(`\n   Current Usage:`);
      console.log(`   Index Count: ${stats.counters.indexCounter?.usage || 0}/${stats.counters.indexCounter?.quota || 'N/A'}`);
      console.log(`   Data Source Count: ${stats.counters.dataSourceCounter?.usage || 0}/${stats.counters.dataSourceCounter?.quota || 'N/A'}`);
      console.log(`   Indexer Count: ${stats.counters.indexerCounter?.usage || 0}/${stats.counters.indexerCounter?.quota || 'N/A'}`);
    }
  }

  // Get index stats summary
  console.log("\n📈 Getting index statistics summary...");
  const indexStatsResult = await serviceTool({
    operation: "indexStatsSummary",
    params: {}
  });

  if (indexStatsResult.success) {
    const summary = indexStatsResult.result;
    console.log(`✅ Index Statistics Summary:`);
    console.log(`   Total Indexes: ${summary.totalIndexes || 0}`);
    console.log(`   Total Documents: ${summary.totalDocuments || 0}`);
    console.log(`   Total Storage: ${summary.totalStorageFormatted || 'N/A'}`);
    
    if (summary.indexes?.length > 0) {
      console.log(`\n   Index Breakdown:`);
      summary.indexes.forEach((idx: any) => {
        console.log(`   - ${idx.name}: ${idx.documentCount || 0} docs, ${idx.storageFormatted || 'N/A'}`);
      });
    }
  }

  // List synonym maps
  console.log("\n📝 Getting synonym maps...");
  const synonymResult = await serviceTool({
    operation: "listSynonymMaps",
    params: {}
  });

  if (synonymResult.success) {
    const maps = synonymResult.result.synonymMaps || [];
    console.log(`✅ Found ${maps.length} synonym maps`);
    if (maps.length > 0) {
      maps.forEach((map: any) => {
        console.log(`   - ${map.name}`);
      });
    }
  }
}

async function main() {
  console.log("=== COMPREHENSIVE AZURE SEARCH MCP TOOLS TEST ===");
  
  try {
    await testIndexOperations();
    await testDocumentOperations();
    await testDataSources();
    await testIndexers();
    await testServiceUtilities();
    
    console.log("\n\n=== ALL TESTS COMPLETED SUCCESSFULLY ===");
    
  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Run the comprehensive test
main().catch(console.error);