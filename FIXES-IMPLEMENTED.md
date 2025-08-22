# Tool Registry and Direct Invocation Fixes

## Summary of Issues Fixed

This document outlines the critical issues identified and fixed in the Azure Search MCP server's tool registry and direct invocation system.

## Issues and Resolutions

### 1. ✅ Missing toolName Parameter in createHelpers()

**Issue**: The `createHelpers()` method was called without passing the `toolName` parameter, but the helper functions inside needed it for notifications.

**File**: `src/dynamic-tools/base/DynamicTool.ts`

**Fix**: 
- Line 242: Added `this.toolName` as the last parameter when calling `createHelpers()`
- Line 360-365: Updated method signature to accept `toolName` as a parameter
- Changed `progressToken?: string` to `progressToken: string | undefined` to fix parameter ordering

### 2. ✅ Durable Object Class Name Mismatch

**Issue**: `wrangler.jsonc` referenced `AzureSearchMCPSQLite` but the actual exported class was `AzureSearchMCPDynamic`.

**File**: `wrangler.jsonc`

**Fix**:
- Line 44: Changed class_name from `"AzureSearchMCPSQLite"` to `"AzureSearchMCPDynamic"`
- Added migration v4 to handle the renaming for existing deployments

### 3. ✅ Wrong Main Entry Point

**Issue**: `wrangler.jsonc` pointed to `src/index.ts` which was just a redirect file.

**File**: `wrangler.jsonc`

**Fix**:
- Line 12: Changed main from `"src/index.ts"` to `"src/index-dynamic.ts"`

### 4. ✅ Missing Agent Context for Direct Invocation

**Issue**: Direct tool invocation set `agent: null`, breaking elicitation features.

**File**: `src/mcp-tool-wrapper.ts`

**Fix**:
- Lines 76-84: Added a stub agent with `elicitInput` method that safely handles elicitation in direct mode
- Lines 139-147: Enhanced elicit helper to provide better feedback when elicitation is not available

### 5. ✅ Added Tool Name Validation

**Issue**: Base class had empty `toolName` which could cause registration conflicts.

**File**: `src/dynamic-tools/base/DynamicTool.ts`

**Fix**:
- Lines 172-178: Added validation to ensure toolName and description are not empty during registration

### 6. ✅ Fixed Duplicate Object Property

**Issue**: `KnowledgeSourceTool` had duplicate `crawlDepth` property in an object literal.

**File**: `src/dynamic-tools/KnowledgeSourceTool.ts`

**Fix**:
- Line 465: Removed duplicate `crawlDepth` property

### 7. ✅ Enhanced Exports for Direct Usage

**Issue**: Tool wrapper utilities weren't exported from main entry point.

**File**: `src/index.ts`

**Fix**:
- Line 17: Added exports for `createToolWrapper`, `listAvailableTools`, and `getToolInfo`

## Migration Path

For existing deployments:

1. The Durable Object class rename is handled by migration v4
2. No data loss will occur - the migration system handles the renaming
3. Deploy with: `npm run deploy`

## Testing

All fixes have been validated with TypeScript type checking:
```bash
npm run type-check  # Passes with no errors
```

## Impact

These fixes ensure:
- ✅ No runtime errors from undefined variables
- ✅ Proper Durable Object binding for Cloudflare Workers
- ✅ Safe fallback for elicitation in direct mode
- ✅ Type safety throughout the tool system
- ✅ Cleaner exports and better developer experience

## Backward Compatibility

All changes maintain backward compatibility:
- Aliases are preserved in `index.ts`
- Migration system handles class renaming
- Direct invocation mode gracefully degrades when features aren't available