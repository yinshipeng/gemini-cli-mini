# Gemini CLI with MCP Support

This version of the Gemini CLI includes support for the Model Context Protocol (MCP), allowing you to extend the capabilities of the CLI with external tools and services.

## What is MCP?

The Model Context Protocol (MCP) is an open standard that enables AI assistants to connect to various tools and data sources through a standardized protocol. With MCP support, your Gemini CLI can access:

- File system operations
- Database queries
- API integrations
- Custom business logic
- And much more...

## Getting Started with MCP

### 1. Configure MCP Servers

You can configure MCP servers in several ways:

#### Environment Variables
```bash
MCP_SERVER_FILESYSTEM_COMMAND=npx
MCP_SERVER_FILESYSTEM_ARGS=@modelcontextprotocol/server-filesystem,--port,3001
```

#### Configuration File
Create a `mcp-config.json` file in your home directory (`~/.gemini-cli/mcp-config.json`) or in the current directory:

```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "--port", "3001"]
    },
    "github": {
      "httpUrl": "https://api.github.com"
    }
  }
}
```

### 2. Start Chat with MCP Support

```bash
# Start chat with a specific MCP server command
npm start chat -- --mcp-server "npx @modelcontextprotocol/server-filesystem"

# Or use the configured servers
npm start chat
```

### 3. Use MCP Tools

Once connected, MCP tools will be automatically discovered and made available to the AI assistant. You can ask the assistant to use these tools just like any other tool.

## Example MCP Servers

Here are some example MCP servers you can use:

1. **File System Server**: `@modelcontextprotocol/server-filesystem`
2. **Database Server**: `@modelcontextprotocol/server-database`
3. **GitHub Server**: `@modelcontextprotocol/server-github`

Install and use them like this:

```bash
# Install an MCP server
npm install @modelcontextprotocol/server-filesystem

# Start chat with the filesystem server
npm start chat -- --mcp-server "npx @modelcontextprotocol/server-filesystem"
```

## Creating Custom MCP Servers

You can create your own MCP servers to expose custom functionality. See the [MCP Specification](https://modelcontextprotocol.io) for details on how to implement an MCP server.

## Troubleshooting

If you encounter issues with MCP connections:

1. Check that the MCP server is running and accessible
2. Verify your configuration in `mcp-config.json`
3. Ensure network connectivity to remote MCP servers
4. Check the console output for detailed error messages

For more information, visit [modelcontextprotocol.io](https://modelcontextprotocol.io).