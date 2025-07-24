/**
 * READ_FILE_TOOL: 文件读取工具
 * 
 * 最简化的文件读取工具，演示工具系统的基本结构
 */

export class ReadFileTool {
  name = 'read_file';
  displayName = 'Read File';
  description = 'Read the contents of a file at the specified path';
  
  schema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path to the file to read'
      }
    },
    required: ['path']
  };

  async execute(params) {
    try {
      const { readFileSync } = await import('fs');
      const content = readFileSync(params.path, 'utf8');
      
      return {
        success: true,
        content: content,
        summary: `Read ${content.length} characters from ${params.path}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}