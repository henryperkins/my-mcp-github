# Connect Claude Code to tools via MCP

> Learn how to connect Claude Code to your tools with the Model Context Protocol.

Claude Code can connect to hundreds of external tools and data sources through the Model Context Protocol (MCP), an open-source standard for AI-tool integrations. MCP servers give Claude Code access to your tools, databases, and APIs.

## What you can do with MCP

With MCP servers connected, you can ask Claude Code to:

* Implement features from issue trackers: "Add the feature described in JIRA issue ENG-4521 and create a PR on GitHub."
* Analyze monitoring data: "Check Sentry and Statsig to check the usage of the feature described in ENG-4521."
* Query databases: "Find emails of 10 random users who used feature ENG-4521, based on our Postgres database."
* Integrate designs: "Update our standard email template based on the new Figma designs that were posted in Slack"
* Automate workflows: "Create Gmail drafts inviting these 10 users to a feedback session about the new feature."

## Popular MCP servers

> [!warning]
> Use third party MCP servers at your own risk — Anthropic has not verified the correctness or security of all these servers. Make sure you trust MCP servers you are installing. Be especially careful when using MCP servers that could fetch untrusted content, as these can expose you to prompt injection risk.

### Development & Testing Tools

- [Sentry](https://docs.sentry.io/product/sentry-mcp/) — Monitor errors, debug production issues  
  Command:
  ```bash
  claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
  ```

- [Socket](https://github.com/SocketDev/socket-mcp) — Security analysis for dependencies  
  Command:
  ```bash
  claude mcp add --transport http socket https://mcp.socket.dev/
  ```

### Project Management & Documentation

- [Asana](https://developers.asana.com/docs/using-asanas-model-control-protocol-mcp-server) — Interact with your Asana workspace to keep projects on track  
  Command:
  ```bash
  claude mcp add --transport sse asana https://mcp.asana.com/sse
  ```

- [Atlassian](https://www.atlassian.com/platform/remote-mcp-server) — Manage your Jira tickets and Confluence docs  
  Command:
  ```bash
  claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse
  ```

- [ClickUp](https://github.com/hauptsacheNet/clickup-mcp) — Task management, project tracking  
  Command:
  ```bash
  claude mcp add clickup --env CLICKUP_API_KEY=YOUR_KEY --env CLICKUP_TEAM_ID=YOUR_ID -- npx -y @hauptsache.net/clickup-mcp
  ```

- [Intercom](https://developers.intercom.com/docs/guides/mcp) — Access real-time customer conversations, tickets, and user data  
  Command:
  ```bash
  claude mcp add --transport http intercom https://mcp.intercom.com/mcp
  ```

- [Linear](https://linear.app/docs/mcp) — Integrate with Linear's issue tracking and project management  
  Command:
  ```bash
  claude mcp add --transport sse linear https://mcp.linear.app/sse
  ```

- [Notion](https://developers.notion.com/docs/mcp) — Read docs, update pages, manage tasks  
  Command:
  ```bash
  claude mcp add --transport http notion https://mcp.notion.com/mcp
  ```

### Databases & Data Management

- [Airtable](https://github.com/domdomegg/airtable-mcp-server) — Read/write records, manage bases and tables  
  Command:
  ```bash
  claude mcp add airtable --env AIRTABLE_API_KEY=YOUR_KEY -- npx -y airtable-mcp-server
  ```

### Payments & Commerce

- [PayPal](https://www.paypal.ai/) — Integrate commerce capabilities, payment processing, transaction management  
  Command:
  ```bash
  claude mcp add --transport http paypal https://mcp.paypal.com/mcp
  ```

- [Plaid](https://plaid.com/blog/plaid-mcp-ai-assistant-claude/) — Banking data and financial account linking  
  Command:
  ```bash
  claude mcp add --transport sse plaid https://api.dashboard.plaid.com/mcp/sse
  ```

- [Square](https://developer.squareup.com/docs/mcp) — Build on Square APIs (payments, inventory, orders, etc.)  
  Command:
  ```bash
  claude mcp add --transport sse square https://mcp.squareup.com/sse
  ```

- [Stripe](https://docs.stripe.com/mcp) — Payment processing, subscriptions, and financial transactions  
  Command:
  ```bash
  claude mcp add --transport http stripe https://mcp.stripe.com
  ```

### Design & Media

- [Figma](https://help.figma.com/hc/en-us/articles/32132100833559) — Access designs, export assets  
  Command:
  ```bash
  claude mcp add --transport sse figma http://127.0.0.1:3845/sse
  ```
  Notes: Requires Figma Desktop with Dev Mode MCP Server

- [invideo](https://invideo.io/ai/mcp) — Build video creation capabilities into your applications  
  Command:
  ```bash
  claude mcp add --transport sse invideo https://mcp.invideo.io/sse
  ```

### Infrastructure & DevOps

- [Azure AI Search](https://github.com/yourusername/azure-search-mcp) — Manage Azure Cognitive Search services, indexes, documents, and indexers  
  Command:
  ```bash
  claude mcp add --transport sse azure-search https://your-worker.workers.dev/sse
  ```
  Notes: Requires Azure Search API key. Supports index management, document operations, synonym maps, data sources, and indexers.

- [Cloudflare](https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/) — Build apps, analyze traffic, monitor performance, manage security  
  Notes: Multiple services available. See documentation for specific server URLs. Claude Code can use the Cloudflare CLI if installed.

### Automation & Integration

- [Workato](https://docs.workato.com/mcp.html) — Access any application, workflows or data via Workato, made accessible for AI  
  Notes: MCP servers are programmatically generated.

- [Zapier](https://help.zapier.com/hc/en-us/articles/36265392843917) — Connect to nearly 8,000 apps through Zapier's automation platform  
  Notes: Generate a user-specific URL at mcp.zapier.com.

> [!note]
> Need a specific integration? Find hundreds more MCP servers on GitHub: https://github.com/modelcontextprotocol/servers, or build your own using the MCP SDK: https://modelcontextprotocol.io/quickstart/server.

## Installing MCP servers

MCP servers can be configured in three different ways depending on your needs.

### Option 1: Add a local stdio server

Stdio servers run as local processes on your machine. They're ideal for tools that need direct system access or custom scripts.

```bash
# Basic syntax
claude mcp add <name> <command> [args...]

# Real example: Add Airtable server
claude mcp add airtable --env AIRTABLE_API_KEY=YOUR_KEY \
  -- npx -y airtable-mcp-server
```

### Option 2: Add a remote SSE server

SSE (Server-Sent Events) servers provide real-time streaming connections. Many cloud services use this for live updates.

```bash
# Basic syntax
claude mcp add --transport sse <name> <url>

# Real example: Connect to Linear
claude mcp add --transport sse linear https://mcp.linear.app/sse

# Example with authentication header
claude mcp add --transport sse private-api https://api.company.com/mcp \
  --header "X-API-Key: your-key-here"
```

### Option 3: Add a remote HTTP server

HTTP servers use standard request/response patterns. Most REST APIs and web services use this transport.

```bash
# Basic syntax
claude mcp add --transport http <name> <url>

# Real example: Connect to Notion
claude mcp add --transport http notion https://mcp.notion.com/mcp

# Example with Bearer token
claude mcp add --transport http secure-api https://api.example.com/mcp \
  --header "Authorization: Bearer your-token"
```

### Managing your servers

Once configured, you can manage your MCP servers with these commands:

```bash
# List all configured servers
claude mcp list

# Get details for a specific server
claude mcp get github

# Remove a server
claude mcp remove github

# (within Claude Code) Check server status
/mcp
```

> [!tip]
> Tips:
> - Use the `--scope` flag to specify where the configuration is stored:
>   - `local` (default): Available only to you in the current project (was called `project` in older versions)
>   - `project`: Shared with everyone in the project via `.mcp.json` file
>   - `user`: Available to you across all projects (was called `global` in older versions)
> - Set environment variables with `--env` flags (e.g., `--env KEY=value`)
> - Configure MCP server startup timeout using the `MCP_TIMEOUT` environment variable (e.g., `MCP_TIMEOUT=10000 claude` sets a 10-second timeout)
> - Use `/mcp` to authenticate with remote servers that require OAuth 2.0 authentication

> [!warning]
> Windows Users: On native Windows (not WSL), local MCP servers that use `npx` require the `cmd /c` wrapper to ensure proper execution.
> 
> ```bash
> # This creates command="cmd" which Windows can execute
> claude mcp add my-server -- cmd /c npx -y @some/package
> ```
> 
> Without the `cmd /c` wrapper, you'll encounter "Connection closed" errors because Windows cannot directly execute `npx`.

## MCP installation scopes

MCP servers can be configured at three different scope levels, each serving distinct purposes for managing server accessibility and sharing. Understanding these scopes helps you determine the best way to configure servers for your specific needs.

### Local scope

Local-scoped servers represent the default configuration level and are stored in your project-specific user settings. These servers remain private to you and are only accessible when working within the current project directory. This scope is ideal for personal development servers, experimental configurations, or servers containing sensitive credentials that shouldn't be shared.

```bash
# Add a local-scoped server (default)
claude mcp add my-private-server /path/to/server

# Explicitly specify local scope
claude mcp add my-private-server --scope local /path/to/server
```

### Project scope

Project-scoped servers enable team collaboration by storing configurations in a `.mcp.json` file at your project's root directory. This file is designed to be checked into version control, ensuring all team members have access to the same MCP tools and services. When you add a project-scoped server, Claude Code automatically creates or updates this file with the appropriate configuration structure.

```bash
# Add a project-scoped server
claude mcp add shared-server --scope project /path/to/server
```

The resulting `.mcp.json` file follows a standardized format:

```json
{
  "mcpServers": {
    "shared-server": {
      "command": "/path/to/server",
      "args": [],
      "env": {}
    }
  }
}
```

For security reasons, Claude Code prompts for approval before using project-scoped servers from `.mcp.json` files. If you need to reset these approval choices, use the `claude mcp reset-project-choices` command.

### User scope

User-scoped servers provide cross-project accessibility, making them available across all projects on your machine while remaining private to your user account. This scope works well for personal utility servers, development tools, or services you frequently use across different projects.

```bash
# Add a user server
claude mcp add my-user-server --scope user /path/to/server
```

### Choosing the right scope

Select your scope based on:

* Local scope: Personal servers, experimental configurations, or sensitive credentials specific to one project
* Project scope: Team-shared servers, project-specific tools, or services required for collaboration
* User scope: Personal utilities needed across multiple projects, development tools, or frequently-used services

### Scope hierarchy and precedence

MCP server configurations follow a clear precedence hierarchy. When servers with the same name exist at multiple scopes, the system resolves conflicts by prioritizing local-scoped servers first, followed by project-scoped servers, and finally user-scoped servers. This design ensures that personal configurations can override shared ones when needed.

### Environment variable expansion in `.mcp.json`

Claude Code supports environment variable expansion in `.mcp.json` files, allowing teams to share configurations while maintaining flexibility for machine-specific paths and sensitive values like API keys.

Supported syntax:
- `${VAR}` — Expands to the value of environment variable `VAR`
- `${VAR:-default}` — Expands to `VAR` if set, otherwise uses `default`

Expansion locations:
- `command` — The server executable path
- `args` — Command-line arguments
- `env` — Environment variables passed to the server
- `url` — For SSE/HTTP server types
- `headers` — For SSE/HTTP server authentication

Example with variable expansion:

```json
{
  "mcpServers": {
    "api-server": {
      "type": "sse",
      "url": "${API_BASE_URL:-https://api.example.com}/mcp",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}
```

If a required environment variable is not set and has no default value, Claude Code will fail to parse the config.

## Practical examples

### Example: Monitor errors with Sentry

```bash
# 1. Add the Sentry MCP server
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp

# 2. Use /mcp to authenticate with your Sentry account
> /mcp

# 3. Debug production issues
> "What are the most common errors in the last 24 hours?"
> "Show me the stack trace for error ID abc123"
> "Which deployment introduced these new errors?"
```

## Authenticate with remote MCP servers

Many cloud-based MCP servers require authentication. Claude Code supports OAuth 2.0 for secure connections.

### Step 1: Add the server that requires authentication

For example:

```bash
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
```

### Step 2: Use the /mcp command within Claude Code

In Claude Code, use the command:

```
> /mcp
```

Then follow the steps in your browser to login.

> [!tip]
> Tips:
> - Authentication tokens are stored securely and refreshed automatically
> - Use "Clear authentication" in the `/mcp` menu to revoke access
> - If your browser doesn't open automatically, copy the provided URL
> - OAuth authentication works with both SSE and HTTP transports

## Add MCP servers from JSON configuration

If you have a JSON configuration for an MCP server, you can add it directly.

### Step 1: Add an MCP server from JSON

```bash
# Basic syntax
claude mcp add-json <name> '<json>'

# Example: Adding a stdio server with JSON configuration
claude mcp add-json weather-api '{"type":"stdio","command":"/path/to/weather-cli","args":["--api-key","abc123"],"env":{"CACHE_DIR":"/tmp"}}'
```

### Step 2: Verify the server was added

```bash
claude mcp get weather-api
```

> [!tip]
> Tips:
> - Make sure the JSON is properly escaped in your shell
> - The JSON must conform to the MCP server configuration schema
> - You can use `--scope global` to add the server to your global configuration instead of the project-specific one

## Import MCP servers from Claude Desktop

If you've already configured MCP servers in Claude Desktop, you can import them.

### Step 1: Import servers from Claude Desktop

```bash
# Basic syntax 
claude mcp add-from-claude-desktop
```

### Step 2: Select which servers to import

After running the command, you'll see an interactive dialog that allows you to select which servers you want to import.

### Step 3: Verify the servers were imported

```bash
claude mcp list
```

> [!tip]
> Tips:
> - This feature only works on macOS and Windows Subsystem for Linux (WSL)
> - It reads the Claude Desktop configuration file from its standard location on those platforms
> - Use the `--scope global` flag to add servers to your global configuration
> - Imported servers will have the same names as in Claude Desktop
> - If servers with the same names already exist, they will get a numerical suffix (e.g., `server_1`)

## Use Claude Code as an MCP server

You can use Claude Code itself as an MCP server that other applications can connect to:

```bash
# Start Claude as a stdio MCP server
claude mcp serve
```

You can use this in Claude Desktop by adding this configuration to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "claude-code": {
      "command": "claude",
      "args": ["mcp", "serve"],
      "env": {}
    }
  }
}
```

> [!tip]
> Tips:
> - The server provides access to Claude's tools like View, Edit, LS, etc.
> - In Claude Desktop, try asking Claude to read files in a directory, make edits, and more.
> - Note that this MCP server is simply exposing Claude Code's tools to your MCP client, so your own client is responsible for implementing user confirmation for individual tool calls.

## Use MCP resources

MCP servers can expose resources that you can reference using @ mentions, similar to how you reference files.

### Reference MCP resources

### Step 1: List available resources

Type `@` in your prompt to see available resources from all connected MCP servers. Resources appear alongside files in the autocomplete menu.

### Step 2: Reference a specific resource

Use the format `@server:protocol://resource/path` to reference a resource:

```
> Can you analyze @github:issue://123 and suggest a fix?
```

```
> Please review the API documentation at @docs:file://api/authentication
```

### Step 3: Multiple resource references

You can reference multiple resources in a single prompt:

```
> Compare @postgres:schema://users with @docs:file://database/user-model
```

> [!tip]
> Tips:
> - Resources are automatically fetched and included as attachments when referenced
> - Resource paths are fuzzy-searchable in the @ mention autocomplete
> - Claude Code automatically provides tools to list and read MCP resources when servers support them
> - Resources can contain any type of content that the MCP server provides (text, JSON, structured data, etc.)

## Use MCP prompts as slash commands

MCP servers can expose prompts that become available as slash commands in Claude Code.

### Execute MCP prompts

### Step 1: Discover available prompts

Type `/` to see all available commands, including those from MCP servers. MCP prompts appear with the format `/mcp__servername__promptname`.

### Step 2: Execute a prompt without arguments

```
> /mcp__github__list_prs
```

### Step 3: Execute a prompt with arguments

Many prompts accept arguments. Pass them space-separated after the command:

```
> /mcp__github__pr_review 456
```

```
> /mcp__jira__create_issue "Bug in login flow" high
```

> [!tip]
> Tips:
> - MCP prompts are dynamically discovered from connected servers
> - Arguments are parsed based on the prompt's defined parameters
> - Prompt results are injected directly into the conversation
> - Server and prompt names are normalized (spaces become underscores)