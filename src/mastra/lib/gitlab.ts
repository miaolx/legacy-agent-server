import { Gitlab } from '@gitbeaker/rest';

export const GitlabAPI  = new Gitlab({
  host: 'https://git.finchina.com/',
  token: 'BcYnB227n_CYfDZ1JtWL' // 个人访问令牌
});