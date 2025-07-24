# 架构深度解析：Gemini CLI Mini

## 🎯 项目目标

通过**最小实现**理解AI CLI工具的**核心架构模式**。

## 🏗️ 三层架构详解

### 1. 表示层 (Presentation Layer)
**文件**: `src/cli.js`

**职责**:
- 命令行参数解析
- 用户交互入口
- 生命周期管理

**核心代码模式**:
```javascript
// 命令模式
program
  .command('chat')
  .action(async (options) => {
    const client = new MiniGeminiClient(config);
    await client.startChat(); // 委托给核心层
  });
```

### 2. 核心业务层 (Business Logic Layer)
**文件**: `src/core/client.js`

#### 2.1 会话管理生命周期
```
startChat() 
   ↓
initializeHistory()  // 初始化上下文
   ↓
while(true) {        // 主循环
   getUserInput()     // 获取输入
   processMessage()   // 处理消息
}
```

#### 2.2 递归思考机制
```javascript
// 关键设计：AI自我对话
async processMessage(input) {
    const response = await this.callGeminiAPI(input);
    
    // 判断是否需要继续思考
    if (response.shouldContinue) {
        await this.processMessage('Please continue.'); // 递归调用
    }
}
```

#### 2.3 工具集成系统
```javascript
// 工具发现和使用流程
const prompt = `
Available tools: ${this.toolRegistry.getFunctionDeclarations()}
User message: ${message}
`;

// AI决定使用哪个工具
// 工具执行结果反馈给AI
// AI基于结果继续对话
```

### 3. 数据访问层 (Data Access Layer)
**文件**: `src/tools/`

#### 3.1 工具系统架构
```
ToolRegistry (注册中心)
    ↓
BaseTool (抽象接口)
    ↓
├── ReadFileTool     (文件读取)
├── WriteFileTool    (文件写入)
├── MemoryTool       (记忆存储)
└── [可扩展工具...]
```

#### 3.2 记忆存储设计
```
~/.gemini-mini/memory.md
├── 文件格式: Markdown
├── 存储模式: 追加写入
├── 访问方式: 直接文件操作
└── 生命周期: 持久化存储
```

## 🔍 关键设计模式

### 1. 命令模式 (Command Pattern)
```javascript
// 每个工具都是一个命令
class ReadFileTool {
    name = 'read_file';
    schema = { /* 参数定义 */ };
    execute(params) { /* 具体实现 */ }
}
```

### 2. 注册模式 (Registry Pattern)
```javascript
class ToolRegistry {
    tools = new Map();          // 存储所有工具
    register(tool) { ... }      // 注册新工具
    getFunctionDeclarations()    // 发现可用工具
}
```

### 3. 策略模式 (Strategy Pattern)
```javascript
// 不同的响应策略
const strategies = {
    'read file': () => new ReadFileTool(),
    'write file': () => new WriteFileTool(),
    'remember': () => new MemoryTool()
};
```

### 4. 模板方法模式 (Template Method)
```javascript
// BaseTool定义通用流程
abstract class BaseTool {
    async execute(params) {
        this.validate(params);  // 模板步骤1
        return this.run(params); // 模板步骤2
    }
}
```

## 🔄 数据流分析

### 1. 用户输入处理流程
```
用户输入
   ↓
CLI解析
   ↓
Client.buildPrompt()  // 构建上下文
   ↓
callGeminiAPI()      // 调用AI
   ↓
AI响应
   ↓
工具调用决策
   ↓
工具执行结果
   ↓
最终响应给用户
```

### 2. 工具调用流程
```
AI决定使用工具
   ↓
ToolRegistry查找工具
   ↓
Tool.execute()        // 执行工具
   ↓
返回结果给AI
   ↓
AI基于结果继续
```

### 3. 记忆存储流程
```
用户要求记忆
   ↓
MemoryTool.execute()  // 保存记忆
   ↓
写入 ~/.gemini-mini/memory.md
   ↓
下次对话时读取
```

## 🎯 架构决策记录 (ADR)

### ADR-001: 使用纯Node.js而非React
**决策**: 使用纯Node.js实现，而非React+Ink
**理由**: 
- ✅ 减少学习成本
- ✅ 专注架构本身
- ✅ 更少的依赖
- ❌ 失去富文本界面

### ADR-002: 文件存储而非数据库存储
**决策**: 使用Markdown文件存储记忆
**理由**:
- ✅ 用户可读性强
- ✅ 零配置
- ✅ 版本控制友好
- ❌ 查询能力有限

### ADR-003: 模拟API而非真实API
**决策**: 模拟Gemini API响应
**理由**:
- ✅ 无需API密钥即可运行
- ✅ 可控的演示环境
- ✅ 专注架构模式
- ❌ 非真实AI响应

## 📊 性能考虑

### 1. 内存使用
- **对话历史**: 保存在内存中，无压缩
- **工具实例**: 懒加载，按需创建
- **文件缓存**: 无缓存，直接文件操作

### 2. 扩展点
- **工具系统**: 通过ToolRegistry可无限扩展
- **存储系统**: 可替换为Redis/数据库
- **API集成**: 可替换为真实API调用

## 🎓 学习要点总结

### 1. 核心概念
1. **分层架构**: 清晰的职责分离
2. **插件系统**: 可扩展的工具机制
3. **状态管理**: 对话历史和用户记忆
4. **递归思考**: AI自我对话能力

### 2. 代码组织
1. **单一职责**: 每个类/函数只做一件事
2. **依赖注入**: 配置和工具通过构造函数注入
3. **错误处理**: 每层的错误边界
4. **测试友好**: 接口清晰，易于测试

### 3. 扩展方向
1. **真实API集成**: 替换模拟API
2. **富文本界面**: 添加React+Ink
3. **更多工具**: 集成更多系统工具
4. **配置管理**: 添加配置文件支持

这个架构虽然简单，但包含了**生产级AI CLI工具**的所有关键设计要素，是理解现代AI应用架构的理想起点。