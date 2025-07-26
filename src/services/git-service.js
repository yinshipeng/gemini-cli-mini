/**
 * MINI GEMINI CLI SERVICES: Git 服务
 * 
 * 提供 Git 操作和项目状态管理功能
 * 简化版本，专注于基本的 Git 信息获取
 */

import { execSync, exec } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

export class GitService {
  constructor(projectRoot) {
    this.projectRoot = resolve(projectRoot);
    this.isGitRepo = this.checkIsGitRepository();
  }

  /**
   * 检查是否为 Git 仓库
   */
  checkIsGitRepository() {
    try {
      const gitDir = join(this.projectRoot, '.git');
      return existsSync(gitDir);
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查 Git 是否可用
   */
  async isGitAvailable() {
    return new Promise((resolve) => {
      exec('git --version', (error) => {
        resolve(!error);
      });
    });
  }

  /**
   * 执行 Git 命令
   */
  execGitCommand(command, options = {}) {
    if (!this.isGitRepo) {
      throw new Error('当前目录不是 Git 仓库');
    }

    try {
      const result = execSync(`git ${command}`, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        timeout: 10000,
        ...options
      });
      return result.trim();
    } catch (error) {
      throw new Error(`Git 命令执行失败: ${error.message}`);
    }
  }

  /**
   * 获取当前分支名
   */
  getCurrentBranch() {
    if (!this.isGitRepo) return null;
    
    try {
      return this.execGitCommand('branch --show-current');
    } catch (error) {
      console.warn('获取当前分支失败:', error.message);
      return null;
    }
  }

  /**
   * 获取最新提交信息
   */
  getLastCommit() {
    if (!this.isGitRepo) return null;
    
    try {
      const hash = this.execGitCommand('rev-parse HEAD');
      const message = this.execGitCommand('log -1 --pretty=format:"%s"');
      const author = this.execGitCommand('log -1 --pretty=format:"%an"');
      const date = this.execGitCommand('log -1 --pretty=format:"%ad"');
      
      return {
        hash: hash.substring(0, 8),
        fullHash: hash,
        message: message.replace(/"/g, ''),
        author: author.replace(/"/g, ''),
        date: date.replace(/"/g, '')
      };
    } catch (error) {
      console.warn('获取最新提交失败:', error.message);
      return null;
    }
  }

  /**
   * 获取工作区状态
   */
  getWorkingStatus() {
    if (!this.isGitRepo) return null;
    
    try {
      const status = this.execGitCommand('status --porcelain');
      const lines = status.split('\n').filter(line => line.trim());
      
      const result = {
        clean: lines.length === 0,
        totalChanges: lines.length,
        staged: 0,
        unstaged: 0,
        untracked: 0,
        files: []
      };
      
      lines.forEach(line => {
        const statusCode = line.substring(0, 2);
        const filePath = line.substring(3);
        
        const fileStatus = {
          path: filePath,
          status: this.parseStatusCode(statusCode)
        };
        
        if (statusCode[0] !== ' ' && statusCode[0] !== '?') {
          result.staged++;
        }
        if (statusCode[1] !== ' ') {
          result.unstaged++;
        }
        if (statusCode === '??') {
          result.untracked++;
        }
        
        result.files.push(fileStatus);
      });
      
      return result;
    } catch (error) {
      console.warn('获取工作区状态失败:', error.message);
      return null;
    }
  }

  /**
   * 解析 Git 状态码
   */
  parseStatusCode(code) {
    const statusMap = {
      '??': 'untracked',
      'A ': 'added',
      'M ': 'modified',
      'D ': 'deleted',
      'R ': 'renamed',
      'C ': 'copied',
      ' M': 'modified',
      ' D': 'deleted',
      'MM': 'modified',
      'AM': 'added-modified',
      'AD': 'added-deleted'
    };
    
    return statusMap[code] || 'unknown';
  }

  /**
   * 获取远程仓库信息
   */
  getRemoteInfo() {
    if (!this.isGitRepo) return null;
    
    try {
      const remotes = this.execGitCommand('remote -v');
      const lines = remotes.split('\n').filter(line => line.trim());
      const remoteInfo = {};
      
      lines.forEach(line => {
        const [name, url, type] = line.split(/\\s+/);
        if (type === '(fetch)') {
          remoteInfo[name] = {
            name,
            url,
            type: this.detectRepoType(url)
          };
        }
      });
      
      return remoteInfo;
    } catch (error) {
      console.warn('获取远程仓库信息失败:', error.message);
      return null;
    }
  }

  /**
   * 检测仓库类型
   */
  detectRepoType(url) {
    if (url.includes('github.com')) return 'GitHub';
    if (url.includes('gitlab.com')) return 'GitLab';
    if (url.includes('bitbucket.org')) return 'Bitbucket';
    if (url.includes('gitee.com')) return 'Gitee';
    return 'Other';
  }

  /**
   * 获取完整的 Git 项目信息
   */
  getProjectInfo() {
    if (!this.isGitRepo) {
      return {
        isGitRepo: false,
        message: '当前目录不是 Git 仓库'
      };
    }
    
    return {
      isGitRepo: true,
      projectRoot: this.projectRoot,
      currentBranch: this.getCurrentBranch(),
      lastCommit: this.getLastCommit(),
      workingStatus: this.getWorkingStatus(),
      remoteInfo: this.getRemoteInfo()
    };
  }

  /**
   * 获取项目统计信息
   */
  getStats() {
    if (!this.isGitRepo) return null;
    
    try {
      const totalCommits = this.execGitCommand('rev-list --count HEAD');
      const contributors = this.execGitCommand('shortlog -sn --all');
      const firstCommit = this.execGitCommand('log --reverse --pretty=format:"%ad" | head -1');
      
      const contributorList = contributors.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [commits, ...nameParts] = line.trim().split(/\\s+/);
          return {
            commits: parseInt(commits),
            name: nameParts.join(' ')
          };
        });
      
      return {
        totalCommits: parseInt(totalCommits),
        contributors: contributorList,
        firstCommitDate: firstCommit.replace(/"/g, ''),
        totalContributors: contributorList.length
      };
    } catch (error) {
      console.warn('获取项目统计失败:', error.message);
      return null;
    }
  }
}