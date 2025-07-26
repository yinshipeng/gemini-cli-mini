/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  SSEClientTransport,
  SSEClientTransportOptions,
} from '@modelcontextprotocol/sdk/client/sse.js';
import {
  StreamableHTTPClientTransport,
  StreamableHTTPClientTransportOptions,
} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { parse } from 'shell-quote';

// MCP 默认超时时间 (10分钟)
export const MCP_DEFAULT_TIMEOUT_MSEC = 10 * 60 * 1000;

/**
 * Enum representing the connection status of an MCP server
 */
export const MCPServerStatus = {
  /** Server is disconnected or experiencing errors */
  DISCONNECTED: 'disconnected',
  /** Server is in the process of connecting */
  CONNECTING: 'connecting',
  /** Server is connected and ready to use */
  CONNECTED: 'connected',
};

/**
 * Enum representing the overall MCP discovery state
 */
export const MCPDiscoveryState = {
  /** Discovery has not started yet */
  NOT_STARTED: 'not_started',
  /** Discovery is currently in progress */
  IN_PROGRESS: 'in_progress',
  /** Discovery has completed (with or without errors) */
  COMPLETED: 'completed',
};

/**
 * Map to track the status of each MCP server within the core package
 */
const mcpServerStatusesInternal = new Map();

/**
 * Track the overall MCP discovery state
 */
let mcpDiscoveryState = MCPDiscoveryState.NOT_STARTED;

/**
 * Event listeners for MCP server status changes
 */
const statusChangeListeners = [];

/**
 * Add a listener for MCP server status changes
 */
export function addMCPStatusChangeListener(listener) {
  statusChangeListeners.push(listener);
}

/**
 * Remove a listener for MCP server status changes
 */
export function removeMCPStatusChangeListener(listener) {
  const index = statusChangeListeners.indexOf(listener);
  if (index !== -1) {
    statusChangeListeners.splice(index, 1);
  }
}

/**
 * Update the status of an MCP server
 */
function updateMCPServerStatus(serverName, status) {
  mcpServerStatusesInternal.set(serverName, status);
  // Notify all listeners
  for (const listener of statusChangeListeners) {
    listener(serverName, status);
  }
}

/**
 * Get the current status of an MCP server
 */
export function getMCPServerStatus(serverName) {
  return (
    mcpServerStatusesInternal.get(serverName) || MCPServerStatus.DISCONNECTED
  );
}

/**
 * Get all MCP server statuses
 */
export function getAllMCPServerStatuses() {
  return new Map(mcpServerStatusesInternal);
}

/**
 * Get the current MCP discovery state
 */
export function getMCPDiscoveryState() {
  return mcpDiscoveryState;
}

/**
 * Discovers tools from all configured MCP servers and registers them with the tool registry.
 * It orchestrates the connection and discovery process for each server defined in the
 * configuration, as well as any server specified via a command-line argument.
 *
 * @param {Record<string, MCPServerConfig>} mcpServers A record of named MCP server configurations.
 * @param {string | undefined} mcpServerCommand An optional command string for a dynamically specified MCP server.
 * @param {ToolRegistry} toolRegistry The central registry where discovered tools will be registered.
 * @returns {Promise<void>} A promise that resolves when the discovery process has been attempted for all servers.
 */
export async function discoverMcpTools(
  mcpServers,
  mcpServerCommand,
  toolRegistry
) {
  mcpDiscoveryState = MCPDiscoveryState.IN_PROGRESS;
  try {
    mcpServers = populateMcpServerCommand(mcpServers, mcpServerCommand);

    const discoveryPromises = Object.entries(mcpServers).map(
      ([mcpServerName, mcpServerConfig]) =>
        connectAndDiscover(
          mcpServerName,
          mcpServerConfig,
          toolRegistry
        ),
    );
    await Promise.all(discoveryPromises);
  } finally {
    mcpDiscoveryState = MCPDiscoveryState.COMPLETED;
  }
}

/** Visible for Testing */
export function populateMcpServerCommand(
  mcpServers,
  mcpServerCommand
) {
  if (mcpServerCommand) {
    const cmd = mcpServerCommand;
    const args = parse(cmd, process.env);
    if (args.some((arg) => typeof arg !== 'string')) {
      throw new Error('failed to parse mcpServerCommand: ' + cmd);
    }
    // use generic server name 'mcp'
    mcpServers['mcp'] = {
      command: args[0],
      args: args.slice(1),
    };
  }
  return mcpServers;
}

