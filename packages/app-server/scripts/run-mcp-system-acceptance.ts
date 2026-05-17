import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generatePrincipalKeyPair } from "@agenter/principal-crypto";
import { Database } from "bun:sqlite";
import { InMemoryFs } from "just-bash";

import { McpSystem } from "../src/mcp-system/system";
import { createRuntimeShellCommands } from "../src/runtime-cli";
import { readRuntimeSkillContent } from "../src/runtime-skills";
import type { RuntimeSkillInfoView, RuntimeSkillView } from "../src/runtime-tool-views";

interface CommandEvidence {
  readonly command: string;
  readonly stdin?: unknown;
  readonly exitCode: number;
  readonly stdoutSummary: unknown;
  readonly stderr: string;
}

interface AcceptanceEvidence {
  readonly generatedAt: string;
  readonly projectPath: string;
  readonly rootWorkspacePath: string;
  readonly dbPath: string;
  readonly sources: {
    readonly sequentialThinkingPackage: string;
    readonly everythingSseServer: string;
  };
  readonly commands: CommandEvidence[];
  readonly actionFacts: Array<Record<string, string | number | null>>;
}

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const repoRoot = resolve(packageRoot, "../..");
const changeDir = join(repoRoot, "openspec", "changes", "add-mcp-system");
const evidencePath = join(changeDir, "acceptance.md");
const generatedAt = new Date().toISOString();
const tempRoot = mkdtempSync(join(tmpdir(), "agenter-mcp-acceptance-"));
const servers: HttpServer[] = [];
const childProcesses: ChildProcessWithoutNullStreams[] = [];

const json = (value: unknown): string => JSON.stringify(value, null, 2);

const parseJson = (value: string): unknown => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return JSON.parse(trimmed) as unknown;
};

const clip = (value: string, maxLength = 1_200): string =>
  value.length > maxLength ? `${value.slice(0, maxLength)}\n...<clipped ${value.length - maxLength} chars>` : value;

const summarizeToolNames = (toolsJson: unknown): string[] => {
  if (typeof toolsJson !== "string" || toolsJson.length === 0) {
    return [];
  }
  const parsed = JSON.parse(toolsJson) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map((tool) =>
      tool && typeof tool === "object" && "name" in tool && typeof tool.name === "string" ? tool.name : null,
    )
    .filter((name): name is string => name !== null);
};

const summarizeRows = (rows: unknown): unknown => {
  if (!Array.isArray(rows)) {
    return rows;
  }
  return rows.map((row) => {
    if (!row || typeof row !== "object") {
      return row;
    }
    const record = row as Record<string, unknown>;
    return {
      ...Object.fromEntries(
        Object.entries(record).filter(([key]) => !["tools_json", "resources_json", "prompts_json", "snapshot_json"].includes(key)),
      ),
      ...(record.tools_json ? { toolNames: summarizeToolNames(record.tools_json) } : {}),
    };
  });
};

const summarizeSnapshot = (snapshot: Record<string, unknown>): Record<string, unknown> => ({
  name: snapshot.name,
  projectPath: snapshot.projectPath,
  serverName: snapshot.serverName,
  serverVersion: snapshot.serverVersion,
  toolNames: Array.isArray(snapshot.tools)
    ? snapshot.tools
        .map((tool) =>
          tool && typeof tool === "object" && "name" in tool && typeof tool.name === "string" ? tool.name : null,
        )
        .filter((name): name is string => name !== null)
    : [],
  snapshotAt: snapshot.snapshotAt,
});

const summarizeInstance = (instance: unknown): unknown => {
  if (!instance || typeof instance !== "object") {
    return instance;
  }
  const record = instance as Record<string, unknown>;
  return {
    name: record.name,
    projectPath: record.projectPath,
    lifecycle: record.lifecycle,
    lastError: record.lastError,
    lastStartedAt: record.lastStartedAt,
    lastStoppedAt: record.lastStoppedAt,
  };
};

