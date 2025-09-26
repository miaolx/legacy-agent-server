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
    baseSha: z.string().describe("Base commit SHA"),
    headSha: z.string().describe("Head commit SHA"),
    startSha: z.string().describe("Start commit SHA"),
  }),
  changedFiles: z.array(z.object({
    filename: z.string(),
    old_path: z.string(),
    status: z.enum(['added', 'modified', 'removed', 'renamed']),
    changes: z.number().int(),
    additions: z.number().int(),
    deletions: z.number().int(),
    parse: z.array(z.object({}))
    // patch: z.string().optional().describe("Raw patch text provided by Gitlab"), // REMOVED patch
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
export const countDeletions = (diff: string) => {
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

const getLineType = (line: string) => {
    if (line.startsWith(' ')) return 'context';
    if (line.startsWith('-')) return 'deletion';
    if (line.startsWith('+')) return 'addition';
    if (line.startsWith('\\')) return 'no-newline';
    return 'header';
}

const parseSingleDiff = (diffContent: string) => {
  const lines = diffContent.split('\n');
  const result: any = [];
  let oldLineNumber: any = null;
  let newLineNumber: any = null;
  let currentHunk: any = null;

  lines.forEach((line, index) => {
    if (line.startsWith('@@')) {
      // 解析 hunk 头部，例如：@@ -1,5 +1,6 @@
      const hunkMatch = line.match(/@@ \-(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (hunkMatch) {
        oldLineNumber = parseInt(hunkMatch[1]);
        newLineNumber = parseInt(hunkMatch[3]);

        currentHunk = {
          old_start: oldLineNumber,
          new_start: newLineNumber,
          old_lines: hunkMatch[2] ? parseInt(hunkMatch[2]) : 1,
          new_lines: hunkMatch[4] ? parseInt(hunkMatch[4]) : 1,
          lines: []
        };
      }
    } else if (currentHunk) {
      const lineType = getLineType(line);
      const content = line.substring(1); // 移除前缀字符

      const lineInfo = {
        type: lineType,
        content: content,
        old_line: null,
        new_line: null,
        line_number: index + 1
      };

      switch (lineType) {
        case 'context':
          lineInfo.old_line = oldLineNumber;
          lineInfo.new_line = newLineNumber;
          oldLineNumber++;
          newLineNumber++;
          break;

        case 'deletion':
          lineInfo.old_line = oldLineNumber;
          oldLineNumber++;
          break;

        case 'addition':
          lineInfo.new_line = newLineNumber;
          newLineNumber++;
          break;

        case 'no-newline':
          // 特殊标记，不增加行号
          break;
      }

      currentHunk.lines.push(lineInfo);
      result.push(lineInfo);
    }
  });

  return result;
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
        baseSha: prData.diff_refs.base_sha,
        headSha: prData.diff_refs.head_sha,
        startSha: prData.diff_refs.start_sha,
        projectId,
        mergeRequestIid,
        associatedIssues,
      }

      // 3. changed files
      const files = filesResponse.changes.map(f => ({
        filename: f.new_path,
        old_path: f.old_path,
        status: getChangeType(f) as 'added' | 'modified' | 'removed' | 'renamed',
        changes: countAdditions(f.diff) + countDeletions(f.diff),
        additions: countAdditions(f.diff),
        deletions: countDeletions(f.diff),
        parse: parseSingleDiff(f.diff)
        // patch: f.diff
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
