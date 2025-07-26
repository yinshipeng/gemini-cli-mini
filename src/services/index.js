/**
 * MINI GEMINI CLI SERVICES: 服务注册中心
 * 
 * 统一管理和导出所有服务模块
 */

import { FileService } from './file-service.js';
import { GitService } from './git-service.js';
import { SessionService } from './session-service.js';
import { ConfigService } from './config-service.js';

export { FileService, GitService, SessionService, ConfigService };

/**
 * 服务工厂类 - 统一创建和管理服务实例
 */
export class ServiceManager {
  constructor(options = {}) {
    this.options = options;
    this.services = new Map();
    this.projectRoot = options.projectRoot || process.cwd();
  }

  /**
   * 获取或创建文件服务
   */
  getFileService() {
    if (!this.services.has('file')) {
      this.services.set('file', new FileService(this.projectRoot));
    }
    return this.services.get('file');
  }

  /**
   * 获取或创建 Git 服务
   */
  getGitService() {
    if (!this.services.has('git')) {
      this.services.set('git', new GitService(this.projectRoot));
    }
    return this.services.get('git');
  }

  /**
   * 获取或创建会话服务
   */
  getSessionService() {
    if (!this.services.has('session')) {
      const config = this.options.sessionConfig || {};
      this.services.set('session', new SessionService(config));
    }
    return this.services.get('session');
  }

  /**
   * 获取或创建配置服务
   */
  getConfigService() {
    if (!this.services.has('config')) {
      this.services.set('config', new ConfigService());
    }
    return this.services.get('config');
  }

  /**
   * 获取所有服务
   */
  getAllServices() {
    return {
      file: this.getFileService(),
      git: this.getGitService(),
      session: this.getSessionService(),
      config: this.getConfigService()
    };
  }

  /**
   * 初始化所有服务
   */
  async initialize() {
    const services = this.getAllServices();
    const initResults = {};
    
    // 配置服务初始化
    try {
      const configStatus = services.config.getStatus();
      initResults.config = {
        success: configStatus.isValid,
        status: configStatus
      };
    } catch (error) {
      initResults.config = {
        success: false,
        error: error.message
      };
    }
    
    // Git 服务初始化
    try {
      const gitInfo = services.git.getProjectInfo();
      initResults.git = {
        success: true,
        info: gitInfo
      };
    } catch (error) {
      initResults.git = {
        success: false,
        error: error.message
      };
    }
    
    // 文件服务初始化
    try {
      const fileStats = await services.file.getProjectStats();
      initResults.file = {
        success: true,
        stats: fileStats
      };
    } catch (error) {
      initResults.file = {
        success: false,
        error: error.message
      };
    }
    
    // 会话服务初始化
    try {
      const sessionStats = services.session.getSessionStats();
      initResults.session = {
        success: true,
        stats: sessionStats
      };
    } catch (error) {
      initResults.session = {
        success: false,
        error: error.message
      };
    }
    
    return initResults;
  }

  /**
   * 获取项目概览信息
   */
  async getProjectOverview() {
    const services = this.getAllServices();
    
    return {
      project: {
        root: this.projectRoot,
        timestamp: new Date().toISOString()
      },
      git: services.git.getProjectInfo(),
      files: await services.file.getProjectStats(),
      sessions: services.session.getSessionStats(),
      config: services.config.getStatus()
    };
  }

  /**
   * 清理服务资源
   */
  cleanup() {
    this.services.clear();
  }
}