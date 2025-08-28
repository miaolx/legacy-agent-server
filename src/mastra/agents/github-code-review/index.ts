import { Agent } from "@mastra/core/agent";

import { deepSeekModel } from '../../model-provider/deepseek';
import { codeReviewInstructions } from "./instructions";
import { codeReviewTools } from "./tools";

import { getDiffsContent } from '../github-review-group/tools/get-diffs-content'
import { getFileContent } from '../github-review-group/tools/get-file-content'
import { fileComment } from "../github-review-group/tools/file-comment";

export const codeReviewAgent = new Agent({
  name: "github-code-review-agent", // Descriptive name
  model: deepSeekModel, // Use an appropriate LLM
  instructions: codeReviewInstructions,
  tools: {
    ...codeReviewTools,
    getDiffsContent,
    getFileContent,
    fileComment
  },
});
