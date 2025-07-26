#!/usr/bin/env node

import { configLoader } from './src/utils/config-loader.js';

const config = configLoader.loadConfig();
const summary = configLoader.getConfigSummary(config);

console.log('🔍 当前API配置检查');
console.log('==================');
console.log('提供商:', config.provider);
console.log('模型:', config.model);
console.log('Base URL:', config.baseUrl);
console.log('有API Key:', summary.hasApiKey);
console.log('');

if (!config.apiKey) {
  console.log('❌ 未找到API Key！');
  console.log('');
  console.log('📋 配置方法：');
  console.log('1. OpenAI: export OPENAI_API_KEY="sk-your-key"');
  console.log('2. Gemini: export GEMINI_API_KEY="your-key"');
  console.log('3. Claude: export ANTHROPIC_API_KEY="your-key"');
  console.log('');
  console.log('💡 添加到 ~/.zshrc 或 ~/.bashrc 后执行: source ~/.zshrc');
} else {
  console.log('✅ API Key 已配置');
  
  // 测试实际API连接
  console.log('');
  console.log('🌍 测试API连接...');
  
  try {
    const testResponse = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.provider === 'openai' && { 'Authorization': `Bearer ${config.apiKey}` }),
        ...(config.provider === 'gemini' && { 'x-goog-api-key': config.apiKey }),
        ...(config.provider === 'claude' && { 'x-api-key': config.apiKey })
      },
      body: JSON.stringify({
        ...(config.provider === 'openai' && {
          model: config.model,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10
        }),
        ...(config.provider === 'gemini' && {
          contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
          generationConfig: { maxOutputTokens: 10 }
        }),
        ...(config.provider === 'claude' && {
          model: config.model,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10
        })
      })
    });
    
    console.log('✅ API连接成功！');
    console.log('响应状态:', testResponse.status);
    
  } catch (error) {
    console.log('❌ API连接失败:', error.message);
    console.log('');
    console.log('🔧 可能的解决方案：');
    console.log('1. 检查网络连接');
    console.log('2. 验证API Key是否正确');
    console.log('3. 确认Base URL是否正确');
    
    // 显示正确的配置
    if (config.provider === 'claude') {
      console.log('');
      console.log('💡 Claude API配置：');
      console.log('export ANTHROPIC_API_KEY="sk-ant-api03-..."');
      console.log('export CLAUDE_MODEL="claude-3-sonnet-20240229"');
    }
  }
}

console.log('');
console.log('🎯 推荐配置：');
console.log('');
console.log('OpenAI (最简单):');
console.log('echo \'export OPENAI_API_KEY="sk-your-key-here"\' >> ~/.zshrc');
console.log('echo \'export OPENAI_MODEL="gpt-3.5-turbo"\' >> ~/.zshrc');
console.log('source ~/.zshrc');
console.log('');
console.log('Google Gemini:');
console.log('echo \'export GEMINI_API_KEY="your-gemini-key"\' >> ~/.zshrc');
console.log('echo \'export GEMINI_MODEL="gemini-pro"\' >> ~/.zshrc');
console.log('source ~/.zshrc');