import { Gitlab } from '@gitbeaker/rest';

export const GitlabAPI  = new Gitlab({
  host: 'https://git.finchina.com/',
  token: '_59xesSWrSY5jh25SixK' // 个人访问令牌
});