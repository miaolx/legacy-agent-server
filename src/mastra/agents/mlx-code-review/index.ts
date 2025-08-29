import { Agent } from "@mastra/core/agent";

import { deepSeekModel } from '../../model-provider/deepseek';
import { getPrDetail } from "../github-pr-groups-builder/tools/get-pr-detail";
import { getGithubActionArtifactContent } from "../github-pr-groups-builder/tools/get-action-artifact";
import { groupChangedFiles } from "../github-pr-groups-builder/tools/group-changed-files";
import { getIssueDetail } from "../github-pr-groups-builder/tools/get-issues-detail";
import { getFileContent } from "../github-review-group/tools/get-file-content";
import { getDiffsContent } from "../github-review-group/tools/get-diffs-content";
import { fileComment } from "../github-review-group/tools/file-comment";

import { getMlxGroupJson } from './tools/get-group-json'
import { groupInstructions } from './instructions'

export const mlxCodeReviewAgent = new Agent({
  name: 'mlx-code-review-agent',
  model: deepSeekModel,
  instructions: groupInstructions,
  tools: {
    getPrDetail,
    getGithubActionArtifactContent,
    groupChangedFiles,
    getIssueDetail,
    getFileContent,
    getDiffsContent,
    fileComment,
    getMlxGroupJson
    // prSummary,
  },
})