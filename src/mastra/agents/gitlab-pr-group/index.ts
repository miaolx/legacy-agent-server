import { Agent } from "@mastra/core/agent";

import { deepSeekModel, dzhModel, qwModel } from '../../model-provider/deepseek';
import { prGroupsBuilderInstructions } from "./instructions";
import { getPrDetail } from "./tools/get-pr-detail";
import { getGitlabActionArtifactContent } from "./tools/get-action-artifact"; // 修改为 GitLab 版本
import { groupChangedFiles } from "./tools/group-changed-files";
import { getIssueDetail } from "./tools/get-issues-detail";

export const gitlabPrGroupsBuilderAgent = new Agent({
  name: "gitlab-pr-groups-builder",
  model: qwModel,
  instructions: prGroupsBuilderInstructions,
  tools: {
    getPrDetail,
    getGitlabActionArtifactContent, // 更新工具映射
    groupChangedFiles,
    // getIssueDetail,
  },
});
