import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

/**
 * deepseek provider
 */
export const deepSeekProvider = createOpenAICompatible({
  baseURL: 'https://api.deepseek.com/v1',
  name: 'deepseek',
  headers: {
    Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY!}`,
  },
});

/**
 * deepseek model
 */
export const deepSeekModel = deepSeekProvider.chatModel('deepseek-chat');

/**
 * dzh provider
 */
export const dzhProvider = createOpenAICompatible({
  baseURL: 'http://10.15.97.68:7010/v1',
  name: 'Dify',
  headers: {
    Authorization: `Bearer http://10.99.32.62/v1|app-VhEJnSN8hEBanLA8vocYUGQo|Chat`,
  },
});


export const dzhModel = dzhProvider.chatModel('dify');