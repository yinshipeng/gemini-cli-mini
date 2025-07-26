/**
 * MINI GEMINI CLIENT: 优化的核心客户端实现
 * 
 * 核心功能：
 * 1. 与Gemini API通信
 * 2. 对话历史管理
 * 3. 本地工具调用支持
 * 4. 递归思考机制
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { UnifiedAIClient } from './unified-client.js';
import { configLoader } from '../utils/config-loader.js';
import { MemoryTool } from '../tools/memory.js';
import { ReadFileTool } from '../tools/read-file.js';
import { WriteFileTool } from '../tools/write-file.js';
import { integrateMcpTools, createMcpAwareToolRegistry } from '../tools/mcp/mcp-integration.js';
import chalk from 'chalk';

export class MiniGeminiClient {
  constructor(config) {
    this.config = config;
    this.history = [];
    
    try {
      this.apiClient = new UnifiedAIClient();
      console.log(chalk.green('✅ Unified API client initialized'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize API client:'), error.message);
      console.log(chalk.yellow('💡 Please check your API configuration'));
      process.exit(1);
    }
    
    this.setupTools();
  }

  async setupTools() {
    // 注册本地工具
    const baseToolRegistry = {
      tools: new Map(),
      register: function(tool) {
        this.tools.set(tool.name, tool);
      },
      registerTool: function(tool) {
        this.tools.set(tool.name, tool);
      },
      getTool: function(name) {
        return this.tools.get(name);
      },
      executeTool: async function(name, params) {
        const tool = this.tools.get(name);
        if (!tool) {
          throw new Error(`Tool not found: ${name}`);
        }
        return await tool.execute(params);
      },
      getFunctionDeclarations: function() {
        return Array.from(this.tools.values()).map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.schema
        }));
      },
      getAllTools: function() {
        return Array.from(this.tools.values()).map(tool => ({
          name: tool.name,
          description: tool.description,
          type: tool.serverName ? 'mcp' : 'local'
        }));
      },
      listTools: function() {
        return Array.from(this.tools.keys());
      }
    };
    
    // Create MCP-aware tool registry
    this.toolRegistry = createMcpAwareToolRegistry(baseToolRegistry);
    
    // 注册本地工具
    this.toolRegistry.registerTool(new ReadFileTool());
    this.toolRegistry.registerTool(new WriteFileTool());
    this.toolRegistry.registerTool(new MemoryTool());
    
    // 集成 MCP 工具
    await integrateMcpTools(this.toolRegistry, this.config.mcpServerCommand);
  }

  async startChat() {
    console.log('\n🤖 Mini Gemini Chat Started!');
    console.log('Type "exit" to quit, "help" for commands\n');

    // 初始化对话
    this.initializeHistory();

    while (true) {
      const input = await this.getUserInput('You: ');
      
      if (input.toLowerCase() === 'exit') {
        console.log('👋 Goodbye!');
        break;
      }

      if (input.toLowerCase() === 'help') {
        this.showHelp();
        continue;
      }

      await this.processMessage(input);
    }
  }

  async processMessage(userInput) {
    try {
      // 实际API调用（增强版）
      const response = await this.callGeminiAPI(userInput);
      
      // 处理响应
      console.log('\n🤖 AI:', response.text);
      
      // 如果需要继续思考
      if (response.shouldContinue) {
        console.log('🔄 AI is thinking deeper...');
        await this.processMessage('Please continue.');
      }

    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  async callGeminiAPI(message) {
    try {
      // 构建消息历史
      const messages = [
        { role: 'system', content: this.buildSystemPrompt() },
        ...this.history.slice(1), // 跳过系统消息
        { role: 'user', content: message }
      ];

      // 添加工具信息
      const tools = this.toolRegistry.getFunctionDeclarations();

      const response = await this.apiClient.sendMessage(messages, tools);
      
      // 处理工具调用
      if (response.tool_calls) {
        for (const toolCall of response.tool_calls) {
          try {
            const result = await this.toolRegistry.executeTool(
              toolCall.name, 
              toolCall.arguments
            );
            
            // 将工具结果添加到历史
            messages.push({
              role: 'assistant',
              content: null,
              tool_calls: [toolCall]
            });
            
            messages.push({
              role: 'tool',
              content: JSON.stringify(result),
              tool_call_id: toolCall.id
            });
          } catch (error) {
            messages.push({
              role: 'tool',
              content: JSON.stringify({ error: error.message }),
              tool_call_id: toolCall.id
            });
          }
        }
        
        // 继续对话，使用工具结果
        const followUpResponse = await this.apiClient.sendMessage(messages, tools);
        return {
          text: followUpResponse.text,
          shouldContinue: false
        };
      }

      return {
        text: response.text,
        shouldContinue: message.includes('complex') || message.includes('analyze')
      };

    } catch (error) {
      console.error('❌ API Error:', error.message);
      return {
        text: `抱歉，我无法处理这个请求。错误: ${error.message}`,
        shouldContinue: false
      };
    }
  }

  buildSystemPrompt() {
    const toolsInfo = this.toolRegistry.getFunctionDeclarations();
    const memory = this.getMemory();
    const cwd = this.config.workingDir || process.cwd();
    const apiConfig = this.apiClient.getConfig?.() || { provider: 'OpenAI', model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo' };

    return `
You are Mini Gemini, a helpful AI assistant with access to local tools.

Current directory: ${cwd}
Available tools: ${toolsInfo.length} tools available
User memory: ${memory.substring(0, 200)}${memory.length > 200 ? '...' : ''}

Guidelines:
- Use tools when they can help answer the user's question
- Always provide helpful and accurate responses
- If you need to use tools, call them directly
- Keep responses concise but informative
    `.trim();
  }

  generateResponse(message, prompt) {
    // 这个方法现在只是备用，实际使用API调用
    return "I'm ready to help you with real AI capabilities!";
  }


  async getUserInput(prompt) {
    // 简单实现，实际中可能使用更复杂的输入处理
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise(resolve => {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  initializeHistory() {
    this.history = [
      {
        role: 'system',
        content: `You are Mini Gemini CLI. Current directory: ${this.config.workingDir}`
      }
    ];
  }

  getMemory() {
    const memoryPath = join(homedir(), '.gemini-mini', 'memory.md');
    if (existsSync(memoryPath)) {
      return readFileSync(memoryPath, 'utf8');
    }
    return 'No memories yet.';
  }

  showHelp() {
    const tools = this.toolRegistry.getAllTools();
    
    console.log(`
🤖 Mini Gemini Commands:
- Type your message to chat with AI
- "exit" - Quit the application
- Mention tool names to use them
- Try "analyze this complex problem" to see recursive thinking

🔧 Available Tools: ${tools.length}
    `);
    tools.forEach(tool => {
      console.log(`  ${tool.name}: ${tool.description}`);
    });
  }

  async runDemo() {
    console.log('\n🎯 Running Demo...\n');
    
    const scenarios = [
      'Hello, can you help me?',
      'Please read file src/example.js',
      'Remember my favorite color is blue',
      'Analyze this complex code architecture problem'
    ];

    for (const scenario of scenarios) {
      console.log(chalk.blue(`User: ${scenario}`));
      const response = await this.callGeminiAPI(scenario);
      console.log(chalk.green(`AI: ${response.text}`));
      
      if (response.shouldContinue) {
        console.log(chalk.yellow('AI continues thinking...'));
        const continueResponse = await this.callGeminiAPI('Please continue.');
        console.log(chalk.green(`AI: ${continueResponse.text}`));
      }
      
      console.log('---');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}