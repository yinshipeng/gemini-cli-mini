/**
 * TOOL REGISTRY: 工具系统的核心
 * 
 * 这是原版ToolRegistry的极简实现
 * 功能：注册、发现和管理所有可用工具
 */

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  register(tool) {
    this.tools.set(tool.name, tool);
    console.log(`🔧 Registered tool: ${tool.name}`);
  }

  getTool(name) {
    return this.tools.get(name);
  }

  getFunctionDeclarations() {
    const declarations = [];
    for (const [name, tool] of this.tools) {
      declarations.push({
        name: tool.name,
        description: tool.description,
        parameters: tool.schema
      });
    }
    return declarations;
  }

  listTools() {
    return Array.from(this.tools.keys());
  }
}