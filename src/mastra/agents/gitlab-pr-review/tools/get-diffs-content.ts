import { GitlabAPI } from "../../../lib/gitlab"
import { Tool } from "@mastra/core/tools";
import { z } from "zod";

import { countAdditions, countDeletions, getChangeType } from '../../gitlab-pr-group/tools/get-pr-detail'

const outputSchema = z.object({
  diffFilesContent: z.array(z.object({
    filename: z.string(),
    status: z.enum(['added', 'modified', 'removed', 'renamed']),
    changes: z.number().int(),
    additions: z.number().int(),
    deletions: z.number().int(),
    patch: z.string().optional().describe("Raw patch text provided by Gitlab"),
  })).describe('The diff content of the changed files in the pull request.'),
  relatedList: z.array(z.string()).describe('Related filePath of the input paths'),
})

export const getDiffsContent = new Tool({
  id: "getDiffsContent",
  description: "Fetches the diff content of the changed files in the pull request.",
  inputSchema: z.object({
    projectId: z.string().describe("The projectId of the repository"),
    mergeRequestIid: z.number().describe("The name of the mergeRequest (e.g., 1)."),
    paths: z.array(z.string()).describe("The path of the file to get the diff content."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    console.log("getDiffsContent ~ context:", context)
    let _context = {}
    if (typeof context === 'string' || context instanceof String) {
      _context = JSON.parse(context?.trim().replace(/'/g, '"').replace(/(\w+):/g, '"$1":'))
    } else {
      _context = context
    }
    console.log("🚀 ~  _context:", _context)
    const { projectId, project_id, mergeRequestIid, merge_request_iid, paths } = _context;

    try {
      const filesResponse = await GitlabAPI.MergeRequests.showChanges(projectId || project_id, mergeRequestIid || merge_request_iid);

      const files = filesResponse?.changes.map(f => ({
        filename: f.new_path,
        status: getChangeType(f) as 'added' | 'modified' | 'removed' | 'renamed',
        changes: countAdditions(f.diff) + countDeletions(f.diff),
        additions: countAdditions(f.diff),
        deletions: countDeletions(f.diff),
        patch: f.diff
      }));

      const filteredFiles = files.filter(f => paths.includes(f.filename));
      
      // const relatedFiles = await fetch('http://10.15.97.188:8000/api/chat_with_system', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Accept': 'application/json',
      //   },

      //   body: JSON.stringify({
      //     message: `获取${paths}文件在mergeRequestIid为${mergeRequestIid}合并请求中的修改内容，依赖与被依赖的文件路径，用列表格式返回`
      //   }),
      // });

      // const { response } = await relatedFiles.json();

      // const str = 'src/'

      // const relatedList = response?.split('\n')
      //   .filter(line => line.trim()) // 过滤空行
      //   .map(line => line.replace(/^- /, '').trim()).filter(line => line.includes(str))
      // console.log("🚀 ~ relatedList", relatedList)

      return {
        diffFilesContent: filteredFiles,
        // relatedList: relatedList
      };
    } catch (error) {
      console.error(error);
      return {
        diffFilesContent: [],
        relatedList: []
      };
    }
  },
});

