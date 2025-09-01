import { GitlabAPI } from "../../../lib/gitlab"
import { Tool } from "@mastra/core/tools";
import { z } from "zod";

const outputSchema = z.object({
  diff_files_content: z.array(z.object({
    filename: z.string(),
    status: z.enum(['added', 'modified', 'removed', 'renamed']),
    changes: z.number().int(),
    additions: z.number().int(),
    deletions: z.number().int(),
    patch: z.string().optional().describe("Raw patch text provided by GitHub"),
  })).describe('The diff content of the changed files in the pull request.'),
})

export const getDiffsContent = new Tool({
  id: "getDiffsContent",
  description: "Fetches the diff content of the changed files in the pull request.",
  inputSchema: z.object({
    projectId: z.string().describe("The projectId of the repository"),
    mergeRequestIid: z.number().describe("The name of the mergeRequest (e.g., 1)."),
    changed_file_paths: z.array(z.string()).describe("The path of the file to get the diff content."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { projectId, mergeRequestIid, changed_file_paths } = context;

    try {
      const filesResponse = await GitlabAPI.MergeRequests.showChanges(projectId, mergeRequestIid);
      const files = filesResponse.changes.map(f => ({
        filename: f.new_path,
        status: f.status as 'added' | 'modified' | 'removed' | 'renamed',
        changes: f.diff,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch
      }));

      const filteredFiles = files.filter(f => changed_file_paths.includes(f.filename));

      return {
        diff_files_content: filteredFiles,
      };
    } catch (error) {
      console.error(error);
      return {
        diff_files_content: [],
      };
    }
  },
});

