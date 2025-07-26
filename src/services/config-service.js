/**
 * MINI GEMINI CLI SERVICES: 配置服务
 * 
 * 管理应用配置、环境变量和用户设置
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = '.gemini-mini';
const CONFIG_FILE = 'config.json';
const DEFAULT_CONFIG_FILE = 'default-config.json';

export class ConfigService {
  constructor(options = {}) {
    this.configDir = join(homedir(), CONFIG_DIR);
    this.configPath = join(this.configDir, CONFIG_FILE);
    this.defaultConfigPath = join(this.configDir, DEFAULT_CONFIG_FILE);
    this.projectConfigPath = join(process.cwd(), '.gemini-config.json');
    
    this.config = {};
    this.defaultConfig = this.getDefaultConfig();
    
    this.ensureConfigDir();
    this.loadConfig();
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig() {
    return {
      // API 配置
      api: {
        provider: 'openai',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen3-coder-plus',
        temperature: 0.7,
        maxTokens: 4096,
        timeout: 30000
      },
      
      // 聊天配置
      chat: {
        maxHistoryLength: 50,
        autoSave: true,
        showTimestamps: true,
        enableStreaming: true
      },
      
      // 工具配置
      tools: {
        enableLocalTools: true,
        enableMcpTools: true,
        toolTimeout: 30000
      },
      
      // MCP 配置
      mcp: {
        serverTimeout: 10000,
        maxRetries: 3,
        logLevel: 'warn'
      },
      
      // 文件发现配置
      files: {
        respectGitIgnore: true,
        respectGeminiIgnore: true,
        maxFiles: 1000,
        defaultIgnores: [
          'node_modules/**/*',
          '.git/**/*',
          '**/.DS_Store',
          '**/Thumbs.db'
        ]
      },
      
      // 日志配置
      logging: {
        level: 'info',
        enableDebug: false,
        logToFile: false,
        logFile: join(homedir(), CONFIG_DIR, 'app.log')
      },
      
      // 主题和显示
      display: {
        colorOutput: true,
        showProgress: true,
        compactMode: false
      },
      
      // 安全配置
      security: {
        enableSandbox: false,
        allowedCommands: [],
        restrictedPaths: []
      }
    };
  }

  /**
   * 确保配置目录存在
   */
  ensureConfigDir() {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }
  }

  /**
   * 加载配置
   */
  loadConfig() {
    // 加载默认配置
    this.config = { ...this.defaultConfig };
    
    // 加载用户全局配置
    if (existsSync(this.configPath)) {
      try {
        const userConfig = JSON.parse(readFileSync(this.configPath, 'utf8'));
        this.config = this.mergeConfig(this.config, userConfig);
      } catch (error) {
        console.warn('加载用户配置失败:', error.message);
      }
    }
    
    // 加载项目配置
    if (existsSync(this.projectConfigPath)) {
      try {
        const projectConfig = JSON.parse(readFileSync(this.projectConfigPath, 'utf8'));
        this.config = this.mergeConfig(this.config, projectConfig);
      } catch (error) {
        console.warn('加载项目配置失败:', error.message);
      }
    }
    
    // 加载环境变量
    this.loadEnvironmentConfig();
  }

  /**
   * 加载环境变量配置
   */
  loadEnvironmentConfig() {
    const envConfig = {};
    
    // API 配置
    if (process.env.GEMINI_API_KEY) {
      envConfig.api = { ...envConfig.api, apiKey: process.env.GEMINI_API_KEY };
    }
    if (process.env.OPENAI_API_KEY) {
      envConfig.api = { ...envConfig.api, apiKey: process.env.OPENAI_API_KEY };
    }
    if (process.env.OPENAI_BASE_URL) {
      envConfig.api = { ...envConfig.api, baseUrl: process.env.OPENAI_BASE_URL };
    }
    if (process.env.OPENAI_MODEL) {
      envConfig.api = { ...envConfig.api, model: process.env.OPENAI_MODEL };
    }
    
    // 调试模式
    if (process.env.DEBUG === 'true' || process.env.GEMINI_DEBUG === 'true') {
      envConfig.logging = { ...envConfig.logging, enableDebug: true, level: 'debug' };
    }
    
    // 合并环境变量配置
    if (Object.keys(envConfig).length > 0) {
      this.config = this.mergeConfig(this.config, envConfig);
    }
  }

  /**
   * 深度合并配置对象
   */
  mergeConfig(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeConfig(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * 保存用户配置
   */
  saveConfig(config = null) {
    const configToSave = config || this.config;
    
    try {
      writeFileSync(this.configPath, JSON.stringify(configToSave, null, 2), 'utf8');
      return true;
    } catch (error) {
      throw new Error(`保存配置失败: ${error.message}`);
    }
  }

  /**
   * 重置为默认配置
   */
  resetToDefault() {
    this.config = { ...this.defaultConfig };
    this.saveConfig();
    return this.config;
  }

  /**
   * 获取配置值
   */
  get(path, defaultValue = undefined) {
    return this.getNestedValue(this.config, path, defaultValue);
  }

  /**
   * 设置配置值
   */
  set(path, value) {
    this.setNestedValue(this.config, path, value);
    return this;
  }

  /**
   * 获取嵌套对象的值
   */
  getNestedValue(obj, path, defaultValue) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  }

  /**
   * 设置嵌套对象的值
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * 获取完整配置
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * 验证配置
   */
  validate() {
    const errors = [];
    
    // 验证 API 配置
    if (!this.config.api || !this.config.api.apiKey) {
      errors.push('缺少 API Key 配置');
    }
    
    if (!this.config.api.baseUrl) {
      errors.push('缺少 API Base URL 配置');
    }
    
    if (!this.config.api.model) {
      errors.push('缺少模型配置');
    }
    
    // 验证数值范围
    if (this.config.api.temperature < 0 || this.config.api.temperature > 2) {
      errors.push('Temperature 应该在 0-2 之间');
    }
    
    if (this.config.chat.maxHistoryLength < 1) {
      errors.push('最大历史长度应该大于 0');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 导出配置
   */
  export(includeSecrets = false) {
    const exported = { ...this.config };
    
    if (!includeSecrets) {
      // 移除敏感信息
      if (exported.api && exported.api.apiKey) {
        exported.api.apiKey = '***HIDDEN***';
      }
    }
    
    return exported;
  }

  /**
   * 导入配置
   */
  import(configData) {
    try {
      const importedConfig = typeof configData === 'string' 
        ? JSON.parse(configData) 
        : configData;
      
      this.config = this.mergeConfig(this.defaultConfig, importedConfig);
      this.saveConfig();
      
      return true;
    } catch (error) {
      throw new Error(`导入配置失败: ${error.message}`);
    }
  }

  /**
   * 获取配置状态信息
   */
  getStatus() {
    const validation = this.validate();
    
    return {
      configPath: this.configPath,
      projectConfigExists: existsSync(this.projectConfigPath),
      isValid: validation.isValid,
      errors: validation.errors,
      loadedSources: [
        'default',
        existsSync(this.configPath) ? 'user' : null,
        existsSync(this.projectConfigPath) ? 'project' : null,
        'environment'
      ].filter(Boolean)
    };
  }
}