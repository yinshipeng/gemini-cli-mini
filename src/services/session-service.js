/**
 * MINI GEMINI CLI SERVICES: 会话服务
 * 
 * 管理聊天会话、上下文和对话历史
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

const SESSION_DIR = '.gemini-mini/sessions';

export class SessionService {
  constructor(config = {}) {
    this.config = config;
    this.sessionDir = join(homedir(), SESSION_DIR);
    this.currentSessionId = null;
    this.sessionData = null;
    this.maxHistoryLength = config.maxHistoryLength || 50;
    this.autoSave = config.autoSave !== false;
    
    this.ensureSessionDir();
  }

  /**
   * 确保会话目录存在
   */
  ensureSessionDir() {
    if (!existsSync(this.sessionDir)) {
      mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  /**
   * 生成会话 ID
   */
  generateSessionId(identifier = null) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const base = identifier || `session-${timestamp}-${random}`;
    
    return createHash('md5').update(base).digest('hex').substring(0, 16);
  }

  /**
   * 创建新会话
   */
  createSession(options = {}) {
    const sessionId = this.generateSessionId(options.identifier);
    const sessionData = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: options.title || `Chat Session ${new Date().toLocaleDateString()}`,
      history: [],
      context: {
        workingDir: options.workingDir || process.cwd(),
        model: options.model || 'default',
        temperature: options.temperature || 0.7,
        ...options.context
      },
      metadata: {
        messageCount: 0,
        totalTokens: 0,
        ...options.metadata
      }
    };
    
    this.currentSessionId = sessionId;
    this.sessionData = sessionData;
    
    if (this.autoSave) {
      this.saveSession();
    }
    
    return sessionData;
  }

  /**
   * 加载会话
   */
  loadSession(sessionId) {
    const sessionPath = join(this.sessionDir, `${sessionId}.json`);
    
    if (!existsSync(sessionPath)) {
      throw new Error(`会话不存在: ${sessionId}`);
    }
    
    try {
      const data = readFileSync(sessionPath, 'utf8');
      this.sessionData = JSON.parse(data);
      this.currentSessionId = sessionId;
      
      return this.sessionData;
    } catch (error) {
      throw new Error(`加载会话失败: ${error.message}`);
    }
  }

  /**
   * 保存会话
   */
  saveSession(sessionData = null) {
    const data = sessionData || this.sessionData;
    if (!data || !data.id) {
      throw new Error('没有可保存的会话数据');
    }
    
    const sessionPath = join(this.sessionDir, `${data.id}.json`);
    data.updatedAt = new Date().toISOString();
    
    try {
      writeFileSync(sessionPath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      throw new Error(`保存会话失败: ${error.message}`);
    }
  }

  /**
   * 添加消息到历史
   */
  addMessage(role, content, metadata = {}) {
    if (!this.sessionData) {
      throw new Error('没有活动会话');
    }
    
    const message = {
      id: this.generateMessageId(),
      role,
      content,
      timestamp: new Date().toISOString(),
      ...metadata
    };
    
    this.sessionData.history.push(message);
    this.sessionData.metadata.messageCount++;
    
    // 限制历史长度
    if (this.sessionData.history.length > this.maxHistoryLength) {
      const removed = this.sessionData.history.splice(0, 
        this.sessionData.history.length - this.maxHistoryLength);
      console.debug(`清理了 ${removed.length} 条历史消息`);
    }
    
    if (this.autoSave) {
      this.saveSession();
    }
    
    return message;
  }

  /**
   * 生成消息 ID
   */
  generateMessageId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `msg_${timestamp}_${random}`;
  }

  /**
   * 获取消息历史
   */
  getHistory(limit = null) {
    if (!this.sessionData) {
      return [];
    }
    
    const history = this.sessionData.history;
    return limit ? history.slice(-limit) : history;
  }

  /**
   * 清除历史
   */
  clearHistory() {
    if (!this.sessionData) {
      throw new Error('没有活动会话');
    }
    
    this.sessionData.history = [];
    this.sessionData.metadata.messageCount = 0;
    
    if (this.autoSave) {
      this.saveSession();
    }
  }

  /**
   * 更新会话上下文
   */
  updateContext(contextUpdates) {
    if (!this.sessionData) {
      throw new Error('没有活动会话');
    }
    
    this.sessionData.context = {
      ...this.sessionData.context,
      ...contextUpdates
    };
    
    if (this.autoSave) {
      this.saveSession();
    }
  }

  /**
   * 获取会话列表
   */
  listSessions() {
    const sessions = [];
    
    try {
      const files = readdirSync(this.sessionDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const sessionPath = join(this.sessionDir, file);
            const data = JSON.parse(readFileSync(sessionPath, 'utf8'));
            sessions.push({
              id: data.id,
              title: data.title,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
              messageCount: data.metadata.messageCount || 0
            });
          } catch (error) {
            console.warn(`跳过损坏的会话文件: ${file}`);
          }
        }
      }
    } catch (error) {
      console.warn('读取会话列表失败:', error.message);
    }
    
    return sessions.sort((a, b) => 
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  }

  /**
   * 删除会话
   */
  deleteSession(sessionId) {
    const sessionPath = join(this.sessionDir, `${sessionId}.json`);
    
    if (!existsSync(sessionPath)) {
      throw new Error(`会话不存在: ${sessionId}`);
    }
    
    try {
      unlinkSync(sessionPath);
      
      if (this.currentSessionId === sessionId) {
        this.currentSessionId = null;
        this.sessionData = null;
      }
      
      return true;
    } catch (error) {
      throw new Error(`删除会话失败: ${error.message}`);
    }
  }

  /**
   * 获取当前会话
   */
  getCurrentSession() {
    return this.sessionData;
  }

  /**
   * 导出会话
   */
  exportSession(sessionId = null, format = 'json') {
    const id = sessionId || this.currentSessionId;
    if (!id) {
      throw new Error('没有指定的会话');
    }
    
    const sessionData = sessionId ? this.loadSession(sessionId) : this.sessionData;
    
    switch (format) {
      case 'json':
        return JSON.stringify(sessionData, null, 2);
      
      case 'markdown':
        return this.exportToMarkdown(sessionData);
      
      case 'text':
        return this.exportToText(sessionData);
      
      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
  }

  /**
   * 导出为 Markdown 格式
   */
  exportToMarkdown(sessionData) {
    let markdown = `# ${sessionData.title}\n\n`;
    markdown += `**创建时间:** ${sessionData.createdAt}\n`;
    markdown += `**更新时间:** ${sessionData.updatedAt}\n`;
    markdown += `**消息数量:** ${sessionData.metadata.messageCount}\n\n`;
    markdown += `---\n\n`;
    
    for (const message of sessionData.history) {
      const roleIcon = message.role === 'user' ? '👤' : '🤖';
      markdown += `## ${roleIcon} ${message.role.toUpperCase()}\n\n`;
      markdown += `${message.content}\n\n`;
      markdown += `*时间: ${message.timestamp}*\n\n`;
      markdown += `---\n\n`;
    }
    
    return markdown;
  }

  /**
   * 导出为纯文本格式
   */
  exportToText(sessionData) {
    let text = `${sessionData.title}\n`;
    text += `=${'='.repeat(sessionData.title.length)}\n\n`;
    text += `创建时间: ${sessionData.createdAt}\n`;
    text += `更新时间: ${sessionData.updatedAt}\n`;
    text += `消息数量: ${sessionData.metadata.messageCount}\n\n`;
    
    for (const message of sessionData.history) {
      text += `[${message.role.toUpperCase()}] ${message.timestamp}\n`;
      text += `${message.content}\n\n`;
      text += `${'-'.repeat(50)}\n\n`;
    }
    
    return text;
  }

  /**
   * 获取会话统计信息
   */
  getSessionStats() {
    const sessions = this.listSessions();
    const totalSessions = sessions.length;
    const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);
    
    return {
      totalSessions,
      totalMessages,
      averageMessagesPerSession: totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0,
      oldestSession: sessions.length > 0 ? sessions[sessions.length - 1] : null,
      newestSession: sessions.length > 0 ? sessions[0] : null
    };
  }
}