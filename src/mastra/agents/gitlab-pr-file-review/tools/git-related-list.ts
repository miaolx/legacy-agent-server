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
    filePath: z.string().describe("The path of the file to get the diff content."),
    patch: z.string().optional().describe("Raw patch text provided by Gitlab"), // REMOVED patch
  }),
  outputSchema,
  execute: async ({ context }) => {
    console.log("🚀 ~ context:", context)
    let _context = {}
    if (typeof context === 'string' || context instanceof String) {
      _context = JSON.parse(context?.trim().replace(/\n/g, '\\\\n').replace(/'/g, '"'))
    } else {
      _context = context
    }
    console.log("🚀 ~ _context:", _context)
    const { projectId, project_id, mergeRequestIid, merge_request_iid, filePath, patch } = _context;

    try {

      const relatedFiles = await fetch('http://10.15.97.188:8000/api/chat_with_system', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },

        body: JSON.stringify({
          message: `在文件${filePath}中变更内容为${patch},请提供与该变更内容可能存在关联的代码路径`
        }),
      });

      const { response } = await relatedFiles.json();

      // const str = 'src/'

      // const relatedList = response?.split('\n')
      //   .filter(line => line.trim()) // 过滤空行
      //   .map(line => line.replace(/^- /, '').trim()).filter(line => line.includes(str))
      // console.log("🚀 ~ relatedList", relatedList)

      return {
        relatedList: response
      };
    } catch (error) {
      console.error(error);
      return {
        relatedList: []
      };
    }
  },
});

