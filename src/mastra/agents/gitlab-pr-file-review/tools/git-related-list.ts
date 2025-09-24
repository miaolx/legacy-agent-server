import { Tool } from "@mastra/core/tools";
import { z } from "zod";

const outputSchema = z.object({
  relatedList: z.array(z.string()).describe('Related filePath of the input filePath'),
})

export const getRelatedList = new Tool({
  id: "getRelatedList",
  description: "Fetches the related list of the changed files in the pull request.",
  inputSchema: z.object({
    projectId: z.string().describe("The projectId of the repository"),
    mergeRequestIid: z.number().describe("The name of the mergeRequest (e.g., 1)."),
    filePath: z.array(z.string()).describe("The path of the file to get the diff content."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    let _context = {}
    if (typeof context === 'string' || context instanceof String) {
      _context = JSON.parse(context?.trim().replace(/'/g, '"').replace(/(\w+):/g, '"$1":'))
    } else {
      _context = context
    }
    const { projectId, project_id, mergeRequestIid, merge_request_iid, filePath } = _context;

    try {

      const relatedFiles = await fetch('http://10.15.97.188:8000/api/chat_with_system', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },

        body: JSON.stringify({
          message: `获取${filePath}文件在mergeRequestIid为${mergeRequestIid}合并请求中的修改内容，依赖与被依赖的文件路径，用列表格式返回`
        }),
      });

      const { response } = await relatedFiles.json();

      const str = 'src/'

      const relatedList = response?.split('\n')
        .filter(line => line.trim()) // 过滤空行
        .map(line => line.replace(/^- /, '').trim()).filter(line => line.includes(str))
      console.log("🚀 ~ relatedList", relatedList)

      return {
        relatedList: relatedList
      };
    } catch (error) {
      console.error(error);
      return {
        relatedList: []
      };
    }
  },
});

