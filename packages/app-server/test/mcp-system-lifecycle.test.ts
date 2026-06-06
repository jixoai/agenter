import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { McpSystemStore } from "../src/mcp-system/store";
import { McpSystem } from "../src/mcp-system/system";
import type { McpTransportStartContext } from "../src/mcp-system/types";

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
  runtimeEnvProvider?: () => Record<string, string>;
}): McpSystem => {
  const root = mkdtempSync(join(tmpdir(), "agenter-mcp-system-lifecycle-"));
  tempRoots.push(root);
  return new McpSystem({
    dbPath: input.dbPath ?? join(root, "mcp-system.sqlite"),
    rootWorkspacePath: input.rootWorkspacePath ?? join(root, "root-workspace"),
    runtimeEnv: {
      ROOT_ONLY: "root-env",
      TOKEN: "root-token",
    },
    runtimeEnvProvider: input.runtimeEnvProvider,
    transportFactory: input.transportFactory,
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
    servers.push(server);
    void server.connect(serverTransport);
    return clientTransport;
  };
  return { factory, starts, servers };
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

  test("Scenario: Given runtime env changes after construction When an MCP starts Then it uses the latest env provider values", async () => {
    const fixture = createFixtureTransportFactory();
    let apiBaseUrl = "http://127.0.0.1:4100";
    const system = createSystem({
      transportFactory: fixture.factory,
      runtimeEnvProvider: () => ({
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
