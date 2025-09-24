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
    Authorization: `Bearer http://10.17.107.55/v1|app-VX835JVqvzU7pqwI11MQgML7|Chat`,
  },
});


export const dzhModel = dzhProvider.chatModel('dify');


export const qwProvider = createOpenAICompatible({
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  name: 'Qwen',
  headers: {
    Authorization: `Bearer sk-0478c6b47e454abbb9223449fe14dc53`,
  },
});

export const qwModel = qwProvider.chatModel('qwen-plus-latest');