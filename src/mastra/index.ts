
import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';
import { MCPServer } from "@mastra/mcp";
import http from "http";

import { agents } from './agents';
import { difyGetPrDetail, difyGroupChangedFiles, difyGetGithubActionArtifactContent } from './dify-tool-adapter'


// Create the MCP server
export const server = new MCPServer({
  name: "MyCRServer",
  version: "1.0.0",
  tools: { difyGetPrDetail, difyGroupChangedFiles, difyGetGithubActionArtifactContent },
});

export const mastra = new Mastra({
  agents,
  logger: createLogger({
    name: 'Mastra',
    // level: 'debug',
  }),
});

// 启动 HTTP 服务器
const PORT = 8080; // 指定端口
const httpServer = http.createServer(async (req, res) => {
  await server.startSSE({
    url: new URL(req.url || "", `http://localhost:${PORT}`),
    ssePath: "/sse",
    messagePath: "/message",
    req,
    res,
  });
});


httpServer.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});