import { Gitlab } from '@gitbeaker/rest';

export const GitlabAPI  = new Gitlab({
  host: 'https://git.finchina.com/',
  token: '3ALe--cKZ3gCULSs_Wsg' // 个人访问令牌
});