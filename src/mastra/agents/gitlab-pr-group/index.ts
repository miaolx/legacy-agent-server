import { Agent } from "@mastra/core/agent";

import { deepSeekModel, dzhModel } from '../../model-provider/deepseek';
import { prGroupsBuilderInstructions } from "./instructions";
import { getPrDetail } from "./tools/get-pr-detail";
import { getGithubActionArtifactContent } from "./tools/get-action-artifact";
import { groupChangedFiles } from "./tools/group-changed-files";
import { getIssueDetail } from "./tools/get-issues-detail";

export const gitlabPrGroupsBuilderAgent = new Agent({
  name: "gitlab-pr-groups-builder",
  model: deepSeekModel,
  instructions: prGroupsBuilderInstructions,
  tools: {
    getPrDetail,
    getGithubActionArtifactContent,
    groupChangedFiles,
    getIssueDetail,
  },
});