const summarizeToolResult = (result: unknown): unknown => {
  if (!result || typeof result !== "object") {
    return result;
  }
  const record = result as Record<string, unknown>;
  const content = Array.isArray(record.content)
    ? record.content.map((item) =>
        item && typeof item === "object" && "text" in item && typeof item.text === "string"
          ? { type: (item as Record<string, unknown>).type, text: clip(item.text, 260) }
          : item,
      )
    : record.content;
  return {
    content,
    structuredContent: record.structuredContent,
  };
};

const summarizeStdout = (command: string, stdout: string): unknown => {
  if (command.endsWith("--help")) {
    return clip(stdout, 1_400);
  }
  const parsed = parseJson(stdout);
  if (!parsed || typeof parsed !== "object") {
    return parsed;
  }
  const payload = parsed as Record<string, unknown>;
  if (Array.isArray(payload.rows)) {
    return { ...payload, rows: summarizeRows(payload.rows) };
  }
  const result = payload.result;
  if (!result || typeof result !== "object") {
    return payload;
  }
  const resultRecord = result as Record<string, unknown>;
  if (resultRecord.snapshot && typeof resultRecord.snapshot === "object") {
    return {
      ...payload,
      result: {
        ...resultRecord,
        instance: summarizeInstance(resultRecord.instance),
        snapshot: summarizeSnapshot(resultRecord.snapshot as Record<string, unknown>),
      },
    };
  }
  if ("instance" in resultRecord || "result" in resultRecord) {
    return {
      ...payload,
      result: {
        ...resultRecord,
        instance: summarizeInstance(resultRecord.instance),
        result: summarizeToolResult(resultRecord.result),
      },
    };
  }
  return payload;
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
  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("error", rejectReady);
    server.listen(0, "127.0.0.1", resolveReady);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("SSE fixture did not expose a TCP address");
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
  };
};

const reserveTcpPort = async (): Promise<number> => {
  const server = createServer();
  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("error", rejectReady);
    server.listen(0, "127.0.0.1", resolveReady);
  });
  const address = server.address();
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  if (!address || typeof address === "string") {
    throw new Error("failed to reserve a TCP port");
  }
  return address.port;
};

const startEverythingSseServer = async (): Promise<{ origin: string; stderr: () => string }> => {
  const port = await reserveTcpPort();
  const sseProcess = spawn("bunx", ["-y", "@modelcontextprotocol/server-everything", "sse"], {
    cwd: tempRoot,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      PORT: String(port),
    },
  });
  childProcesses.push(sseProcess);

  let stderr = "";
  let stdout = "";
  sseProcess.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });
  sseProcess.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8");
  });

  await new Promise<void>((resolveReady, rejectReady) => {
    const timeout = setTimeout(() => {
      rejectReady(new Error(`server-everything SSE did not become ready\nstderr:\n${stderr}\nstdout:\n${stdout}`));
    }, 30_000);
    sseProcess.once("exit", (code, signal) => {
      clearTimeout(timeout);
      rejectReady(new Error(`server-everything SSE exited before ready: code=${code} signal=${signal}\nstderr:\n${stderr}`));
    });
    const poll = setInterval(() => {
      if (stderr.includes(`Server is running on port ${port}`)) {
        clearInterval(poll);
        clearTimeout(timeout);
        resolveReady();
      }
    }, 50);
  });

  return {
    origin: `http://127.0.0.1:${port}`,
    stderr: () => stderr,
  };
};

const terminateChildProcess = async (childProcess: ChildProcessWithoutNullStreams): Promise<void> => {
  await new Promise<void>((resolveClose) => {
    if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
      resolveClose();
      return;
    }

    const pid = childProcess.pid;
    const kill = (signal: NodeJS.Signals) => {
      try {
        if (pid && process.platform !== "win32") {
          process.kill(-pid, signal);
          return;
        }
      } catch {
        // Fall back to killing the direct child below.
      }
      childProcess.kill(signal);
    };

    const hardKillTimer = setTimeout(() => {
      if (childProcess.exitCode === null && childProcess.signalCode === null) {
        kill("SIGKILL");
      }
    }, 2_000);
    childProcess.once("close", () => {
      hardKillTimer[Symbol.dispose]();
      resolveClose();
    });
    kill("SIGTERM");
  });
};

