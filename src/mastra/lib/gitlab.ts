import { Gitlab } from '@gitbeaker/rest';

export const GitlabAPI  = new Gitlab({
  host: 'https://git.finchina.com/',
  token: 'xJb_Qd228e4H_fxRua5R' // 个人访问令牌
});