#!/usr/bin/env node

/**
 * MCP Client with Elicitation Support
 * 
 * This client connects to your Azure Search MCP server and handles
 * elicitation requests for interactive parameter collection.
 * 
 * Usage:
 *   npm install @modelcontextprotocol/sdk dotenv
 *   npx tsx elicitation-client.ts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import readline from "readline/promises";

interface ElicitationRequest {
  message: string;
  requestedSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

interface ElicitationResponse {
  action: "accept" | "decline" | "cancel";
  content?: Record<string, any>;
}

class AzureSearchElicitationClient {
  private client: Client;
  private transport: SSEClientTransport | null = null;
  private rl: readline.Interface;
  private serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    this.client = new Client({
      name: "azure-search-elicitation-client",
      version: "1.0.0",
      capabilities: {
        elicitation: {}  // Enable elicitation support
      }
    });
    
    // Register the elicitation handler
    this.client.setRequestHandler(
      'elicitation/create',
      this.handleElicitation.bind(this)
    );
  }

  /**
   * Handle elicitation requests from the server
   */
  async handleElicitation(params: ElicitationRequest): Promise<ElicitationResponse> {
    console.log("\n" + "=".repeat(60));
    console.log("🔔 SERVER REQUEST");
    console.log("=".repeat(60));
    console.log(params.message);
    console.log("-".repeat(60));
    
    const content: Record<string, any> = {};
    const { properties, required = [] } = params.requestedSchema;
    
    // Collect input for each field
    for (const [key, prop] of Object.entries(properties)) {
      const isRequired = required.includes(key);
      console.log(`\n📝 ${key}${isRequired ? ' (REQUIRED)' : ' (optional)'}`);
      
      if (prop.title) {
        console.log(`   Title: ${prop.title}`);
      }
      if (prop.description) {
        console.log(`   Description: ${prop.description}`);
      }
      
      let value: any = undefined;
      
      // Handle different field types
      if (prop.enum) {
        // Enum selection
        console.log(`   Options:`);
        prop.enum.forEach((opt: string, i: number) => {
          const displayName = prop.enumNames?.[i] || opt;
          console.log(`     ${i + 1}. ${displayName} (${opt})`);
        });
        
        const input = await this.rl.question(`   Select option (1-${prop.enum.length}) or press Enter to skip: `);
        if (input) {
          const index = parseInt(input) - 1;
          if (index >= 0 && index < prop.enum.length) {
            value = prop.enum[index];
          }
        }
      } else if (prop.type === "boolean") {
        // Boolean input
        const input = await this.rl.question(`   Enter yes/no (or press Enter to skip): `);
        if (input) {
          value = ['yes', 'y', 'true', '1'].includes(input.toLowerCase());
        }
      } else if (prop.type === "number" || prop.type === "integer") {
        // Numeric input
        let prompt = `   Enter number`;
        if (prop.minimum !== undefined) prompt += ` (min: ${prop.minimum})`;
        if (prop.maximum !== undefined) prompt += ` (max: ${prop.maximum})`;
        prompt += ` or press Enter to skip: `;
        
        const input = await this.rl.question(prompt);
        if (input) {
          const num = prop.type === "integer" ? parseInt(input) : parseFloat(input);
          if (!isNaN(num)) {
            // Validate constraints
            if (prop.minimum !== undefined && num < prop.minimum) {
              console.log(`   ⚠️  Value must be at least ${prop.minimum}`);
              continue;
            }
            if (prop.maximum !== undefined && num > prop.maximum) {
              console.log(`   ⚠️  Value must be at most ${prop.maximum}`);
              continue;
            }
            value = num;
          }
        }
      } else {
        // String input
        let prompt = `   Enter value`;
        if (prop.minLength) prompt += ` (min ${prop.minLength} chars)`;
        if (prop.maxLength) prompt += ` (max ${prop.maxLength} chars)`;
        prompt += ` or press Enter to skip: `;
        
        const input = await this.rl.question(prompt);
        if (input) {
          // Validate constraints
          if (prop.minLength && input.length < prop.minLength) {
            console.log(`   ⚠️  Value must be at least ${prop.minLength} characters`);
            continue;
          }
          if (prop.maxLength && input.length > prop.maxLength) {
            console.log(`   ⚠️  Value must be at most ${prop.maxLength} characters`);
            continue;
          }
          value = input;
        }
      }
      
      // Store value if provided
      if (value !== undefined) {
        content[key] = value;
      } else if (isRequired) {
        console.log(`   ⚠️  This field is required!`);
        // Give user another chance
        const retry = await this.rl.question(`   Try again? (yes/no): `);
        if (retry.toLowerCase() === 'yes') {
          // Recursively retry this field
          continue;
        } else {
          return { action: "cancel" };
        }
      }
    }
    
    // Show summary and confirm
    console.log("\n" + "=".repeat(60));
    console.log("📋 SUMMARY");
    console.log("=".repeat(60));
    console.log(JSON.stringify(content, null, 2));
    console.log("-".repeat(60));
    
    const confirm = await this.rl.question("\n🤔 How would you like to proceed?\n  1. Accept and submit\n  2. Decline request\n  3. Cancel\nChoice (1/2/3): ");
    
    switch (confirm) {
      case "1":
        console.log("✅ Accepted");
        return { action: "accept", content };
      case "2":
        console.log("❌ Declined");
        return { action: "decline" };
      default:
        console.log("🚫 Cancelled");
        return { action: "cancel" };
    }
  }

  async connect() {
    console.log(`🔌 Connecting to ${this.serverUrl}...`);
    
    this.transport = new SSEClientTransport(new URL(this.serverUrl));
    await this.client.connect(this.transport);
    
    console.log("✅ Connected with elicitation support!");
    
    // List available tools
    const tools = await this.client.listTools();
    console.log(`\n🔧 Available tools: ${tools.tools.map(t => t.name).join(', ')}`);
  }

  async testElicitation() {
    console.log("\n" + "=".repeat(60));
    console.log("🧪 TESTING ELICITATION");
    console.log("=".repeat(60));
    
    console.log("\n1️⃣  Testing index creation (should trigger elicitation)...");
    try {
      // Call createIndex without full parameters
      const result = await this.client.callTool({
        name: "createIndex",
        arguments: {
          // Intentionally incomplete - should trigger elicitation
          indexName: "test-elicitation-demo"
        }
      });
      console.log("\n✅ Result:", JSON.stringify(result.content, null, 2));
    } catch (error: any) {
      console.log("\n❌ Error:", error.message);
    }
    
    console.log("\n2️⃣  Testing delete confirmation (should trigger elicitation)...");
    try {
      // Call deleteIndex to trigger confirmation
      const result = await this.client.callTool({
        name: "deleteIndex",
        arguments: {
          indexName: "test-elicitation-demo"
        }
      });
      console.log("\n✅ Result:", JSON.stringify(result.content, null, 2));
    } catch (error: any) {
      console.log("\n❌ Error:", error.message);
    }
  }

  async interactiveMode() {
    console.log("\n" + "=".repeat(60));
    console.log("💬 INTERACTIVE MODE");
    console.log("=".repeat(60));
    console.log("Type 'help' for commands, 'quit' to exit");
    
    while (true) {
      const input = await this.rl.question("\n> ");
      
      if (input.toLowerCase() === 'quit') {
        break;
      }
      
      if (input.toLowerCase() === 'help') {
        console.log(`
Available commands:
  list              - List all indexes
  create <name>     - Create a new index (will elicit parameters)
  delete <name>     - Delete an index (will elicit confirmation)
  search            - Search documents (will elicit index name)
  test              - Run elicitation tests
  quit              - Exit
        `);
        continue;
      }
      
      if (input.startsWith('create ')) {
        const indexName = input.substring(7).trim();
        try {
          const result = await this.client.callTool({
            name: "createIndex",
            arguments: { indexName }
          });
          console.log("✅ Created:", result.content);
        } catch (error: any) {
          console.log("❌ Error:", error.message);
        }
      } else if (input.startsWith('delete ')) {
        const indexName = input.substring(7).trim();
        try {
          const result = await this.client.callTool({
            name: "deleteIndex",
            arguments: { indexName }
          });
          console.log("✅ Deleted:", result.content);
        } catch (error: any) {
          console.log("❌ Error:", error.message);
        }
      } else if (input === 'list') {
        try {
          const result = await this.client.callTool({
            name: "listIndexes",
            arguments: {}
          });
          console.log("📋 Indexes:", result.content);
        } catch (error: any) {
          console.log("❌ Error:", error.message);
        }
      } else if (input === 'search') {
        try {
          const result = await this.client.callTool({
            name: "searchDocuments",
            arguments: { search: "*" }  // Missing indexName should trigger elicitation
          });
          console.log("🔍 Results:", result.content);
        } catch (error: any) {
          console.log("❌ Error:", error.message);
        }
      } else if (input === 'test') {
        await this.testElicitation();
      } else {
        console.log("Unknown command. Type 'help' for available commands.");
      }
    }
  }

  async close() {
    await this.client.close();
    this.rl.close();
  }
}

// Main execution
async function main() {
  // Get server URL from environment or use default
  const serverUrl = process.env.AZURE_SEARCH_MCP_URL || "http://localhost:8788/sse";
  
  console.log("🚀 Azure Search MCP Client with Elicitation Support");
  console.log("=" .repeat(60));
  
  const client = new AzureSearchElicitationClient(serverUrl);
  
  try {
    await client.connect();
    
    // Ask user what to do
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    const mode = await rl.question("\nSelect mode:\n  1. Run tests\n  2. Interactive mode\nChoice (1/2): ");
    rl.close();
    
    if (mode === "1") {
      await client.testElicitation();
    } else {
      await client.interactiveMode();
    }
  } catch (error) {
    console.error("Fatal error:", error);
  } finally {
    await client.close();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}