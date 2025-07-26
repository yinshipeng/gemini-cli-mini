# 🚀 真实API配置指南

## 快速开始

### 1. 选择你的AI提供商

#### OpenAI (推荐)
```bash
# 添加到 ~/.zshrc 或 ~/.bashrc
export OPENAI_API_KEY="sk-your-openai-key-here"
export OPENAI_BASE_URL="https://api.openai.com/v1"
export OPENAI_MODEL="gpt-3.5-turbo"
```

#### Google Gemini
```bash
export GEMINI_API_KEY="your-gemini-key-here"
export GEMINI_BASE_URL="https://generativelanguage.googleapis.com/v1beta"
export GEMINI_MODEL="gemini-pro"
```

#### Anthropic Claude
```bash
export ANTHROPIC_API_KEY="your-claude-key-here"
export CLAUDE_MODEL="claude-3-sonnet-20240229"
```

#### Azure OpenAI
```bash
export AZURE_OPENAI_API_KEY="your-azure-key"
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
export AZURE_OPENAI_MODEL="gpt-35-turbo"
```

### 2. 重新加载配置
```bash
source ~/.zshrc  # 或 ~/.bashrc
```

### 3. 验证配置
```bash
node src/cli.js chat
```

## 📋 支持的配置方式

### 优先级顺序
1. 环境变量
2. `.env` 文件
3. shell配置文件 (.zshrc, .bashrc等)

### 配置文件示例

#### ~/.zshrc
```bash
# OpenAI配置
export OPENAI_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export OPENAI_BASE_URL="https://api.openai.com/v1"
export OPENAI_MODEL="gpt-4-turbo-preview"

# 可选：自定义基础URL（用于代理或其他提供商）
export OPENAI_BASE_URL="https://api.openai-proxy.com/v1"
```

#### ~/.bashrc
```bash
# Gemini配置
export GEMINI_API_KEY="AIxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export GEMINI_BASE_URL="https://generativelanguage.googleapis.com/v1beta"
export GEMINI_MODEL="gemini-pro"
```

#### 项目根目录 .env
```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-3.5-turbo
```

## 🔧 测试连接

### 检查配置
```bash
# 查看当前配置
node -e "
const { configLoader } = require('./src/utils/config-loader.js');
const config = configLoader.loadConfig();
console.log('Configuration:', configLoader.getConfigSummary(config));
"
```

### 测试API
```bash
# 启动聊天测试
node src/cli.js chat
```

## 🌍 支持的提供商

| 提供商 | API Key变量 | Base URL变量 | 默认模型 |
|--------|-------------|--------------|----------|
| OpenAI | OPENAI_API_KEY | OPENAI_BASE_URL | gpt-3.5-turbo |
| Google Gemini | GEMINI_API_KEY | GEMINI_BASE_URL | gemini-pro |
| Anthropic Claude | ANTHROPIC_API_KEY | - | claude-3-sonnet-20240229 |
| Azure OpenAI | AZURE_OPENAI_API_KEY | AZURE_OPENAI_ENDPOINT | gpt-35-turbo |

## 💡 常见问题

### 1. API Key未找到
```
❌ Failed to initialize API client: API key not found. Please set OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY
```

**解决方法：**
- 检查环境变量是否正确设置
- 确认配置文件已重新加载
- 验证API Key格式是否正确

### 2. 网络连接问题
```
❌ API Error: Network request failed
```

**解决方法：**
- 检查网络连接
- 验证base URL是否正确
- 检查是否需要代理设置

### 3. 权限错误
```
❌ API Error: 401 Unauthorized
```

**解决方法：**
- 确认API Key有效
- 检查API Key权限
- 验证账户余额

## 🎯 高级配置

### 使用代理
```bash
export OPENAI_BASE_URL="https://your-proxy.com/v1"
export OPENAI_API_KEY="your-proxy-key"
```

### 自定义模型
```bash
export OPENAI_MODEL="gpt-4-1106-preview"
export GEMINI_MODEL="gemini-pro-vision"
```

## 🔍 调试技巧

### 查看完整配置
```bash
node -e "
const { configLoader } = require('./src/utils/config-loader.js');
const config = configLoader.loadConfig();
console.log('Full config:', {
  provider: config.provider,
  model: config.model,
  baseUrl: config.baseUrl,
  hasKey: !!config.apiKey
});
"
```

### 环境变量检查
```bash
# 检查是否设置成功
echo $OPENAI_API_KEY
echo $GEMINI_API_KEY
```