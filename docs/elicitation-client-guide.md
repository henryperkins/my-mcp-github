# MCP Elicitation Client Implementation Guide

## Overview

To enable elicitation support in your MCP client, you need to:
1. Advertise elicitation capability when connecting
2. Handle `elicitation/create` requests from the server
3. Present UI to collect user input
4. Return structured responses matching the requested schema

## Key Requirements

### 1. Advertise Elicitation Support

When initializing your client session, include elicitation in capabilities:

```typescript
const client = new Client({
  name: "my-client",
  version: "1.0.0",
  capabilities: {
    elicitation: {}  // Advertise support
  }
});
```

### 2. Handle Elicitation Requests

Your client must handle `elicitation/create` method calls from the server:

```typescript
client.setRequestHandler('elicitation/create', async (params) => {
  const { message, requestedSchema } = params;
  
  // Present UI to user and collect input
  const userInput = await presentElicitationUI(message, requestedSchema);
  
  // Return structured response
  return {
    action: userInput.action, // "accept", "decline", or "cancel"
    content: userInput.data    // User's input matching schema
  };
});
```

### 3. Schema Support

Elicitation only supports primitive types:
- `string` (with optional enum, minLength, maxLength)
- `number` / `integer` (with optional minimum, maximum)
- `boolean`

Complex types (arrays of objects, nested objects) are NOT supported.

## Implementation Example

### TypeScript/Node.js Client

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import readline from "readline/promises";

class MCPClientWithElicitation {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    this.client = new Client({
      name: "elicitation-client",
      version: "1.0.0",
      capabilities: {
        elicitation: {}  // Enable elicitation
      }
    });
    
    // Register elicitation handler
    this.client.setRequestHandler('elicitation/create', 
      this.handleElicitation.bind(this)
    );
  }

  async handleElicitation(params: any) {
    const { message, requestedSchema } = params;
    
    console.log("\n🔔 Server Request:", message);
    console.log("Required fields:");
    
    const content: Record<string, any> = {};
    
    // Iterate through schema properties
    for (const [key, prop] of Object.entries(requestedSchema.properties)) {
      const propDef = prop as any;
      const isRequired = requestedSchema.required?.includes(key);
      
      // Display field info
      console.log(`\n${key}${isRequired ? ' (required)' : ' (optional)'}:`);
      if (propDef.description) {
        console.log(`  ${propDef.description}`);
      }
      
      // Handle different types
      if (propDef.enum) {
        // Enum selection
        console.log(`  Options: ${propDef.enum.join(', ')}`);
        const value = await this.rl.question(`  Enter value: `);
        if (propDef.enum.includes(value)) {
          content[key] = value;
        } else if (isRequired) {
          return { action: "cancel" };
        }
      } else if (propDef.type === "boolean") {
        // Boolean input
        const value = await this.rl.question(`  Enter true/false: `);
        content[key] = value.toLowerCase() === "true";
      } else if (propDef.type === "number" || propDef.type === "integer") {
        // Numeric input
        const value = await this.rl.question(`  Enter number: `);
        const num = propDef.type === "integer" 
          ? parseInt(value) 
          : parseFloat(value);
        if (!isNaN(num)) {
          content[key] = num;
        } else if (isRequired) {
          return { action: "cancel" };
        }
      } else {
        // String input
        const value = await this.rl.question(`  Enter value: `);
        if (value || !isRequired) {
          content[key] = value;
        } else {
          return { action: "cancel" };
        }
      }
    }
    
    // Confirm with user
    console.log("\nYou entered:", JSON.stringify(content, null, 2));
    const confirm = await this.rl.question("Confirm? (yes/no/cancel): ");
    
    switch (confirm.toLowerCase()) {
      case "yes":
      case "y":
        return { action: "accept", content };
      case "no":
      case "n":
        return { action: "decline" };
      default:
        return { action: "cancel" };
    }
  }

  async connect(serverPath: string) {
    const command = serverPath.endsWith('.py') ? 'python' : 'node';
    
    this.transport = new StdioClientTransport({
      command,
      args: [serverPath],
    });
    
    await this.client.connect(this.transport);
    console.log("✅ Connected with elicitation support");
  }

  async callTool(name: string, args: any) {
    // Tool calls may trigger elicitation on the server
    const result = await this.client.callTool({ name, arguments: args });
    return result;
  }

  async close() {
    await this.client.close();
    this.rl.close();
  }
}

