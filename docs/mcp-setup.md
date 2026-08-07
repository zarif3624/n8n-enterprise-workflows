# Set up n8n MCP

n8n includes an instance-level MCP server. It lets supported AI clients search,
build, edit, validate, test, and run workflows while n8n remains the system that
owns workflow access and execution.

## Requirements

- A current n8n Cloud or self-hosted instance
- Instance owner or administrator access to enable MCP
- A supported MCP client such as Codex or Claude Code
- A development project for evaluating templates

Workflow building and editing through the MCP requires n8n 2.13 or later.
Use the latest stable n8n release for the current tool surface.

## Enable the n8n MCP server

1. In n8n, open **Settings > Instance-level MCP**.
2. Enable MCP access.
3. Open **Connection details** and copy your instance's MCP URL.
4. Prefer OAuth when your client supports it. For token authentication, create a
   dedicated token, store it securely, and rotate it under your normal access policy.
5. Enable individual existing workflows for MCP only when they should be visible
   to connected clients.

Instance-level access does not automatically expose every workflow for full
inspection or execution. n8n keeps workflow access user-scoped and requires
individual workflows to be enabled.

## Connect Codex

Add the official n8n skills:

```bash
codex plugin marketplace add n8n-io/skills
codex plugin add n8n-skills@n8n-io
```

Restart Codex, approve the plugin hook prompt, and add your n8n MCP endpoint:

```bash
codex mcp add n8n-mcp --url https://YOUR-N8N-DOMAIN/mcp-server/http
```

Codex can authenticate through OAuth on first use. In the desktop app, the same
server can be added under **Settings > MCP servers** as a Streamable HTTP server.

## Connect Claude Code

```bash
claude mcp add --transport http n8n-mcp https://YOUR-N8N-DOMAIN/mcp-server/http
```

OAuth is recommended. Access-token configuration is documented in n8n's
official setup guide.

## Verify the connection

Ask the client to:

1. List accessible n8n projects.
2. Search workflows for a harmless keyword.
3. List workflow-building capabilities.
4. Confirm it can validate workflow code before creating anything.

Do not begin with a production execution. Build and validate in a development
project, inspect the resulting connections, and test with representative data.

## Official references

- [Connect to the n8n MCP server](https://docs.n8n.io/connect/connect-to-n8n-mcp-server/)
- [n8n MCP tools reference](https://docs.n8n.io/connect/connect-to-n8n-mcp-server/mcp-server-tools-reference/)
- [Official n8n skills](https://github.com/n8n-io/skills)
