#!/usr/bin/env node

/**
 * GEMINI-CLI-MINI: 极简版Gemini CLI入口文件
 * 
 * 核心功能：
 * 1. 命令行参数解析
 * 2. 启动交互式会话
 * 3. 管理整个应用生命周期
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { MiniGeminiClient } from './core/client.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const program = new Command();

program
  .name('mini-gemini')
  .description('Minimal Gemini CLI - Learn the core architecture')
  .version('1.0.0');

program
  .command('chat')
  .description('Start interactive chat session')
  .option('-d, --dir <path>', 'Working directory', process.cwd())
  .option('--mcp-server <command>', 'MCP server command to start')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Starting Mini Gemini CLI...'));
    console.log(chalk.gray(`Working directory: ${options.dir}`));
    
    const client = new MiniGeminiClient({
      workingDir: options.dir,
      apiKey: process.env.GEMINI_API_KEY,
      mcpServerCommand: options.mcpServer
    });

    try {
      await client.startChat();
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });



program
  .command('demo')
  .description('Run a quick demo')
  .action(async () => {
    console.log(chalk.green('🎯 Mini Gemini CLI Demo'));
    console.log(chalk.gray('This demonstrates the core architecture:'));
    console.log('1. ✅ Tool registration');
    console.log('2. ✅ Memory persistence');
    console.log('3. ✅ Recursive thinking');
    console.log('4. ✅ Stream processing');
    
    const client = new MiniGeminiClient({
      apiKey: process.env.GEMINI_API_KEY
    });
    
    await client.runDemo();
  });

// 如果没有提供命令，显示帮助
if (process.argv.length === 2) {
  program.help();
}

program.parse();