/**
 * 配置文件读取工具
 * 支持从多种配置文件读取API配置：
 * - ~/.zshrc
 * - ~/.bashrc  
 * - ~/.bash_profile
 * - ~/.profile
 * - 环境变量
 */

import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export class ConfigLoader {
  constructor() {
    this.configPaths = [
      join(homedir(), '.zshrc'),
      join(homedir(), '.bashrc'),
      join(homedir(), '.bash_profile'),
      join(homedir(), '.profile'),
      join(homedir(), '.env'),
      '.env'
    ];
  }

  /**
   * 从配置文件中读取变量
   */
  loadConfig() {
    const config = {
      apiKey: null,
      baseUrl: null,
      model: null,
      provider: 'openai' // 默认使用OpenAI
    };

    // 优先读取环境变量
    config.apiKey = process.env.OPENAI_API_KEY || 
                   process.env.GEMINI_API_KEY || 
                   process.env.ANTHROPIC_API_KEY ||
                   process.env.AZURE_OPENAI_API_KEY;

    config.baseUrl = process.env.OPENAI_BASE_URL || 
                    process.env.GEMINI_BASE_URL ||
                    process.env.AZURE_OPENAI_ENDPOINT;

    config.model = process.env.OPENAI_MODEL || 
                  process.env.GEMINI_MODEL ||
                  process.env.CLAUDE_MODEL ||
                  'gpt-3.5-turbo'; // 默认模型

    // 从配置文件中读取
    for (const configPath of this.configPaths) {
      if (existsSync(configPath)) {
        const content = readFileSync(configPath, 'utf-8');
        const envVars = this.parseEnvFile(content);
        
        // 合并配置
        config.apiKey = config.apiKey || envVars.OPENAI_API_KEY || envVars.GEMINI_API_KEY;
        config.baseUrl = config.baseUrl || envVars.OPENAI_BASE_URL || envVars.GEMINI_BASE_URL;
        config.model = config.model || envVars.OPENAI_MODEL || envVars.GEMINI_MODEL;
        
        // 检测提供商类型
        if (envVars.GEMINI_API_KEY) config.provider = 'gemini';
        if (envVars.ANTHROPIC_API_KEY) config.provider = 'claude';
        if (envVars.AZURE_OPENAI_API_KEY) config.provider = 'azure';
      }
    }

    return config;
  }

  /**
   * 解析shell配置文件或.env文件
   */
  parseEnvFile(content) {
    const vars = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      // 去除注释和空白
      const cleanLine = line.trim().replace(/#.*/, '').trim();
      if (!cleanLine) continue;
      
      // 匹配 export VAR=value 或直接 VAR=value
      const exportMatch = cleanLine.match(/^export\s+([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/i);
      const directMatch = cleanLine.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/i);
      
      let key, value;
      if (exportMatch) {
        [, key, value] = exportMatch;
      } else if (directMatch) {
        [, key, value] = directMatch;
      } else {
        continue;
      }
      
      // 去除引号
      value = value.trim().replace(/^["']|["']$/g, '');
      vars[key] = value;
    }
    
    return vars;
  }

  /**
   * 验证配置是否完整
   */
  validateConfig(config) {
    const errors = [];
    
    if (!config.apiKey) {
      errors.push('API key not found. Please set OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY');
    }
    
    if (!config.baseUrl) {
      // 根据提供商设置默认URL
      switch (config.provider) {
        case 'openai':
          config.baseUrl = 'https://api.openai.com/v1';
          break;
        case 'gemini':
          config.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
          break;
        case 'claude':
          config.baseUrl = 'https://api.anthropic.com/v1';
          break;
        case 'azure':
          if (!config.baseUrl) {
            errors.push('Azure OpenAI endpoint is required');
          }
          break;
      }
    }
    
    return errors;
  }

  /**
   * 获取配置信息摘要（不包含敏感信息）
   */
  getConfigSummary(config) {
    return {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
      hasApiKey: !!config.apiKey
    };
  }
}

export const configLoader = new ConfigLoader();