import { Gitlab } from '@gitbeaker/rest';

export const GitlabAPI  = new Gitlab({
  host: 'https://git.finchina.com/',
  token: '-FY5Wo6Y_1J5xwhrL28e' // 个人访问令牌
});