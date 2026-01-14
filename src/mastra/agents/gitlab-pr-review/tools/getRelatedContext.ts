import { GitlabAPI } from "../../../lib/gitlab"
import { Tool } from "@mastra/core/tools";
import { z } from "zod";

const inputSchema = z.object({
  projectId: z.string().describe("The projectId of the repository"),
  mergeRequestIid: z.number().describe("The name of the mergeRequest (e.g., 1)."),
  path: z.string().describe("The file path to fetch content for"),
  headRef: z
    .string()
    .describe(
      "The name of the commit/branch/tag. Default: the repository's default branch."
    ),
});

const outputSchema = z.union([
  z
    .object({
      ok: z.literal(true),
      relatedContext: z.string().describe('Related context of the diff'),
      changedContext: z.string().describe('Related Changed context of the MR'),
    })
    .describe("The success object"),
  z
    .object({
      ok: z.literal(false),
      messsage: z
        .string()
        .describe("An optional error message of what went wrong"),
    })
    .describe("The error/failed object"),
]);

/**
 * 解析JS代码，提取【顶层import】+【仅本地文件引入】的变量名列表
 * 规则：仅前4种import写法、as重命名取原变量、排除第三方库、自动去重、过滤嵌套import
 * @param {string} jsCode 待解析的JS代码字符串
 * @returns {string[]} 去重后的本地引入变量名数组
 */
function getTopImportVars(jsCode: string) {
  const importVars = new Set();
  // 核心正则：匹配顶层import，同时捕获【变量内容】+【from后的完整路径/包名】
  const importReg = /^import\s+([\w\s,{}]+?)\s+from\s+['"]([^'"]+)['"]/gm;
  let match;

  while ((match = importReg.exec(jsCode)) !== null) {
    const importBody = match[1]; // 捕获 import 和 from 之间的变量内容
    const fromPath = match[2];    // 捕获 from 后面的路径/包名 ✅新增核心捕获
    
    // ✅ 核心过滤逻辑：只处理【本地文件】，排除所有第三方库
    const isLocalFile = /^(\.\/|\.\.\/|\/|@\/|@pages\/)/.test(fromPath);
    if (!isLocalFile) continue; // 如果是第三方库，直接跳过本次循环
    
    // 1. 提取【默认导入】的变量名 (import a from './xxx' / import user, {xxx} from './xxx')
    const defaultVarReg = /^(\w+)(?=\s*,?)/;
    const defaultVarMatch = importBody.match(defaultVarReg);
    if (defaultVarMatch) {
      importVars.add(defaultVarMatch[1]);
    }

    // 2. 提取【花括号命名导入】的变量名 (含as重命名，只提取重命名前的原变量名)
    const braceReg = /{([\s\w,]+?(\s+as\s+\w+)?)*}/;
    const braceMatch = importBody.match(braceReg);
    if (braceMatch) {
      const braceContent = braceMatch[0];
      // 核心规则：只捕获 重命名前/普通命名 的原始变量名
      const nameVarReg = /\b(\w+)\b(?=\s*(?:,|as))/g;
      let nameMatch;
      while ((nameMatch = nameVarReg.exec(braceContent)) !== null) {
        importVars.add(nameMatch[1]);
      }
    }
  }

  return Array.from(importVars);
}


function clearJsComments(jsStr: string) {
  return jsStr.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '').trim();
}

/**
 * 【核心优化】生成匹配JS定义代码的正则表达式 (全覆盖所有定义场景：全局+任意对象挂载+变量+函数+类+对象属性)
 * @param {string} keyword 单个搜索关键词
 * @returns {RegExp} 正则规则
 */
