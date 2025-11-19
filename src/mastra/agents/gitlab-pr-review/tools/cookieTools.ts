import { writeFile, access, readFile } from 'fs/promises';
import { resolve } from 'path';

/**
 * 将 Cookie 保存到本地文件
 * @param {Object} cookie - Cookie 对象
 * @param {string} filePath - 文件保存路径，默认为当前目录下的 cookie.json
 * @returns {Promise<boolean>} 保存是否成功
 */
export async function saveCookieToFile(cookie: string, filePath = './cookie.json') {
  try {
    // 验证 Cookie 对象
    if (!cookie) {
      throw new Error('Cookie不存在');
    }
    // 创建完整的文件路径
    const fullPath = resolve(filePath);

    // 将 Cookie 转换为 JSON 字符串并保存
    const cookieJSON = JSON.stringify(cookie, null, 2);
    await writeFile(fullPath, cookieJSON, 'utf8');

    console.log(`Cookie 已成功保存到: ${fullPath}`);
    return true;
  } catch (error: any) {
    console.error('保存 Cookie 失败:', error.message);
    return false;
  }
}

/**
 * 从本地文件读取 Cookie
 * @param {string} filePath - Cookie 文件路径，默认为当前目录下的 cookie.json
 * @returns {Promise<Object|null>} Cookie 对象，读取失败返回 null
 */
export async function loadCookieFromFile(filePath = './cookie.json') {
  try {
    const fullPath = resolve(filePath);

    // 检查文件是否存在
    try {
      await access(fullPath);
    } catch {
      console.log('Cookie 文件不存在');
      return null;
    }
    // 读取文件内容
    const fileContent = await readFile(fullPath, 'utf8');
    // 解析 JSON 数据
    const cookie = JSON.parse(fileContent);
    console.log(`Cookie 已从 ${fullPath} 成功加载`);
    return cookie;
  } catch (error: any) {
    console.error('读取 Cookie 失败:', error.message);
    return null;
  }
}

export const isCookieExpired = (cookieString: string) => {
  // 提取 expires 时间
  if (!cookieString) {
    return true
  }
  const expiresMatch = cookieString.match(/expires=([^;]+)/);
  if (!expiresMatch) {
    return true; // 没有过期时间，视为已过期或会话Cookie
  }
  const expiresTime = new Date(expiresMatch[1]);
  const currentTime = new Date();
  return currentTime > expiresTime;
}
