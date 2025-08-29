import { Tool } from "@mastra/core/tools";
import { z } from "zod";

import { GroupChangedFilesOutputSchema } from '../../github-pr-groups-builder/tools/group-changed-files'

const outputSchema = z.object({
  metadata: z.object({
    title: z.string(),
    description: z.string().nullable(),
    author: z.string().nullable(),
    url: z.string().url(),
    state: z.enum(["open", "closed"]),
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
  issueBodies: z.object({}).describe("Map from Issue number to content/null"),
  summaryCommitsMsg: z.string().describe("summary of commits message"),
  reviewGroups: GroupChangedFilesOutputSchema
})

export const getMlxGroupJson = new Tool({
  id: 'getMlxGroupJson',
  description: 'final output **must** be a well-formatted JSON object. It contains the aggregated PR context information: metadata, issueBodies, reviewGroups.',
  inputSchema: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pull_number: z.number().describe("Pull Request number"),
  }),
  outputSchema: outputSchema.describe("structured file grouping result"),
  execute: async ({ context, mastra }) => {
    const agent = mastra.getAgent("gitlabPrGroupsBuilderAgent");
    try {
      const response = await agent.generate(JSON.stringify(context));
      const groupJson = response!.text?.split("```json")[1].replace("```", "")

      return groupJson
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log("🚀 ~ execute: ~ errorMessage:", errorMessage)
      return {
        error: `Failed to review file via HTTP: ${errorMessage}`
      };
    }
  },
})

export const getMlxCommentJson = new Tool({
  id: 'getMlxGommentJson',
  inputSchema: outputSchema.describe("structured file grouping result"),
  outputSchema: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pull_number: z.number().describe("Pull Request number"),
    commit_id: z.string().describe("commit id"),
    path: z.string().describe("change file path"),
    line: z.number().describe("change code line"),
    body: z.number().describe("your comment"),
  }),
  execute: async ({ context, mastra }) => {
    const agent = mastra.getAgent("gitlabReviewGroupAgent");
    try {
      const response = await agent.generate(JSON.stringify(context));
      console.log("🚀 ~ response:", response)
      return response!.text
    } catch (error: any){
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log("🚀 ~ execute: ~ errorMessage:", errorMessage)
      return {
        error: `Failed to review file via HTTP: ${errorMessage}`
      };
    }
  }
})