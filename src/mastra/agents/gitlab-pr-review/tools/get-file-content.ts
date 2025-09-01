import { GitlabAPI } from "../../../lib/gitlab"
import { Tool } from "@mastra/core/tools";
import { z } from "zod";

const inputSchema = z.object({
  projectId: z.string().describe("The projectId of the repository"),
  mergeRequestIid: z.number().describe("The name of the mergeRequest (e.g., 1)."),
  path: z.string().describe("The file path to fetch content for"),
  headRef: z
    .string()
    .describe(
      "The name of the commit/branch/tag. Default: the repository's default branch."
    ),
});

const outputSchema = z.union([
  z
    .object({
      ok: z.literal(true),
      content: z.string().describe("The decoded content of the file"),
    })
    .describe("The success object"),
  z
    .object({
      ok: z.literal(false),
      messsage: z
        .string()
        .describe("An optional error message of what went wrong"),
    })
    .describe("The error/failed object"),
]);

export const getFileContent = new Tool({
  id: "fetchFileContent",
  description:
    "Fetch file content from GitHub, decode it, and update the database",
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { projectId, path, headRef } = context;
    // console.log("🚀 ~ context:", context)

    try {
      const response = await GitlabAPI.RepositoryFiles.show(projectId, path, headRef);

      if (Array.isArray(response)) {
        return {
          ok: false as const,
          messsage: `Path ${path} points to a directory, not a file`,
        };
      }

      if (!("content" in response)) {
        return {
          ok: false as const,
          messsage: `No content available for file ${path}`,
        };
      }

      let content: string;
      try {
        content = Buffer.from(response.content, "base64").toString(
          "utf-8",
        );
      } catch (error) {
        return {
          ok: false as const,
          messsage: error instanceof Error ? error.message : "Unkown error",
        };
      }

      return {
        ok: true as const,
        content,
      };
    } catch (error) {
      console.error("Error fetching file content:", error);
      return {
        ok: false as const,
        messsage: error instanceof Error ? error.message : "Unkown error",
      };
    }
  },
});
