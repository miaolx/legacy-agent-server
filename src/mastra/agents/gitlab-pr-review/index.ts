import { Agent } from "@mastra/core/agent";

import { dzhModel, qwModel } from '../../model-provider/deepseek';
import { reviewGroupInstructions } from "./instructions";
import { getFileContent } from "./tools/get-file-content";
import { getDiffsContent } from "./tools/get-diffs-content";

export const gitlabReviewGroupAgent = new Agent({
  name: "gitlab-review-group-agent",
  model: qwModel,
  instructions: reviewGroupInstructions,
  tools: {
    getFileContent,
    getDiffsContent,
  },
});
