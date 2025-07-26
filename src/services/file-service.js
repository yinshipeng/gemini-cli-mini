/**
 * MINI GEMINI CLI SERVICES: 文件发现服务
 * 
 * 提供文件过滤、发现和管理功能
 * 基于 .gitignore 和 .geminiignore 进行智能过滤
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve, relative } from 'path';
import { glob } from 'glob';

const GEMINI_IGNORE_FILE = '.geminiignore';

export class FileService {
  constructor(projectRoot) {
    this.projectRoot = resolve(projectRoot);
    this.gitIgnorePatterns = this.loadGitIgnorePatterns();
    this.geminiIgnorePatterns = this.loadGeminiIgnorePatterns();
  }

  /**
   * 加载 .gitignore 规则
   */
  loadGitIgnorePatterns() {
    const gitIgnorePath = join(this.projectRoot, '.gitignore');
    if (!existsSync(gitIgnorePath)) {
      return [];
    }
    
    try {
      const content = readFileSync(gitIgnorePath, 'utf8');
      return this.parseIgnoreFile(content);
    } catch (error) {
      console.warn('无法读取 .gitignore:', error.message);
      return [];
    }
  }

  /**
   * 加载 .geminiignore 规则
   */
  loadGeminiIgnorePatterns() {
    const geminiIgnorePath = join(this.projectRoot, GEMINI_IGNORE_FILE);
    if (!existsSync(geminiIgnorePath)) {
      return [];
    }
    
    try {
      const content = readFileSync(geminiIgnorePath, 'utf8');
      return this.parseIgnoreFile(content);
    } catch (error) {
      console.warn('无法读取 .geminiignore:', error.message);
      return [];
    }
  }

  /**
   * 解析忽略文件内容
   */
  parseIgnoreFile(content) {
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(pattern => {
        // 简单的 glob 模式转换
        if (pattern.endsWith('/')) {
          return pattern + '**/*';
        }
        return pattern;
      });
  }

  /**
   * 检查文件是否应该被忽略
   */
  shouldIgnoreFile(filePath, options = {}) {
    const { respectGitIgnore = true, respectGeminiIgnore = true } = options;
    const relativePath = relative(this.projectRoot, resolve(filePath));
    
    // 检查 .gitignore
    if (respectGitIgnore && this.matchesPatterns(relativePath, this.gitIgnorePatterns)) {
      return true;
    }
    
    // 检查 .geminiignore
    if (respectGeminiIgnore && this.matchesPatterns(relativePath, this.geminiIgnorePatterns)) {
      return true;
    }
    
    // 默认忽略的文件/目录
    const defaultIgnores = [
      'node_modules/**/*',
      '.git/**/*',
      '**/.DS_Store',
      '**/Thumbs.db',
      '**/*.tmp',
      '**/*.temp'
    ];
    
    if (this.matchesPatterns(relativePath, defaultIgnores)) {
      return true;
    }
    
    return false;
  }

  /**
   * 检查文件路径是否匹配忽略模式
   */
  matchesPatterns(filePath, patterns) {
    return patterns.some(pattern => {
      // 简单的 glob 匹配实现
      const regex = this.globToRegex(pattern);
      return regex.test(filePath);
    });
  }

  /**
   * 将 glob 模式转换为正则表达式
   */
  globToRegex(pattern) {
    const escaped = pattern
      .replace(/[.+^${}()|[\\]\\]/g, '\\\\$&')
      .replace(/\\*/g, '.*')
      .replace(/\\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }

  /**
   * 发现项目文件
   */
  async discoverFiles(pattern = '**/*', options = {}) {
    const { respectGitIgnore = true, respectGeminiIgnore = true, maxFiles = 1000 } = options;
    
    try {
      const files = await glob(pattern, {
        cwd: this.projectRoot,
        ignore: ['node_modules/**', '.git/**'],
        nodir: true,
        maxFiles
      });
      
      return files.filter(file => 
        !this.shouldIgnoreFile(join(this.projectRoot, file), {
          respectGitIgnore,
          respectGeminiIgnore
        })
      );
    } catch (error) {
      console.error('文件发现失败:', error.message);
      return [];
    }
  }

  /**
   * 发现特定类型的文件
   */
  async discoverFilesByType(extensions, options = {}) {
    const extPattern = extensions.length === 1 
      ? `**/*.${extensions[0]}`
      : `**/*.{${extensions.join(',')}}`;
    
    return this.discoverFiles(extPattern, options);
  }

  /**
   * 获取项目统计信息
   */
  async getProjectStats(options = {}) {
    const allFiles = await this.discoverFiles('**/*', options);
    const stats = {
      totalFiles: allFiles.length,
      fileTypes: {},
      directories: new Set(),
      totalSize: 0
    };
    
    for (const file of allFiles) {
      const fullPath = join(this.projectRoot, file);
      const ext = file.split('.').pop() || 'no-extension';
      
      // 统计文件类型
      stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
      
      // 统计目录
      const dir = file.split('/').slice(0, -1).join('/');
      if (dir) {
        stats.directories.add(dir);
      }
      
      // 统计文件大小（如果可以的话）
      try {
        const { statSync } = await import('fs');
        const stat = statSync(fullPath);
        stats.totalSize += stat.size;
      } catch (error) {
        // 忽略错误
      }
    }
    
    stats.totalDirectories = stats.directories.size;
    delete stats.directories; // 不返回详细目录列表
    
    return stats;
  }

  /**
   * 过滤文件列表
   */
  filterFiles(filePaths, options = {}) {
    return filePaths.filter(file => !this.shouldIgnoreFile(file, options));
  }

  /**
   * 获取忽略模式
   */
  getIgnorePatterns() {
    return {
      gitIgnore: [...this.gitIgnorePatterns],
      geminiIgnore: [...this.geminiIgnorePatterns]
    };
  }
}