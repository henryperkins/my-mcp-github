## Step-by-Step Implementation Instructions

### Phase 1: Setup Infrastructure (30 minutes)

#### 1.1 Create Base Structure
1. Create new branch: `feature/dynamic-tools-architecture`
2. Create folder structure:
   - `src/dynamic-tools/base/` - for DynamicTool.ts
   - `src/dynamic-tools/` - for each feature tool
   - Keep existing folders intact for rollback safety

#### 1.2 Copy Base Class
1. Create `src/dynamic-tools/base/DynamicTool.ts`
2. Copy the complete DynamicTool base class provided
3. Ensure all imports resolve correctly:
   - Update import paths to match your project structure
   - Verify ResponseFormatter, withTimeout, ToolContext imports
   - Check that all utility functions are available

#### 1.3 Update Type Definitions
1. Add new types to `src/types.ts`:
   - OperationDefinition interface
   - OperationHandler type
   - OperationHelpers interface
   - ElicitationOptions interface
2. Ensure ToolContext includes agent property for elicitation

### Phase 2: Create Dynamic Tools (2 hours)

#### 2.1 Index Management Tool
1. Create `src/dynamic-tools/IndexTool.ts`
2. Extend DynamicTool base class
3. Migrate operations from existing IndexTools.ts:
   - Copy logic from listIndexes → list operation
   - Copy logic from getIndex → get operation
   - Copy logic from createIndex → create operation
   - Copy logic from createOrUpdateIndex → update operation
   - Copy logic from deleteIndex → delete operation
   - Copy logic from getIndexStats → stats operation
4. Set proper category for each operation (read/write/delete)
5. Add examples for at least 2 operations
6. Define resources array with indexes://list resource
7. Define prompts array with create_optimal_index prompt

#### 2.2 Document Operations Tool
1. Create `src/dynamic-tools/DocumentTool.ts`
2. Extend DynamicTool base class
3. Migrate operations from DocumentTools.ts:
   - searchDocuments → search operation
   - getDocument → get operation
   - countDocuments → count operation
   - uploadDocuments → upload operation
   - mergeDocuments → merge operation
   - mergeOrUploadDocuments → mergeOrUpload operation
   - deleteDocuments → delete operation
4. Add new analyze operation for document analytics
5. Mark batch operations with batchOperation: true
6. Set supportsPagination: true for search operation

#### 2.3 Data Source Management Tool
1. Create `src/dynamic-tools/DataSourceTool.ts`
2. Migrate from DataTools.ts:
   - listDataSources → list operation
   - getDataSource → get operation
   - createOrUpdateBlobDataSource → createBlob/updateBlob operations
   - generateBlobSyncPlan → generateSyncPlan operation
3. Add proper elicitation for missing connection strings

#### 2.4 Indexer Management Tool
1. Create `src/dynamic-tools/IndexerTool.ts`
2. Migrate from IndexerTools.ts:
   - All 7 indexer operations
   - Ensure runWithProgress includes progress notifications
3. Add timeout configurations for long-running operations

#### 2.5 Skillset Management Tool
1. Create `src/dynamic-tools/SkillsetTool.ts`
2. Migrate from SkillTools.ts:
   - Include skill template examples in operation metadata
   - Add validation for cognitive services configuration

#### 2.6 Knowledge Tools (2 tools)
1. Create `src/dynamic-tools/KnowledgeAgentTool.ts`
2. Create `src/dynamic-tools/KnowledgeSourceTool.ts`
3. Migrate all knowledge operations
4. Ensure proper Azure OpenAI configuration validation

#### 2.7 Service Utilities Tool
1. Create `src/dynamic-tools/ServiceTool.ts`
2. Combine operations from:
   - ServiceUtilsTools.ts
   - SynonymTools.ts
   - DebugTools.ts
3. Group by functionality (stats, analysis, configuration, debug)

### Phase 3: Update Main Server (1 hour)

#### 3.1 Create New Entry Point
1. Copy `src/index.ts` to `src/index-dynamic.ts`
2. Remove all individual tool imports (registerIndexTools, etc.)
3. Add dynamic tool imports:
   ```
   Import IndexTool from ./dynamic-tools/IndexTool
   Import DocumentTool from ./dynamic-tools/DocumentTool
   [... etc for all 8 tools]
   ```

#### 3.2 Modify Registration Logic
1. Remove all individual registerXXXTools() calls
2. Replace with dynamic tool registration:
   - IndexTool.register(server, context, options)
   - DocumentTool.register(server, context, options)
   - [Repeat for all 8 tools]
