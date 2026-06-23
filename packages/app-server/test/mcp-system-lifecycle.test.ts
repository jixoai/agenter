import { afterEach, describe, expect, test } from "bun:test";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { McpSystemStore } from "../src/mcp-system/store";
import { McpSystem, type McpInspectorSpawnFactory } from "../src/mcp-system/system";
import type { McpAppServerEvent, McpTransportStartContext } from "../src/mcp-system/types";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

const createSystem = (input: {
  transportFactory: (context: McpTransportStartContext) => InMemoryTransport;
  dbPath?: string;
  rootWorkspacePath?: string;
  envProvider?: () => Record<string, string>;
  inspectorSpawnFactory?: McpInspectorSpawnFactory;
  discoverySettleMs?: number;
  discoveryPollMs?: number;
}): McpSystem => {
  const root = mkdtempSync(join(tmpdir(), "agenter-mcp-system-lifecycle-"));
  tempRoots.push(root);
  return new McpSystem({
    dbPath: input.dbPath ?? join(root, "mcp-system.sqlite"),
    rootWorkspacePath: input.rootWorkspacePath ?? join(root, "root-workspace"),
    baseEnv: {
      ROOT_ONLY: "root-env",
      TOKEN: "root-token",
    },
    envProvider: input.envProvider,
    transportFactory: input.transportFactory,
    inspectorSpawnFactory: input.inspectorSpawnFactory,
    discoverySettleMs: input.discoverySettleMs ?? 0,
    discoveryPollMs: input.discoveryPollMs ?? 25,
  });
};

const addMemoryGlobal = (system: McpSystem, name = "memory") =>
  system.add({
    name,
    title: "Memory MCP",
    description: "In-memory MCP fixture",
    env: { TOKEN: "global-token" },
    transport: {
      kind: "stdio",
      command: "fixture",
      env: { TRANSPORT_ONLY: "transport-env" },
    },
  });

const readRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected object value");
  }
  return value as Record<string, unknown>;
};

const readString = (value: unknown, key: string): string => {
  const candidate = readRecord(value)[key];
  if (typeof candidate !== "string") {
    throw new Error(`expected string field: ${key}`);
  }
  return candidate;
};

const waitUntil = async (predicate: () => boolean, message: string): Promise<void> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 1000) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(message);
};

const createFixtureTransportFactory = () => {
  const starts: McpTransportStartContext[] = [];
  const servers: McpServer[] = [];
  const factory = (context: McpTransportStartContext): InMemoryTransport => {
    starts.push(context);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = new McpServer({
      name: `fixture-${context.name}`,
      version: "1.0.0",
    });
    server.registerTool(
      "echo",
      {
        description: "Echo a message",
        inputSchema: {
          message: z.string(),
        },
      },
      ({ message }) => ({
        content: [{ type: "text", text: `${context.projectPath}:${message}` }],
      }),
    );
    server.registerResource(
      "workspace-memory",
      "memory://workspace",
      {
        title: "Workspace Memory",
        description: "Fixture resource catalogue",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                projectPath: context.projectPath,
                workspace: "fixture",
              },
              null,
              2,
            ),
          },
        ],
      }),
    );
    server.registerResource(
      "playground-link-ui",
      "ui://fixture/playground-link",
      {
        title: "Fixture MCP App",
        description: "Fixture MCP Apps resource",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "text/html;profile=mcp-app",
            text: "<!doctype html><html><body><main>Fixture MCP App</main></body></html>",
          },
        ],
      }),
    );
    server.registerPrompt(
      "summarize",
      {
        title: "Summarize",
        description: "Fixture summarize prompt",
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
              text: `Summarize ${topic} for ${context.projectPath}.`,
            },
          },
        ],
      }),
    );
    servers.push(server);
    void server.connect(serverTransport);
    return clientTransport;
  };
  return { factory, starts, servers };
};

