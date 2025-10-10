import { Gitlab } from '@gitbeaker/rest';

export const GitlabAPI  = new Gitlab({
  host: 'https://git.finchina.com/',
  token: 'R86_N_K5ksWzQ-DoV4sF' // 个人访问令牌
});