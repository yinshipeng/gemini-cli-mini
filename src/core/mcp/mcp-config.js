/**
 * MCP Configuration Loader
 * Loads MCP server configurations from environment variables and config files
 */

import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';

/**
 * MCP Server Configuration
 * @typedef {Object} MCPServerConfig
 * @property {string} [command] - Command to start the MCP server (for stdio transport)
 * @property {string[]} [args] - Arguments for the command
 * @property {Object} [env] - Environment variables for the command
 * @property {string} [cwd] - Working directory for the command
 * @property {string} [url] - URL for SSE transport
 * @property {string} [httpUrl] - URL for HTTP transport
 * @property {Object} [headers] - Headers to include in HTTP requests
 * @property {number} [timeout] - Timeout in milliseconds
 * @property {string[]} [includeTools] - List of tools to include
 * @property {string[]} [excludeTools] - List of tools to exclude
 */

/**
 * Load MCP configurations from various sources
 * @returns {Record<string, MCPServerConfig>} Map of server names to configurations
 */
export function loadMcpConfigurations() {
  const configs = {};
  
  // 1. Load from environment variables
  loadFromEnvironment(configs);
  
  // 2. Load from config file in home directory
  loadFromHomeConfig(configs);
  
  // 3. Load from config file in current directory
  loadFromLocalConfig(configs);
  
  return configs;
}

/**
 * Load MCP configurations from environment variables
 * Format: MCP_SERVER_<NAME>_COMMAND, MCP_SERVER_<NAME>_URL, etc.
 * @param {Record<string, MCPServerConfig>} configs 
 */
function loadFromEnvironment(configs) {
  // Find all MCP-related environment variables
  const mcpEnvVars = Object.keys(process.env).filter(key => 
    key.startsWith('MCP_SERVER_')
  );
  
  // Group by server name
  const serverConfigs = {};
  for (const envVar of mcpEnvVars) {
    const match = envVar.match(/^MCP_SERVER_([^_]+)_(.+)$/);
    if (match) {
      const [, serverName, configKey] = match;
      if (!serverConfigs[serverName]) {
        serverConfigs[serverName] = {};
      }
      
      const value = process.env[envVar];
      switch (configKey) {
        case 'COMMAND':
          serverConfigs[serverName].command = value;
          break;
        case 'ARGS':
          serverConfigs[serverName].args = value.split(',').map(arg => arg.trim());
          break;
        case 'URL':
          serverConfigs[serverName].url = value;
          break;
        case 'HTTP_URL':
          serverConfigs[serverName].httpUrl = value;
          break;
        case 'TIMEOUT':
          serverConfigs[serverName].timeout = parseInt(value, 10);
          break;
        case 'INCLUDE_TOOLS':
          serverConfigs[serverName].includeTools = value.split(',').map(tool => tool.trim());
          break;
        case 'EXCLUDE_TOOLS':
          serverConfigs[serverName].excludeTools = value.split(',').map(tool => tool.trim());
          break;
      }
    }
  }
  
  // Merge with existing configs
  Object.assign(configs, serverConfigs);
}

/**
 * Load MCP configurations from ~/.gemini-cli/mcp-config.json
 * @param {Record<string, MCPServerConfig>} configs 
 */
function loadFromHomeConfig(configs) {
  const configPath = join(homedir(), '.gemini-cli', 'mcp-config.json');
  if (existsSync(configPath)) {
    try {
      const configFile = JSON.parse(readFileSync(configPath, 'utf8'));
      if (configFile.servers) {
        Object.assign(configs, configFile.servers);
      }
    } catch (error) {
      console.warn(`Failed to load MCP config from ${configPath}:`, error.message);
    }
  }
}

/**
 * Load MCP configurations from ./mcp-config.json
 * @param {Record<string, MCPServerConfig>} configs 
 */
function loadFromLocalConfig(configs) {
  const configPath = join(process.cwd(), 'mcp-config.json');
  if (existsSync(configPath)) {
    try {
      const configFile = JSON.parse(readFileSync(configPath, 'utf8'));
      if (configFile.servers) {
        Object.assign(configs, configFile.servers);
      }
    } catch (error) {
      console.warn(`Failed to load MCP config from ${configPath}:`, error.message);
    }
  }
}

/**
 * Get a specific MCP server configuration
 * @param {string} serverName 
 * @returns {MCPServerConfig | null}
 */
export function getMcpServerConfig(serverName) {
  const configs = loadMcpConfigurations();
  return configs[serverName] || null;
}

/**
 * List all configured MCP servers
 * @returns {string[]}
 */
export function listMcpServers() {
  const configs = loadMcpConfigurations();
  return Object.keys(configs);
}