const createDelayedResourceTransportFactory = () => {
  const starts: McpTransportStartContext[] = [];
  const servers: McpServer[] = [];
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  const factory = (context: McpTransportStartContext): InMemoryTransport => {
    starts.push(context);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = new McpServer({
      name: `delayed-${context.name}`,
      version: "1.0.0",
    });
    server.registerResource(
      "playground-link-ui",
      "ui://fixture/playground-link",
      {
        title: "Fixture MCP App",
        description: "Fixture MCP Apps resource",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "text/html;profile=mcp-app",
            text: "<!doctype html><html><body><main>Fixture MCP App</main></body></html>",
          },
        ],
      }),
    );
    timers.push(
      setTimeout(() => {
        server.registerResource(
          "Fixture-Doc-Section",
          new ResourceTemplate("fixture://{/slug*}.md", {
            list: async () => ({
              resources: [
                {
                  name: "docs/overview",
                  title: "Overview",
                  uri: "fixture://docs/overview.md",
                  description: "Delayed fixture docs section",
                },
              ],
            }),
          }),
          {
            title: "A single fixture documentation section",
            description: "Delayed fixture resource template",
          },
          async (uri) => ({
            contents: [
              {
                uri: uri.href,
                mimeType: "text/markdown",
                text: "# Overview\n",
              },
            ],
          }),
        );
      }, 40),
    );
    servers.push(server);
    void server.connect(serverTransport);
    return clientTransport;
  };
  const close = async (): Promise<void> => {
    for (const timer of timers.splice(0)) {
      clearTimeout(timer);
    }
    await Promise.all(servers.map((server) => server.close().catch(() => undefined)));
  };
  return { factory, starts, servers, close };
};

const createFakeInspectorProcess = (): ChildProcessWithoutNullStreams & {
  stdout: PassThrough;
  stderr: PassThrough;
  killedSignal: NodeJS.Signals | null;
} => {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdin = new PassThrough();
  const processBase = new EventEmitter() as EventEmitter &
    Partial<ChildProcessWithoutNullStreams> & {
      stdout: PassThrough;
      stderr: PassThrough;
      stdin: PassThrough;
      killed: boolean;
      exitCode: number | null;
      signalCode: NodeJS.Signals | null;
      killedSignal: NodeJS.Signals | null;
      kill: (signal?: NodeJS.Signals | number) => boolean;
    };
  processBase.stdout = stdout;
  processBase.stderr = stderr;
  processBase.stdin = stdin;
  processBase.killed = false;
  processBase.exitCode = null;
  processBase.signalCode = null;
  processBase.killedSignal = null;
  processBase.kill = (signal?: NodeJS.Signals | number): boolean => {
    processBase.killed = true;
    processBase.killedSignal = typeof signal === "string" ? signal : null;
    processBase.signalCode = processBase.killedSignal;
    return true;
  };
  return processBase as unknown as ChildProcessWithoutNullStreams & {
    stdout: PassThrough;
    stderr: PassThrough;
    killedSignal: NodeJS.Signals | null;
  };
};

