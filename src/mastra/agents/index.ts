import { gitlabReviewSingleAgent } from './gitlab-pr-file-review'

import { gitlabPrGroupsBuilderAgent } from './gitlab-pr-group';

import { gitlabReviewGroupAgent } from './gitlab-pr-review';

import { mlxGitlabCodeReviewAgent } from './mlx-gitlab-code-review'

// 注册到 mastra 的 agents
export const agents = {
  gitlabReviewSingleAgent,
  gitlabPrGroupsBuilderAgent,
  gitlabReviewGroupAgent,
  mlxGitlabCodeReviewAgent,

};