/**
 * Connects to an MCP server and discovers available tools, registering them with the tool registry.
 * This function handles the complete lifecycle of connecting to a server, discovering tools,
 * and cleaning up resources if no tools are found.
 *
 * @param {string} mcpServerName The name identifier for this MCP server
 * @param {MCPServerConfig} mcpServerConfig Configuration object containing connection details
 * @param {ToolRegistry} toolRegistry The registry to register discovered tools with
 * @returns {Promise<void>} Promise that resolves when discovery is complete
 */
export async function connectAndDiscover(
  mcpServerName,
  mcpServerConfig,
  toolRegistry
) {
  updateMCPServerStatus(mcpServerName, MCPServerStatus.CONNECTING);

  try {
    const mcpClient = await connectToMcpServer(
      mcpServerName,
      mcpServerConfig
    );
    try {
      updateMCPServerStatus(mcpServerName, MCPServerStatus.CONNECTED);

      mcpClient.onerror = (error) => {
        console.error(`MCP ERROR (${mcpServerName}):`, error.toString());
        updateMCPServerStatus(mcpServerName, MCPServerStatus.DISCONNECTED);
      };

      const tools = await discoverTools(
        mcpServerName,
        mcpServerConfig,
        mcpClient,
      );
      for (const tool of tools) {
        toolRegistry.registerTool(tool);
      }
    } catch (error) {
      mcpClient.close();
      throw error;
    }
  } catch (error) {
    console.error(
      `Error connecting to MCP server '${mcpServerName}': ${error.message || error}`,
    );
    updateMCPServerStatus(mcpServerName, MCPServerStatus.DISCONNECTED);
  }
}

/**
 * Discovers and sanitizes tools from a connected MCP client.
 * It retrieves function declarations from the client, filters out disabled tools,
 * generates valid names for them, and wraps them in `DiscoveredMCPTool` instances.
 *
 * @param {string} mcpServerName The name of the MCP server.
 * @param {MCPServerConfig} mcpServerConfig The configuration for the MCP server.
 * @param {Client} mcpClient The active MCP client instance.
 * @returns {Promise<DiscoveredMCPTool[]>} A promise that resolves to an array of discovered and enabled tools.
 * @throws {Error} An error if no enabled tools are found or if the server provides invalid function declarations.
 */
export async function discoverTools(
  mcpServerName,
  mcpServerConfig,
  mcpClient
) {
  try {
    const mcpCallableTool = mcpToTool(mcpClient);
    const tool = await mcpCallableTool.tool();

    if (!Array.isArray(tool.functionDeclarations)) {
      throw new Error(`Server did not return valid function declarations.`);
    }

    const discoveredTools = [];
    for (const funcDecl of tool.functionDeclarations) {
      if (!isEnabled(funcDecl, mcpServerName, mcpServerConfig)) {
        continue;
      }

      discoveredTools.push(
        new DiscoveredMCPTool(
          mcpCallableTool,
          mcpServerName,
          funcDecl.name,
          funcDecl.description ?? '',
          funcDecl.parametersJsonSchema ?? { type: 'object', properties: {} },
          mcpServerConfig.timeout ?? MCP_DEFAULT_TIMEOUT_MSEC,
        ),
      );
    }
    if (discoveredTools.length === 0) {
      throw Error('No enabled tools found');
    }
    return discoveredTools;
  } catch (error) {
    throw new Error(`Error discovering tools: ${error}`);
  }
}

/**
 * Creates and connects an MCP client to a server based on the provided configuration.
 * It determines the appropriate transport (Stdio, SSE, or Streamable HTTP) and
 * establishes a connection. It also applies a patch to handle request timeouts.
 *
 * @param {string} mcpServerName The name of the MCP server, used for logging and identification.
 * @param {MCPServerConfig} mcpServerConfig The configuration specifying how to connect to the server.
 * @returns {Promise<Client>} A promise that resolves to a connected MCP `Client` instance.
 * @throws {Error} An error if the connection fails or the configuration is invalid.
 */
