/**
 * MEMORY_TOOL: 记忆持久化工具
 * 
 * 最简化的记忆工具，演示如何持久化用户信息
 * 存储位置：~/.gemini-mini/memory.md
 */

import { homedir } from 'os';
import { join } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

export class MemoryTool {
  name = 'save_memory';
  displayName = 'Save Memory';
  description = 'Save a piece of information to long-term memory';
  
  schema = {
    type: 'object',
    properties: {
      fact: {
        type: 'string',
        description: 'The fact or information to remember'
      }
    },
    required: ['fact']
  };

  constructor() {
    this.memoryPath = join(homedir(), '.gemini-mini', 'memory.md');
    this.ensureMemoryFile();
  }

  ensureMemoryFile() {
    const dir = join(homedir(), '.gemini-mini');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    if (!existsSync(this.memoryPath)) {
      writeFileSync(this.memoryPath, '# Mini Gemini Memory\n\n## Gemini Added Memories\n\n', 'utf8');
    }
  }

  async execute(params) {
    try {
      let content = readFileSync(this.memoryPath, 'utf8');
      const memoryEntry = `- ${params.fact}`;
      
      // Find or create memories section
      const memoriesSection = '## Gemini Added Memories';
      const memoriesIndex = content.indexOf(memoriesSection);
      
      if (memoriesIndex !== -1) {
        const insertIndex = memoriesIndex + memoriesSection.length;
        content = content.slice(0, insertIndex) + '\n' + memoryEntry + content.slice(insertIndex);
      } else {
        content += `\n${memoriesSection}\n${memoryEntry}\n`;
      }
      
      writeFileSync(this.memoryPath, content, 'utf8');
      
      return {
        success: true,
        summary: `Remembered: "${params.fact}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  getAllMemories() {
    try {
      const content = readFileSync(this.memoryPath, 'utf8');
      const lines = content.split('\n');
      return lines
        .filter(line => line.startsWith('- '))
        .map(line => line.substring(2));
    } catch (error) {
      return [];
    }
  }
}