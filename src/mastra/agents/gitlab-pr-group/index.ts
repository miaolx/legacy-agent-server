import { Agent } from "@mastra/core/agent";

import { deepSeekModel, dzhModel, qwModel } from '../../model-provider/deepseek';
import { prGroupsBuilderInstructions } from "./instructions";
import { getPrDetail } from "./tools/get-pr-detail";

export const gitlabPrGroupsBuilderAgent = new Agent({
  name: "gitlab-pr-groups-builder",
  model: qwModel,
  instructions: prGroupsBuilderInstructions,
  tools: {
    getPrDetail,
  },
});
