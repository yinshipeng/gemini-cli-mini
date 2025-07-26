import OpenAI from 'openai';
import chalk from 'chalk';

/**
 * Unified AI Client using OpenAI SDK
 * Supports OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL configuration
 */
export class UnifiedAIClient {
  constructor() {
    this.initializeClient();
  }

  initializeClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
    });

    this.model = model;
    
    console.log(chalk.blue(`🔧 Configured for OpenAI: ${baseURL} with model ${model}`));
  }

  /**
   * Send message to AI and get response
   * @param {Array} messages - Array of message objects with role and content
   * @param {Array} tools - Optional array of tool definitions
   * @returns {Promise<Object>} Response object with text and tool_calls
   */
  async sendMessage(messages, tools = []) {
    try {
      const params = {
        model: this.model,
        messages: messages.map(msg => {
          // Ensure content is always a string
          let content = msg.content;
          if (typeof content !== 'string') {
            content = JSON.stringify(content);
          }
          
          return {
            role: msg.role,
            content: content
          };
        }),
        max_tokens: 4000,
        temperature: 0.7,
      };

      if (tools && tools.length > 0) {
        // Format tools for OpenAI API
        params.tools = tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        }));
        params.tool_choice = 'auto';
      }

      const response = await this.client.chat.completions.create(params);
      
      const message = response.choices[0]?.message;
      if (!message) {
        throw new Error('No response from AI');
      }

      return {
        text: message.content || '',
        tool_calls: message.tool_calls?.map(toolCall => ({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments || '{}')
        })) || []
      };
    } catch (error) {
      console.error('OpenAI API Error:', error.message);
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  /**
   * Get current configuration
   * @returns {Object} Configuration summary
   */
  getConfig() {
    return {
      provider: 'OpenAI',
      model: this.model,
      baseURL: this.client.baseURL
    };
  }
}