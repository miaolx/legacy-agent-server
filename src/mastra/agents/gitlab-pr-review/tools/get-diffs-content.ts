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

    try {
      const filesResponse = await GitlabAPI.MergeRequests.showChanges(projectId || project_id, mergeRequestIid || merge_request_iid);

      const filteredFiles = filesResponse?.changes.filter(f => paths.includes(f.new_path))?.[0];

      const files = {
        filename: filteredFiles.new_path,
        status: getChangeType(filteredFiles) as 'added' | 'modified' | 'removed' | 'renamed',
        changes: countAdditions(filteredFiles.diff) + countDeletions(filteredFiles.diff),
        additions: countAdditions(filteredFiles.diff),
        deletions: countDeletions(filteredFiles.diff),
        patch: filteredFiles.diff
      }

      return files;
    } catch (error) {
      console.error(error);
      return {};
    }
  },
});

