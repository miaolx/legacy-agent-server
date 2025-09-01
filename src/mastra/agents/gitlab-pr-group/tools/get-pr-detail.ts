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
    associatedIssues: z.array(z.object({
      number: z.number().int(),
      title: z.string(),
      url: z.string().url(),
      state: z.string(),
    })).describe("Issues linked to the PR"),
  }),
  files: z.array(z.object({
    filename: z.string(),
    status: z.enum(['added', 'modified', 'removed', 'renamed']),
    changes: z.number().int(),
    additions: z.number().int(),
    deletions: z.number().int(),
    // patch: z.string().optional().describe("Raw patch text provided by GitHub"), // REMOVED patch
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
      const associatedIssues: { number: number, title: string, url: string, state: string }[] = [];
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
        status: f.status as 'added' | 'modified' | 'removed' | 'renamed',
        changes: f.diff,
        additions: f.additions,
        deletions: f.deletions,
      }));

      // 4. commits messages
      const commits = commitsResponse.map(c => ({
        message: c.message,
        date: c.committed_date ?? null,
      }));

      return {
        metadata,
        files,
        commits,
        // rawDiff, // REMOVED rawDiff field
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


// Find and concurrently fetch associated issues
const getAssociatedIssues = async (prData: any, owner: string, repo: string) => {
  const issueRegex = /#(\d+)/g;
  const linkedIssueNumbers = new Set<number>();
  if (prData.body) {
    let match;
    while ((match = issueRegex.exec(prData.body)) !== null) {
      linkedIssueNumbers.add(parseInt(match[1], 10));
    }
  }

  const associatedIssues: { number: number, title: string, url: string, state: string }[] = [];
  if (linkedIssueNumbers.size > 0) {
    const issuePromises = Array.from(linkedIssueNumbers).map(issueNumber =>
      GithubAPI.rest.issues.get({ owner, repo, issue_number: issueNumber })
    );

    // Use Promise.allSettled to handle both fulfilled and rejected promises
    const issueResults = await Promise.allSettled(issuePromises);

    issueResults.forEach(result => {
      if (result.status === 'fulfilled') {
        const issueData = result.value.data; // Access result.value.data for fulfilled promises
        associatedIssues.push({
          number: issueData.number,
          title: issueData.title,
          url: issueData.html_url,
          state: issueData.state,
        });
      } else { // result.status === 'rejected'
        // Need to extract issueNumber from the rejection reason if possible,
        // but the original error object doesn't directly contain it.
        // We can log the error reason directly.
        const error = result.reason;
        // Log the error but continue processing other issues
        // Attempt to get more details from the error if it's an Octokit error
        const issueNumberStr = error?.request?.url?.match(/issues\/(\d+)/)?.[1] || 'unknown';
        console.warn(`Could not fetch details for linked issue #${issueNumberStr} in ${owner}/${repo}: ${error?.message || error}`);
        // Optionally add a placeholder or skip the issue
      }
    });
  }
  return associatedIssues;
}