function getJsDefineReg(keyword: string) {
  const regStr = [
    // 1. 变量定义: var/let/const 关键词 = xxx
    `(var|let|const)\\s+${keyword}\\s*[=:]\\s*[^;{},]+[;}]?`,
    // 2. 函数声明定义: function 关键词() { ... }
    `function\\s+${keyword}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]{0,500}?`,
    // 3. 箭头函数/匿名函数赋值定义: const 关键词 = ()=>{} / = function(){}
    `(var|let|const)\\s+${keyword}\\s*=\\s*(function\\s*\\([^)]*\\)|=>)\\s*\\{[\\s\\S]{0,500}?`,
    // 4. class类定义: class 关键词 { ... }
    `class\\s+${keyword}\\s*\\{\\s*[\\s\\S]{0,500}?`,
    // 5. 对象字面量的属性/方法定义: { 关键词:值 } / { 关键词(){} }
    `${keyword}\\s*[:=]\\s*([^,}]+|function\\s*\\([^)]*\\)\\s*\\{[\\s\\S]{0,500}?)`,
    // 6. 原生全局挂载定义: window.关键词=xxx / this.关键词=xxx
    `(window|this)\\.${keyword}\\s*=\\s*[^;]+`,
    // 7. ✨【新增】任意单层对象挂载定义: obj.关键词=xxx / utils.关键词=()=>{} （最常用）
    `[a-zA-Z0-9_$]+\\.${keyword}\\s*=\\s*[^;]+`,
    // 8. ✨【新增】任意多层嵌套对象挂载定义: a.b.关键词=xxx / res.data.关键词=xxx / global.config.关键词=xxx
    `[a-zA-Z0-9_$]+(\\.[a-zA-Z0-9_$]+)*\\.${keyword}\\s*=\\s*[^;]+`
  ].join('|');
  return new RegExp(regStr, 'img'); // i:忽略大小写 m:多行匹配 g:全局匹配
}

/**
 * 核心方法：从diff字符串数组匹配关键词，返回【带前后上下文】的定义代码纯字符串数组
 * @param {Array<string>} diffStrList 入参：diff字符串组成的数组
 * @param {Array<string>} keywords 关键词数组 如：["testFunc", "baseUrl", "User"]
 * @param {number} [contextLine=2] 可选：匹配行的【前后各取N行】上下文，默认前后各2行
 * @returns {Array<string>} 出参：去重后的、带上下文的纯代码字符串数组
 */
function findJsDefineFromDiffWithContext(diffStrList: Array<string>, keywords: Array<string>, contextLine = 2) {
  // 边界值判断：入参非数组/空数组，直接返回空数组
  if (!Array.isArray(diffStrList) || diffStrList.length === 0 ||
    !Array.isArray(keywords) || keywords.length === 0) {
    return [];
  }
  // 上下文行数容错：传负数/0则取0行（只返回匹配行本身）
  const ctxLine = Math.max(0, Number(contextLine) || 2);
  const tempMatchList: any[] = [];

  // 遍历每一个diff字符串
  diffStrList.forEach(diffStr => {
    if (typeof diffStr !== 'string' || diffStr.trim() === '') return;

    // 1. 按行分割diff字符串，预处理每行并保存【清洗后的行+行索引】，核心：保留行的顺序和索引用于取上下文
    const diffLines = diffStr.split('\n');
    const validLineList: any[] = []; // 格式: [{ code: '清洗后的纯代码', originLine: '原始diff行' }]
    diffLines.forEach(line => {
      const trimedLine = line.trim();
      if (trimedLine === '') return; // 过滤空行
      if (line.startsWith('-')) return; // 过滤删除行（-开头）

      // 处理diff标识：+开头去掉+号，其他行保留纯内容
      const pureCode = line.startsWith('+') ? line.slice(1).trim() : trimedLine;
      const cleanCode = clearJsComments(pureCode); // 清除注释
      if (cleanCode) {
        validLineList.push({ code: cleanCode, originLine: line });
      }
    });

    if (validLineList.length === 0) return;
    // 拼接所有有效代码用于正则匹配，同时保留行列表用于取上下文
    const fullValidCode = validLineList.map(item => item.code).join(' ');

    // 2. 批量匹配所有关键词
    keywords.forEach(keyword => {
      const reg = getJsDefineReg(keyword);
      let matchRes;
      while ((matchRes = reg.exec(fullValidCode)) !== null) {
        const matchCode = matchRes[0].trim();
        if (!matchCode || !matchCode.includes(keyword)) continue;

        // 3. 找到匹配代码在有效行列表中的【行索引】，核心：用于取前后上下文
        const matchLineIndex = validLineList.findIndex(item => item.code.includes(matchCode.substring(0, 30)));
        if (matchLineIndex === -1) continue;

        // 4. 计算上下文的起止行：智能边界处理，不会越界
        const startIdx = Math.max(0, matchLineIndex - ctxLine); // 往前取N行，最小到0
        const endIdx = Math.min(validLineList.length, matchLineIndex + ctxLine + 1); // 往后取N行，最大到最后一行

        // 5. 截取上下文行并拼接成完整代码片段
        const contextLines = validLineList.slice(startIdx, endIdx);
        const fullContextCode = contextLines.map(item => item.code).join('\n');

        // 6. 存入临时列表，后续去重
        tempMatchList.push(fullContextCode);
      }
    });
  });

  // 最终：去重 + 过滤空字符串，返回纯字符串数组
  const uniqueSet = new Set(tempMatchList);
  return Array.from(uniqueSet).filter(item => item.trim() !== '');
}

