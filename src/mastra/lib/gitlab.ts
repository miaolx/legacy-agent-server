import { Gitlab } from '@gitbeaker/rest';

export const GitlabAPI  = new Gitlab({
  host: 'https://git.finchina.com/',
  token: 'x3xC8Smdvkrxo8ygzzyj' // 个人访问令牌
});