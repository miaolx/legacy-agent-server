import { GitlabAPI } from "../../../lib/gitlab"
import { Tool } from "@mastra/core/tools";
import { z } from "zod";

const inputSchema = z.object({
  projectId: z.string().describe("The projectId of the repository"),
  mergeRequestIid: z.number().describe("The name of the mergeRequest (e.g., 1)."),
  commit_id: z.string().describe("The SHA of the commit the comment applies to (usually the PR's head SHA)."),
  path: z.string().describe("The relative path to the file being commented on."),
  line: z.number().int().positive().describe("The line number **in the pull request diff view** that the comment applies to. This is NOT the line number in the source file itself."),
  body: z.string().describe("The text of the review comment."),
});

const outputSchema = z.object({
  success: z.boolean().describe("Whether the comment was posted successfully."),
  comment_url: z.string().optional().describe("The URL of the posted comment, if successful."),
  error: z.string().optional().describe("An error message, if the operation failed."),
});

export const fileComment = new Tool({
  id: "file_comment",
  description: "Posts a review comment on a specific line in a specific file of a pull request diff.",
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { projectId, mergeRequestIid, commit_id, path, line, body } = context;

    try {
      const response = await GitlabAPI.MergeRequestDiscussions.create(projectId, mergeRequestIid, body);

      if (response.status === 201) {
        return {
          success: true,
          comment_url: response.html_url,
        };
      } else {
        // Although createReviewComment typically throws on non-201, handle defensively
        return {
          success: false,
          error: `Failed to post comment. Status: ${response.status}`,
        };
      }
    } catch (error) {
      console.error("Error posting review comment:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred while posting review comment.",
      };
    }
  },
}); 