export async function connectToMcpServer(
  mcpServerName,
  mcpServerConfig
) {
  const mcpClient = new Client({
    name: 'gemini-cli-mcp-client',
    version: '0.0.1',
  });

  // patch Client.callTool to use request timeout as genai McpCallTool.callTool does not do it
  // TODO: remove this hack once GenAI SDK does callTool with request options
  if ('callTool' in mcpClient) {
    const origCallTool = mcpClient.callTool.bind(mcpClient);
    mcpClient.callTool = function (params, resultSchema, options) {
      return origCallTool(params, resultSchema, {
        ...options,
        timeout: mcpServerConfig.timeout ?? MCP_DEFAULT_TIMEOUT_MSEC,
      });
    };
  }

  try {
    const transport = await createTransport(
      mcpServerName,
      mcpServerConfig
    );
    try {
      await mcpClient.connect(transport, {
        timeout: mcpServerConfig.timeout ?? MCP_DEFAULT_TIMEOUT_MSEC,
      });
      return mcpClient;
    } catch (error) {
      await transport.close();
      throw error;
    }
  } catch (error) {
    // Handle connection errors
    // Create a concise error message
    const errorMessage = error.message || String(error);
    const isNetworkError =
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('ECONNREFUSED');

    let conciseError;
    if (isNetworkError) {
      conciseError = `Cannot connect to '${mcpServerName}' - server may be down or URL incorrect`;
    } else {
      conciseError = `Connection failed for '${mcpServerName}': ${errorMessage}`;
    }

    throw new Error(conciseError);
  }
}

/** Visible for Testing */
export async function createTransport(
  mcpServerName,
  mcpServerConfig
) {
  if (mcpServerConfig.httpUrl) {
    const transportOptions = {};

    if (mcpServerConfig.headers) {
      transportOptions.requestInit = {
        headers: mcpServerConfig.headers,
      };
    }

    return new StreamableHTTPClientTransport(
      new URL(mcpServerConfig.httpUrl),
      transportOptions,
    );
  }

  if (mcpServerConfig.url) {
    const transportOptions = {};

    if (mcpServerConfig.headers) {
      transportOptions.requestInit = {
        headers: mcpServerConfig.headers,
      };
    }

    return new SSEClientTransport(
      new URL(mcpServerConfig.url),
      transportOptions,
    );
  }

  if (mcpServerConfig.command) {
    const transport = new StdioClientTransport({
      command: mcpServerConfig.command,
      args: mcpServerConfig.args || [],
      env: {
        ...process.env,
        ...(mcpServerConfig.env || {}),
      },
      cwd: mcpServerConfig.cwd,
    });
    return transport;
  }

  throw new Error(
    `Invalid configuration: missing httpUrl (for Streamable HTTP), url (for SSE), and command (for stdio).`,
  );
}

/** Visible for testing */
export function isEnabled(
  funcDecl,
  mcpServerName,
  mcpServerConfig
) {
  if (!funcDecl.name) {
    console.warn(
      `Discovered a function declaration without a name from MCP server '${mcpServerName}'. Skipping.`,
    );
    return false;
  }
  const { includeTools, excludeTools } = mcpServerConfig;

  // excludeTools takes precedence over includeTools
  if (excludeTools && excludeTools.includes(funcDecl.name)) {
    return false;
  }

  return (
    !includeTools ||
    includeTools.some(
      (tool) => tool === funcDecl.name || tool.startsWith(`${funcDecl.name}(`),
    )
  );
}

/**
 * Converts an MCP client to a tool that can be used by the Gemini CLI
 */
function mcpToTool(mcpClient) {
  return {
    async tool() {
      // Get the list of available tools from the MCP server
      const listResult = await mcpClient.request({
        method: 'tools/list',
      });
      
      return {
        functionDeclarations: listResult.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parametersJsonSchema: tool.inputSchema
        }))
      };
    },
    
    async execute(toolName, args) {
      // Execute a tool on the MCP server
      const result = await mcpClient.request({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      });
      
      return result;
    }
  };
}

/**
 * Discovered MCP Tool class
 */
export class DiscoveredMCPTool {
  constructor(
    mcpCallableTool,
    serverName,
    name,
    description,
    schema,
    timeout,
  ) {
    this.mcpCallableTool = mcpCallableTool;
    this.serverName = serverName;
    this.name = name;
    this.description = description;
    this.schema = schema;
    this.timeout = timeout;
  }

  async execute(params) {
    try {
      const result = await this.mcpCallableTool.execute(this.name, params);
      return result;
    } catch (error) {
      throw new Error(`MCP tool execution failed: ${error.message}`);
    }
  }
}