describe("Feature: mcpSystem lifecycle", () => {
  test("Scenario: Given an enabled stopped MCP When call runs with defaults Then it auto-starts and records a project-local snapshot", async () => {
    const fixture = createFixtureTransportFactory();
    const system = createSystem({ transportFactory: fixture.factory });
    try {
      addMemoryGlobal(system);
      system.enable({ name: "memory", projectPath: "/repo/app" });

      const result = await system.call({
        name: "memory",
        projectPath: "/repo/app",
        toolName: "echo",
        arguments: { message: "hello" },
      });

      expect(result.instance.lifecycle).toBe("running");
      expect(fixture.starts).toHaveLength(1);
      expect(fixture.starts[0]?.projectPath).toBe("/repo/app");
      expect(fixture.starts[0]?.env.TOKEN).toBe("global-token");
      expect(fixture.starts[0]?.env.ROOT_ONLY).toBe("root-env");
      expect(fixture.starts[0]?.env.TRANSPORT_ONLY).toBeUndefined();
      expect(JSON.stringify(result.result)).toContain("/repo/app:hello");

      const rows = system.query({
        projectPath: "/repo/app",
        sql: "select name, enabled, lifecycle, server_name, tools_json from mcp_enabled where name = $name",
        params: { name: "memory" },
      }).rows;

      expect(rows[0]?.lifecycle).toBe("running");
      expect(rows[0]?.server_name).toBe("fixture-memory");
      expect(String(rows[0]?.tools_json)).toContain("echo");
    } finally {
      system.close();
      await Promise.all(fixture.servers.map((server) => server.close().catch(() => undefined)));
    }
  });

  test("Scenario: Given a disabled MCP When call runs with default autoEnable Then it rejects without starting", async () => {
    const fixture = createFixtureTransportFactory();
    const system = createSystem({ transportFactory: fixture.factory });
    try {
      addMemoryGlobal(system);

      await expect(
        system.call({
          name: "memory",
          projectPath: "/repo/app",
          toolName: "echo",
          arguments: { message: "hello" },
        }),
      ).rejects.toThrow(/not enabled/);
      expect(fixture.starts).toHaveLength(0);
      expect(system.store.getExplicitEnablement("memory", "/repo/app")).toBeNull();
    } finally {
      system.close();
      await Promise.all(fixture.servers.map((server) => server.close().catch(() => undefined)));
    }
  });

  test("Scenario: Given a disabled MCP When call opts into autoEnable Then it enables and starts before use", async () => {
    const fixture = createFixtureTransportFactory();
    const system = createSystem({ transportFactory: fixture.factory });
    try {
      addMemoryGlobal(system);

      const result = await system.call({
        name: "memory",
        projectPath: "/repo/app",
        toolName: "echo",
        arguments: { message: "hello" },
        autoEnable: true,
      });

      expect(result.instance.lifecycle).toBe("running");
      expect(system.store.requireEnabledProject("memory", "/repo/app").enabled).toBeTrue();
      expect(fixture.starts).toHaveLength(1);
    } finally {
      system.close();
      await Promise.all(fixture.servers.map((server) => server.close().catch(() => undefined)));
    }
  });

  test("Scenario: Given an unsaved MCP draft When inspect runs Then connection and capability actions stay ephemeral", async () => {
    const fixture = createFixtureTransportFactory();
    const system = createSystem({ transportFactory: fixture.factory });
    try {
      const inspectedTool = await system.inspect({
        name: "draft-memory",
        projectPath: "/repo/app",
        env: { TOKEN: "draft-token" },
        transport: {
          kind: "stdio",
          command: "fixture",
          env: { TRANSPORT_ONLY: "transport-env" },
        },
        capabilityKind: "tool",
        toolName: "echo",
        arguments: { message: "hello" },
      });
      const inspectedResource = await system.inspect({
        name: "draft-memory",
        projectPath: "/repo/app",
        env: { TOKEN: "draft-token" },
        transport: {
          kind: "stdio",
          command: "fixture",
          env: { TRANSPORT_ONLY: "transport-env" },
        },
        capabilityKind: "resource",
        resourceUri: "memory://workspace",
      });
      const inspectedPrompt = await system.inspect({
        name: "draft-memory",
        projectPath: "/repo/app",
        env: { TOKEN: "draft-token" },
        transport: {
          kind: "stdio",
          command: "fixture",
          env: { TRANSPORT_ONLY: "transport-env" },
        },
        capabilityKind: "prompt",
        promptName: "summarize",
        arguments: { topic: "workspace" },
      });

      expect(inspectedTool.snapshot.serverName).toBe("fixture-draft-memory");
      expect(JSON.stringify(inspectedTool.snapshot.tools)).toContain("echo");
      expect(JSON.stringify(inspectedTool.snapshot.resources)).toContain("memory://workspace");
      expect(JSON.stringify(inspectedTool.snapshot.prompts)).toContain("summarize");
      expect(JSON.stringify(inspectedTool.result)).toContain("/repo/app:hello");
      expect(JSON.stringify(inspectedResource.result)).toContain('\\"workspace\\": \\"fixture\\"');
      expect(JSON.stringify(inspectedPrompt.result)).toContain("Summarize workspace for /repo/app.");
      expect(fixture.starts).toHaveLength(3);
      expect(fixture.starts[0]?.env.TOKEN).toBe("draft-token");
      expect(fixture.starts[0]?.env.ROOT_ONLY).toBe("root-env");
      expect(system.store.getInstance("draft-memory", "/repo/app")).toBeNull();
      expect(
        system.query({
          projectPath: "/repo/app",
          sql: "select name from mcp_enabled where name = $name",
          params: { name: "draft-memory" },
        }).rows,
      ).toHaveLength(0);
    } finally {
      system.close();
      await Promise.all(fixture.servers.map((server) => server.close().catch(() => undefined)));
    }
  });

  test("Scenario: Given an unsaved MCP draft When probe opens and uses capabilities Then one isolated client is reused without durable facts", async () => {
    const fixture = createFixtureTransportFactory();
    const system = createSystem({ transportFactory: fixture.factory });
    try {
      const open = await system.probe({
        action: "open",
        name: "draft-memory",
        projectPath: "/repo/app",
        env: { TOKEN: "draft-token" },
        transport: {
          kind: "stdio",
          command: "fixture",
          env: { TRANSPORT_ONLY: "transport-env" },
        },
      });
      const probeId = readString(open.parsed, "probeId");

      const ping = await system.probe({ action: "ping", probeId });
      const tool = await system.probe({
        action: "call-tool",
        probeId,
        toolName: "echo",
        arguments: { message: "hello" },
      });
      const resource = await system.probe({
        action: "read-resource",
        probeId,
        resourceUri: "memory://workspace",
      });
      const prompt = await system.probe({
        action: "get-prompt",
        probeId,
        promptName: "summarize",
        arguments: { topic: "workspace" },
      });
      const closed = await system.probe({ action: "close", probeId });
      const afterClose = await system.probe({ action: "ping", probeId });

      expect(open.command).toBe("mcp probe");
      expect(open.stdin).toContain('"action": "open"');
      expect(open.stdout).toContain('"probeId"');
      expect(open.stdout).toContain('"serverName": "fixture-draft-memory"');
      expect(ping.exitCode).toBe(0);
      expect(JSON.stringify(tool.parsed)).toContain("/repo/app:hello");
      expect(JSON.stringify(resource.parsed)).toContain('\\"workspace\\": \\"fixture\\"');
      expect(JSON.stringify(prompt.parsed)).toContain("Summarize workspace for /repo/app.");
      expect(closed.parsed).toEqual({ probeId, closed: true });
      expect(afterClose.exitCode).toBe(1);
      expect(afterClose.stderr).toContain("mcp probe not found");
      expect(fixture.starts).toHaveLength(1);
      expect(fixture.starts[0]?.env.TOKEN).toBe("draft-token");
      expect(system.store.getInstance("draft-memory", "/repo/app")).toBeNull();
      expect(
        system.query({
          projectPath: "/repo/app",
          sql: "select name from mcp_enabled where name = $name",
          params: { name: "draft-memory" },
        }).rows,
      ).toHaveLength(0);
      expect(
        system.query({
          sql: "select name from mcp_installed where name = $name",
          params: { name: "draft-memory" },
        }).rows,
      ).toHaveLength(0);
    } finally {
      system.close();
      await Promise.all(fixture.servers.map((server) => server.close().catch(() => undefined)));
    }
  });

  test("Scenario: Given delayed resource registration When probe opens Then discovery waits for a stable resource snapshot", async () => {
    const fixture = createDelayedResourceTransportFactory();
    const system = createSystem({
      transportFactory: fixture.factory,
      discoverySettleMs: 250,
      discoveryPollMs: 25,
    });
    try {
      const open = await system.probe({
        action: "open",
        name: "delayed-docs",
        projectPath: "/repo/app",
        transport: {
          kind: "stdio",
          command: "fixture",
        },
      });
      const snapshot = readRecord(readRecord(open.parsed).snapshot);

      expect(open.exitCode).toBe(0);
      expect(JSON.stringify(snapshot.resources)).toContain("ui://fixture/playground-link");
      expect(JSON.stringify(snapshot.resources)).toContain("fixture://docs/overview.md");
      expect(JSON.stringify(snapshot.resourceTemplates)).toContain("fixture://{/slug*}.md");
      expect(fixture.starts).toHaveLength(1);
    } finally {
      system.close();
      await fixture.close();
    }
  });

  test("Scenario: Given an unsaved MCP draft When app-server hosts an MCP App resource Then the lease owns an isolated protocol session", async () => {
    const fixture = createFixtureTransportFactory();
    const system = createSystem({ transportFactory: fixture.factory });
    try {
      const session = await system.appServerStart({
        name: "draft-app",
        projectPath: "/repo/app",
        env: { TOKEN: "draft-token" },
        transport: {
          kind: "stdio",
          command: "fixture",
          env: { TRANSPORT_ONLY: "transport-env" },
        },
        resourceUri: "ui://fixture/playground-link",
      });
      const events: McpAppServerEvent[] = [];
      const lease = system.attachAppServerLease(session.leaseId, (event) => {
        events.push(event);
      });

      await lease.receive({ jsonrpc: "2.0", id: 1, method: "ui/initialize", params: {} });
      await lease.receive({ jsonrpc: "2.0", id: 2, method: "resources/list", params: {} });
      await lease.receive({
        jsonrpc: "2.0",
        id: 3,
        method: "resources/read",
        params: { uri: "memory://workspace" },
      });

      await waitUntil(
        () => events.filter((event) => event.type === "message").length >= 3,
        "expected app-server JSON-RPC responses",
      );
      const messagePayloads = events.flatMap((event) => (event.type === "message" ? [event.message] : []));

      expect(session.command).toBe("mcp app-server");
      expect(session.hostPath).toContain(`/mcp/apps/${encodeURIComponent(session.leaseId)}/host`);
      expect(system.readAppServerLeaseResource(session.leaseId).html).toContain("Fixture MCP App");
      expect(
        events.some((event) => event.type === "resource" && event.resource.uri === "ui://fixture/playground-link"),
      ).toBeTrue();
      expect(JSON.stringify(messagePayloads.find((message) => readRecord(message).id === 1))).toContain(
        "agenter-mcp-app-server",
      );
      expect(JSON.stringify(messagePayloads.find((message) => readRecord(message).id === 2))).toContain(
        "ui://fixture/playground-link",
      );
      expect(JSON.stringify(messagePayloads.find((message) => readRecord(message).id === 3))).toContain(
        '\\"workspace\\": \\"fixture\\"',
      );
      expect(fixture.starts).toHaveLength(1);
      expect(fixture.starts[0]?.projectPath).toBe("/repo/app");
      expect(fixture.starts[0]?.env.TOKEN).toBe("draft-token");
      expect(system.store.getInstance("draft-app", "/repo/app")).toBeNull();
      expect(
        system.query({
          projectPath: "/repo/app",
          sql: "select name from mcp_enabled where name = $name",
          params: { name: "draft-app" },
        }).rows,
      ).toHaveLength(0);
      expect(
        system.query({
          sql: "select name from mcp_installed where name = $name",
          params: { name: "draft-app" },
        }).rows,
      ).toHaveLength(0);

      lease.release();
      await waitUntil(
        () => system.appServerSnapshot({ sessionId: session.sessionId }).state === "closed",
        "expected app-server lease release to close session",
      );
      expect(() => system.attachAppServerLease(session.leaseId, () => undefined)).toThrow(/lease not found/);
    } finally {
      system.close();
      await Promise.all(fixture.servers.map((server) => server.close().catch(() => undefined)));
    }
  });

  test("Scenario: Given an unsaved MCP draft When inspector starts Then a heavyweight inspector process is isolated and releasable", async () => {
    const fixture = createFixtureTransportFactory();
    const fakeInspectorProcess = createFakeInspectorProcess();
    const spawns: Array<{
      command: string;
      args: string[];
      options: Parameters<McpInspectorSpawnFactory>[2];
    }> = [];
    const system = createSystem({
      transportFactory: fixture.factory,
      inspectorSpawnFactory: (command, args, options) => {
        spawns.push({ command, args, options });
        return fakeInspectorProcess;
      },
    });
    try {
      const started = await system.inspectorStart({
        name: "memory",
        projectPath: "/repo/app",
        env: { TOKEN: "draft-token" },
        transport: {
          kind: "stdio",
          command: "fixture",
          args: ["--stdio"],
          env: { TRANSPORT_ONLY: "transport-env" },
        },
      });
      const events: Array<ReturnType<typeof system.inspectorSnapshot> | unknown> = [];
      const unsubscribe = system.subscribeInspector(started.sessionId, (event) => events.push(event));
      const configIndex = started.args.indexOf("--config");
      const configPath = started.args[configIndex + 1];
      if (!configPath) {
        throw new Error("expected inspector config path");
      }
      const config = readRecord(JSON.parse(readFileSync(configPath, "utf8")));
      const mcpServers = readRecord(config.mcpServers);
      const memoryServer = readRecord(mcpServers.memory);
      const serverPort = spawns[0]?.options.env?.SERVER_PORT;

      fakeInspectorProcess.stdout.write(
        "MCP Inspector ready at http://127.0.0.1:6274/?MCP_PROXY_AUTH_TOKEN=test-token\n",
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      const ready = system.inspectorSnapshot({ sessionId: started.sessionId });
      const closed = await system.inspectorClose({ sessionId: started.sessionId });
      unsubscribe();

      expect(started.command).toBe("bunx");
      expect(started.leaseId).toMatch(/^[0-9a-f-]+$/u);
      expect(started.args).toEqual(["@modelcontextprotocol/inspector", "--config", configPath, "--server", "memory"]);
      expect(spawns[0]?.command).toBe("bunx");
      expect(spawns[0]?.args).toEqual(started.args);
      expect(spawns[0]?.options.cwd).toBe("/repo/app");
      expect(spawns[0]?.options.env?.HOST).toBe("localhost");
      expect(spawns[0]?.options.env?.TOKEN).toBe("draft-token");
      expect(spawns[0]?.options.env?.MCP_AUTO_OPEN_ENABLED).toBe("false");
      expect(JSON.stringify(started.args)).not.toContain("draft-token");
      expect("type" in memoryServer).toBe(false);
      expect(readString(memoryServer, "command")).toBe("fixture");
      expect(ready.state).toBe("ready");
      expect(ready.url).toContain("MCP_PROXY_AUTH_TOKEN=test-token");
      expect(serverPort).toBeDefined();
      expect(ready.url).toContain(`MCP_PROXY_PORT=${serverPort}`);
      expect(closed.state).toBe("closed");
      expect(fakeInspectorProcess.killedSignal).toBe("SIGTERM");
      expect(existsSync(configPath)).toBe(false);
      expect(JSON.stringify(events)).toContain("snapshot");
      expect(JSON.stringify(events)).toContain("log");
    } finally {
      system.close();
      await Promise.all(fixture.servers.map((server) => server.close().catch(() => undefined)));
    }
  });

  test("Scenario: Given an inspector lease When the WebSocket lease is released Then the heavyweight process is closed", async () => {
    const fixture = createFixtureTransportFactory();
    const fakeInspectorProcess = createFakeInspectorProcess();
    const system = createSystem({
      transportFactory: fixture.factory,
      inspectorSpawnFactory: () => fakeInspectorProcess,
    });
    try {
      const started = await system.inspectorStart({
        name: "memory",
        projectPath: "/repo/app",
        transport: {
          kind: "stdio",
          command: "fixture",
          args: ["--stdio"],
        },
      });
      const events: unknown[] = [];
      const releaseLease = system.attachInspectorLease(started.leaseId, (event) => events.push(event));

      releaseLease();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const closed = system.inspectorSnapshot({ sessionId: started.sessionId });
      expect(closed.state).toBe("closed");
      expect(fakeInspectorProcess.killedSignal).toBe("SIGTERM");
      expect(JSON.stringify(events)).toContain("snapshot");
    } finally {
      system.close();
      await Promise.all(fixture.servers.map((server) => server.close().catch(() => undefined)));
    }
  });

  test("Scenario: Given a failed inspector session When the lease is released Then the failed process still gets cleaned up", async () => {
    const fixture = createFixtureTransportFactory();
    const fakeInspectorProcess = createFakeInspectorProcess();
    const system = createSystem({
      transportFactory: fixture.factory,
      inspectorSpawnFactory: () => fakeInspectorProcess,
    });
    try {
      const started = await system.inspectorStart({
        name: "memory",
        projectPath: "/repo/app",
        transport: {
          kind: "stdio",
          command: "fixture",
          args: ["--stdio"],
        },
      });
      const configIndex = started.args.indexOf("--config");
      const configPath = started.args[configIndex + 1];
      if (!configPath) {
        throw new Error("expected inspector config path");
      }

      fakeInspectorProcess.emit("error", new Error("network closed"));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(system.inspectorSnapshot({ sessionId: started.sessionId }).state).toBe("failed");

      const releaseLease = system.attachInspectorLease(started.leaseId, () => undefined);
      releaseLease();

      await waitUntil(
        () => system.inspectorSnapshot({ sessionId: started.sessionId }).state === "closed",
        "expected failed inspector lease release to close session",
      );
      expect(fakeInspectorProcess.killedSignal).toBe("SIGTERM");
      expect(existsSync(configPath)).toBe(false);
    } finally {
      system.close();
      await Promise.all(fixture.servers.map((server) => server.close().catch(() => undefined)));
    }
  });

  test("Scenario: Given an enabled stopped MCP When call disables autoStart Then it rejects without starting", async () => {
    const fixture = createFixtureTransportFactory();
    const system = createSystem({ transportFactory: fixture.factory });
    try {
      addMemoryGlobal(system);
      system.enable({ name: "memory", projectPath: "/repo/app" });

      await expect(
        system.call({
          name: "memory",
          projectPath: "/repo/app",
          toolName: "echo",
          arguments: { message: "hello" },
          autoStart: false,
        }),
      ).rejects.toThrow(/not running/);
      expect(fixture.starts).toHaveLength(0);
    } finally {
      system.close();
      await Promise.all(fixture.servers.map((server) => server.close().catch(() => undefined)));
    }
  });

  test("Scenario: Given one project MCP instance When starting twice Then the same live session is reused", async () => {
    const fixture = createFixtureTransportFactory();
    const system = createSystem({ transportFactory: fixture.factory });
    try {
      addMemoryGlobal(system);
      system.enable({ name: "memory", projectPath: "/repo/app" });

      const first = await system.start({ name: "memory", projectPath: "/repo/app" });
      const second = await system.start({ name: "memory", projectPath: "/repo/app" });

      expect(first.instance.lifecycle).toBe("running");
      expect(second.instance.lifecycle).toBe("running");
      expect(fixture.starts).toHaveLength(1);
    } finally {
      system.close();
      await Promise.all(fixture.servers.map((server) => server.close().catch(() => undefined)));
    }
  });

  test("Scenario: Given a running MCP instance When stop and restart run Then lifecycle facts move through stopped and running", async () => {
    const fixture = createFixtureTransportFactory();
    const system = createSystem({ transportFactory: fixture.factory });
    try {
      addMemoryGlobal(system);
      system.enable({ name: "memory", projectPath: "/repo/app" });

      await system.start({ name: "memory", projectPath: "/repo/app" });
      const stopped = await system.stop({ name: "memory", projectPath: "/repo/app" });
      const restarted = await system.restart({ name: "memory", projectPath: "/repo/app" });

      expect(stopped.instance.lifecycle).toBe("stopped");
      expect(restarted.instance.lifecycle).toBe("running");
      expect(fixture.starts).toHaveLength(2);
    } finally {
      system.close();
      await Promise.all(fixture.servers.map((server) => server.close().catch(() => undefined)));
    }
  });

  test("Scenario: Given previous runtime left live lifecycle facts When mcpSystem opens Then they recover as stopped with snapshots intact", () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-mcp-system-lifecycle-"));
    tempRoots.push(root);
    const dbPath = join(root, "mcp-system.sqlite");
    const seed = new McpSystemStore(dbPath);
    try {
      seed.addGlobal({
        name: "memory",
        transport: { kind: "stdio", command: "fixture" },
      });
      seed.enableProject({ name: "memory", projectPath: "/repo/app" });
      seed.updateInstance({
        name: "memory",
        projectPath: "/repo/app",
        lifecycle: "running",
        lastStartedAt: "2026-05-17T00:00:00.000Z",
      });
      seed.saveSnapshot({
        name: "memory",
        projectPath: "/repo/app",
        serverName: "fixture-memory",
        tools: [{ name: "echo" }],
        resources: [],
        prompts: [],
        snapshot: { source: "previous-runtime" },
        snapshotAt: "2026-05-17T00:00:01.000Z",
      });
    } finally {
      seed.close();
    }

    const fixture = createFixtureTransportFactory();
    const system = createSystem({
      dbPath,
      rootWorkspacePath: join(root, "root-workspace"),
      transportFactory: fixture.factory,
    });
    try {
      const rows = system.query({
        projectPath: "/repo/app",
        sql: "select lifecycle, server_name, tools_json from mcp_enabled where name = $name",
        params: { name: "memory" },
      }).rows;

      expect(rows[0]?.lifecycle).toBe("stopped");
      expect(rows[0]?.server_name).toBe("fixture-memory");
      expect(String(rows[0]?.tools_json)).toContain("echo");
    } finally {
      system.close();
    }
  });

  test("Scenario: Given launch env changes after construction When an MCP starts Then it uses the latest env provider values", async () => {
    const fixture = createFixtureTransportFactory();
    let apiBaseUrl = "http://127.0.0.1:4100";
    const system = createSystem({
      transportFactory: fixture.factory,
      envProvider: () => ({
        AGENTER_ATTENTION_API_BASE_URL: apiBaseUrl,
      }),
    });
    try {
      addMemoryGlobal(system);
      system.enable({ name: "memory", projectPath: "/repo/app" });

      await system.start({ name: "memory", projectPath: "/repo/app" });
      await system.stop({ name: "memory", projectPath: "/repo/app" });
      apiBaseUrl = "http://127.0.0.1:4200";
      await system.start({ name: "memory", projectPath: "/repo/app" });

      expect(fixture.starts[0]?.env.AGENTER_ATTENTION_API_BASE_URL).toBe("http://127.0.0.1:4100");
      expect(fixture.starts[1]?.env.AGENTER_ATTENTION_API_BASE_URL).toBe("http://127.0.0.1:4200");
    } finally {
      system.close();
      await Promise.all(fixture.servers.map((server) => server.close().catch(() => undefined)));
    }
  });
});
