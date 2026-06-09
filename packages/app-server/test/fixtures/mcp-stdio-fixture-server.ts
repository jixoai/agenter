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

server.registerResource(
  "workspace-readme",
  "fixture://workspace/readme",
  {
    title: "Workspace Readme",
    description: "Fixture workspace resource.",
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(
          {
            cwd: process.cwd(),
            mode: process.env.AGENTER_MCP_FIXTURE_MODE ?? "missing",
          },
          null,
          2,
        ),
      },
    ],
  }),
);

server.registerPrompt(
  "fixture_summarize",
  {
    title: "Fixture Summarize",
    description: "Fixture summarize prompt.",
    argsSchema: {
      topic: z.string(),
    },
  },
  ({ topic }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Summarize ${topic} for ${process.cwd()}.`,
        },
      },
    ],
  }),
);

await server.connect(new StdioServerTransport());
