import { Agent } from "@mastra/core/agent";

import { deepSeekModel } from '../../model-provider/deepseek';

import { getMlxGroupJson, getMlxCommentJson } from './tools/get-group-json'
import { groupInstructions } from './instructions'
import { fileComment } from "../gitlab-pr-review/tools/file-comment";

export const mlxGitlabCodeReviewAgent = new Agent({
  name: 'mlx-code-gitlab-review-agent',
  model: deepSeekModel,
  instructions: groupInstructions,
  tools: {
    getMlxCommentJson,
    getMlxGroupJson,
    fileComment
    // prSummary,
  },
})