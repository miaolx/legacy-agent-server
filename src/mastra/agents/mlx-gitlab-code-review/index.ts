import { Agent } from "@mastra/core/agent";

import { deepSeekModel } from '../../model-provider/deepseek';

import { getMlxGroupJson, getMlxCommentJson } from './tools/get-group-json'
import { groupInstructions } from './instructions'

export const mlxGitlabCodeReviewAgent = new Agent({
  name: 'mlx-code-gitlab-review-agent',
  model: deepSeekModel,
  instructions: groupInstructions,
  tools: {
    getMlxCommentJson,
    getMlxGroupJson
    // prSummary,
  },
})