export const getRelatedContext = new Tool({
  id: "getRelatedContext",
  description:
    "get the related context from Gitlab diffs",
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    let _context = {}
    if (typeof context === 'string' || context instanceof String) {
      _context = JSON.parse(context?.trim().replace(/'/g, '"').replace(/(\w+):/g, '"$1":'))
    } else {
      _context = context
    }

    const { projectId, project_id, mergeRequestIid, file_path, path, headRef, ref } = _context as any;

    let filteredFiles: any = { new_path: '', diff: '' }
    let relatedFiles: any = []
    let filesResponse: any = null
    let relatedContext = ''
    let changedContext = ''

    try {
      const response = await GitlabAPI.RepositoryFiles.show(projectId || project_id, path || file_path, headRef || ref);

      try {
        filesResponse = await GitlabAPI.MergeRequests.showChanges(projectId || project_id, mergeRequestIid || mergeRequestIid);
        relatedFiles = filesResponse?.changes.filter((f: any) => !path.includes(f.new_path))?.map((i: any) => i.diff);
        filteredFiles = filesResponse?.changes.filter((f: any) => path.includes(f.new_path))?.[0];
      } catch (error) {
        console.error(error);
      }

      if (Array.isArray(response)) {
        return {
          ok: false as const,
          messsage: `Path ${path} points to a directory, not a file`,
        };
      }

      if (!("content" in response)) {
        return {
          ok: false as const,
          messsage: `No content available for file ${path}`,
        };
      }

      let content: string;
      let keywords: any[];

      try {
        content = Buffer.from(response.content, "base64").toString(
          "utf-8",
        );
        keywords = getTopImportVars(content)
        changedContext = findJsDefineFromDiffWithContext(relatedFiles, keywords)?.join('/n')
      } catch (error) {
        return {
          ok: false as const,
          messsage: error instanceof Error ? error.message : "Unkown error",
        };
      }

      try {
        const relatedFiles = await fetch('http://10.15.97.188:8000/api/chat_with_system', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            message: `在文件${filteredFiles.new_path}中变更内容为${filteredFiles.diff}，请提供与该变更内容最可能存在关联的代码块，至多3个。返回数据中只要结果，不要带有查询内容。`,
            return_documents_only: true,
            "relate-documents-count": 3
          }),
        });

        const { response, status } = await relatedFiles.json();

        if (status === 'success') {
          relatedContext = response
        }
      } catch (error) {
        console.error(error);
      }

      return {
        ok: true as const,
        relatedContext,
        changedContext
      };
    } catch (error) {
      console.error("Error fetching file content:", error);
      return {
        ok: false as const,
        messsage: error instanceof Error ? error.message : "Unkown error",
      };
    }
  },
});
