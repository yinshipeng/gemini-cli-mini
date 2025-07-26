/**
 * MCP Tool Integration
 * Integrates MCP tools with the existing tool registry
 */

import { discoverMcpTools } from './mcp-client.js';
import { loadMcpConfigurations } from './mcp-config.js';

/**
 * Integrates MCP tools with the tool registry
 * @param {ToolRegistry} toolRegistry - The tool registry to integrate with
 * @param {string | undefined} mcpServerCommand - Optional command to start an MCP server
 */
export async function integrateMcpTools(toolRegistry, mcpServerCommand) {
  try {
    // Load MCP configurations
    const mcpServers = loadMcpConfigurations();
    
    // If no MCP servers are configured and no command is provided, skip discovery
    if (Object.keys(mcpServers).length === 0 && !mcpServerCommand) {
      console.log('No MCP servers configured, skipping MCP tool discovery');
      return;
    }
    
    console.log('🔍 Discovering MCP tools...');
    
    // Discover and register MCP tools
    await discoverMcpTools(
      mcpServers,
      mcpServerCommand,
      toolRegistry
    );
    
    // Log the discovered tools
    const allTools = toolRegistry.listTools();
    const mcpTools = allTools.filter(toolName => 
      toolRegistry.getTool(toolName) instanceof (await import('./mcp-client.js')).DiscoveredMCPTool
    );
    
    if (mcpTools.length > 0) {
      console.log(`✅ Discovered ${mcpTools.length} MCP tools:`);
      mcpTools.forEach(toolName => {
        console.log(`  - ${toolName}`);
      });
    } else {
      console.log('ℹ️  No MCP tools discovered');
    }
  } catch (error) {
    console.error('❌ Failed to integrate MCP tools:', error.message);
  }
}

/**
 * Creates a tool registry that supports both local and MCP tools
 * @param {ToolRegistry} baseRegistry - The base tool registry
 * @returns {Object} Extended tool registry with MCP support
 */
export function createMcpAwareToolRegistry(baseRegistry) {
  return {
    ...baseRegistry,
    
    /**
     * Register a tool (extended to handle MCP tools specially)
     * @param {Object} tool - The tool to register
     */
    registerTool(tool) {
      // Register with the base registry
      baseRegistry.register(tool);
      
      // If this is an MCP tool, log additional information
      if (tool.serverName) {
        console.log(`🔧 Registered MCP tool: ${tool.name} (from ${tool.serverName})`);
      }
    },
    
    /**
     * Execute a tool, handling MCP tools appropriately
     * @param {string} name - The name of the tool to execute
     * @param {Object} params - The parameters to pass to the tool
     * @returns {Promise<any>} The result of executing the tool
     */
    async executeTool(name, params) {
      const tool = baseRegistry.getTool(name);
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }
      
      // Execute the tool
      try {
        const result = await tool.execute(params);
        return result;
      } catch (error) {
        // Provide better error messages for MCP tools
        if (tool.serverName) {
          throw new Error(`MCP tool '${name}' from server '${tool.serverName}' failed: ${error.message}`);
        }
        throw error;
      }
    }
  };
}