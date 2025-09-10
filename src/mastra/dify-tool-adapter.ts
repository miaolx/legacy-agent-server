import { Tool } from '@mastra/core/tools';
import { getGithubActionArtifactContent } from './agents/gitlab-pr-group/tools/get-action-artifact';
import { groupChangedFiles } from './agents/gitlab-pr-group/tools/group-changed-files';
import { getPrDetail } from './agents/gitlab-pr-group/tools/get-pr-detail';

// 为了解决类型不匹配的问题，我们使用类型断言来绕过严格的类型检查。
// 在实际生产环境中，应确保 Tool 类型定义的一致性。
type AnyTool = Tool<any, any, any>;

/**
 * 将 Mastra 工具适配为 Dify 可识别的工具格式。
 * @param mastraTool - 一个已定义的 Mastra 工具实例。
 * @returns 符合 Dify 自定义工具规范的对象。
 */
export const createDifyTool = (mastraTool: AnyTool) => {
  // 将 Zod Schema 转换为 JSON Schema (简化版)
  // 实际应用中可能需要更完整的 zod-to-json-schema 库
  const convertZodToJSONSchema = (schema: any): any => {
    if (schema._def.typeName === 'ZodObject') {
      const shape = schema.shape;
      const properties: Record<string, any> = {};
      Object.keys(shape).forEach(key => {
        const fieldSchema = shape[key];
        properties[key] = {
          type: fieldSchema._def.typeName.replace('Zod', '').toLowerCase(),
          description: fieldSchema.description || key,
        };
      });
      return {
        type: 'object',
        properties,
        required: Object.keys(shape),
      };
    }
    return { type: 'object' }; // 默认回退
  };

  return {
    // Dify 所需的顶层属性
    name: (mastraTool as any).metadata?.name || mastraTool.id,
    description: mastraTool.description,
    parameters: convertZodToJSONSchema(mastraTool.inputSchema),

    // 核心执行逻辑：将 Dify 的调用转发给 Mastra 工具
    execute: async (params: Record<string, any>) => {
      try {
        // Mastra 工具期望 { context } 结构
        if (typeof mastraTool.execute !== 'function') {
          throw new Error('The provided Mastra tool does not have an execute method.');
        }
        const result = await mastraTool.execute({ context: params });
        return result;
      } catch (error: any) {
        console.error(`Error executing adapted tool ${mastraTool.id}:`, error);
        throw new Error(`Tool execution failed: ${error.message}`);
      }
    },
  };
};

// --- 适配具体的 Mastra 工具 ---
// 注意：在实际使用时，需要在这里导入具体的工具实例

// 示例：假设我们从相应路径导出了工具
// import { getGithubActionArtifactContent } from './agents/gitlab-pr-group/tools/get-action-artifact';
// import { groupChangedFiles } from './agents/gitlab-pr-group/tools/group-changed-files';

// export const difyGetGithubActionArtifactContent = createDifyTool(getGithubActionArtifactContent);
// export const difyGroupChangedFiles = createDifyTool(groupChangedFiles);

// --- 实际适配具体的 Mastra 工具 ---

// 导入需要被适配的工具实例


// 创建可供 Dify 调用的适配后工具
// 创建可供 Dify 调用的适配后工具
export const difyGetGithubActionArtifactContent = createDifyTool(getGithubActionArtifactContent as AnyTool);
export const difyGroupChangedFiles = createDifyTool(groupChangedFiles as AnyTool);
export const difyGetPrDetail = createDifyTool(getPrDetail as AnyTool);