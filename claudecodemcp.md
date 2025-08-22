Here's the note with the "Popular MCP servers" section removed, keeping all other content in clean Markdown format:


# Connect Claude Code to tools via MCP

> Learn how to connect Claude Code to your tools with the Model Context Protocol.

Claude Code can connect to hundreds of external tools and data sources through the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction), an open-source standard for AI-tool integrations. MCP servers give Claude Code access to your tools, databases, and APIs.

## What you can do with MCP

With MCP servers connected, you can ask Claude Code to:

- **Implement features from issue trackers**: "Add the feature described in JIRA issue ENG-4521 and create a PR on GitHub."
- **Analyze monitoring data**: "Check Sentry and Statsig to check the usage of the feature described in ENG-4521."
- **Query databases**: "Find emails of 10 random users who used feature ENG-4521, based on our Postgres database."
- **Integrate designs**: "Update our standard email template based on the new Figma designs that were posted in Slack"
- **Automate workflows**: "Create Gmail drafts inviting these 10 users to a feedback session about the new feature."

## Installing MCP servers

MCP servers can be configured in three different ways depending on your needs:

### Option 1: Add a local stdio server

Stdio servers run as local processes on your machine. They're ideal for tools that need direct system access or custom scripts.

```bash
# Basic syntax
claude mcp add <name> <command> [args...]

# Real example: Add Airtable server
claude mcp add airtable --env AIRTABLE_API_KEY=YOUR_KEY \
  -- npx -y airtable-mcp-server
```


Understanding the "--" parameter
The `--` (double dash) separates Claude's own CLI flags from the command and arguments that get passed to the MCP server. Everything before `--` are options for Claude (like `--env`, `--scope`), and everything after `--` is the actual command to run the MCP server.

For example:
- `claude mcp add myserver -- npx server` → runs `npx server`
- `claude mcp add myserver --env KEY=value -- python server.py --port 8080` → runs `python server.py --port 8080` with `KEY=value` in environment

This prevents conflicts between Claude's flags and the server's flags.


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


Tips:
- Use the `--scope` flag to specify where the configuration is stored:
  - `local` (default): Available only to you in the current project
  - `project`: Shared with everyone in the project via `.mcp.json` file
  - `user`: Available to you across all projects
- Set environment variables with `--env` flags (e.g., `--env KEY=value`)
- Configure MCP server startup timeout using the MCP_TIMEOUT environment variable
- Use `/mcp` to authenticate with remote servers that require OAuth 2.0 authentication


**Windows Users**: On native Windows (not WSL), local MCP servers that use `npx` require the `cmd /c` wrapper:

```bash
claude mcp add my-server -- cmd /c npx -y @some/package
```

Without the `cmd /c` wrapper, you'll encounter "Connection closed" errors because Windows cannot directly execute `npx`.


## MCP installation scopes

MCP servers can be configured at three different scope levels:

### Local scope

```bash
# Add a local-scoped server (default)
claude mcp add my-private-server /path/to/server

# Explicitly specify local scope
claude mcp add my-private-server --scope local /path/to/server
```

### Project scope

```bash
# Add a project-scoped server
claude mcp add shared-server --scope project /path/to/server
```

The resulting `.mcp.json` file follows this format:

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

### User scope

```bash
# Add a user server
claude mcp add my-user-server --scope user /path/to/server
```

### Choosing the right scope

| Scope       | Use Case                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------- |
| **Local**   | Personal servers, experimental configurations, or sensitive credentials specific to one project    |
| **Project** | Team-shared servers, project-specific tools, or services required for collaboration                |
| **User**    | Personal utilities needed across multiple projects, development tools, or frequently-used services |

### Scope hierarchy and precedence

Local > Project > User (local configurations override shared ones)

### Environment variable expansion in `.mcp.json`

Claude Code supports environment variable expansion in `.mcp.json` files:

**Supported syntax:**
- `${VAR}` - Expands to the value of environment variable VAR
- `${VAR:-default}` - Expands to VAR if set, otherwise uses default

**Example:**
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

## Practical examples

### Example: Monitor errors with Sentry

```bash
# 1. Add the Sentry MCP server
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp

# 2. Authenticate in Claude Code
> /mcp

# 3. Query errors
> "What are the most common errors in the last 24 hours?"
> "Show me the stack trace for error ID abc123"
```

## Authenticate with remote MCP servers

1. **Add the server that requires authentication**:
   ```bash
   claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
   ```
2. **Use the /mcp command within Claude Code**:
   ```
   > /mcp
   ```
   Follow the browser prompts to login.

Authentication tips:
- Tokens are stored securely and refreshed automatically
- Use "Clear authentication" in the `/mcp` menu to revoke access
- OAuth authentication works with both SSE and HTTP transports

## Add MCP servers from JSON configuration

```bash
# Basic syntax
claude mcp add-json <name> '<json>'

# Example
claude mcp add-json weather-api '{
  "type": "stdio",
  "command": "/path/to/weather-cli",
  "args": ["--api-key", "abc123"],
  "env": {"CACHE_DIR": "/tmp"}
}'
```

## Import MCP servers from Claude Desktop

```bash
# Import servers
claude mcp add-from-claude-desktop

# Verify import
claude mcp list
```


Import tips:
- Works on macOS and Windows Subsystem for Linux (WSL)
- Uses the `--scope user` flag to add servers to your user configuration
- Imported servers maintain their original names from Claude Desktop


## Use Claude Code as an MCP server

```bash
# Start as stdio server
claude mcp serve
```

Configuration for Claude Desktop:
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

## Use MCP resources

Reference resources using `@` mentions:
```
> Can you analyze @github:issue://123 and suggest a fix?
> Compare @postgres:schema://users with @docs:file://database/user-model
```

## Use MCP prompts as slash commands

Discover and execute prompts:
```
> /mcp__github__list_prs
> /mcp__github__pr_review 456
> /mcp__jira__create_issue "Bug in login flow" high
```


Prompt tips:
- MCP prompts appear with format `/mcp__servername__promptname`
- Arguments are parsed based on the prompt's defined parameters
- Prompt results are injected directly into the conversation