const createRuntimeApi = async (input: {
  mcpSystem: McpSystem;
  rootWorkspacePath: string;
  principalId: string;
}) => {
  const skill = {
    name: "agenter-mcp",
    summary: "Install, enable, query, call, and recover MCP servers through the root runtime CLI.",
    path: join(repoRoot, "packages", "app-server", "skills", "mcp", "SKILL.md"),
    root: join(repoRoot, "packages", "app-server", "skills", "mcp"),
    rootKind: "builtin" as const,
    writable: false,
  } satisfies RuntimeSkillView;

  return await listen(async (request, response) => {
    if (request.method !== "POST" || !request.url) {
      response.writeHead(404).end();
      return;
    }
    const body = await readJsonBody(request);
    let payload: unknown;
    if (request.url === "/v1/skill/list") {
      payload = { ok: true, skills: [skill] };
    } else if (request.url === "/v1/skill/info") {
      payload = {
        ok: true,
        result: {
          skill,
          content: readRuntimeSkillContent(skill.path),
        } satisfies RuntimeSkillInfoView,
      };
    } else if (request.url === "/v1/mcp/add") {
      payload = { ok: true, result: input.mcpSystem.add(body as Parameters<McpSystem["add"]>[0]) };
    } else if (request.url === "/v1/mcp/remove") {
      payload = { ok: true, result: await input.mcpSystem.remove(body as Parameters<McpSystem["remove"]>[0]) };
    } else if (request.url === "/v1/mcp/enable") {
      payload = { ok: true, result: input.mcpSystem.enable(body as Parameters<McpSystem["enable"]>[0]) };
    } else if (request.url === "/v1/mcp/disable") {
      payload = { ok: true, result: await input.mcpSystem.disable(body as Parameters<McpSystem["disable"]>[0]) };
    } else if (request.url === "/v1/mcp/list") {
      payload = { ok: true, rows: input.mcpSystem.list(body as Parameters<McpSystem["list"]>[0]) };
    } else if (request.url === "/v1/mcp/query") {
      payload = { ok: true, rows: input.mcpSystem.query(body as Parameters<McpSystem["query"]>[0]).rows };
    } else if (request.url === "/v1/mcp/start") {
      payload = { ok: true, result: await input.mcpSystem.start(body as Parameters<McpSystem["start"]>[0]) };
    } else if (request.url === "/v1/mcp/stop") {
      payload = { ok: true, result: await input.mcpSystem.stop(body as Parameters<McpSystem["stop"]>[0]) };
    } else if (request.url === "/v1/mcp/restart") {
      payload = { ok: true, result: await input.mcpSystem.restart(body as Parameters<McpSystem["restart"]>[0]) };
    } else if (request.url === "/v1/mcp/call") {
      payload = { ok: true, result: await input.mcpSystem.call(body as Parameters<McpSystem["call"]>[0]) };
    } else {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(`${JSON.stringify(payload)}\n`);
  });
};

const renderMarkdownEvidence = (evidence: AcceptanceEvidence): string => {
  const lines = [
    "# MCP System Acceptance Evidence",
    "",
    `Generated: ${evidence.generatedAt}`,
    "",
    "## Scope",
    "",
    "- Actor: Codex AI agent using root-workspace runtime CLI commands plus MCP skill/help discovery.",
    "- Stdio target: `@modelcontextprotocol/server-sequential-thinking` through `bunx -y`.",
    "- SSE target: official `@modelcontextprotocol/server-everything sse` reference/test server through `bunx -y`.",
    `- Project path: \`${evidence.projectPath}\``,
    `- Root workspace: \`${evidence.rootWorkspacePath}\``,
    `- SQLite database: \`${evidence.dbPath}\``,
    "",
    "## Reviewed Sources",
    "",
    `- Sequential Thinking package: ${evidence.sources.sequentialThinkingPackage}`,
    `- Everything SSE server: ${evidence.sources.everythingSseServer}`,
    "",
    "## Command Transcript",
    "",
  ];
  for (const command of evidence.commands) {
    lines.push(`### ${command.command}`, "", `Exit code: ${command.exitCode}`, "");
    if (command.stdin !== undefined) {
      lines.push("stdin:", "", "```json", json(command.stdin), "```", "");
    }
    lines.push("stdout summary:", "", "```json", json(command.stdoutSummary), "```", "");
    if (command.stderr) {
      lines.push("stderr:", "", "```text", command.stderr.trim(), "```", "");
    }
  }
  lines.push("## Action Facts", "", "```json", json(evidence.actionFacts), "```", "");
  lines.push(
    "## Result",
    "",
    "- PASS: stdio sequential-thinking add/enable/query/list/call/stop/restart ran through the root `mcp` CLI surface.",
    "- PASS: SSE add/enable/call ran through the same root `mcp` CLI surface against the official Everything reference/test server.",
    "- PASS: project-local snapshots and explicit action facts were recorded for both exact project/global pairs.",
    "",
  );
  return `${lines.join("\n")}\n`;
};

const main = async (): Promise<void> => {
  const rootWorkspacePath = join(tempRoot, "root-workspace");
  const projectPath = join(tempRoot, "project");
  const dbPath = join(tempRoot, "mcp-system.sqlite");
  mkdirSync(rootWorkspacePath, { recursive: true });
  mkdirSync(projectPath, { recursive: true });

  const principal = generatePrincipalKeyPair();
  const sse = await startEverythingSseServer();
  const mcpSystem = new McpSystem({
    dbPath,
    rootWorkspacePath,
    runtimeEnv: {
      AGENTER_MCP_ACCEPTANCE: "1",
    },
  });
  const runtimeApi = await createRuntimeApi({
    mcpSystem,
    rootWorkspacePath,
    principalId: principal.principalId,
  });
  const mcpCommand = createRuntimeShellCommands({
    baseUrl: runtimeApi.origin,
    privateKey: principal.privateKey,
    rootWorkspacePath,
    principalId: principal.principalId,
  }).find((command) => command.name === "mcp");
  const skillCommand = createRuntimeShellCommands({
    baseUrl: runtimeApi.origin,
    privateKey: principal.privateKey,
    rootWorkspacePath,
    principalId: principal.principalId,
  }).find((command) => command.name === "skill");
  if (!mcpCommand || !skillCommand) {
    throw new Error("runtime CLI did not expose mcp and skill commands");
  }

  const commands: CommandEvidence[] = [];
  const run = async (
    label: string,
    command: typeof mcpCommand,
    args: string[],
    stdin?: unknown,
  ): Promise<unknown> => {
    const result = await command.execute(args, {
      fs: new InMemoryFs(),
      cwd: rootWorkspacePath,
      env: new Map([["PATH", process.env.PATH ?? ""]]),
      stdin: stdin === undefined ? "" : JSON.stringify(stdin),
    });
    commands.push({
      command: `${label} ${args.join(" ")}`.trim(),
      stdin,
      exitCode: result.exitCode,
      stdoutSummary: summarizeStdout(`${label} ${args.join(" ")}`.trim(), result.stdout),
      stderr: result.stderr,
    });
    if (result.exitCode !== 0) {
      throw new Error(`${label} ${args.join(" ")} failed: ${result.stderr}`);
    }
    return parseJson(result.stdout);
  };

  const skillInfo = await skillCommand.execute(["info", "agenter-mcp", "--json"], {
    fs: new InMemoryFs(),
    cwd: rootWorkspacePath,
    env: new Map([["PATH", process.env.PATH ?? ""]]),
    stdin: "",
  });
  commands.push({
    command: "skill info agenter-mcp --json",
    exitCode: skillInfo.exitCode,
    stdoutSummary: (() => {
      const parsed = parseJson(skillInfo.stdout) as RuntimeSkillInfoView;
      return {
        skill: parsed.skill,
        contentContains: {
          helpFirst: parsed.content.includes("mcp --help"),
          sqlTables: parsed.content.includes("mcp_installed") && parsed.content.includes("mcp_enabled"),
          autoDefaults: parsed.content.includes("autoStart: true") && parsed.content.includes("autoEnable: false"),
          removeStopDefault: parsed.content.includes("mcp remove` defaults to `stop: false"),
        },
      };
    })(),
    stderr: skillInfo.stderr,
  });
  if (skillInfo.exitCode !== 0) {
    throw new Error(`skill info failed: ${skillInfo.stderr}`);
  }

  const queryHelp = await mcpCommand.execute(["query", "--help"], {
    fs: new InMemoryFs(),
    cwd: rootWorkspacePath,
    env: new Map([["PATH", process.env.PATH ?? ""]]),
    stdin: "",
  });
  commands.push({
    command: "mcp query --help",
    exitCode: queryHelp.exitCode,
    stdoutSummary: summarizeStdout("mcp query --help", queryHelp.stdout),
    stderr: queryHelp.stderr,
  });
  if (queryHelp.exitCode !== 0) {
    throw new Error(`mcp query --help failed: ${queryHelp.stderr}`);
  }

  await run("mcp", mcpCommand, ["add"], {
    name: "thinking",
    title: "Sequential Thinking",
    transport: {
      kind: "stdio",
      command: "bunx",
      args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    },
  });
  await run("mcp", mcpCommand, ["query"], {
    projectPath,
    sql: "select name, enabled, enabled_source, lifecycle from mcp_enabled where name = $name",
    params: { name: "thinking" },
  });
  await run("mcp", mcpCommand, ["enable"], { name: "thinking", projectPath });
  await run("mcp", mcpCommand, ["list"], { projectPath });
  await run("mcp", mcpCommand, ["call"], {
    name: "thinking",
    projectPath,
    toolName: "sequentialthinking",
    arguments: {
      thought: "Acceptance: verify stdio MCP invocation through mcpSystem.",
      thoughtNumber: 1,
      totalThoughts: 1,
      nextThoughtNeeded: false,
    },
  });
  await run("mcp", mcpCommand, ["query"], {
    projectPath,
    sql: "select name, enabled, lifecycle, server_name, tools_json from mcp_enabled where name = $name",
    params: { name: "thinking" },
  });
  await run("mcp", mcpCommand, ["stop"], { name: "thinking", projectPath });
  await run("mcp", mcpCommand, ["restart"], { name: "thinking", projectPath });
  await run("mcp", mcpCommand, ["stop"], { name: "thinking", projectPath });

  await run("mcp", mcpCommand, ["add"], {
    name: "sse-echo",
    title: "SSE Echo",
    transport: {
      kind: "sse",
      url: `${sse.origin}/sse`,
    },
  });
  await run("mcp", mcpCommand, ["enable"], { name: "sse-echo", projectPath });
  await run("mcp", mcpCommand, ["call"], {
    name: "sse-echo",
    projectPath,
    toolName: "echo",
    arguments: { message: "hello" },
  });
  await run("mcp", mcpCommand, ["query"], {
    projectPath,
    sql: "select name, enabled, lifecycle, server_name, tools_json from mcp_enabled order by name",
  });
  await run("mcp", mcpCommand, ["stop"], { name: "sse-echo", projectPath });

  const db = new Database(dbPath, { readonly: true, strict: true });
  const actionFacts = db
    .query<Record<string, string | number | null>, []>(
      `select action, name, project_path, tool_name, auto_start, auto_enable, status, error
       from mcp_actions
       order by action_id`,
    )
    .all();
  db.close();

  const evidence: AcceptanceEvidence = {
    generatedAt,
    projectPath,
    rootWorkspacePath,
    dbPath,
    sources: {
      sequentialThinkingPackage: "https://www.npmjs.com/package/@modelcontextprotocol/server-sequential-thinking",
      everythingSseServer: "https://github.com/modelcontextprotocol/servers/blob/main/src/everything/README.md",
    },
    commands,
    actionFacts,
  };

  mkdirSync(changeDir, { recursive: true });
  writeFileSync(evidencePath, renderMarkdownEvidence(evidence), "utf8");
  console.log(`MCP system acceptance passed: ${evidencePath}`);

  mcpSystem.close();
};

try {
  await main();
} finally {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolveClose) => {
          server.close(() => resolveClose());
        }),
    ),
  );
  await Promise.all(childProcesses.splice(0).map(terminateChildProcess));
  rmSync(tempRoot, { recursive: true, force: true });
}
