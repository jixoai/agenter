import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "agenter-stdio-fixture",
  version: "1.0.0",
});

server.registerTool(
  "fixture_echo",
  {
    description: "Echo the current project and message.",
    inputSchema: {
      message: z.string(),
    },
  },
  ({ message }) => ({
    content: [
      {
        type: "text",
        text: `${process.cwd()}:${process.env.AGENTER_MCP_FIXTURE_MODE ?? "missing"}:${message}`,
      },
    ],
  }),
);

await server.connect(new StdioServerTransport());