// Usage
async function main() {
  const client = new MCPClientWithElicitation();
  
  try {
    await client.connect('./path/to/your/server.js');
    
    // Call a tool that might trigger elicitation
    const result = await client.callTool('createIndex', {
      // Partial params - server will elicit missing ones
      indexName: 'my-index'
    });
    
    console.log('Tool result:', result);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
```

### Python Client

```python
import asyncio
import json
from typing import Optional, Dict, Any
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

class MCPClientWithElicitation:
    def __init__(self):
        self.session: Optional[ClientSession] = None
        
    async def handle_elicitation(self, message: str, 
                                 requested_schema: Dict[str, Any]) -> Dict[str, Any]:
        """Handle elicitation requests from server"""
        print(f"\n🔔 Server Request: {message}")
        print("Required fields:")
        
        content = {}
        properties = requested_schema.get('properties', {})
        required = requested_schema.get('required', [])
        
        for key, prop in properties.items():
            is_required = key in required
            print(f"\n{key}{'(required)' if is_required else '(optional)'}:")
            
            if prop.get('description'):
                print(f"  {prop['description']}")
            
            # Handle enums
            if 'enum' in prop:
                print(f"  Options: {', '.join(prop['enum'])}")
                value = input("  Enter value: ")
                if value in prop['enum']:
                    content[key] = value
                elif is_required:
                    return {"action": "cancel"}
            
            # Handle booleans
            elif prop['type'] == 'boolean':
                value = input("  Enter true/false: ")
                content[key] = value.lower() == 'true'
            
            # Handle numbers
            elif prop['type'] in ['number', 'integer']:
                value = input("  Enter number: ")
                try:
                    num = int(value) if prop['type'] == 'integer' else float(value)
                    content[key] = num
                except ValueError:
                    if is_required:
                        return {"action": "cancel"}
            
            # Handle strings
            else:
                value = input("  Enter value: ")
                if value or not is_required:
                    content[key] = value
                elif is_required:
                    return {"action": "cancel"}
        
        # Confirm
        print(f"\nYou entered: {json.dumps(content, indent=2)}")
        confirm = input("Confirm? (yes/no/cancel): ")
        
        if confirm.lower() in ['yes', 'y']:
            return {"action": "accept", "content": content}
        elif confirm.lower() in ['no', 'n']:
            return {"action": "decline"}
        else:
            return {"action": "cancel"}
    
    async def connect(self, server_path: str):
        """Connect to MCP server with elicitation support"""
        command = "python" if server_path.endswith('.py') else "node"
        
        params = StdioServerParameters(
            command=command,
            args=[server_path],
        )
        
        async with stdio_client(params) as (read, write):
            # Initialize with elicitation capability
            self.session = ClientSession(read, write)
            
            # Set elicitation handler
            self.session.set_request_handler(
                'elicitation/create',
                self.handle_elicitation
            )
            
            await self.session.initialize(
                client_info={
                    "name": "elicitation-client",
                    "version": "1.0.0"
                },
                capabilities={
                    "elicitation": {}  # Advertise support
                }
            )
            
            print("✅ Connected with elicitation support")
            
            # Keep session alive
            await asyncio.Event().wait()

# Usage
async def main():
    client = MCPClientWithElicitation()
    await client.connect('./path/to/your/server.py')

if __name__ == "__main__":
    asyncio.run(main())
```

## Testing Your Implementation

1. **Test with your Azure Search MCP server:**
   ```bash
   # Start your client
   node elicitation-client.js http://localhost:8788/mcp
   
   # Try creating an index without all parameters
   # The server should trigger elicitation for missing fields
   ```

2. **Test the delete confirmation flow:**
   - Call `deleteIndex` without confirmation parameters
   - Server should elicit confirmation through your client

3. **Test search parameter elicitation:**
   - Call `searchDocuments` without index name
   - Server should request the index name interactively

## UI Considerations

For production clients with GUIs:

1. **Modal Dialogs**: Present elicitation as modal forms
2. **Inline Forms**: Embed forms in the chat interface
3. **Progressive Disclosure**: Show required fields first
4. **Validation**: Validate input before sending to server
5. **Clear Actions**: Provide clear Accept/Decline/Cancel buttons

## Security Best Practices

1. **Never auto-accept**: Always require user confirmation
2. **Rate limiting**: Prevent excessive elicitation requests
3. **Sensitive data**: Never request passwords/tokens via elicitation
4. **Clear descriptions**: Show what data is being requested and why
5. **Audit trail**: Log elicitation requests and responses

## Common Issues

### Issue: Elicitation not triggering
- Ensure client advertises `elicitation` capability
- Check server has access to `elicitInput` method
- Verify transport supports bidirectional communication

### Issue: Schema validation failures
- Only use primitive types (string, number, boolean)
- Avoid nested objects or arrays of objects
- Ensure enum values are strings

### Issue: User experience problems
- Add clear descriptions to schema fields
- Group related fields together
- Provide sensible defaults where appropriate
- Show validation errors immediately

## Next Steps

1. Implement elicitation handler in your client
2. Test with various server tools
3. Add proper UI for production use
4. Consider adding elicitation analytics/logging