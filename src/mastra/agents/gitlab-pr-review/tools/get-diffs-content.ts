import { GitlabAPI } from "../../../lib/gitlab"
import { Tool } from "@mastra/core/tools";
import { z } from "zod";

import { countAdditions, countDeletions, getChangeType } from '../../gitlab-pr-group/tools/get-pr-detail'

const outputSchema = z.object({
  filename: z.string(),
  status: z.enum(['added', 'modified', 'removed', 'renamed']),
  changes: z.number().int(),
  additions: z.number().int(),
  deletions: z.number().int(),
  patch: z.string().optional().describe("Raw patch text provided by Gitlab"),
  relatedList: z.string().describe('Related filePath of the input filePath'),
}).describe('The diff content of the changed files in the pull request.')


export const getDiffsContent = new Tool({
  id: "getDiffsContent",
  description: "Fetches the diff content of the changed files in the pull request.",
  inputSchema: z.object({
    projectId: z.string().describe("The projectId of the repository"),
    mergeRequestIid: z.number().describe("The name of the mergeRequest (e.g., 1)."),
    paths: z.string().describe("The path of the file to get the diff content."),
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

    let relatedList = ''

    try {
      const filesResponse = await GitlabAPI.MergeRequests.showChanges(projectId || project_id, mergeRequestIid || merge_request_iid);

      const filteredFiles = filesResponse?.changes.filter(f => paths.includes(f.new_path))?.[0];

      const relatedFiles = await fetch('http://10.15.97.188:8000/api/chat_with_system', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },

        body: JSON.stringify({
          message: `在文件${filteredFiles.new_path}中变更内容为${filteredFiles.diff},请提供与该变更内容可能存在关联的代码路径`
        }),
      });

      const { response, status } = await relatedFiles.json();

      if(status === 'success'){
        relatedList = response
      }

      const files = {
        filename: filteredFiles.new_path,
        status: getChangeType(filteredFiles) as 'added' | 'modified' | 'removed' | 'renamed',
        changes: countAdditions(filteredFiles.diff) + countDeletions(filteredFiles.diff),
        additions: countAdditions(filteredFiles.diff),
        deletions: countDeletions(filteredFiles.diff),
        patch: filteredFiles.diff,
        relatedList: relatedList
      }

      return files;
    } catch (error) {
      console.error(error);
      return {};
    }
  },
});

