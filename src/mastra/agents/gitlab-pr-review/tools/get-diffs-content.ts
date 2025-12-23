import { GitlabAPI } from "../../../lib/gitlab"
import { Tool } from "@mastra/core/tools";
import { z } from "zod";

import { countAdditions, countDeletions, getChangeType } from '../../gitlab-pr-group/tools/get-pr-detail'

const outputSchema = z.object({
  filename: z.string(),
  status: z.enum(['added', 'modified', 'removed', 'renamed']),
  changes: z.number().int(),
  additions: z.number().int(),
  deletions: z.number().int(),
  patch: z.string().optional().describe("Raw patch text provided by Gitlab"),
  relatedList: z.string().describe('Related filePath of the input filePath'),
}).describe('The diff content of the changed files in the pull request.')

const extractDiffs = (diffContent: string) => {
  /**
   * Extract multiple diffs and convert them into a diff array
   * 提取多个diff转成diff数组
   */

  // 使用正则表达式来匹配diff数据块
  const diffPattern = /@@ -\d+,\d+ \+\d+,\d+ @@.*?(?=\n@@|$)/gs;
  const diffs = diffContent.match(diffPattern) || [];
  return diffs;
}

const parsePatch = (diffContent: string) => {
  // 按行分割 patch
  const lines = diffContent.split('\n');
  const result = [];
  const added = [];
  const removed = []
  let currentNewLine = 0;
  let inHunk = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检查是否为 @@ 头
    if (line.startsWith('@@')) {
      // 解析 @@ 头获取新文件的起始行号
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        currentNewLine = parseInt(match[1], 10);
        inHunk = true;
        result.push(`${line}`);
      }
      continue;
    }

    // 如果在 hunk 中，处理各种情况
    if (inHunk) {
      if (line.startsWith(' ')) {
        // 空格行：当前新行号递增
        result.push(`${currentNewLine}: ${line}`);
        added.push(`${currentNewLine}: ${line}`);
        removed.push(`${currentNewLine}: ${line}`);
        currentNewLine++;
      } else if (line.startsWith('+')) {
        // 加号行：当前新行号递增
        result.push(`${currentNewLine}: ${line}`);
        added.push(`${currentNewLine}: ${line}`);
        currentNewLine++;
      } else if (line.startsWith('-')) {
        // 减号行：当前新行号不变
        result.push(`${currentNewLine}: ${line}`);
        removed.push(`${currentNewLine}: ${line}`);
        // 注意：currentNewLine 不递增
      } else {
        // 其他情况（如空行或非补丁行）
        result.push(`${currentNewLine}: ${line}`);
        added.push(`${currentNewLine}: ${line}`);
        removed.push(`${currentNewLine}: ${line}`);
        currentNewLine++;
      }
    }
  }
  return [result.join('\n'), added.join('\n'), removed.join('\n')];
}


export const getDiffsContent = new Tool({
  id: "getDiffsContent",
  description: "Fetches the diff content of the changed files in the pull request.",
  inputSchema: z.object({
    projectId: z.string().describe("The projectId of the repository"),
    mergeRequestIid: z.number().describe("The name of the mergeRequest (e.g., 1)."),
    paths: z.string().describe("The path of the file to get the diff content."),
    diffIndex: z.number().describe("The index of the chunk in the diff content."),
    isDefault: z.string().describe("Is it the default workFlow"),
  }),
  outputSchema,
  execute: async ({ context }) => {
    let _context: any = {}
    console.log("🚀 ~ getDiffsContent context:", context)
    if (typeof context === 'string' || context instanceof String) {
      _context = JSON.parse(context?.trim().replace(/'/g, '"').replace(/(\w+):/g, '"$1":'))
    } else {
      _context = context
    }
    console.log("🚀 ~ getDiffsContent _context:", _context)
    const { projectId, project_id, mergeRequestIid, merge_request_iid, paths, diffIndex, isDefault } = _context;

    let relatedList = ''
    let filteredFiles: any = { diff: '' }

    try {
      const filesResponse = await GitlabAPI.MergeRequests.showChanges(projectId || project_id, mergeRequestIid || merge_request_iid);
      filteredFiles = filesResponse?.changes.filter(f => paths.includes(f.new_path))?.[0];
    } catch (error) {
      console.error(error);
    }

    let [diff, added, removed] = parsePatch(filteredFiles.diff)

    if (!isDefault) {
      try {
        if (diffIndex || diffIndex === 0) {
          diff = extractDiffs(filteredFiles.diff)?.[diffIndex]
        }

        const relatedFiles = await fetch('http://10.15.97.188:8000/api/chat_with_system', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            message: `在文件${filteredFiles.new_path}中变更内容为${diff}，请提供与该变更内容最可能存在关联的代码块，至多3个。返回数据中只要结果，不要带有查询内容。`,
            return_documents_only: true,
            "relate-documents-count": 3
          }),
        });

        const { response, status } = await relatedFiles.json();

        if (status === 'success') {
          relatedList = response
        }
        // relatedList = ''
      } catch (error) {
        console.error(error);
      }
    }

    console.log('getDiffsContent执行完成');

    const files = {
      filename: filteredFiles.new_path,
      patch: diff,
      added,
      removed,
      relatedList: relatedList
    }

    return files
  },
});

