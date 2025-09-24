import { Agent } from "@mastra/core/agent";

import { dzhModel, qwModel } from '../../model-provider/deepseek';
import { reviewGroupInstructions } from "./instructions";
import { getFileContent } from "../gitlab-pr-review/tools/get-file-content";
import { getDiffsContent } from "../gitlab-pr-review/tools/get-diffs-content";

import { getRelatedList } from './tools/git-related-list'

export const gitlabReviewSingleAgent = new Agent({
  name: "gitlab-review-single-agent",
  model: dzhModel,
  instructions: reviewGroupInstructions,
  tools: {
    getRelatedList,
    getFileContent,
    getDiffsContent,
  },
});