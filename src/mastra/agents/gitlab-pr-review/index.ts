import { Agent } from "@mastra/core/agent";

import { deepSeekModel, qwModel } from '../../model-provider/deepseek';
import { reviewGroupInstructions } from "./instructions";
import { fileComment } from "./tools/file-comment";
import { getFileContent } from "./tools/get-file-content";
import { getDiffsContent } from "./tools/get-diffs-content";

export const gitlabReviewGroupAgent = new Agent({
  name: "gitlab-review-group-agent",
  model: qwModel,
  instructions: reviewGroupInstructions,
  tools: {
    // fileComment,
    getFileContent,
    getDiffsContent,
  },
});
