import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { McpSystemStore } from "../src/mcp-system/store";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

const createStore = (): McpSystemStore => {
  const root = mkdtempSync(join(tmpdir(), "agenter-mcp-system-"));
  tempRoots.push(root);
  return new McpSystemStore(join(root, "mcp-system.sqlite"));
};

const addSequentialThinking = (store: McpSystemStore, name = "thinking") =>
  store.addGlobal({
    name,
    title: "Sequential Thinking",
    description: "Structured reasoning MCP",
    transport: {
      kind: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      env: { MCP_MODE: "stdio" },
    },
    env: { TOKEN: "global-token" },
  });

describe("Feature: mcpSystem durable store", () => {
  test("Scenario: Given a global MCP is added When project facts are queried Then the global stays disabled and stopped by default", () => {
    const store = createStore();
    try {
      const projectPath = "/repo/app";

      addSequentialThinking(store);

      expect(store.getExplicitEnablement("thinking", projectPath)).toBeNull();
      expect(store.getInstance("thinking", projectPath)).toBeNull();
      expect(store.listProject({ projectPath })).toEqual([]);

      const rows = store.query({
        projectPath,
        sql: "select name, project_path, enabled, enabled_source, lifecycle from mcp_enabled where name = $name",
        params: { name: "thinking" },
      }).rows;

      expect(rows).toEqual([
        {
          name: "thinking",
          project_path: "/repo/app",
          enabled: 0,
          enabled_source: "default",
          lifecycle: null,
        },
      ]);
    } finally {
      store.close();
    }
  });

  test("Scenario: Given no project path When querying enablement Then default disabled rows are not invented", () => {
    const store = createStore();
    try {
      addSequentialThinking(store);

      const rows = store.query({
        sql: "select name, enabled, enabled_source from mcp_enabled",
      }).rows;

      expect(rows).toEqual([]);
    } finally {
      store.close();
    }
  });

  test("Scenario: Given a project enables an MCP When listing the project Then only enabled rows with global overview are returned", () => {
    const store = createStore();
    try {
      addSequentialThinking(store);
      store.addGlobal({
        name: "filesystem",
        title: "Filesystem",
        description: "File tools",
        transport: { kind: "stdio", command: "node", args: ["server.js"] },
      });
      store.enableProject({ name: "thinking", projectPath: "/repo/app" });

      const rows = store.listProject({ projectPath: "/repo/app" });

      expect(rows.map((row) => row.name)).toEqual(["thinking"]);
      expect(rows[0]?.title).toBe("Sequential Thinking");
      expect(rows[0]?.description).toBe("Structured reasoning MCP");
      expect(rows[0]?.lifecycle).toBeNull();
      expect(rows[0]?.snapshot_json).toBeNull();
    } finally {
      store.close();
    }
  });

  test("Scenario: Given parent and child project paths When one is enabled Then enablement and snapshots do not inherit", () => {
    const store = createStore();
    try {
      addSequentialThinking(store);
      store.enableProject({ name: "thinking", projectPath: "/repo" });
      store.updateInstance({
        name: "thinking",
        projectPath: "/repo",
        lifecycle: "running",
        lastStartedAt: "2026-05-17T00:00:00.000Z",
      });
      store.saveSnapshot({
        name: "thinking",
        projectPath: "/repo",
        serverName: "parent-server",
        serverVersion: "1.0.0",
        protocolVersion: "2025-06-18",
        tools: [{ name: "parent_tool" }],
        resources: [],
        prompts: [],
        snapshot: { source: "parent" },
        snapshotAt: "2026-05-17T00:00:01.000Z",
      });

      expect(store.listProject({ projectPath: "/repo" }).map((row) => row.name)).toEqual(["thinking"]);
      expect(store.listProject({ projectPath: "/repo/app" })).toEqual([]);

      const childRows = store.query({
        projectPath: "/repo/app",
        sql: "select name, enabled, enabled_source, lifecycle, server_name, tools_json from mcp_enabled where name = $name",
        params: { name: "thinking" },
      }).rows;

      expect(childRows).toEqual([
        {
          name: "thinking",
          enabled: 0,
          enabled_source: "default",
          lifecycle: null,
          server_name: null,
          tools_json: null,
        },
      ]);
    } finally {
      store.close();
    }
  });

  test("Scenario: Given a running project instance When removing the global without stop Then removal is blocked and facts remain active", () => {
    const store = createStore();
    try {
      addSequentialThinking(store);
      store.enableProject({ name: "thinking", projectPath: "/repo/app" });
      store.updateInstance({
        name: "thinking",
        projectPath: "/repo/app",
        lifecycle: "running",
        lastStartedAt: "2026-05-17T00:00:00.000Z",
      });

      const result = store.removeGlobal({ name: "thinking" });

      expect(result).toEqual({ removed: false, blockedProjects: ["/repo/app"] });
      expect(store.getGlobal("thinking")?.name).toBe("thinking");
      expect(store.requireEnabledProject("thinking", "/repo/app").enabled).toBeTrue();
      expect(store.getInstance("thinking", "/repo/app")?.lifecycle).toBe("running");
    } finally {
      store.close();
    }
  });

  test("Scenario: Given a running project instance When removing the global with stop Then instances stop and enablement is revoked", () => {
    const store = createStore();
    try {
      addSequentialThinking(store);
      store.enableProject({ name: "thinking", projectPath: "/repo/app" });
      store.updateInstance({
        name: "thinking",
        projectPath: "/repo/app",
        lifecycle: "running",
        lastStartedAt: "2026-05-17T00:00:00.000Z",
      });

      const result = store.removeGlobal({ name: "thinking", stop: true });

      expect(result).toEqual({ removed: true, blockedProjects: [] });
      expect(store.getGlobal("thinking")).toBeNull();
      expect(store.getExplicitEnablement("thinking", "/repo/app")?.enabled).toBeFalse();
      expect(store.getInstance("thinking", "/repo/app")?.lifecycle).toBe("stopped");
    } finally {
      store.close();
    }
  });

  test("Scenario: Given project enablement When disabling Then the default stop behavior is visible but can be skipped", () => {
    const store = createStore();
    try {
      addSequentialThinking(store);
      store.enableProject({ name: "thinking", projectPath: "/repo/app" });
      store.updateInstance({ name: "thinking", projectPath: "/repo/app", lifecycle: "running" });

      store.disableProject({ name: "thinking", projectPath: "/repo/app" });
      expect(store.getExplicitEnablement("thinking", "/repo/app")?.enabled).toBeFalse();
      expect(store.getInstance("thinking", "/repo/app")?.lifecycle).toBe("stopped");

      store.enableProject({ name: "thinking", projectPath: "/repo/app" });
      store.updateInstance({ name: "thinking", projectPath: "/repo/app", lifecycle: "running" });
      store.disableProject({ name: "thinking", projectPath: "/repo/app", stop: false });

      expect(store.getExplicitEnablement("thinking", "/repo/app")?.enabled).toBeFalse();
      expect(store.getInstance("thinking", "/repo/app")?.lifecycle).toBe("running");
    } finally {
      store.close();
    }
  });

  test("Scenario: Given snapshots are stored When SQL searches JSON Then mcp query returns JSON rows only", () => {
    const store = createStore();
    try {
      addSequentialThinking(store);
      store.enableProject({ name: "thinking", projectPath: "/repo/app" });
      store.saveSnapshot({
        name: "thinking",
        projectPath: "/repo/app",
        serverName: "seq",
        serverVersion: "1.0.0",
        protocolVersion: "2025-06-18",
        tools: [{ name: "sequentialthinking" }],
        resources: [],
        prompts: [],
        snapshot: { tools: [{ name: "sequentialthinking" }] },
        snapshotAt: "2026-05-17T00:00:01.000Z",
      });

      const rows = store.query({
        projectPath: "/repo/app",
        sql: [
          "select name, server_name, json_extract(tools_json, '$[0].name') as first_tool",
          "from mcp_enabled",
          "where tools_json like $pattern",
        ].join(" "),
        params: { pattern: "%sequentialthinking%" },
      }).rows;

      expect(rows).toEqual([
        {
          name: "thinking",
          server_name: "seq",
          first_tool: "sequentialthinking",
        },
      ]);
    } finally {
      store.close();
    }
  });

  test("Scenario: Given caller SQL When it is not read-only Then mcp query rejects it", () => {
    const store = createStore();
    try {
      addSequentialThinking(store);

      expect(() =>
        store.query({
          sql: "delete from mcp_installed where name = $name",
          params: { name: "thinking" },
        }),
      ).toThrow(/must start with SELECT, WITH, or EXPLAIN QUERY PLAN/);
      expect(() =>
        store.query({
          sql: "select * from mcp_installed; select * from mcp_enabled",
        }),
      ).toThrow(/exactly one statement/);
      expect(() =>
        store.query({
          sql: "pragma table_info(mcp_installed)",
        }),
      ).toThrow(/must start with SELECT, WITH, or EXPLAIN QUERY PLAN/);
    } finally {
      store.close();
    }
  });

  test("Scenario: Given mcp facts exist When a new store opens the same database Then facts survive runtime restart", () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-mcp-system-"));
    tempRoots.push(root);
    const filePath = join(root, "mcp-system.sqlite");

    const first = new McpSystemStore(filePath);
    first.addGlobal({
      name: "remote",
      transport: { kind: "sse", url: "http://127.0.0.1:3000/sse", headers: { authorization: "Bearer test" } },
    });
    first.enableProject({ name: "remote", projectPath: "/repo/app" });
    first.saveSnapshot({
      name: "remote",
      projectPath: "/repo/app",
      serverName: "remote-server",
      tools: [{ name: "echo" }],
      resources: [],
      prompts: [],
      snapshot: { transport: "sse" },
      snapshotAt: "2026-05-17T00:00:01.000Z",
    });
    first.close();

    const second = new McpSystemStore(filePath);
    try {
      expect(second.getGlobal("remote")?.transport).toEqual({
        kind: "sse",
        url: "http://127.0.0.1:3000/sse",
        headers: { authorization: "Bearer test" },
      });
      expect(second.requireEnabledProject("remote", "/repo/app").enabled).toBeTrue();
      expect(second.listProject({ projectPath: "/repo/app" })[0]?.server_name).toBe("remote-server");
    } finally {
      second.close();
    }
  });
});
