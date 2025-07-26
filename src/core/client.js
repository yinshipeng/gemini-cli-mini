/**
 * MINI GEMINI CLIENT: 优化的核心客户端实现
 *
 * 核心功能：
 * 1. 与Gemini API通信
 * 2. 对话历史管理
 * 3. 本地工具调用支持
 * 4. 递归思考机制
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { UnifiedAIClient } from "./unified-client.js";
import { configLoader } from "../utils/config-loader.js";
import { MemoryTool } from "../tools/memory.js";
import { ReadFileTool } from "../tools/read-file.js";
import { WriteFileTool } from "../tools/write-file.js";
import {
  integrateMcpTools,
  createMcpAwareToolRegistry,
} from "../tools/mcp-integration.js";
import { ServiceManager } from "../services/index.js";
import chalk from "chalk";

export class MiniGeminiClient {
  constructor(config) {
    this.config = config;
    this.history = [];

    // 初始化服务管理器
    this.serviceManager = new ServiceManager({
      projectRoot: config.workingDir || process.cwd(),
      sessionConfig: config.sessionConfig || {}
    });

    try {
      this.apiClient = new UnifiedAIClient();
      console.log(chalk.green("✅ Unified API client initialized"));
    } catch (error) {
      console.error(
        chalk.red("❌ Failed to initialize API client:"),
        error.message
      );
      console.log(chalk.yellow("💡 Please check your API configuration"));
      process.exit(1);
    }

    this.setupServicesAndTools();
  }

  async setupServicesAndTools() {
    await this.setupServices();
    await this.setupTools();
  }

  async setupServices() {
    try {
      console.log(chalk.blue("🔧 Initializing services..."));
      const initResults = await this.serviceManager.initialize();
      
      // 显示服务状态
      Object.entries(initResults).forEach(([service, result]) => {
        if (result.success) {
          console.log(chalk.green(`✅ ${service} service initialized`));
        } else {
          console.log(chalk.yellow(`⚠️ ${service} service: ${result.error}`));
        }
      });
    } catch (error) {
      console.error(chalk.red("❌ Services initialization failed:"), error.message);
    }
  }

  async setupTools() {
    // 注册本地工具
    const baseToolRegistry = {
      tools: new Map(),
      register: function (tool) {
        this.tools.set(tool.name, tool);
      },
      registerTool: function (tool) {
        this.tools.set(tool.name, tool);
      },
      getTool: function (name) {
        return this.tools.get(name);
      },
      executeTool: async function (name, params) {
        const tool = this.tools.get(name);
        if (!tool) {
          throw new Error(`Tool not found: ${name}`);
        }
        return await tool.execute(params);
      },
      getFunctionDeclarations: function () {
        return Array.from(this.tools.values()).map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.schema,
        }));
      },
      getAllTools: function () {
        return Array.from(this.tools.values()).map((tool) => ({
          name: tool.name,
          description: tool.description,
          type: tool.serverName ? "mcp" : "local",
        }));
      },
      listTools: function () {
        return Array.from(this.tools.keys());
      },
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
    console.log("\n🤖 Mini Gemini Chat Started!");
    console.log('Type "exit" to quit, "help" for commands\n');

    // 初始化对话
    this.initializeHistory();

    while (true) {
      const input = await this.getUserInput("You: ");

      if (input.toLowerCase() === "exit") {
        console.log("👋 Goodbye!");
        break;
      }

      if (input.toLowerCase() === "help") {
        this.showHelp();
        continue;
      }

      if (input.toLowerCase() === "history") {
        this.showHistory();
        continue;
      }

      if (input.toLowerCase() === "clear") {
        this.clearHistory();
        console.log("🗑️ Conversation history cleared.");
        continue;
      }

      if (input.toLowerCase() === "status") {
        await this.showStatus();
        continue;
      }

      if (input.toLowerCase() === "project") {
        await this.showProjectOverview();
        continue;
      }

      await this.processMessage(input);
    }
  }

  async processMessage(userInput) {
    try {
      // 将用户输入添加到历史
      this.history.push({ role: "user", content: userInput });

      // 实际API调用（增强版）
      const response = await this.callGeminiAPI(userInput);

      // 将AI响应添加到历史
      this.history.push({ role: "assistant", content: response.text });

      // 限制历史记录长度（保留最近的20条消息 + 系统消息）
      if (this.history.length > 21) {
        this.history = [
          this.history[0], // 保留系统消息
          ...this.history.slice(-20) // 保留最近20条消息
        ];
      }

      // 处理响应
      console.log("\n🤖 AI:", response.text);

      // 如果需要继续思考
      if (response.shouldContinue) {
        console.log("🔄 AI is thinking deeper...");
        await this.processMessage("Please continue.");
      }
    } catch (error) {
      console.error("❌ Error:", error.message);
    }
  }

  async callGeminiAPI(message) {
    try {
      // 构建消息历史 - 使用已经更新的历史记录
      const messages = [
        { role: "system", content: this.buildSystemPrompt() },
        ...this.history.slice(1), // 跳过原有的系统消息，使用更新的
      ];

      // 添加工具信息
      const tools = this.toolRegistry.getFunctionDeclarations();

      const response = await this.apiClient.sendMessage(messages, tools);

      // 处理工具调用
      if (response.tool_calls) {
        // 创建工具调用消息的副本，用于API调用
        const messagesWithTools = [...messages];
        
        for (const toolCall of response.tool_calls) {
          try {
            const result = await this.toolRegistry.executeTool(
              toolCall.name,
              toolCall.arguments
            );

            // 将工具结果添加到临时消息历史（用于API调用）
            messagesWithTools.push({
              role: "assistant",
              content: null,
              tool_calls: [toolCall],
            });

            messagesWithTools.push({
              role: "tool",
              content: JSON.stringify(result),
              tool_call_id: toolCall.id,
            });
          } catch (error) {
            messagesWithTools.push({
              role: "tool",
              content: JSON.stringify({ error: error.message }),
              tool_call_id: toolCall.id,
            });
          }
        }

        // 继续对话，使用工具结果
        const followUpResponse = await this.apiClient.sendMessage(
          messagesWithTools,
          tools
        );
        return {
          text: followUpResponse.text,
          shouldContinue: false,
        };
      }

      return {
        text: response.text,
        shouldContinue:
          message.includes("complex") || message.includes("analyze"),
      };
    } catch (error) {
      console.error("❌ API Error:", error.message);
      return {
        text: `抱歉，我无法处理这个请求。错误: ${error.message}`,
        shouldContinue: false,
      };
    }
  }

  buildSystemPrompt() {
    const toolsInfo = this.toolRegistry.getFunctionDeclarations();
    const memory = this.getMemory();
    const cwd = this.config.workingDir || process.cwd();
    const apiConfig = this.apiClient.getConfig?.() || {
      provider: "OpenAI",
      model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
    };

    return `
You are Mini Gemini, a helpful AI assistant with access to local tools.

Current directory: ${cwd}
Available tools: ${toolsInfo.length} tools available
User memory: ${memory.substring(0, 200)}${memory.length > 200 ? "..." : ""}

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
    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  initializeHistory() {
    this.history = [
      {
        role: "system",
        content: `You are Mini Gemini CLI. Current directory: ${this.config.workingDir}`,
      },
    ];
  }

  getMemory() {
    const memoryPath = join(homedir(), ".gemini-mini", "memory.md");
    if (existsSync(memoryPath)) {
      return readFileSync(memoryPath, "utf8");
    }
    return "No memories yet.";
  }

  showHelp() {
    const tools = this.toolRegistry.getAllTools();

    console.log(`
🤖 Mini Gemini Commands:
- Type your message to chat with AI
- "exit" - Quit the application
- "help" - Show this help message
- "history" - Show conversation history
- "clear" - Clear conversation history
- "status" - Show system status and services info
- "project" - Show project overview
- Mention tool names to use them
- Try "analyze this complex problem" to see recursive thinking

🔧 Available Tools: ${tools.length}
    `);
    tools.forEach((tool) => {
      console.log(`  ${tool.name}: ${tool.description}`);
    });
  }

  showHistory() {
    console.log("\n📜 Conversation History:");
    console.log(`Total messages: ${this.history.length}`);
    
    this.history.forEach((msg, index) => {
      const role = msg.role === 'system' ? '⚙️ System' : 
                  msg.role === 'user' ? '👤 User' : '🤖 AI';
      const content = msg.content.length > 100 ? 
                     msg.content.substring(0, 100) + '...' : 
                     msg.content;
      console.log(`${index + 1}. ${role}: ${content}`);
    });
    console.log("");
  }

  clearHistory() {
    this.initializeHistory();
  }

  async showStatus() {
    console.log('\n📊 System Status:');
    
    const services = this.serviceManager.getAllServices();
    
    // 配置服务状态
    const configStatus = services.config.getStatus();
    console.log(`\n🔧 Configuration:`);
    console.log(`  Config file: ${configStatus.configPath}`);
    console.log(`  Valid: ${configStatus.isValid ? '✅' : '❌'}`);
    console.log(`  Sources: ${configStatus.loadedSources.join(', ')}`);
    if (!configStatus.isValid) {
      configStatus.errors.forEach(error => console.log(`  ❌ ${error}`));
    }
    
    // Git 服务状态
    const gitInfo = services.git.getProjectInfo();
    console.log(`\n📁 Git Information:`);
    if (gitInfo.isGitRepo) {
      console.log(`  Repository: ✅ Git repository`);
      console.log(`  Branch: ${gitInfo.currentBranch || 'unknown'}`);
      console.log(`  Last commit: ${gitInfo.lastCommit?.hash || 'none'}`);
      console.log(`  Working status: ${gitInfo.workingStatus?.clean ? '✅ Clean' : '⚠️ Has changes'}`);
    } else {
      console.log(`  Repository: ❌ Not a Git repository`);
    }
    
    // 工具状态
    const tools = this.toolRegistry.getAllTools();
    const localTools = tools.filter(t => t.type === 'local');
    const mcpTools = tools.filter(t => t.type === 'mcp');
    console.log(`\n🔧 Tools:`);
    console.log(`  Local tools: ${localTools.length}`);
    console.log(`  MCP tools: ${mcpTools.length}`);
    console.log(`  Total: ${tools.length}`);
    
    // 会话状态
    const sessionStats = services.session.getSessionStats();
    console.log(`\n💬 Sessions:`);
    console.log(`  Total sessions: ${sessionStats.totalSessions}`);
    console.log(`  Total messages: ${sessionStats.totalMessages}`);
    console.log(`  Avg messages/session: ${sessionStats.averageMessagesPerSession}`);
    
    console.log('');
  }

  async showProjectOverview() {
    console.log('\n📋 Project Overview:');
    
    try {
      const overview = await this.serviceManager.getProjectOverview();
      
      console.log(`\nProject: ${overview.project.root}`);
      console.log(`Generated: ${new Date(overview.project.timestamp).toLocaleString()}`);
      
      if (overview.git.isGitRepo) {
        console.log(`\n📁 Git:`);
        console.log(`  Branch: ${overview.git.currentBranch}`);
        console.log(`  Last commit: ${overview.git.lastCommit?.message || 'No commits'}`);
        console.log(`  Status: ${overview.git.workingStatus?.clean ? 'Clean' : 'Has changes'}`);
        
        if (overview.git.remoteInfo && Object.keys(overview.git.remoteInfo).length > 0) {
          console.log(`  Remotes:`);
          Object.values(overview.git.remoteInfo).forEach(remote => {
            console.log(`    ${remote.name}: ${remote.type} (${remote.url})`);
          });
        }
      }
      
      console.log(`\n📊 Files:`);
      console.log(`  Total files: ${overview.files.totalFiles}`);
      console.log(`  Total directories: ${overview.files.totalDirectories}`);
      console.log(`  Total size: ${(overview.files.totalSize / 1024).toFixed(1)} KB`);
      
      if (Object.keys(overview.files.fileTypes).length > 0) {
        console.log(`  File types:`);
        const sortedTypes = Object.entries(overview.files.fileTypes)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10); // Top 10
        sortedTypes.forEach(([ext, count]) => {
          console.log(`    .${ext}: ${count} files`);
        });
      }
      
      console.log(`\n💬 Sessions:`);
      console.log(`  Total: ${overview.sessions.totalSessions}`);
      console.log(`  Messages: ${overview.sessions.totalMessages}`);
      
    } catch (error) {
      console.error('❌ Failed to generate project overview:', error.message);
    }
    
    console.log('');
  }

  async runDemo() {
    console.log("\n🎯 Running Demo...\n");

    const scenarios = [
      "Hello, can you help me?",
      "Please read file src/example.js",
      "Remember my favorite color is blue",
      "Analyze this complex code architecture problem",
    ];

    for (const scenario of scenarios) {
      console.log(chalk.blue(`User: ${scenario}`));
      const response = await this.callGeminiAPI(scenario);
      console.log(chalk.green(`AI: ${response.text}`));

      if (response.shouldContinue) {
        console.log(chalk.yellow("AI continues thinking..."));
        const continueResponse = await this.callGeminiAPI("Please continue.");
        console.log(chalk.green(`AI: ${continueResponse.text}`));
      }

      console.log("---");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
