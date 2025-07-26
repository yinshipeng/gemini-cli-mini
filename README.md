# Gemini CLI Mini

一个极简版的Gemini CLI工具，用于学习和理解现代AI CLI工具的核心架构。

## 🚀 项目定位

这个项目的目的是：**用最小的代码量展示Gemini CLI的核心架构模式**

- **代码行数**: < 500行核心代码
- **核心功能**: 完整保留原版精髓
- **学习价值**: 理解AI CLI工具的设计模式

## 🏗️ 核心架构

### 1. 三层架构模型
```
gemini-cli-mini/
├── src/
│   ├── cli.js          # 入口层：命令行交互
│   ├── core/
│   │   └── client.js   # 核心层：AI客户端、对话管理
│   └── tools/          # 工具层：文件操作、记忆存储
├── docs/               # 架构文档
└── package.json
```

## 📚 架构学习要点

### 1. 客户端设计 (src/core/client.js)
- **会话管理**: `startChat()` -> `processMessage()` -> 循环
- **状态压缩**: 简化版对话历史管理
- **工具集成**: 自动发现和使用工具

### 2. 工具系统设计 (src/tools/)
- **统一接口**: 所有工具实现相同的`execute()`方法
- **动态注册**: `ToolRegistry`管理所有可用工具
- **参数验证**: JSON Schema定义工具参数

### 3. 记忆系统设计 (src/tools/memory.js)
- **存储格式**: Markdown文件，易于阅读和编辑
- **追加模式**: 新记忆添加到文件末尾
- **用户隔离**: 每个用户独立的记忆文件

### 4. 流式处理
- **实时响应**: 逐字显示AI回复
- **中断处理**: 支持Ctrl+C中断
- **错误恢复**: 优雅处理网络/API错误

## 🎓 学习路径

### 阶段1：理解基础架构 (30分钟)
1. 阅读 `src/cli.js` - 理解命令行入口
2. 理解 `MiniGeminiClient` 的生命周期
3. 运行演示：`npm start demo`

### 阶段2：深入工具系统 (20分钟)
1. 分析 `ToolRegistry` 的设计模式
2. 查看具体工具实现 (`ReadFileTool`, `WriteFileTool`)
3. 尝试添加新工具

### 阶段3：理解记忆系统 (15分钟)
1. 查看 `MemoryTool` 的实现
2. 理解 `~/.gemini-mini/memory.md` 的格式
3. 测试记忆功能

### 阶段4：递归思考机制 (15分钟)
1. 理解 `shouldContinue` 标志的作用
2. 观察递归调用的流程
3. 思考如何扩展到真实场景

## 🛠️ 扩展指南

### 添加新工具
```javascript
// src/tools/your-tool.js
export class YourTool {
    name = 'your_tool';
    description = 'What this tool does';
    schema = { /* JSON Schema */ };
    
    async execute(params) {
        // 实现工具逻辑
    }
}

// 在client.js中注册
this.toolRegistry.registerTool(new YourTool());
```

### 集成真实Gemini API
```javascript
// 替换client.js中的callGeminiAPI方法
async callGeminiAPI(message) {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(this.config.apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const result = await model.generateContent(this.buildPrompt(message));
    return {
        text: result.response.text(),
        shouldContinue: this.shouldContinue(result.response.text())
    };
}
```

## 📖 架构总结

**Gemini CLI Mini** 展示了现代AI CLI工具的核心设计模式：

1. **分层架构**: CLI → 核心逻辑 → 工具系统 → 持久化
2. **插件化设计**: 工具可热插拔
3. **状态管理**: 对话历史和用户记忆
4. **流式处理**: 实时响应和递归思考
5. **错误处理**: 优雅的失败恢复

这个项目虽然小巧，但包含了**生产级AI CLI工具**的所有关键要素，是学习现代AI应用架构的理想起点。