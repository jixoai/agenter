import { afterEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { createServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { McpSystem } from "../src/mcp-system/system";

const tempRoots: string[] = [];
const servers: HttpServer[] = [];
const stdioFixturePath = fileURLToPath(new URL("./fixtures/mcp-stdio-fixture-server.ts", import.meta.url));

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

const createTempRoot = (prefix: string): string => {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
};

const createSystem = (): McpSystem => {
  const root = createTempRoot("agenter-mcp-transport-system-");
  return new McpSystem({
    dbPath: join(root, "mcp-system.sqlite"),
    rootWorkspacePath: join(root, "root-workspace"),
    runtimeEnv: {
      AGENTER_MCP_FIXTURE_MODE: "root-env",
    },
  });
};

const createFixtureMcpServer = (name: string): McpServer => {
  const server = new McpServer({
    name,
    version: "1.0.0",
  });
  server.registerTool(
    "fixture_echo",
    {
      description: "Echo a test message.",
      inputSchema: {
        message: z.string(),
      },
    },
    ({ message }) => ({
      content: [
        {
          type: "text",
          text: `${name}:${message}`,
        },
      ],
    }),
  );
  return server;
};

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return undefined;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
};

const listen = async (handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>) => {
  const server = createServer((request, response) => {
    Promise.resolve(handler(request, response)).catch((error: unknown) => {
      if (!response.headersSent) {
        response.writeHead(500, { "content-type": "application/json" });
      }
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("fixture server did not expose a TCP address");
  }
  return {
    server,
    origin: `http://127.0.0.1:${address.port}`,
  };
};

const startStreamableHttpFixture = async () => {
  const transports = new Map<string, StreamableHTTPServerTransport>();
  return await listen(async (request, response) => {
    if (request.url !== "/mcp" || request.method !== "POST") {
      response.writeHead(404).end();
      return;
    }

    const body = await readJsonBody(request);
    const sessionId = request.headers["mcp-session-id"];
    let transport = typeof sessionId === "string" ? transports.get(sessionId) : undefined;
    if (!transport) {
      if (!isInitializeRequest(body)) {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "missing session" }, id: null }));
        return;
      }
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          if (transport) {
            transports.set(newSessionId, transport);
          }
        },
      });
      transport.onclose = () => {
        const currentSessionId = transport?.sessionId;
        if (currentSessionId) {
          transports.delete(currentSessionId);
        }
      };
      await createFixtureMcpServer("agenter-streamable-fixture").connect(transport);
    }
    await transport.handleRequest(request, response, body);
  });
};

const startSseFixture = async () => {
  const transports = new Map<string, SSEServerTransport>();
  return await listen(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/sse") {
      const transport = new SSEServerTransport("/messages", response);
      transports.set(transport.sessionId, transport);
      transport.onclose = () => transports.delete(transport.sessionId);
      await createFixtureMcpServer("agenter-sse-fixture").connect(transport);
      return;
    }
    if (request.method === "POST" && url.pathname === "/messages") {
      const sessionId = url.searchParams.get("sessionId") ?? "";
      const transport = transports.get(sessionId);
      if (!transport) {
        response.writeHead(404).end("missing session");
        return;
      }
      await transport.handlePostMessage(request, response, await readJsonBody(request));
      return;
    }
    response.writeHead(404).end();
  });
};

describe("Feature: mcpSystem protocol transport fixtures", () => {
  test("Scenario: Given a stdio MCP fixture When started through the default transport Then discovery and calls use a real child process", async () => {
    const system = createSystem();
    const projectPath = createTempRoot("agenter-mcp-stdio-project-");
    try {
      system.add({
        name: "stdio-fixture",
        transport: {
          kind: "stdio",
          command: "bun",
          args: ["run", stdioFixturePath],
          env: {
            AGENTER_MCP_FIXTURE_MODE: "transport-env",
          },
        },
      });
      system.enable({ name: "stdio-fixture", projectPath });

      const started = await system.start({ name: "stdio-fixture", projectPath });
      const called = await system.call({
        name: "stdio-fixture",
        projectPath,
        toolName: "fixture_echo",
        arguments: { message: "hello" },
      });

      expect(started.snapshot.serverName).toBe("agenter-stdio-fixture");
      expect(JSON.stringify(started.snapshot.tools)).toContain("fixture_echo");
      expect(JSON.stringify(called.result)).toContain(`${projectPath}:transport-env:hello`);
    } finally {
      system.close();
    }
  });

  test("Scenario: Given a Streamable HTTP MCP fixture When started through the default transport Then discovery records the remote tools", async () => {
    const fixture = await startStreamableHttpFixture();
    const system = createSystem();
    try {
      system.add({
        name: "streamable-fixture",
        transport: {
          kind: "streamable-http",
          url: `${fixture.origin}/mcp`,
        },
      });
      system.enable({ name: "streamable-fixture", projectPath: "/repo/app" });

      const started = await system.start({ name: "streamable-fixture", projectPath: "/repo/app" });

      expect(started.snapshot.serverName).toBe("agenter-streamable-fixture");
      expect(JSON.stringify(started.snapshot.tools)).toContain("fixture_echo");
    } finally {
      system.close();
    }
  });

  test("Scenario: Given an SSE MCP fixture When started through the default transport Then discovery records the project-local snapshot", async () => {
    const fixture = await startSseFixture();
    const system = createSystem();
    try {
      system.add({
        name: "sse-fixture",
        transport: {
          kind: "sse",
          url: `${fixture.origin}/sse`,
        },
      });
      system.enable({ name: "sse-fixture", projectPath: "/repo/app" });

      const started = await system.start({ name: "sse-fixture", projectPath: "/repo/app" });
      const rows = system.query({
        projectPath: "/repo/app",
        sql: "select name, server_name, tools_json from mcp_enabled where name = $name",
        params: { name: "sse-fixture" },
      }).rows;

      expect(started.snapshot.serverName).toBe("agenter-sse-fixture");
      expect(JSON.stringify(started.snapshot.tools)).toContain("fixture_echo");
      expect(rows).toHaveLength(1);
      expect(rows[0]?.server_name).toBe("agenter-sse-fixture");
      expect(String(rows[0]?.tools_json)).toContain("fixture_echo");
    } finally {
      system.close();
    }
  });
});
