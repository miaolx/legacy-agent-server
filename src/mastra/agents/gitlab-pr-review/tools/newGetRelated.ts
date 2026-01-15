import { GitlabAPI } from "../../../lib/gitlab"
import { Tool } from "@mastra/core/tools";
import { z } from "zod";
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

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
 * 解析JS代码，提取【顶层import】+【仅本地文件引入】的变量名+对应引入路径
 * 规则：仅前4种import写法、as重命名取原变量、排除第三方库、自动去重、过滤嵌套import、路径去除开头相对标识
 * @param {string} jsCode 待解析的JS代码字符串
 * @returns {{varName: string, fromPath: string}[]} 去重后的数组，每项含「变量名」+「去除相对标识的纯净路径」
 */
function getTopImportVars(jsCode: string) {
  const uniqueImportItems: Record<string, { varName: string; fromPath: string }> = {};
  const importReg = /^import\s+([\w\s,{}]+?)\s+from\s+['"]([^'"]+)['"]/gm;
  let match;

  // ✅ 核心新增：路径清理工具函数 - 移除所有开头的相对路径标识
  const cleanRelativePath = (path: string) => {
    // 正则匹配 开头的 ./ | ../ | / | @/ | @pages/ ，支持连续多个（如 ././utils 也能清理）
    return path.replace(/^(?:\.\/|\.\.\/|\/|@\/|@pages\/)+/, '');
  };

  while ((match = importReg.exec(jsCode)) !== null) {
    const importBody = match[1];
    const originFromPath = match[2]; // 原始路径（用于判断是否是本地文件）

    // ✅ 原规则保留：只处理本地文件，排除第三方库（必须用【原始路径】判断，不能用清理后的）
    const isLocalFile = /^(\.\/|\.\.\/|\/|@\/|@pages\/)/.test(originFromPath);
    if (!isLocalFile) continue;

    // ✅ 核心执行：清理路径，去除开头的相对路径标识，得到纯净路径
    const fromPath = cleanRelativePath(originFromPath);

    // 1. 提取默认导入变量名
    const defaultVarReg = /^(\w+)(?=\s*,?)/;
    const defaultVarMatch = importBody.match(defaultVarReg);
    if (defaultVarMatch) {
      const varName = defaultVarMatch[1];
      if (!uniqueImportItems[varName]) {
        uniqueImportItems[varName] = { varName, fromPath };
      }
    }

    // 2. 提取花括号命名导入变量名（as重命名只取原变量名，原规则不变）
    const braceReg = /{([\s\w,]+?(\s+as\s+\w+)?)*}/;
    const braceMatch = importBody.match(braceReg);
    if (braceMatch) {
      const braceContent = braceMatch[0];
      const nameVarReg = /\b(\w+)\b(?=\s*(?:,|as))/g;
      let nameMatch;
      while ((nameMatch = nameVarReg.exec(braceContent)) !== null) {
        const varName = nameMatch[1];
        if (!uniqueImportItems[varName]) {
          uniqueImportItems[varName] = { varName, fromPath };
        }
      }
    }
  }

  return Object.values(uniqueImportItems);
}

/**
 * 从JS完整代码字符串中，提取指定变量的「定义+所有重新赋值」完整代码片段
 * @param {string} fullCode 已获取的JS文件完整代码字符串
 * @param {string} targetVar 要提取的目标变量名 例：'user' | 'apiList' | 'config'
 * @returns {string} 去重后的完整代码片段拼接
 */

function extractVarDefineAndAssign(fullCode: string, targetVar: string) {
  // 1. 解析代码为AST抽象语法树
  const ast = acorn.parse(fullCode, {
    ecmaVersion: 'latest', // 兼容所有ES6+语法
    sourceType: 'script'    // 普通脚本，前端/Node通用
  });

  const result = new Set(); // 自动去重，避免重复提取相同代码

  // 2. 遍历AST，匹配变量定义 & 赋值节点
  walk.simple(ast, {
    // ✅ 匹配：var / let / const 变量定义 (含赋值/纯声明)
    VariableDeclaration(node) {
      node.declarations.forEach(decl => {
        if (decl.id.name === targetVar) {
          // 精准截取变量定义的完整代码
          result.add(fullCode.slice(decl.start, decl.end));
        }
      });
    },
    // ✅ 匹配：变量重新赋值 (所有赋值运算符都支持)
    AssignmentExpression(node) {
      if (node.left.name === targetVar) {
        // 精准截取变量赋值的完整代码
        result.add(fullCode.slice(node.start, node.end));
      }
    }
  });

  // 转数组返回
  return Array.from(result).join('/n');
}


/**
 * 批量获取 GitLab 仓库中多个文件的内容
 * @param {Array<{key: string; filePath: string}>} filePaths 对象数组，每项含 自定义关键词 + 文件相对路径
 * @param {Object} config gitlab相关配置 { projectId, ref }
 * @returns {Promise<Array<string>>} 带关键词+路径+内容的结果数组
 */
async function batchGetGitlabFileContents(filePaths: Array<{ key: string; filePath: string }>, config = {}) {
  const { projectId, ref } = config as { projectId: string | number; ref: string };

  // 空数组直接返回空，边界判断
  if (!filePaths?.length) {
    return [];
  }

  // Promise.all 并发请求，性能最优（原逻辑保留）
  const fileContentList = await Promise.all(
    filePaths.map(async (item) => {
      const { key, filePath } = item;
      try {
        // ✅ 修复原函数的核心BUG：原代码错误传了config.path，应该传遍历的当前filePath
        const file = await GitlabAPI.RepositoryFiles.show(
          projectId, // 项目ID
          filePath,  // 当前文件的实际路径（修复核心问题）
          ref,       // 分支名/tag名
        );

        // Base64解码 GitLab 返回的文件内容（原逻辑保留，必写步骤）
        const rawContent = Buffer.from(file.content, 'base64').toString('utf-8');

        const content = extractVarDefineAndAssign(key, rawContent)

        // 返回：关键词+路径+解码后的文件内容
        return content;

      } catch (error: any) {
        console.error(`❌ 获取文件【${filePath}】失败:`, error.message);
        // 异常时返回空内容，保证数组结构完整性，不会中断Promise.all
        return '';
      }
    }),
  );

  return fileContentList;
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
    let relatedPaths: any = []
    let filesResponse: any = null
    let relatedContext = ''
    let changedContext = ''

    try {
      const response = await GitlabAPI.RepositoryFiles.show(projectId || project_id, path || file_path, headRef || ref);

      try {
        filesResponse = await GitlabAPI.MergeRequests.showChanges(projectId || project_id, mergeRequestIid || mergeRequestIid);
        relatedFiles = filesResponse?.changes.filter((f: any) => !path.includes(f.new_path))?.map((i: any) => i.diff);
        relatedPaths = filesResponse?.changes.filter((f: any) => !path.includes(f.new_path))?.map((i: any) => i.new_path);
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

      try {
        const content = Buffer.from(response.content, "base64").toString(
          "utf-8",
        );

        const filePaths: any = getTopImportVars(content)?.forEach((item: any) => {
          const matchStr = relatedPaths.find((str: string) => str.includes(item.fromPath));
          if (matchStr) {
            filePaths.push({ key: item.varName, filePath: matchStr });
          }
        })

        const config = {
          projectId: projectId || project_id,
          ref: headRef || ref
        }

        changedContext = (await batchGetGitlabFileContents(filePaths, config))?.join('/n')
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
