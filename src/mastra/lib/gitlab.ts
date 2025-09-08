import { Gitlab } from '@gitbeaker/rest';

export const GitlabAPI  = new Gitlab({
  host: 'https://git.finchina.com/',
  token: 'Bc99husr7PAgC2EXbMVy' // 个人访问令牌
});