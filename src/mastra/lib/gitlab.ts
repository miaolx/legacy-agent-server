import { Gitlab } from '@gitbeaker/rest';

export const GitlabAPI  = new Gitlab({
  host: 'https://git.finchina.com/',
  token: ' R-icSwXXvtTQDoWYhPzQ' // 个人访问令牌
});