3. Keep registerResources() call unchanged
4. Keep prompt registration but verify no conflicts

#### 3.3 Update Tool Context
1. Ensure context object includes:
   - getClient() function
   - getSummarizer() function
   - agent reference (this)
2. Pass consistent context to all dynamic tools

#### 3.4 Configure Registration Options
1. Set options for each tool:
   - includeResources: true
   - includePrompts: true
   - enableLogging: true
   - enableMetrics: true

### Phase 4: Testing Strategy (1 hour)

#### 4.1 Create Test Suite
1. Create `tests/dynamic-tools/` folder
2. Write integration tests for each dynamic tool:
   - Test each operation with valid params
   - Test parameter validation
   - Test error handling
   - Test pagination where applicable
   - Test elicitation flows
   - Test confirmation requirements

#### 4.2 Migration Validation
1. Create comparison tests:
   - Run same operation on old and new implementation
   - Compare response structure
   - Verify backward compatibility
2. Test with MCP Inspector:
   - Connect to local instance
   - Verify only 8 tools appear
   - Test 2-3 operations per tool
   - Check resources and prompts load

#### 4.3 Performance Testing
1. Measure context token usage:
   - Count tokens with 51 tools
   - Count tokens with 8 tools
   - Document reduction percentage
2. Measure response times:
   - Tool selection speed
   - Operation execution time
   - End-to-end latency

### Phase 5: Update Configuration (30 minutes)

#### 5.1 Update package.json
1. Add new build script: `"build:dynamic": "wrangler build src/index-dynamic.ts"`
2. Add new dev script: `"dev:dynamic": "wrangler dev src/index-dynamic.ts"`
3. Keep original scripts for rollback capability

#### 5.2 Update wrangler.toml
1. Create new environment section `[env.dynamic]`
2. Set main = "src/index-dynamic.ts"
3. Keep production config unchanged initially

#### 5.3 Update Documentation
1. Update README.md:
   - Document new 8-tool structure
   - Provide operation examples for each tool
   - Update token usage metrics
2. Create MIGRATION.md:
   - Map old tool names to new tool/operation combinations
   - Document breaking changes
   - Provide migration examples

### Phase 6: Deployment Strategy (30 minutes)

#### 6.1 Staging Deployment
1. Deploy to staging environment:
   - `wrangler deploy --env dynamic-staging`
2. Test with Claude Desktop/CLI:
   - Update MCP config to point to staging
   - Run through test scenarios
3. Monitor logs for errors

#### 6.2 Gradual Rollout
1. Deploy to production subdomain:
   - dynamic.your-worker.workers.dev
2. Test with subset of users
3. Monitor metrics for 24 hours:
   - Error rates
   - Performance metrics
   - User feedback

#### 6.3 Full Migration
1. Update main production deployment
2. Keep old code branch for 30 days
3. Monitor for issues

### Phase 7: Optimization (Optional, 1 hour)

#### 7.1 Enhance Operation Discovery
1. Add operation search/filter capability
2. Implement operation suggestions based on context
3. Add operation history tracking

#### 7.2 Improve Error Messages
1. Create operation-specific error handlers
2. Add helpful suggestions for common errors
3. Implement retry logic for transient failures

#### 7.3 Add Advanced Features
1. Implement operation chaining
2. Add macro operations (multiple operations in sequence)
3. Create operation templates for common workflows

### Critical Success Checks

Before marking complete, verify:

1. **Tool Count**: Exactly 8 tools visible in MCP Inspector
2. **All Operations**: All 51 original operations accessible through new structure
3. **Prompts Work**: All prompts execute correctly
4. **Resources Load**: All resources return data
5. **Elicitation**: Confirmation dialogs appear for destructive operations
6. **Pagination**: List operations support cursor-based pagination
7. **Logging**: Notifications appear in client for all operations
8. **Error Handling**: Proper error messages for invalid operations
9. **Performance**: 60%+ reduction in context tokens
10. **Backward Compatibility**: No breaking changes for existing integrations

### Rollback Plan

If issues arise:

1. **Immediate**: Switch back to original index.ts deployment
2. **Debug**: Use metrics resource to identify problem operations
3. **Fix Forward**: Patch specific operations without full rollback
4. **Communicate**: Notify users of temporary reversion if needed

This implementation will reduce your tool count from 51 to 8, improve discoverability, reduce token usage by ~70%, and maintain all existing functionality with better organization.
