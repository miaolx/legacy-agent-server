import { GithubAPI } from "../../../lib/github";
import { GitlabAPI } from "../../../lib/gitlab"
import { Tool } from "@mastra/core/tools";
import { z } from "zod";

// Define the structure for the output
const outputSchema = z.object({
  metadata: z.object({
    title: z.string(),
    description: z.string().nullable(),
    author: z.string().nullable(),
    url: z.string().url(),
    state: z.enum(["opened", "closed"]),
    number: z.number().int(),
    baseRef: z.string().describe("Base branch name"),
    headRef: z.string().describe("Head branch name"),
    headSha: z.string().describe("Head commit SHA"),
  }),
  changedFiles: z.array(z.object({
    filename: z.string(),
    status: z.enum(['added', 'modified', 'removed', 'renamed']),
    changes: z.number().int(),
    additions: z.number().int(),
    deletions: z.number().int(),
    patch: z.string().optional().describe("Raw patch text provided by Gitlab"), // REMOVED patch
  })).describe("Files changed in the PR (metadata only, no patch content)"),
  commits: z.array(z.object({
    message: z.string(),
    date: z.string().nullable(),
  })).describe("Commits messages with the PR"),
  // rawDiff: z.string().describe("The full raw diff text for the PR."), // REMOVED rawDiff
}).or(z.object({ // Error case
  ok: z.literal(false),
  message: z.string().describe("Error message"),
}));

export const countAdditions = (diff: string) => {
  const additions = diff.match(/^\+[^+]/gm);
  return additions ? additions.length : 0;
}

// 计算删除行数
export const countDeletions = (diff: string) =>  {
  const deletions = diff.match(/^-[^-]/gm);
  return deletions ? deletions.length : 0;
}

export const getChangeType = (change: any) => {
  if (change.new_path && !change.old_path) {
    return 'added'; // 新增文件
  } else if (!change.new_path && change.old_path) {
    return 'removed'; // 删除文件
  } else if (change.new_path !== change.old_path) {
    return 'renamed'; // 重命名文件
  } else if (change.new_file) {
    return 'added'; // 新文件
  } else if (change.deleted_file) {
    return 'removed'; // 删除的文件
  } else {
    return 'modified'; // 修改的文件
  }
}

export const getPrDetail = new Tool({
  id: "getPrDetail",
  description: "Fetches comprehensive details for a specific Pull Request, including metadata, associated issues, comments, a list of changed files (WITHOUT the full diff or file patches), and commit messages.", // UPDATED description
  inputSchema: z.object({
    projectId: z.string().describe("The projectId of the repository"),
    mergeRequestIid: z.number().describe("The name of the mergeRequest (e.g., 1)."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { projectId, mergeRequestIid } = context;
    console.log("🚀 ~ projectId, mergeRequestIid:", projectId, mergeRequestIid)

    try {
      // 1. Concurrently fetch PR metadata, files, and commits
      const [prResponse, filesResponse, commitsResponse] = await Promise.all([
        GitlabAPI.MergeRequests.show(projectId, mergeRequestIid),
        GitlabAPI.MergeRequests.showChanges(projectId, mergeRequestIid),
        GitlabAPI.MergeRequests.allCommits(projectId, mergeRequestIid),
      ]);

      // 2. metadata and associated issues
      const prData: any = prResponse;
      // if (prData) {
      const associatedIssues: any[] = [];
      const metadata = {
        title: prData.title,
        description: prData.description ?? null,
        author: prData.author?.username ?? null,
        url: prData.web_url,
        state: prData.state as "opened" | "closed",
        number: prData.iid,
        baseRef: prData.target_branch,
        headRef: prData.source_branch,
        headSha: prData.diff_refs.head_sha,
        projectId,
        mergeRequestIid,
        associatedIssues,
      }

      // 3. changed files
      const files = filesResponse.changes.map(f => ({
        filename: f.new_path,
        status: getChangeType(f) as 'added' | 'modified' | 'removed' | 'renamed',
        changes: countAdditions(f.diff) + countDeletions(f.diff),
        additions: countAdditions(f.diff),
        deletions: countDeletions(f.diff),
        patch: f.diff
      }));

      // 4. commits messages
      const commits = commitsResponse.map(c => ({
        message: c.message,
        date: c.committed_date ?? null,
      }));


      return {
        metadata,
        changedFiles: files,
        commits,
      };
    } catch (error: any) {
      console.error(`Error fetching details for PR #${mergeRequestIid} in ${projectId}:`, error);
      let message = "Failed to fetch pull request details.";
      if (error.status === 404) {
        message = `Pull Request #${mergeRequestIid} not found in ${projectId}.`;
      } else if (error.status === 403 || error.status === 401) {
        message = `Permission denied fetching details for PR #${mergeRequestIid}. Check GITHUB_TOKEN permissions.`;
      } else if (error instanceof Error) {
        message = error.message;
      }
      // Handle potential errors from Promise.all if one of the core requests fails
      // This catch block will handle errors from the initial Promise.all
      return {
        ok: false as const,
        message: message,
      };
    }
  },
});
