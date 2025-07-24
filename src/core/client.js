/**
 * MINI GEMINI CLIENT: 核心客户端实现
 * 
 * 精简了原版的所有复杂功能，只保留最核心：
 * 1. 与Gemini API通信
 * 2. 对话历史管理
 * 3. 工具调用支持
 * 4. 递归思考机制
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { ToolRegistry } from '../tools/registry.js';
import { MemoryTool } from '../tools/memory.js';
import { ReadFileTool } from '../tools/read-file.js';
import { WriteFileTool } from '../tools/write-file.js';
import chalk from 'chalk';

export class MiniGeminiClient {
  constructor(config) {
    this.config = config;
    this.history = [];
    this.toolRegistry = new ToolRegistry();
    this.setupTools();
  }

  setupTools() {
    // 注册最基础的工具
    this.toolRegistry.register(new ReadFileTool());
    this.toolRegistry.register(new WriteFileTool());
    this.toolRegistry.register(new MemoryTool());
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
      // 模拟API调用（实际中会调用Gemini API）
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
    // 这里简化API调用，实际中会使用Google AI SDK
    const prompt = this.buildPrompt(message);
    
    // 模拟响应
    return {
      text: this.generateResponse(message, prompt),
      shouldContinue: message.includes('complex') || message.includes('analyze')
    };
  }

  buildPrompt(message) {
    const toolsInfo = this.toolRegistry.getFunctionDeclarations();
    const memory = this.getMemory();
    const cwd = this.config.workingDir || process.cwd();

    return `
You are Mini Gemini, a helpful AI assistant.

Current directory: ${cwd}
Available tools: ${JSON.stringify(toolsInfo, null, 2)}
User memory: ${memory}

User message: ${message}

Respond naturally and use tools when needed. If you need to think deeper, set shouldContinue to true.
    `.trim();
  }

  generateResponse(message, prompt) {
    // 模拟AI响应逻辑
    if (message.includes('read file')) {
      return "I can help you read files. Please specify which file you'd like me to read.";
    }
    
    if (message.includes('write file')) {
      return "I can help you write files. Please provide the filename and content.";
    }
    
    if (message.includes('remember')) {
      return "I'll remember that for you!";
    }
    
    if (message.includes('complex')) {
      return "This seems complex. Let me break this down into steps: First, I'll analyze the current structure...";
    }
    
    return `I received: "${message}". How can I help you with this?`;
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
    console.log(`
🤖 Mini Gemini Commands:
- Type your message to chat with AI
- "exit" - Quit the application
- Mention "read file", "write file", or "remember" to see tool usage
- Try "analyze this complex problem" to see recursive thinking
    `);
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