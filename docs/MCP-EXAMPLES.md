# Gemini CLI with MCP - 使用示例

## 1. 基本 MCP 配置

### 环境变量配置
```bash
# 设置一个简单的 HTTP MCP 服务器
export MCP_SERVER_TEST_HTTP_URL=http://localhost:3002/mcp

# 或者设置一个命令行 MCP 服务器
export MCP_SERVER_FILESYSTEM_COMMAND=npx
export MCP_SERVER_FILESYSTEM_ARGS=@modelcontextprotocol/server-filesystem
```

### 配置文件方式
创建 `mcp-config.json` 文件：
```json
{
  "servers": {
    "test": {
      "httpUrl": "http://localhost:3002/mcp"
    },
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "--port", "3001"]
    }
  }
}
```

## 2. 启动带有 MCP 支持的聊天会话

```bash
# 使用环境变量配置的 MCP 服务器
npm start chat

# 使用命令行指定 MCP 服务器
npm start chat -- --mcp-server "npx @modelcontextprotocol/server-filesystem"

# 指定工作目录
npm start chat -- --dir /path/to/project --mcp-server "npx @modelcontextprotocol/server-filesystem"
```

## 3. 在聊天中使用 MCP 工具

一旦 MCP 服务器连接成功，其工具将自动可用：

```
You: 请使用 test_tool 工具发送消息 "Hello from Gemini!"
AI: 工具调用结果: Echo: Hello from Gemini!

You: 请列出当前目录的文件
AI: (如果连接了文件系统 MCP 服务器，它会自动使用相应的工具)
```

## 4. 测试 MCP 功能

### 启动测试服务器
```bash
# 启动简单的 MCP 测试服务器
npm run mcp:test-server
```

### 运行 MCP 集成测试
```bash
# 运行 MCP 集成测试
npm run test:mcp
```

## 5. 常见 MCP 服务器

### 文件系统服务器
```bash
# 安装
npm install @modelcontextprotocol/server-filesystem

# 使用
npm start chat -- --mcp-server "npx @modelcontextprotocol/server-filesystem"
```

### Git 服务器
```bash
# 安装
npm install @modelcontextprotocol/server-git

# 使用
npm start chat -- --mcp-server "npx @modelcontextprotocol/server-git"
```

## 6. 故障排除

### 连接问题
1. 确保 MCP 服务器正在运行
2. 检查 URL 和端口是否正确
3. 验证网络连接

### 工具未显示
1. 检查 MCP 服务器是否正确实现了 tools/list 方法
2. 查看控制台输出的错误信息
3. 确认 MCP 服务器返回了有效的工具定义

### 权限问题
1. 确保 MCP 服务器有适当的权限访问所需资源
2. 检查环境变量和配置是否正确设置