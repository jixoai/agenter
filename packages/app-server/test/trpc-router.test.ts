import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { resolveGlobalAvatarCanonicalRoot } from "@agenter/avatar";
import type { MessageControlPlane } from "@agenter/message-system";
import { writeNotePage } from "@agenter/note-system";
import {
  DEFAULT_TERMINAL_BACKEND,
  TerminalDb,
  type TerminalActorId,
  type TerminalApprovalRequestRecord,
  type TerminalControlPlane,
} from "@agenter/terminal-system";
import { AppKernel, SessionDb, appRouter, createTrpcContext } from "../src";
import type { AnyRuntimeEvent } from "../src/realtime-types";
import { UsageAnalyticsDb } from "../src/usage-analytics-db";
import { resolveUsageAnalyticsDbPathFromAvatarRoot } from "../src/usage-analytics-paths";
import { GLOBAL_WORKSPACE_PATH } from "../src/workspace-target";
import { createMockKernelHarness } from "../test-support/mock-kernel-harness";

const tempDirs: string[] = [];
const settleFilesystem = async (): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, 25));
};

const makeTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-trpc-router-"));
  tempDirs.push(dir);
  return dir;
};

const seedGlobalRunningTerminalRecord = (input: {
  stateRoot: string;
  terminalId: string;
  cwd: string;
  stoppedAt?: number;
}): void => {
  const db = new TerminalDb(join(input.stateRoot, ".terminal", "terminal.db"));
  db.createTerminal({
    terminalId: input.terminalId,
    processKind: "shell",
    backend: DEFAULT_TERMINAL_BACKEND,
    command: ["sh", "-lc", "cat"],
    launchCwd: input.cwd,
    profile: {},
    metadata: {},
    processPhase: "running",
    lastStopReason: null,
    lastExitCode: null,
    lastExitSignal: null,
    lastStoppedAt: input.stoppedAt ?? null,
    archivedAt: null,
  });
  db.close();
};

afterEach(async () => {
  await settleFilesystem();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const ROOT_AUTH_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f094538c5f1b6f6db1d4c4a2a2d5f6b7c8d9e0f1";
const mcpStdioFixturePath = fileURLToPath(new URL("./fixtures/mcp-stdio-fixture-server.ts", import.meta.url));

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

const createRootSuperadminCaller = async (kernel: AppKernel) => {
  const anonymousCaller = appRouter.createCaller(await createTrpcContext(kernel));
  const descriptor = await anonymousCaller.auth.service();
  const autoLogin = await anonymousCaller.auth.autoLogin();
  if (!autoLogin.ok) {
    throw new Error(`expected daemon auto login to succeed, got ${autoLogin.reason}: ${autoLogin.message}`);
  }
  const session = autoLogin.session;
  const caller = appRouter.createCaller(
    await createTrpcContext({
      kernel,
      authorizationHeader: `Bearer ${session.token}`,
    }),
  );
  return {
    anonymousCaller,
    caller,
    descriptor,
    session,
  };
};

const createWalletAuthCaller = async (kernel: AppKernel) => {
  const anonymousCaller = appRouter.createCaller(await createTrpcContext(kernel));
  const account = privateKeyToAccount(generatePrivateKey());
  const authId = account.address.toLowerCase();
  const challenge = await anonymousCaller.auth.challengeStart({ authId });
  const session = await anonymousCaller.auth.challengeVerify({
    challengeId: challenge.challengeId,
    signature: await account.signMessage({ message: challenge.challengeText }),
  });
  const caller = appRouter.createCaller(
    await createTrpcContext({
      kernel,
      authorizationHeader: `Bearer ${session.token}`,
    }),
  );
  return {
    account,
    authId,
    actorId: `auth:${authId}` as TerminalActorId,
    caller,
    session,
  };
};

const seedHeartbeatRecords = (input: {
  dbPath: string;
  startAt: number;
  recordCount: number;
}): {
  recordKeys: string[];
} => {
  const db = new SessionDb(input.dbPath);
  try {
    const recordKeys: string[] = [];
    for (let index = 0; index < input.recordCount; index += 1) {
      const kindIndex = index % 3;
      if (kindIndex === 0) {
        const call = db.appendAiCall({
          roundIndex: index + 1,
          kind: "chat",
          status: "done",
          provider: "openai",
          model: `gpt-test-${String(index).padStart(3, "0")}`,
          requestUrl: "https://api.example.test/v1/responses",
          requestBody: {
            model: "gpt-test",
            meta: {
              batch: Math.floor(index / 3),
              flags: {
                compact: false,
                config: index % 9 === 0,
              },
            },
          },
          createdAt: input.startAt + index * 1_000,
          updatedAt: input.startAt + index * 1_000 + 900,
          completedAt: input.startAt + index * 1_000 + 900,
          isComplete: true,
        });
        const requestMessageId = `seed-${index}-request`;
        const responseMessageId = `seed-${index}-response`;
        db.upsertMessage({
          messageId: requestMessageId,
          aiCallId: call.id,
          roundIndex: index + 1,
          scope: "heartbeat_part",
          role: "user",
          createdAt: input.startAt + index * 1_000,
          updatedAt: input.startAt + index * 1_000 + 30,
          parts: [
            {
              partType: "text",
              payload: {
                type: "text",
                content: `structured request ${index}`,
              },
            },
          ],
        });
        db.upsertMessage({
          messageId: responseMessageId,
          aiCallId: call.id,
          roundIndex: index + 1,
          scope: "heartbeat_part",
          role: "assistant",
          createdAt: input.startAt + index * 1_000 + 100,
          updatedAt: input.startAt + index * 1_000 + 900,
          parts: [
            {
              partType: "thinking",
              payload: {
                type: "thinking",
                content: `reasoning block ${index}`,
              },
            },
            {
              partType: "tool_call",
              payload: {
                name: "workspace_read",
                arguments: { path: `docs/${index}.md` },
              },
            },
            {
              partType: "text",
              payload: {
                type: "text",
                content: `structured response ${index}`,
              },
            },
          ],
        });
        db.updateAiCall(call.id, {
          requestMessageIds: [requestMessageId],
          responseMessageIds: [responseMessageId],
        });
        recordKeys.push(`heartbeat-record:model_call:${call.id}`);
        continue;
      }
      if (kindIndex === 1) {
        const call = db.appendAiCall({
          roundIndex: index + 1,
          kind: "compact",
          status: "done",
          provider: "openai",
          model: `gpt-test-${String(index).padStart(3, "0")}`,
          requestUrl: "https://api.example.test/v1/responses",
          requestBody: {
            model: "gpt-test",
            compact: { mode: "bulk", batch: Math.floor(index / 3) },
          },
          createdAt: input.startAt + index * 1_000,
          updatedAt: input.startAt + index * 1_000 + 700,
          completedAt: input.startAt + index * 1_000 + 700,
          isComplete: true,
        });
        const responseMessageId = `seed-${index}-compact-response`;
        db.upsertMessage({
          messageId: responseMessageId,
          aiCallId: call.id,
          roundIndex: index + 1,
          scope: "heartbeat_part",
          role: "assistant",
          createdAt: input.startAt + index * 1_000 + 400,
          updatedAt: input.startAt + index * 1_000 + 700,
          parts: [
            {
              partType: "compact",
              payload: {
                type: "compact",
                content: {
                  before: [`seed-${index - 1}`],
                  after: [`seed-${index}`],
                },
              },
            },
            {
              partType: "text",
              payload: {
                type: "text",
                content: `compact summary ${index}`,
              },
            },
          ],
        });
        db.updateAiCall(call.id, {
          responseMessageIds: [responseMessageId],
        });
        recordKeys.push(`heartbeat-record:compact:${call.id}`);
        continue;
      }

      const messageId = `seed-config-${index}`;
      db.upsertMessage({
        messageId,
        roundIndex: index + 1,
        scope: "request_aux",
        role: "config",
        createdAt: input.startAt + index * 1_000,
        updatedAt: input.startAt + index * 1_000 + 50,
        parts: [
          {
            partType: "config",
            payload: {
              thinking: index % 2 === 0,
              maxToken: 4_096 + index,
              topK: index % 5 === 0 ? 3 : 1,
            },
          },
        ],
      });
      recordKeys.push(`heartbeat-record:config:${messageId}`);
    }
    db.refreshHeartbeatRecords();
    return { recordKeys };
  } finally {
    db.close();
  }
};

const readHeartbeatRecordRows = (
  dbPath: string,
): Array<{
  id: number;
  recordKey: string;
  kind: string;
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
  previewText: string | null;
  sourceRefsJson: string;
  summaryJson: string;
  isComplete: number;
}> => {
  const db = new Database(dbPath, { strict: true });
  try {
    const rows = db
      .query(
        `select id,
                record_key,
                kind,
                started_at,
                updated_at,
                completed_at,
                preview_text,
                source_refs_json,
                summary_json,
                is_complete
         from heartbeat_record
         order by started_at asc, id asc`,
      )
      .all() as Array<{
      id: number;
      record_key: string;
      kind: string;
      started_at: number;
      updated_at: number;
      completed_at: number | null;
      preview_text: string | null;
      source_refs_json: string;
      summary_json: string;
      is_complete: number;
    }>;
    return rows.map((row) => ({
      id: row.id,
      recordKey: row.record_key,
      kind: row.kind,
      startedAt: row.started_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      previewText: row.preview_text,
      sourceRefsJson: row.source_refs_json,
      summaryJson: row.summary_json,
      isComplete: row.is_complete,
    }));
  } finally {
    db.close();
  }
};

type TestObservable<T> = {
  subscribe(observer: { next?: (value: T) => void; error?: (error: unknown) => void; complete?: () => void }): {
    unsubscribe(): void;
  };
};

const waitForEvent = async <T>(
  read: () => T | Promise<T | null> | null,
  input: {
    label: string;
    timeoutMs?: number;
  },
): Promise<T> => {
  const timeoutMs = input.timeoutMs ?? 30_000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (value !== null) {
      return value;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`timed out waiting for ${input.label}`);
};

describe("Feature: app-server trpc procedures", () => {
  test("Scenario: Given no AvatarRuntime is running When Avatar-owned MCP is added enabled started and stopped Then lifecycle facts stay under MCP authority", async () => {
    const root = makeTempDir();
    const projectPath = join(root, "project");
    mkdirSync(projectPath, { recursive: true });
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    try {
      const { caller } = await createRootSuperadminCaller(kernel);
      await caller.mcp.add({
        avatarNickname: "default",
        name: "stdio-fixture",
        title: "Stdio Fixture",
        transport: {
          kind: "stdio",
          command: "bun",
          args: ["run", mcpStdioFixturePath],
          env: {
            AGENTER_MCP_FIXTURE_MODE: "avatar-owned",
          },
        },
      });
      await caller.mcp.enable({
        avatarNickname: "default",
        name: "stdio-fixture",
        projectPath,
      });

      const started = await caller.mcp.start({
        avatarNickname: "default",
        name: "stdio-fixture",
        projectPath,
      });
      const listed = await caller.mcp.list({
        avatarNickname: "default",
        projectPath,
        includeSnapshots: true,
      });
      const stopped = await caller.mcp.stop({
        avatarNickname: "default",
        name: "stdio-fixture",
        projectPath,
      });

      expect(kernel.listSessions()).toHaveLength(0);
      expect(started.snapshot?.serverName).toBe("agenter-stdio-fixture");
      expect(JSON.stringify(started.snapshot?.tools)).toContain("fixture_echo");
      expect(listed[0]?.lifecycle).toBe("running");
      expect(stopped.instance.lifecycle).toBe("stopped");
    } finally {
      await kernel.stop();
    }
  });

  test("Scenario: Given an unsaved MCP draft When caller.mcp.inspect runs Then Studio can test capability actions without persisting config truth", async () => {
    const root = makeTempDir();
    const projectPath = join(root, "project");
    mkdirSync(projectPath, { recursive: true });
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    try {
      const { caller } = await createRootSuperadminCaller(kernel);
      const inspectedTool = await caller.mcp.inspect({
        avatarNickname: "default",
        name: "draft-fixture",
        projectPath,
        transport: {
          kind: "stdio",
          command: "bun",
          args: ["run", mcpStdioFixturePath],
          env: {
            AGENTER_MCP_FIXTURE_MODE: "draft-inspect",
          },
        },
        capabilityKind: "tool",
        toolName: "fixture_echo",
        arguments: { message: "hello" },
      });
      const inspectedResource = await caller.mcp.inspect({
        avatarNickname: "default",
        name: "draft-fixture",
        projectPath,
        transport: {
          kind: "stdio",
          command: "bun",
          args: ["run", mcpStdioFixturePath],
          env: {
            AGENTER_MCP_FIXTURE_MODE: "draft-inspect",
          },
        },
        capabilityKind: "resource",
        resourceUri: "fixture://workspace/readme",
      });
      const inspectedPrompt = await caller.mcp.inspect({
        avatarNickname: "default",
        name: "draft-fixture",
        projectPath,
        transport: {
          kind: "stdio",
          command: "bun",
          args: ["run", mcpStdioFixturePath],
          env: {
            AGENTER_MCP_FIXTURE_MODE: "draft-inspect",
          },
        },
        capabilityKind: "prompt",
        promptName: "fixture_summarize",
        arguments: { topic: "workspace" },
      });

      expect(inspectedTool.snapshot.serverName).toBe("agenter-stdio-fixture");
      expect(JSON.stringify(inspectedTool.snapshot.tools)).toContain("fixture_echo");
      expect(JSON.stringify(inspectedTool.snapshot.resources)).toContain("fixture://workspace/readme");
      expect(JSON.stringify(inspectedTool.snapshot.prompts)).toContain("fixture_summarize");
      expect(JSON.stringify(inspectedTool.result)).toContain(`${projectPath}:draft-inspect:hello`);
      expect(JSON.stringify(inspectedResource.result)).toContain("fixture://workspace/readme");
      expect(JSON.stringify(inspectedPrompt.result)).toContain("workspace");
      expect(
        await caller.mcp.query({
          avatarNickname: "default",
          projectPath,
          sql: "select name from mcp_installed where name = $name",
          params: { name: "draft-fixture" },
        }),
      ).toEqual({ rows: [] });
    } finally {
      await kernel.stop();
    }
  });

  test("Scenario: Given an unsaved MCP draft When caller.mcp.probe runs Then Studio uses a CLI-shaped isolated session without durable writes", async () => {
    const root = makeTempDir();
    const projectPath = join(root, "project");
    mkdirSync(projectPath, { recursive: true });
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    try {
      const { caller } = await createRootSuperadminCaller(kernel);
      const open = await caller.mcp.probe({
        avatarNickname: "default",
        action: "open",
        name: "draft-fixture",
        projectPath,
        transport: {
          kind: "stdio",
          command: "bun",
          args: ["run", mcpStdioFixturePath],
          env: {
            AGENTER_MCP_FIXTURE_MODE: "draft-probe",
          },
        },
      });
      const probeId = readString(open.parsed, "probeId");
      const ping = await caller.mcp.probe({
        avatarNickname: "default",
        action: "ping",
        probeId,
      });
      const tool = await caller.mcp.probe({
        avatarNickname: "default",
        action: "call-tool",
        probeId,
        toolName: "fixture_echo",
        arguments: { message: "hello" },
      });
      const resource = await caller.mcp.probe({
        avatarNickname: "default",
        action: "read-resource",
        probeId,
        resourceUri: "fixture://workspace/readme",
      });
      const prompt = await caller.mcp.probe({
        avatarNickname: "default",
        action: "get-prompt",
        probeId,
        promptName: "fixture_summarize",
        arguments: { topic: "workspace" },
      });
      const close = await caller.mcp.probe({
        avatarNickname: "default",
        action: "close",
        probeId,
      });

      expect(open.command).toBe("mcp probe");
      expect(open.stdout).toContain('"probeId"');
      expect(open.stdout).toContain("agenter-stdio-fixture");
      expect(ping.exitCode).toBe(0);
      expect(JSON.stringify(tool.parsed)).toContain(`${projectPath}:draft-probe:hello`);
      expect(JSON.stringify(resource.parsed)).toContain("fixture://workspace/readme");
      expect(JSON.stringify(prompt.parsed)).toContain("workspace");
      expect(close.parsed).toEqual({ probeId, closed: true });
      expect(kernel.listSessions()).toHaveLength(0);
      expect(
        await caller.mcp.query({
          avatarNickname: "default",
          projectPath,
          sql: "select name from mcp_installed where name = $name",
          params: { name: "draft-fixture" },
        }),
      ).toEqual({ rows: [] });
    } finally {
      await kernel.stop();
    }
  });

  test("Scenario: Given one Avatar already owns an MCP id When mcp.add repeats the id Then override must be explicit", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    try {
      const { caller } = await createRootSuperadminCaller(kernel);
      await caller.mcp.add({
        avatarNickname: "default",
        name: "stdio-fixture",
        title: "First",
        transport: {
          kind: "stdio",
          command: "bun",
          args: ["run", mcpStdioFixturePath],
        },
      });

      await expect(
        caller.mcp.add({
          avatarNickname: "default",
          name: "stdio-fixture",
          title: "Second",
          transport: {
            kind: "stdio",
            command: "node",
            args: ["replacement.js"],
          },
        }),
      ).rejects.toThrow("mcp global already exists: stdio-fixture; pass override true to replace");

      const replaced = await caller.mcp.add({
        avatarNickname: "default",
        name: "stdio-fixture",
        title: "Second",
        transport: {
          kind: "stdio",
          command: "node",
          args: ["replacement.js"],
        },
        override: true,
      });

      expect(replaced.title).toBe("Second");
      expect(replaced.transport).toEqual({
        kind: "stdio",
        command: "node",
        args: ["replacement.js"],
        env: {},
      });
    } finally {
      await kernel.stop();
    }
  });

  test("Scenario: Given avatar notes exist When NoteSystem TRPC catalog page and search are requested Then typed projections hide filesystem reads behind the backend contract", async () => {
    const root = makeTempDir();
    const homeDir = join(root, "home");
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir,
    });
    await kernel.start();
    try {
      const { caller } = await createRootSuperadminCaller(kernel);
      const created = await caller.avatar.create({
        nickname: "note-reader",
        displayName: "Note Reader",
      });
      const principalId = created.avatar.avatarPrincipalId;
      if (!principalId) {
        throw new Error("expected created avatar principal id");
      }
      const avatarHome = resolveGlobalAvatarCanonicalRoot(principalId, homeDir);
      writeNotePage({
        avatarHome: [avatarHome],
        notebook: "ideas",
        section: "shell",
        page: "typed-surface",
        content: "Typed NoteSystem projection keeps Studio away from raw filesystem reads.",
        mime: "text/markdown",
        tags: ["studio", "contract"],
        now: new Date("2026-05-31T15:30:00.000Z"),
        sourceWorkspace: "/repo",
      });
      writeNotePage({
        avatarHome: [avatarHome],
        notebook: "ideas",
        section: "ux",
        page: "scope-tabs",
        content: "Scope tab notes stay under one avatar.",
        mime: "text/markdown",
        now: new Date("2026-05-31T15:31:00.000Z"),
        sourceWorkspace: "/repo",
      });
      writeNotePage({
        avatarHome: [avatarHome],
        notebook: "logs",
        section: "daily",
        page: "today",
        content: "Daily log.",
        mime: "text/markdown",
        now: new Date("2026-05-31T15:32:00.000Z"),
        sourceWorkspace: "/repo",
      });

      const catalog = await caller.note.catalog({ avatarNickname: "note-reader" });
      const notebooks = await caller.note.notebooks({ avatarNickname: "note-reader", limit: 1 });
      const updatedNotebooks = await caller.note.notebooks({
        avatarNickname: "note-reader",
        sort: "updatedAt",
        limit: 1,
      });
      const secondNotebookPage = await caller.note.notebooks({
        avatarNickname: "note-reader",
        cursor: notebooks.nextCursor ?? undefined,
        limit: 1,
      });
      const sections = await caller.note.sections({
        avatarNickname: "note-reader",
        notebook: "ideas",
        sort: "alpha",
        limit: 1,
      });
      const pages = await caller.note.pages({
        avatarNickname: "note-reader",
        notebook: "ideas",
        section: "shell",
        sort: "updatedAt",
        limit: 1,
      });
      const page = await caller.note.page({
        avatarNickname: "note-reader",
        notebook: "ideas",
        section: "shell",
        page: "typed-surface",
      });
      const missingPage = await caller.note.page({
        avatarNickname: "note-reader",
        notebook: "ideas",
        section: "shell",
        page: "missing",
      });
      const search = await caller.note.search({
        avatarNickname: "note-reader",
        query: "Studio raw filesystem",
      });
      const tags = await caller.note.tags({
        avatarNickname: "note-reader",
        notebook: "ideas",
      });
      const sql = await caller.note.query({
        avatarNickname: "note-reader",
        sql: "select notebook, section, page from note_pages_view where notebook = 'ideas' order by section, page",
      });

      expect(catalog.avatar).toMatchObject({
        nickname: "note-reader",
        principalId,
        avatarHome: [avatarHome],
      });
      expect(catalog.capability).toEqual({
        available: true,
        readableRoots: [avatarHome],
        writableRoot: avatarHome,
      });
      expect(catalog.notebooks[0]?.sections[0]?.pages[0]).toMatchObject({
        notebook: "ideas",
        section: "shell",
        page: "typed-surface",
        sourceWorkspace: "/repo",
        tags: ["contract", "studio"],
        mime: "text/markdown",
      });
      expect(notebooks).toMatchObject({
        totalNotebooks: 2,
        totalPages: 3,
        nextCursor: "1",
      });
      expect(notebooks.notebooks[0]).toMatchObject({ notebook: "ideas", sectionCount: 2, pageCount: 2 });
      expect(updatedNotebooks.notebooks[0]?.notebook).toBe("logs");
      expect(secondNotebookPage.notebooks.map((notebook) => notebook.notebook)).toEqual(["logs"]);
      expect(sections).toMatchObject({
        notebook: "ideas",
        totalSections: 2,
        totalPages: 2,
        nextCursor: "1",
      });
      expect(sections.sections[0]).toMatchObject({ section: "shell", pageCount: 1 });
      expect(pages).toMatchObject({
        notebook: "ideas",
        section: "shell",
        totalPages: 1,
        nextCursor: null,
      });
      expect(pages.pages[0]).toMatchObject({ notebook: "ideas", section: "shell", page: "typed-surface" });
      expect(page.page?.body).toContain("Typed NoteSystem projection");
      expect(page.page?.metadata.kind).toBe("note");
      expect(missingPage.page).toBeNull();
      expect(search.results[0]).toMatchObject({
        notebook: "ideas",
        section: "shell",
        page: "typed-surface",
      });
      expect(search.results[0]?.snippet).toContain("Studio");
      expect(tags.tags.map((tag) => tag.name)).toEqual(["contract", "studio"]);
      expect(sql.rows).toEqual([
        { notebook: "ideas", section: "shell", page: "typed-surface" },
        { notebook: "ideas", section: "ux", page: "scope-tabs" },
      ]);
    } finally {
      await kernel.stop();
    }
  });

  test("Scenario: Given a missing avatar home When NoteSystem TRPC APIs run Then they report no note capability", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    try {
      const { caller } = await createRootSuperadminCaller(kernel);

      const catalog = await caller.note.catalog({ avatarNickname: "missing-note-avatar" });
      const notebooks = await caller.note.notebooks({ avatarNickname: "missing-note-avatar" });
      const sections = await caller.note.sections({ avatarNickname: "missing-note-avatar", notebook: "ideas" });
      const pages = await caller.note.pages({
        avatarNickname: "missing-note-avatar",
        notebook: "ideas",
        section: "shell",
      });
      const page = await caller.note.page({
        avatarNickname: "missing-note-avatar",
        notebook: "ideas",
        section: "shell",
        page: "missing",
      });
      const search = await caller.note.search({
        avatarNickname: "missing-note-avatar",
        query: "anything",
      });
      const tags = await caller.note.tags({
        avatarNickname: "missing-note-avatar",
      });
      const sql = await caller.note.query({
        avatarNickname: "missing-note-avatar",
        sql: "select * from note_pages_view",
      });

      expect(catalog.avatar).toMatchObject({
        nickname: "missing-note-avatar",
        principalId: null,
        avatarHome: [],
      });
      expect(catalog.capability.available).toBeFalse();
      expect(catalog.notebooks).toEqual([]);
      expect(notebooks).toMatchObject({ notebooks: [], totalNotebooks: 0, totalPages: 0, nextCursor: null });
      expect(notebooks.capability.available).toBeFalse();
      expect(sections).toMatchObject({
        notebook: "ideas",
        sections: [],
        totalSections: 0,
        totalPages: 0,
        nextCursor: null,
      });
      expect(sections.capability.available).toBeFalse();
      expect(pages).toMatchObject({ notebook: "ideas", section: "shell", pages: [], totalPages: 0, nextCursor: null });
      expect(pages.capability.available).toBeFalse();
      expect(page.page).toBeNull();
      expect(page.capability.available).toBeFalse();
      expect(search.results).toEqual([]);
      expect(search.capability.available).toBeFalse();
      expect(tags.tags).toEqual([]);
      expect(tags.capability.available).toBeFalse();
      expect(sql.rows).toEqual([]);
      expect(sql.capability.available).toBeFalse();
    } finally {
      await kernel.stop();
    }
  });

  test("Scenario: Given explicit NoteSystem references When TRPC write runs Then structured reference metadata resolves before commit", async () => {
    const root = makeTempDir();
    const homeDir = join(root, "home");
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir,
    });
    await kernel.start();
    try {
      const { caller } = await createRootSuperadminCaller(kernel);
      const created = await caller.avatar.create({
        nickname: "note-writer",
        displayName: "Note Writer",
      });
      const principalId = created.avatar.avatarPrincipalId;
      if (!principalId) {
        throw new Error("expected created avatar principal id");
      }
      const avatarHome = resolveGlobalAvatarCanonicalRoot(principalId, homeDir);
      const target = writeNotePage({
        avatarHome: [avatarHome],
        notebook: "ideas",
        section: "shell",
        page: "target",
        content: "Target note.",
        mime: "text/markdown",
      });

      const written = await caller.note.write({
        avatarNickname: "note-writer",
        notebook: "ideas",
        section: "shell",
        page: "json-ref",
        content: '{"ok":true}',
        mime: "application/json",
        references: [{ pageId: target.metadata.pageId, label: "target" }],
      });

      expect(written.page?.metadata.mime).toBe("application/json");
      expect(written.page?.metadata.references[0]).toMatchObject({
        label: "target",
        pageId: target.metadata.pageId,
        uri: "note:ideas/shell/target",
      });
    } finally {
      await kernel.stop();
    }
  });

  test("Scenario: Given caller creates session When listing and deleting Then lifecycle is reflected", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    const { caller } = await createRootSuperadminCaller(kernel);

    const created = await caller.session.create({
      cwd: root,
      name: "workspace",
      autoStart: false,
    });

    expect(created.session.name).toBe("workspace");

    const listed = await caller.session.list();
    expect(listed.sessions).toHaveLength(1);

    const archived = await caller.session.archive({ sessionId: created.session.id });
    expect(archived.session.storageState).toBe("archived");

    const restored = await caller.session.restore({ sessionId: created.session.id });
    expect(restored.session.storageState).toBe("active");

    const deleted = await caller.session.delete({ sessionId: created.session.id });
    expect(deleted.removed).toBe(true);

    const afterDelete = await caller.session.list();
    expect(afterDelete.sessions).toHaveLength(0);

    await kernel.stop();
  });

  test("Scenario: Given app-server owns a managed local auth-service child When auth bootstrap is requested Then descriptor flags and reveal payload stay aligned", async () => {
    const root = makeTempDir();
    const homeDir = join(root, "home");
    const expectedAuthId = privateKeyToAccount(ROOT_AUTH_PRIVATE_KEY).address.toLowerCase();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir,
      authService: {
        rootAuthPrivateKey: ROOT_AUTH_PRIVATE_KEY,
      },
    });
    await kernel.start();
    const caller = appRouter.createCaller(await createTrpcContext(kernel));

    const descriptor = await caller.auth.service();
    expect(descriptor).toMatchObject({
      rootAuthId: expectedAuthId,
      rootAuthBootstrapMode: "managed_local",
      canRevealRootAuthPrivateKey: true,
      hasManagedRootAuthPrivateKey: true,
      browserAutoLoginKeyPath: join(homeDir, ".agenter", "local.env"),
      browserAutoLoginConfigured: false,
      browserAutoLoginBootstrapAvailable: true,
    });

    const autoLogin = await caller.auth.autoLogin();
    expect(autoLogin).toMatchObject({
      ok: true,
      source: "managed_local",
      session: {
        claims: {
          authId: expectedAuthId,
          superadmin: true,
        },
      },
    });
    const refreshedDescriptor = await caller.auth.service();
    expect(refreshedDescriptor.browserAutoLoginConfigured).toBeTrue();

    await kernel.stop();
  });

  test("Scenario: Given durable usage analytics facts When runtime.usageAnalytics is queried Then the caller receives token totals for the avatar behind that session", async () => {
    const root = makeTempDir();
    const homeDir = join(root, "home");
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir,
    });
    await kernel.start();
    const { caller } = await createRootSuperadminCaller(kernel);

    const created = await caller.session.create({
      cwd: root,
      name: "usage-session",
      autoStart: false,
    });
    const avatarPrincipalId = created.session.avatarPrincipalId;
    expect(avatarPrincipalId).toBeDefined();
    if (!avatarPrincipalId) {
      throw new Error("avatar principal missing");
    }
    const analyticsDb = new UsageAnalyticsDb(
      resolveUsageAnalyticsDbPathFromAvatarRoot(resolveGlobalAvatarCanonicalRoot(avatarPrincipalId, homeDir)),
    );
    analyticsDb.upsertFact({
      principalId: avatarPrincipalId,
      sessionId: created.session.id,
      aiCallId: 11,
      cycleId: 4,
      roundIndex: 4,
      kind: "model",
      status: "done",
      providerId: "default",
      apiStandard: "openai-responses",
      vendor: "openai",
      profile: null,
      model: "gpt-test",
      createdAt: Date.UTC(2026, 3, 12, 14, 25, 0),
      completedAt: Date.UTC(2026, 3, 12, 14, 25, 5),
      inputTokens: 180,
      outputTokens: 72,
      totalTokens: 252,
      cachedInputTokens: 24,
      reasoningTokens: 18,
      uncachedInputTokens: 156,
      maxContextTokens: 128_000,
    });
    analyticsDb.close();

    const result = await caller.runtime.usageAnalytics({
      sessionId: created.session.id,
      sinceMs: Date.UTC(2026, 3, 12, 14, 0, 0),
      untilMs: Date.UTC(2026, 3, 12, 15, 0, 0),
      granularity: "raw",
    });

    expect(result.totals).toEqual({
      callCount: 1,
      inputTokens: 180,
      outputTokens: 72,
      totalTokens: 252,
      cachedInputTokens: {
        value: 24,
        knownCallCount: 1,
      },
      reasoningTokens: {
        value: 18,
        knownCallCount: 1,
      },
      uncachedInputTokens: {
        value: 156,
        knownCallCount: 1,
      },
    });

    await kernel.stop();
  });

  test("Scenario: Given a durable auth identity When auth actors are listed Then the collaboration catalog exposes auth-backed label icon and actor id", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    const { caller, anonymousCaller } = await createRootSuperadminCaller(kernel);

    const account = privateKeyToAccount(generatePrivateKey());
    const authId = account.address.toLowerCase();
    const challenge = await anonymousCaller.auth.challengeStart({ authId });
    const signature = await account.signMessage({ message: challenge.challengeText });
    await anonymousCaller.auth.challengeVerify({
      challengeId: challenge.challengeId,
      signature,
    });

    const actors = await caller.auth.actors();
    expect(actors.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: `auth:${authId}`,
          actorKind: "auth",
          authId,
          label: account.address.toLowerCase(),
          subtitle: authId,
          iconUrl: expect.stringContaining("/media/profiles/"),
          identifier: {
            kind: "wallet_evm",
            value: account.address.toLowerCase(),
          },
        }),
      ]),
    );

    await kernel.stop();
  });

  test("Scenario: Given the avatar control plane When catalog and create are called Then global avatars stay principal-backed with backend-owned icon projection", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    const { caller } = await createRootSuperadminCaller(kernel);

    const initialCatalog = await caller.avatar.catalog();
    expect(initialCatalog.items.some((item) => item.nickname === "default")).toBeTrue();
    const defaultEntry = initialCatalog.items.find((item) => item.nickname === "default");
    expect(defaultEntry).toMatchObject({
      avatarPrincipalId: expect.any(String),
      displayName: "Default",
      classify: "assistant",
      defaultAvatar: true,
    });
    expect(defaultEntry?.iconUrl).toContain("/media/avatars/");
    expect(defaultEntry?.globalPath).toContain(join(".agenter", "avatars", "by-principal"));

    const created = await caller.avatar.create({
      nickname: "backend",
      displayName: "Backend",
      classify: "backend",
    });
    expect(created.avatar).toMatchObject({
      avatarPrincipalId: expect.any(String),
      nickname: "backend",
      displayName: "Backend",
      classify: "backend",
    });
    expect(created.avatar.iconUrl).toContain("/media/avatars/");
    expect(created.avatar.globalAvailable).toBeTrue();

    const catalog = await caller.avatar.catalog();
    expect(catalog.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          avatarPrincipalId: created.avatar.avatarPrincipalId,
          nickname: "backend",
          displayName: "Backend",
          classify: "backend",
          iconUrl: created.avatar.iconUrl,
        }),
      ]),
    );

    await kernel.stop();
  });

  test("Scenario: Given workspace and session procedures When querying Then pages favorites and archive results are returned", async () => {
    const root = makeTempDir();
    const workspaceA = join(root, "workspace-a");
    const workspaceB = join(root, "workspace-b");
    mkdirSync(workspaceA, { recursive: true });
    mkdirSync(workspaceB, { recursive: true });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();
    const { caller } = await createRootSuperadminCaller(kernel);

    const createdA = await caller.session.create({ cwd: workspaceA, name: "A", autoStart: false });
    await caller.session.create({ cwd: workspaceB, name: "B", autoStart: false });

    const recent = await caller.workspace.recent({ limit: 8 });
    const recentProjectWorkspaces = recent.items.filter((item) => item !== "~/");
    expect(recent.items[0]).toBe("~/");
    expect(recentProjectWorkspaces[0]).toBe(workspaceB);
    expect(recent.items.includes(workspaceA)).toBeTrue();

    const all = await caller.workspace.listAll();
    expect(all.items.some((item) => item.path === workspaceA)).toBeTrue();
    expect(all.items.some((item) => item.path === workspaceB)).toBeTrue();

    const toggled = await caller.workspace.toggleFavorite({ path: workspaceA });
    expect(toggled.item.path).toBe(workspaceA);
    expect(toggled.item.favorite).toBeTrue();

    const sessionFavorite = await caller.workspace.toggleSessionFavorite({ sessionId: createdA.session.id });
    expect(sessionFavorite.favorite).toBeTrue();

    const page = await caller.workspace.listSessions({ path: workspaceA, tab: "all", limit: 20 });
    expect(page.items[0]?.sessionId).toBe(createdA.session.id);
    expect(page.items[0]?.favorite).toBeTrue();

    await caller.session.archive({ sessionId: createdA.session.id });
    const archivePage = await caller.workspace.listSessions({ path: workspaceA, tab: "archive", limit: 20 });
    expect(archivePage.items[0]?.sessionId).toBe(createdA.session.id);
    expect(archivePage.counts.archive).toBe(1);

    const removed = await caller.workspace.delete({ path: workspaceB });
    expect(removed.removed).toBeTrue();

    const listing = await caller.fs.listDirectories({ path: root, includeHidden: false });
    expect(listing.items.some((item) => item.path === workspaceA)).toBeTrue();

    const valid = await caller.fs.validateDirectory({ path: workspaceA });
    const invalid = await caller.fs.validateDirectory({ path: join(root, "nope") });
    expect(valid.ok).toBeTrue();
    expect(invalid.ok).toBeFalse();

    await kernel.stop();
  });

  test("Scenario: Given one avatar across multiple workspaces When runtime workspace procedures are used Then mounts grants asset roots and bash exec follow the workspace-system contract", async () => {
    const root = makeTempDir();
    const workspaceA = join(root, "workspace-a");
    const workspaceB = join(root, "workspace-b");
    mkdirSync(workspaceA, { recursive: true });
    mkdirSync(workspaceB, { recursive: true });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();
    const { caller } = await createRootSuperadminCaller(kernel);

    const first = await caller.session.create({
      cwd: workspaceA,
      name: "Architect",
      avatar: "architect",
      autoStart: false,
    });
    const second = await caller.session.create({
      cwd: workspaceB,
      name: "Architect",
      avatar: "architect",
      autoStart: false,
    });

    expect(second.session.id).toBe(first.session.id);

    const coldMounts = await caller.workspace.runtimeMounts({
      runtimeId: first.session.id,
    });
    expect(coldMounts.items).toEqual([]);

    const grantedWorkspaceA = await caller.workspace.grantRuntime({
      runtimeId: first.session.id,
      workspacePath: workspaceA,
      grants: [{ pattern: "/", mode: "rw" }],
    });
    expect(grantedWorkspaceA.items).toEqual([
      expect.objectContaining({
        workspacePath: workspaceA,
        pattern: "/",
        mode: "rw",
      }),
    ]);

    await caller.workspace.grantRuntime({
      runtimeId: first.session.id,
      workspacePath: workspaceB,
      grants: [{ pattern: "/", mode: "rw" }],
    });

    const mounts = await caller.workspace.runtimeMounts({
      runtimeId: first.session.id,
    });
    expect(mounts.items.map((item) => item.workspacePath).sort()).toEqual([workspaceA, workspaceB].sort());

    const initialGrants = await caller.workspace.runtimeGrants({
      runtimeId: first.session.id,
      workspacePath: workspaceA,
    });
    expect(initialGrants.items).toEqual([
      expect.objectContaining({
        workspacePath: workspaceA,
        pattern: "/",
        mode: "rw",
      }),
    ]);

    const assetRoots = await caller.workspace.assetRoots({
      workspacePath: workspaceA,
      avatar: "architect",
    });
    expect(assetRoots.workspacePath).toBe(workspaceA);
    expect(assetRoots.avatar).toBe("architect");
    writeFileSync(join(assetRoots.publicRoots.tools, "hello.sh"), "#!/usr/bin/env bash\necho tool-ok\n", "utf8");
    writeFileSync(
      join(assetRoots.publicRoots.tools, "hello.sh.cli.json"),
      JSON.stringify({
        name: "Hello workspace",
        description: "Run the shared hello workspace tool.",
      }),
      "utf8",
    );
    writeFileSync(
      join(assetRoots.privateRoots.tools, "draft.ts"),
      "#!/usr/bin/env node\nconsole.log('draft')\n",
      "utf8",
    );

    const cliCatalog = await caller.workspace.cliCatalog({
      workspacePath: workspaceA,
      avatar: "architect",
    });
    expect(cliCatalog.groups.map((group) => group.id)).toEqual([
      "just-bash-builtins",
      "root-runtime-cli",
      "workspace-public-tools",
      "workspace-private-tools",
    ]);
    expect(cliCatalog.groups[0]?.entries.some((entry) => entry.commandLabel === "cd")).toBeTrue();
    expect(cliCatalog.groups[1]?.entries.some((entry) => entry.commandLabel === "workspace list")).toBeTrue();
    expect(cliCatalog.groups[2]?.entries).toEqual([
      expect.objectContaining({
        commandLabel: "tool_hello",
        displayName: "Hello workspace",
      }),
    ]);
    expect(cliCatalog.groups[3]?.entries).toEqual([
      expect.objectContaining({
        commandLabel: "tool_draft",
        metadataState: "fallback",
      }),
    ]);

    const granted = await caller.workspace.grantRuntime({
      runtimeId: first.session.id,
      workspacePath: workspaceA,
      grants: [{ pattern: "/sandbox", mode: "rw" }],
    });
    expect(granted.items).toEqual([
      expect.objectContaining({
        workspacePath: workspaceA,
        pattern: "/sandbox",
        mode: "rw",
      }),
    ]);

    const execOk = await caller.workspace.exec({
      runtimeId: first.session.id,
      workspacePath: workspaceA,
      avatar: "architect",
      surface: "public-workspace",
      command:
        "mkdir -p /workspace/sandbox && printf workspace-ok > /workspace/sandbox/out.txt && tool_hello && cat /workspace/sandbox/out.txt",
    });
    expect(execOk.exitCode).toBe(0);
    expect(execOk.stdout).toContain("tool-ok");
    expect(execOk.stdout).toContain("workspace-ok");
    expect(readFileSync(join(workspaceA, "sandbox", "out.txt"), "utf8")).toBe("workspace-ok");

    const execDenied = await caller.workspace.exec({
      runtimeId: first.session.id,
      workspacePath: workspaceA,
      avatar: "architect",
      surface: "public-workspace",
      command: "printf blocked > /workspace/blocked.txt",
    });
    expect(execDenied.exitCode).not.toBe(0);
    expect(existsSync(join(workspaceA, "blocked.txt"))).toBeFalse();

    const detached = await caller.workspace.detachRuntime({
      runtimeId: first.session.id,
      workspacePath: workspaceB,
    });
    expect(detached.detached).toBeTrue();

    const mountsAfterDetach = await caller.workspace.runtimeMounts({
      runtimeId: first.session.id,
    });
    expect(mountsAfterDetach.items.map((item) => item.workspacePath)).toEqual([workspaceA]);

    const execMissingGrant = await caller.workspace.exec({
      runtimeId: first.session.id,
      workspacePath: workspaceB,
      avatar: "architect",
      surface: "public-workspace",
      command: "pwd",
    });
    expect(execMissingGrant.exitCode).toBe(1);
    expect(execMissingGrant.stderr).toContain(
      `workspace grants missing for runtime ${first.session.id} on ${workspaceB}`,
    );

    await caller.session.start({
      sessionId: first.session.id,
    });

    const rootExec = await caller.workspace.exec({
      runtimeId: first.session.id,
      workspacePath: workspaceA,
      avatar: "architect",
      surface: "root-workspace",
      command: "workspace list --help",
      cwd: workspaceA,
    });
    expect(rootExec.exitCode).toBe(0);
    expect(rootExec.stdout).toContain("workspace list");

    await kernel.stop();
  });

  test("Scenario: Given browser root-workspace exec needs one active runtime When the runtime is not started Then workspace exec returns an explicit non-zero shell failure instead of throwing 500", async () => {
    const root = makeTempDir();
    const workspace = join(root, "workspace");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();
    const { caller } = await createRootSuperadminCaller(kernel);

    const created = await caller.session.create({
      cwd: workspace,
      name: "inactive-root-exec",
      autoStart: false,
    });

    const inactiveExec = await caller.workspace.exec({
      runtimeId: created.session.id,
      workspacePath: workspace,
      avatar: "default",
      surface: "root-workspace",
      command: "workspace list --help",
    });
    expect(inactiveExec.exitCode).toBe(1);
    expect(inactiveExec.stderr).toContain(`runtime not active for root-workspace exec: ${created.session.id}`);
    expect(inactiveExec.cwd).toBe(workspace);

    await kernel.stop();
  });

  test("Scenario: Given browser shell launch passes a mounted global-workspace tilde cwd When workspace.exec runs Then the backend expands that token against the configured home instead of the daemon cwd", async () => {
    const root = makeTempDir();
    const homeDir = join(root, "home");
    const workspace = join(root, "workspace");
    mkdirSync(homeDir, { recursive: true });
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir,
    });
    await kernel.start();
    const { caller } = await createRootSuperadminCaller(kernel);

    const created = await caller.session.create({
      cwd: workspace,
      name: "global-cwd-normalization",
      autoStart: true,
    });

    const granted = await caller.workspace.grantRuntime({
      runtimeId: created.session.id,
      workspacePath: GLOBAL_WORKSPACE_PATH,
      grants: [{ pattern: "/", mode: "rw" }],
    });
    expect(granted.items).toEqual([
      expect.objectContaining({
        workspacePath: GLOBAL_WORKSPACE_PATH,
        pattern: "/",
        mode: "rw",
      }),
    ]);

    const exec = await caller.workspace.exec({
      runtimeId: created.session.id,
      workspacePath: GLOBAL_WORKSPACE_PATH,
      avatar: "default",
      surface: "root-workspace",
      command: "pwd",
      cwd: "~/",
    });
    expect(exec.exitCode).toBe(0);
    expect(exec.cwd).toBe(homeDir);
    expect(exec.stdout.trim()).toBe(homeDir);

    await kernel.stop();
  });

  test("Scenario: Given tokenized chat-channel routes When caller edits metadata and revokes grants Then channel access stays scoped to the issued token", async () => {
    const root = makeTempDir();
    const workspace = join(root, "workspace");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();
    const { caller } = await createRootSuperadminCaller(kernel);

    const created = await caller.session.create({
      cwd: workspace,
      name: "workspace",
      autoStart: true,
    });
    const sessionId = created.session.id;

    const listed = await caller.message.listChannels({ sessionId });
    expect(listed.items).toEqual([]);

    const createdChannel = await caller.message.createChannel({
      sessionId,
      kind: "room",
      title: "Lunch relay",
      focus: false,
    });
    const channel = createdChannel.channel;
    expect(channel.accessRole).toBe("admin");

    const focused = await caller.message.focus({
      sessionId,
      op: "replace",
      channels: [{ chatId: channel.chatId, accessToken: channel.accessToken }],
    });
    expect(focused.items[0]?.focused).toBeTrue();

    const updated = await caller.message.updateChannel({
      sessionId,
      chatId: channel.chatId,
      accessToken: channel.accessToken,
      patch: {
        title: "Lunch relay",
        participants: [
          { id: `session:${channel.owner}`, label: channel.owner },
          { id: "auth:kzf", label: "kzf" },
          { id: "auth:gaubee", label: "gaubee" },
        ],
      },
    });
    expect(updated.channel.title).toBe("Lunch relay");
    expect(updated.channel.participants.map((participant) => participant.id)).toContain("auth:gaubee");

    const issued = await caller.message.issueChannelGrant({
      sessionId,
      chatId: channel.chatId,
      accessToken: channel.accessToken,
      role: "readonly",
      label: "Viewer",
      participantId: "auth:gaubee",
    });
    expect(issued.grant.accessRole).toBe("readonly");
    expect(issued.grant.accessToken).toStartWith("msgtok_");

    const grants = await caller.message.listChannelGrants({
      sessionId,
      chatId: channel.chatId,
      accessToken: channel.accessToken,
    });
    expect(grants.items.map((grant) => grant.label)).toEqual(["Viewer"]);

    const rejectedWrite = await caller.message.send({
      sessionId,
      chatId: channel.chatId,
      accessToken: issued.grant.accessToken,
      text: "blocked",
    });
    expect(rejectedWrite.ok).toBeFalse();
    if (rejectedWrite.ok) {
      throw new Error("expected readonly room send to fail");
    }
    expect(rejectedWrite.reason).toBe("message channel member access required");

    const revoked = await caller.message.revokeChannelGrant({
      sessionId,
      chatId: channel.chatId,
      accessToken: channel.accessToken,
      grantId: issued.grant.grantId,
    });
    expect(revoked.ok).toBeTrue();

    const rejectedAfterRevoke = await caller.message.send({
      sessionId,
      chatId: channel.chatId,
      accessToken: issued.grant.accessToken,
      text: "still blocked",
    });
    expect(rejectedAfterRevoke.ok).toBeFalse();
    if (rejectedAfterRevoke.ok) {
      throw new Error("expected revoked room send to fail");
    }
    expect(rejectedAfterRevoke.reason).toBe("message room credential-invalid");

    await kernel.stop();
  });

  test("Scenario: Given global room routes When creating paging granting and archiving Then the room stays independent from any session route", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      authService: {
        rootAuthPrivateKey: ROOT_AUTH_PRIVATE_KEY,
      },
    });
    await kernel.start();
    const { caller } = await createRootSuperadminCaller(kernel);
    const created = await caller.message.globalCreate({
      kind: "room",
      title: "Ops room",
      focus: true,
    });
    const room = created.channel;
    expect(room.chatId).toMatch(/^0x[0-9a-f]{40}$/);

    const listed = await caller.message.globalList({ includeArchived: false });
    expect(listed.items.some((item) => item.chatId === room.chatId)).toBeTrue();
    expect(listed.items.find((item) => item.chatId === room.chatId)?.focused).toBeFalse();

    await kernel.uploadGlobalRoomAssets({
      chatId: room.chatId,
      accessToken: room.accessToken,
      files: [
        {
          name: "ops-brief.txt",
          mimeType: "text/plain",
          bytes: new Uint8Array([111, 112, 115]),
        },
      ],
    });
    const assets = await caller.message.globalListAssets({
      chatId: room.chatId,
      accessToken: room.accessToken,
    });
    expect(assets.items).toHaveLength(1);
    expect(assets.items[0]).toMatchObject({
      name: "ops-brief.txt",
      mimeType: "text/plain",
      uploadedByActorId: room.participantId,
    });

    const sent = await caller.message.globalSend({
      chatId: room.chatId,
      accessToken: room.accessToken,
      text: "hello ops",
    });
    expect(sent.ok).toBeTrue();

    const snapshot = await caller.message.globalSnapshot({
      chatId: room.chatId,
      accessToken: room.accessToken,
      limit: 20,
    });
    expect(snapshot.channel.chatId).toBe(room.chatId);
    expect(snapshot.roomRevision).toMatch(/^\d+$/);
    expect(snapshot.transcriptRevision).toMatch(/^\d+$/);
    expect(snapshot.headVersion).toMatch(/^\d+$/);
    expect(snapshot.items.some((item) => item.content === "hello ops")).toBeTrue();
    const sentMessage = snapshot.items.find((item) => item.content === "hello ops");
    expect(sentMessage?.visibleAt).toBe(sentMessage?.createdAt);
    const edited = await caller.message.globalEdit({
      chatId: room.chatId,
      accessToken: room.accessToken,
      messageId: sentMessage?.messageId ?? 0,
      text: "hello ops corrected",
    });
    expect(edited.ok).toBeTrue();

    const snapshotAfterEdit = await caller.message.globalSnapshot({
      chatId: room.chatId,
      accessToken: room.accessToken,
      limit: 20,
    });
    expect(Number(snapshotAfterEdit.roomRevision)).toBeGreaterThanOrEqual(Number(snapshot.roomRevision));
    expect(Number(snapshotAfterEdit.transcriptRevision)).toBeGreaterThan(Number(snapshot.transcriptRevision));
    expect(snapshotAfterEdit.items.some((item) => item.content === "hello ops corrected")).toBeTrue();
    const recalled = await caller.message.globalRecall({
      chatId: room.chatId,
      accessToken: room.accessToken,
      messageId: sentMessage?.messageId ?? 0,
    });
    expect(recalled.ok).toBeTrue();
    const relay = await caller.message.globalIssueGrant({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      participantId: "session:ops-relay",
      label: "Ops relay",
    });
    const relayRejectedEdit = await caller.message.globalEdit({
      chatId: room.chatId,
      accessToken: relay.grant.accessToken,
      messageId: sentMessage?.messageId ?? 0,
      text: "tampered",
    });
    expect(relayRejectedEdit.ok).toBeFalse();
    expect(relayRejectedEdit.reason).toBe("message edit requires original sender");
    const relayRejectedRecall = await caller.message.globalRecall({
      chatId: room.chatId,
      accessToken: relay.grant.accessToken,
      messageId: sentMessage?.messageId ?? 0,
    });
    expect(relayRejectedRecall.ok).toBeFalse();
    expect(relayRejectedRecall.reason).toBe("message recall requires original sender");

    const relayRead = await caller.message.globalMarkRead({
      chatId: room.chatId,
      accessToken: relay.grant.accessToken,
      messageId: sentMessage?.messageId,
    });
    expect(Object.prototype.hasOwnProperty.call(relayRead.channel, "readProgress")).toBeFalse();

    const page = await caller.message.globalPage({
      chatId: room.chatId,
      accessToken: room.accessToken,
      limit: 20,
    });
    expect(page.roomRevision).toMatch(/^\d+$/);
    expect(page.transcriptRevision).toMatch(/^\d+$/);
    expect(page.headVersion).toMatch(/^\d+$/);
    const recalledMessage = page.items.find((item: { messageId: number }) => item.messageId === sentMessage?.messageId);
    expect(recalledMessage?.content).toBe("");
    expect(recalledMessage?.recalledAt).toBeDefined();

    const focused = await caller.message.globalFocus({
      op: "replace",
      channels: [{ chatId: room.chatId, accessToken: room.accessToken }],
    });
    expect(focused.focusedChatIds).toEqual([room.chatId]);

    const updated = await caller.message.globalUpdate({
      chatId: room.chatId,
      accessToken: room.accessToken,
      patch: {
        title: "Ops bridge",
        metadata: { topic: "ops" },
        adminGroupCandidateIds: ["auth:ops-admin"],
      },
    });
    expect(updated.channel.title).toBe("Ops bridge");
    expect(updated.channel.metadata?.topic).toBe("ops");

    const issued = await caller.message.globalIssueGrant({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      participantId: "session:avatar-pair",
      label: "Pair operator",
    });
    expect(issued.grant.accessToken).toStartWith("msgtok_");

    const grants = await caller.message.globalListGrants({
      chatId: room.chatId,
      accessToken: room.accessToken,
    });
    expect(grants.items.map((grant) => grant.participantId)).toContain("session:avatar-pair");

    const revoked = await caller.message.globalRevokeGrant({
      chatId: room.chatId,
      accessToken: room.accessToken,
      grantId: issued.grant.grantId,
    });
    expect(revoked.ok).toBeTrue();

    const archived = await caller.message.globalArchive({
      chatId: room.chatId,
      accessToken: room.accessToken,
      archivedBy: "ops-admin",
    });
    expect(archived.channel.archivedBy).toBe("ops-admin");
    expect(
      (await caller.message.globalList({ includeArchived: false })).items.some((item) => item.chatId === room.chatId),
    ).toBeFalse();

    const disposable = await caller.message.globalCreate({
      title: "Disposable room",
    });
    const deleted = await caller.message.globalDelete({
      chatId: disposable.channel.chatId,
      accessToken: disposable.channel.accessToken,
    });
    expect(deleted.channel.chatId).toBe(disposable.channel.chatId);
    expect(
      (await caller.message.globalList({ includeArchived: true })).items.some(
        (item) => item.chatId === disposable.channel.chatId,
      ),
    ).toBeFalse();

    await kernel.stop();
  });

  test("Scenario: Given a browser caller without auth When message global routes are invoked Then seat tokens do not bypass the authenticated control plane", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      authService: {
        rootAuthPrivateKey: ROOT_AUTH_PRIVATE_KEY,
      },
    });
    await kernel.start();

    const { anonymousCaller, caller } = await createRootSuperadminCaller(kernel);
    const created = await caller.message.globalCreate({
      kind: "room",
      title: "Authenticated room",
    });

    await expect(anonymousCaller.message.globalList({ includeArchived: false })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      anonymousCaller.message.globalSend({
        chatId: created.channel.chatId,
        accessToken: created.channel.accessToken,
        text: "anonymous browser send",
      }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      anonymousCaller.message.globalSnapshot({
        chatId: created.channel.chatId,
        accessToken: created.channel.accessToken,
        limit: 20,
      }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    await kernel.stop();
  });

  test("Scenario: Given seat-backed room reads When seat token and superadmin both mark the same room Then durable message arrays only advance for real room seats", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      authService: {
        rootAuthPrivateKey: ROOT_AUTH_PRIVATE_KEY,
      },
    });
    await kernel.start();

    const { caller: superadminCaller, descriptor } = await createRootSuperadminCaller(kernel);

    const created = await superadminCaller.message.globalCreate({
      kind: "room",
      title: "Read state room",
      focus: false,
    });
    const room = created.channel;
    const relay = await superadminCaller.message.globalIssueGrant({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      participantId: "session:relay",
      label: "Relay",
    });
    const viewer = await superadminCaller.message.globalIssueGrant({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "readonly",
      participantId: "auth:viewer",
      label: "Viewer",
    });

    const messageControlPlane = Reflect.get(kernel, "messageControlPlane") as MessageControlPlane;
    messageControlPlane.send({
      chatId: room.chatId,
      from: "system",
      content: "hello read-state",
      createdAt: 1_000,
      updatedAt: 1_000,
      visibleAt: 1_000,
    });

    const snapshot = await superadminCaller.message.globalSnapshot({
      chatId: room.chatId,
      accessToken: room.accessToken,
      limit: 20,
    });
    const latestMessageId = snapshot.items[0]?.messageId;
    if (!latestMessageId) {
      throw new Error("expected latest visible room message");
    }

    const relayRead = await superadminCaller.message.globalMarkRead({
      chatId: room.chatId,
      accessToken: relay.grant.accessToken,
      messageId: latestMessageId,
    });
    const relayReadState = relayRead.channel.seatStates?.find((state) => state.contactId === "session:relay");
    const relaySnapshot = await superadminCaller.message.globalSnapshot({
      chatId: room.chatId,
      accessToken: room.accessToken,
      limit: 20,
    });
    const relayMessage = relaySnapshot.items.find((item) => item.messageId === latestMessageId);
    expect(relayReadState).toMatchObject({
      contactId: "session:relay",
      role: "member",
    });
    expect(relayMessage?.readContactIds).toContain("session:relay");
    expect(relayMessage?.unreadContactIds).not.toContain("session:relay");
    expect(Object.prototype.hasOwnProperty.call(relayRead.channel, "readProgress")).toBeFalse();

    const superadminRead = await superadminCaller.message.globalMarkRead({
      chatId: room.chatId,
      messageId: latestMessageId,
    });
    expect(
      superadminRead.channel.seatStates?.find((state) => state.contactId === `auth:${descriptor.rootAuthId}`),
    ).toMatchObject({
      contactId: `auth:${descriptor.rootAuthId}`,
      role: "admin",
    });
    const superadminSnapshot = await superadminCaller.message.globalSnapshot({
      chatId: room.chatId,
      accessToken: room.accessToken,
      limit: 20,
    });
    const superadminMessage = superadminSnapshot.items.find((item) => item.messageId === latestMessageId);
    expect(superadminMessage?.readContactIds).toEqual(["session:relay"]);
    expect(superadminMessage?.unreadContactIds.sort()).toEqual([`auth:${descriptor.rootAuthId}`, "auth:viewer"]);
    expect(Object.prototype.hasOwnProperty.call(superadminRead.channel, "readProgress")).toBeFalse();

    const viewerRead = await superadminCaller.message.globalMarkRead({
      chatId: room.chatId,
      accessToken: viewer.grant.accessToken,
      messageId: latestMessageId,
    });
    const viewerReadState = viewerRead.channel.seatStates?.find((state) => state.contactId === "auth:viewer");
    const viewerSnapshot = await superadminCaller.message.globalSnapshot({
      chatId: room.chatId,
      accessToken: room.accessToken,
      limit: 20,
    });
    const viewerMessage = viewerSnapshot.items.find((item) => item.messageId === latestMessageId);
    expect(viewerReadState).toMatchObject({
      contactId: "auth:viewer",
      role: "readonly",
    });
    expect(viewerMessage?.readContactIds.sort()).toEqual(["auth:viewer", "session:relay"]);
    expect(viewerMessage?.unreadContactIds).toEqual([`auth:${descriptor.rootAuthId}`]);
    expect(Object.prototype.hasOwnProperty.call(viewerRead.channel, "readProgress")).toBeFalse();

    await kernel.stop();
  });

  test("Scenario: Given a superadmin room send When the projected room still uses the bootstrap control seat Then the durable sender is the authenticated superadmin actor", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      authService: {
        rootAuthPrivateKey: ROOT_AUTH_PRIVATE_KEY,
      },
    });
    await kernel.start();

    const { caller: superadminCaller, descriptor } = await createRootSuperadminCaller(kernel);

    const created = await superadminCaller.message.globalCreate({
      kind: "room",
      title: "Superadmin send room",
      focus: false,
    });
    const grants = await superadminCaller.message.globalListGrants({
      chatId: created.channel.chatId,
    });
    expect(grants.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          participantId: `auth:${descriptor.rootAuthId}`,
          role: "admin",
        }),
      ]),
    );

    const sent = await superadminCaller.message.globalSend({
      chatId: created.channel.chatId,
      sendAsActorId: `auth:${descriptor.rootAuthId}`,
      text: "superadmin hello",
    });
    expect(sent.ok).toBeTrue();

    const snapshot = await superadminCaller.message.globalSnapshot({
      chatId: created.channel.chatId,
      limit: 20,
    });
    const message = snapshot.items.find((item) => item.content === "superadmin hello");
    expect(message?.senderContactId).toBe(`auth:${descriptor.rootAuthId}`);

    await kernel.stop();
  });

  test("Scenario: Given global terminal routes When creating granting approving and deleting Then the terminal stays independent from session startup order", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      authService: {
        rootAuthPrivateKey: ROOT_AUTH_PRIVATE_KEY,
      },
    });
    await kernel.start();
    const { caller } = await createRootSuperadminCaller(kernel);
    const created = await caller.terminal.globalCreate({
      terminalId: "global-ops",
      processKind: "shell",
      cwd: root,
      focus: false,
    });
    const terminalId = created.result.terminal?.terminalId;
    if (!terminalId) {
      throw new Error("expected global terminal id");
    }

    const listed = await caller.terminal.globalList();
    expect(listed.items.some((item) => item.terminalId === terminalId)).toBeTrue();
    expect(listed.items.find((item) => item.terminalId === terminalId)?.focused).toBeFalse();

    const issued = await caller.terminal.issueGrant({
      terminalId,
      role: "guard",
      participantId: "session:avatar-pair",
      label: "Pair operator",
    });
    expect(issued.grant.accessToken).toStartWith("termtok_");

    const terminalSystem = Reflect.get(kernel, "terminalControlPlane") as TerminalControlPlane;
    const blocked = await terminalSystem.write({
      terminalId,
      text: "pending approval",
      actorId: "session:avatar-pair",
      accessToken: issued.grant.accessToken,
    });
    expect(blocked.ok).toBeFalse();
    expect(blocked.approvalRequest?.terminalId).toBe(terminalId);
    expect(blocked.approvalRequest?.requestedInput).toEqual({
      mode: "raw",
      text: "pending approval",
    });

    const approvals = await caller.terminal.listApprovalRequests({
      terminalId,
      statuses: ["pending"],
    });
    expect(approvals.items).toHaveLength(1);

    const lease = await caller.terminal.approveRequest({
      terminalId,
      requestId: approvals.items[0]!.requestId,
      durationMs: 30 * 60 * 1000,
    });
    expect(lease.participantId).toBe("session:avatar-pair");

    const focusedBySeat = await caller.terminal.globalFocus({
      op: "add",
      terminalIds: [terminalId],
      accessToken: issued.grant.accessToken,
    });
    expect(focusedBySeat.focusedTerminalIds).toEqual([terminalId]);

    const afterSeatFocus = terminalSystem.list().find((item) => item.terminalId === terminalId);
    expect(afterSeatFocus?.focused).toBeFalse();
    expect(afterSeatFocus?.actors?.find((actor) => actor.actorId === "session:avatar-pair")?.focused).toBeTrue();

    const allowed = await caller.terminal.write({
      terminalId,
      accessToken: issued.grant.accessToken,
      text: "approved write",
      returnRead: false,
    });
    expect(allowed.ok).toBeTrue();
    expect(allowed.leaseId).toBe(lease.leaseId);

    const allowedMixed = await caller.terminal.input({
      terminalId,
      accessToken: issued.grant.accessToken,
      text: '<raw>approved mixed</raw><key data="enter"/>',
      returnRead: false,
    });
    expect(allowedMixed.ok).toBeTrue();

    const rejectedMixed = await caller.terminal.input({
      terminalId,
      accessToken: issued.grant.accessToken,
      text: "<raw>a<raw>b</raw>c</raw>",
      returnRead: false,
    });
    expect(rejectedMixed.ok).toBeFalse();
    expect(rejectedMixed.message).toContain("failed before reaching the PTY");

    const activity = await caller.terminal.activityPage({
      terminalId,
      limit: 20,
    });
    expect(activity.items.some((item) => item.kind === "terminal_write")).toBeTrue();
    expect(
      activity.items.some((item) => item.kind === "terminal_write" && item.actorId === "session:avatar-pair"),
    ).toBeTrue();
    expect(
      activity.items.filter((item) => item.kind === "terminal_write" && item.title === "Terminal input"),
    ).toHaveLength(1);

    const focused = await caller.terminal.globalFocus({
      op: "clear",
      terminalIds: [],
    });
    expect(focused.focusedTerminalIds).toEqual([]);

    await caller.terminal.globalStop({
      terminalId,
    });
    const liveAfterStop = await caller.terminal.globalList();
    const historyAfterStop = await caller.terminal.globalHistory();
    const indexAfterStop = await caller.terminal.globalIndex();
    const archiveAfterStop = await caller.terminal.globalArchiveList();
    expect(liveAfterStop.items.some((item) => item.terminalId === terminalId)).toBeFalse();
    expect(historyAfterStop.items.find((item) => item.terminalId === terminalId)?.processPhase).toBe("killed");
    expect(indexAfterStop.items.find((item) => item.terminalId === terminalId)?.processPhase).toBe("killed");
    expect(archiveAfterStop.items.some((item) => item.terminalId === terminalId)).toBeFalse();

    const deleted = await caller.terminal.globalDelete({
      terminalId,
    });
    expect(deleted.ok).toBeTrue();
    expect((await caller.terminal.globalList()).items.some((item) => item.terminalId === terminalId)).toBeFalse();

    await kernel.stop();
  });

  test("Scenario: Given daemon cold-start finds stale global terminals When the app kernel starts Then live history index and archive projections stay separated", async () => {
    const root = makeTempDir();
    const stateRoot = join(root, "state");
    const terminalId = "daemon-recovered-global";
    seedGlobalRunningTerminalRecord({
      stateRoot,
      terminalId,
      cwd: root,
      stoppedAt: Date.now() - 1_000,
    });

    const kernel = new AppKernel({
      globalSessionRoot: join(stateRoot, "sessions"),
      archiveSessionRoot: join(stateRoot, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      authService: {
        rootAuthPrivateKey: ROOT_AUTH_PRIVATE_KEY,
      },
    });
    await kernel.start();
    const { caller } = await createRootSuperadminCaller(kernel);

    const live = await caller.terminal.globalList();
    const history = await caller.terminal.globalHistory();
    const index = await caller.terminal.globalIndex();
    const archive = await caller.terminal.globalArchiveList();

    expect(live.items.some((item) => item.terminalId === terminalId)).toBeFalse();
    expect(history.items.find((item) => item.terminalId === terminalId)?.processPhase).toBe("killed");
    expect(index.items.find((item) => item.terminalId === terminalId)?.processPhase).toBe("killed");
    expect(archive.items.some((item) => item.terminalId === terminalId)).toBeFalse();
    expect(history.items.every((item) => item.processPhase === "killed")).toBeTrue();
    expect(index.items.filter((item) => item.terminalId === terminalId)).toHaveLength(1);

    await kernel.stop();
  });

  test("Scenario: Given managed terminal lease routes When a guard avatar writes under the granted lease Then app-server preserves avatar actor identity and lease provenance without hidden superadmin writes", async () => {
    const root = makeTempDir();
    const avatarActorId: TerminalActorId = "auth:shell-assistant";
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      authService: {
        rootAuthPrivateKey: ROOT_AUTH_PRIVATE_KEY,
      },
    });
    await kernel.start();
    const { caller } = await createRootSuperadminCaller(kernel);
    const created = await caller.terminal.globalCreate({
      terminalId: "managed-lease-route",
      processKind: "shell",
      cwd: root,
      focus: false,
    });
    const terminalId = created.result.terminal?.terminalId;
    if (!terminalId) {
      throw new Error("expected global terminal id");
    }

    await caller.terminal.issueGrant({
      terminalId,
      role: "guard",
      participantId: avatarActorId,
      label: "Shell assistant",
    });

    const lease = await caller.terminal.grantWriteLease({
      terminalId,
      participantId: avatarActorId,
      durationMs: 30 * 60 * 1000,
    });
    expect(lease.participantId).toBe(avatarActorId);

    const terminalSystem = Reflect.get(kernel, "terminalControlPlane") as TerminalControlPlane;
    const written = await terminalSystem.write({
      terminalId,
      text: "managed lease write\n",
      actorId: avatarActorId,
    });
    expect(written.ok).toBeTrue();
    expect(written.leaseId).toBe(lease.leaseId);

    const event = written.eventId ? terminalSystem.getEvent(written.eventId) : undefined;
    expect(event?.payload.actorId).toBe(avatarActorId);
    expect(event?.payload.detail).toMatchObject({
      mode: "raw",
      leaseId: lease.leaseId,
    });

    const activity = await caller.terminal.activityPage({
      terminalId,
      limit: 20,
    });
    expect(
      activity.items.some(
        (item) =>
          item.kind === "terminal_write" &&
          item.actorId === avatarActorId &&
          item.detail &&
          typeof item.detail === "object" &&
          "leaseId" in item.detail &&
          Reflect.get(item.detail, "leaseId") === lease.leaseId,
      ),
    ).toBeTrue();

    const revoked = await caller.terminal.revokeWriteLease({
      terminalId,
      participantId: avatarActorId,
    });
    expect(revoked).toEqual({
      ok: true,
      revokedCount: 1,
    });

    const blockedAgain = await terminalSystem.write({
      terminalId,
      text: "blocked again",
      actorId: avatarActorId,
      createApprovalRequest: false,
    });
    expect(blockedAgain.ok).toBeFalse();
    expect(blockedAgain.message).toContain("approval");

    await kernel.stop();
  });

  test("Scenario: Given terminal permission request subscribers When guard writes occur Then TRPC delivers authorized global and terminal-scoped approval facts only", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      authService: {
        rootAuthPrivateKey: ROOT_AUTH_PRIVATE_KEY,
      },
    });
    await kernel.start();
    const { caller: superadminCaller } = await createRootSuperadminCaller(kernel);
    const observer = await createWalletAuthCaller(kernel);
    const hidden = await createWalletAuthCaller(kernel);
    const alpha = await superadminCaller.terminal.globalCreate({
      terminalId: "permission-sub-alpha",
      processKind: "shell",
      cwd: root,
      focus: false,
    });
    const bravo = await superadminCaller.terminal.globalCreate({
      terminalId: "permission-sub-bravo",
      processKind: "shell",
      cwd: root,
      focus: false,
    });
    const alphaId = alpha.result.terminal?.terminalId;
    const bravoId = bravo.result.terminal?.terminalId;
    if (!alphaId || !bravoId) {
      throw new Error("expected terminal ids");
    }
    await superadminCaller.terminal.issueGrant({
      terminalId: alphaId,
      role: "readonly",
      participantId: observer.actorId,
    });
    await superadminCaller.terminal.issueGrant({
      terminalId: alphaId,
      role: "guard",
      participantId: "session:guard",
    });
    await superadminCaller.terminal.issueGrant({
      terminalId: bravoId,
      role: "guard",
      participantId: "session:guard",
    });

    const terminalSystem = Reflect.get(kernel, "terminalControlPlane") as TerminalControlPlane;
    const initial = await terminalSystem.write({
      terminalId: alphaId,
      text: "initial pending",
      actorId: "session:guard",
    });
    const initialRequestId = initial.approvalRequest?.requestId;
    if (!initialRequestId) {
      throw new Error("expected initial approval request");
    }

    const globalEvents: Array<
      | { type: "snapshot"; items: TerminalApprovalRequestRecord[] }
      | { type: "request"; request: TerminalApprovalRequestRecord }
    > = [];
    const alphaEvents: Array<
      | { type: "snapshot"; items: TerminalApprovalRequestRecord[] }
      | { type: "request"; request: TerminalApprovalRequestRecord }
    > = [];
    const hiddenEvents: Array<
      | { type: "snapshot"; items: TerminalApprovalRequestRecord[] }
      | { type: "request"; request: TerminalApprovalRequestRecord }
    > = [];

    const globalSubscription = (await observer.caller.terminal.permissionRequests()).subscribe({
      next: (event) => {
        globalEvents.push(event);
      },
    });
    const alphaSubscription = (await observer.caller.terminal.permissionRequests({ terminalId: alphaId })).subscribe({
      next: (event) => {
        alphaEvents.push(event);
      },
    });
    const hiddenSubscription = (await hidden.caller.terminal.permissionRequests()).subscribe({
      next: (event) => {
        hiddenEvents.push(event);
      },
    });

    expect(globalEvents).toEqual([
      {
        type: "snapshot",
        items: [expect.objectContaining({ terminalId: alphaId, requestId: initialRequestId })],
      },
    ]);
    expect(alphaEvents).toEqual([
      {
        type: "snapshot",
        items: [expect.objectContaining({ terminalId: alphaId, requestId: initialRequestId })],
      },
    ]);
    expect(hiddenEvents).toEqual([{ type: "snapshot", items: [] }]);

    const alphaFollowup = await terminalSystem.write({
      terminalId: alphaId,
      text: "followup pending",
      actorId: "session:guard",
    });
    const bravoHidden = await terminalSystem.write({
      terminalId: bravoId,
      text: "bravo hidden",
      actorId: "session:guard",
    });

    expect(globalEvents.at(-1)).toMatchObject({
      type: "request",
      request: {
        terminalId: alphaId,
        requestId: alphaFollowup.approvalRequest?.requestId,
      },
    });
    expect(alphaEvents.at(-1)).toMatchObject({
      type: "request",
      request: {
        terminalId: alphaId,
        requestId: alphaFollowup.approvalRequest?.requestId,
      },
    });
    expect(globalEvents.some((event) => event.type === "request" && event.request.terminalId === bravoId)).toBeFalse();
    expect(alphaEvents.some((event) => event.type === "request" && event.request.terminalId === bravoId)).toBeFalse();
    expect(hiddenEvents).toEqual([{ type: "snapshot", items: [] }]);
    expect(bravoHidden.approvalRequest?.terminalId).toBe(bravoId);

    globalSubscription.unsubscribe();
    alphaSubscription.unsubscribe();
    hiddenSubscription.unsubscribe();
    await kernel.stop();
  });

  test("Scenario: Given a browser caller without auth When terminal global routes are invoked Then terminal access tokens do not bypass the authenticated control plane", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      authService: {
        rootAuthPrivateKey: ROOT_AUTH_PRIVATE_KEY,
      },
    });
    await kernel.start();

    const { anonymousCaller, caller } = await createRootSuperadminCaller(kernel);
    const created = await caller.terminal.globalCreate({
      terminalId: "authed-terminal",
      processKind: "shell",
      cwd: root,
      focus: false,
    });
    const terminal = created.result.terminal;
    if (!terminal?.terminalId) {
      throw new Error("expected authenticated terminal id");
    }

    await expect(anonymousCaller.terminal.globalList()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      anonymousCaller.terminal.read({
        terminalId: terminal.terminalId,
        accessToken: terminal.access?.accessToken,
      }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      anonymousCaller.terminal.write({
        terminalId: terminal.terminalId,
        accessToken: terminal.access?.accessToken,
        text: "anonymous write",
      }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    await kernel.stop();
  });

  test(
    "Scenario: Given durable terminal read history When terminal activity page is queried Then read rows stay summarized instead of replaying full snapshots",
    async () => {
      const root = makeTempDir();
      const kernel = new AppKernel({
        globalSessionRoot: join(root, "sessions"),
        archiveSessionRoot: join(root, "archive", "sessions"),
        workspacesPath: join(root, "workspaces.yaml"),
        authService: {
          rootAuthPrivateKey: ROOT_AUTH_PRIVATE_KEY,
        },
      });
      await kernel.start();
      const { caller, session } = await createRootSuperadminCaller(kernel);

      const created = await caller.terminal.globalCreate({
        terminalId: "activity-summary",
      });
      const terminalId = created.result.terminal?.terminalId;
      if (!terminalId) {
        throw new Error("expected activity summary terminal id");
      }
      const terminalSystem = Reflect.get(kernel, "terminalControlPlane") as TerminalControlPlane;
      const recordedRead = await terminalSystem.readAuthorized({
        terminalId,
        mode: "snapshot",
        superadminActorId: session.claims.authId as TerminalActorId,
      });

      expect(recordedRead.eventId).toBeDefined();
      const activity = await caller.terminal.activityPage({
        terminalId,
        limit: 20,
      });
      const readItem = activity.items.find((item) => item.kind === "terminal_read");
      expect(readItem).toBeDefined();
      expect(readItem?.detail).toMatchObject({
        source: "terminal-read-activity",
        eventId: recordedRead.eventId,
        terminalId,
        representation: "snapshot",
      });
      expect(
        readItem?.detail && typeof readItem.detail === "object" && !Array.isArray(readItem.detail)
          ? "snapshot" in readItem.detail
          : false,
      ).toBeFalse();
      expect((readItem?.content.length ?? 0) < JSON.stringify(recordedRead).length).toBeTrue();

      await kernel.stop();
    },
    { timeout: 20_000 },
  );

  test("Scenario: Given root auth identity When bearer JWT reaches the router Then superadmin-only procedures resolve through TRPC auth context", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      authService: {
        rootAuthPrivateKey: ROOT_AUTH_PRIVATE_KEY,
      },
    });
    await kernel.start();

    const caller = appRouter.createCaller(await createTrpcContext(kernel));
    const descriptor = await caller.auth.service();
    expect(descriptor.authMode).toBe("wallet_challenge_jwt");

    const challenge = await caller.auth.challengeStart({
      authId: descriptor.rootAuthId,
    });
    const signature = await privateKeyToAccount(ROOT_AUTH_PRIVATE_KEY).signMessage({
      message: challenge.challengeText,
    });
    const session = await caller.auth.challengeVerify({
      challengeId: challenge.challengeId,
      signature,
    });

    expect(session.claims.superadmin).toBeTrue();
    expect(session.claims.authId).toBe(descriptor.rootAuthId);

    const authedCaller = appRouter.createCaller(
      await createTrpcContext({
        kernel,
        authorizationHeader: `Bearer ${session.token}`,
      }),
    );
    const authSession = await authedCaller.auth.session();
    expect(authSession.claims.superadmin).toBeTrue();
    expect(authSession.token).toBe(session.token);

    const superadminStatus = await authedCaller.auth.superadminStatus();
    expect(superadminStatus.ok).toBeTrue();
    expect(superadminStatus.claims.superadmin).toBeTrue();

    await expect(caller.auth.superadminStatus()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    await kernel.stop();
  });

  test("Scenario: Given durable Heartbeat-part and request-aux rows When runtime heartbeatGroupsPage is queried Then the router projects before-call call and pending groups", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    const { caller } = await createRootSuperadminCaller(kernel);

    const created = await caller.session.create({
      cwd: root,
      name: "heartbeat-parts",
      autoStart: false,
    });
    const db = new SessionDb(join(created.session.sessionRoot, "session.db"));
    let aiCallId = 0;
    try {
      db.upsertMessage({
        messageId: "request-1",
        roundIndex: 0,
        scope: "heartbeat_part",
        role: "user",
        createdAt: 100,
        updatedAt: 100,
        parts: [{ partType: "text", payload: { type: "text", content: "context" }, isComplete: true }],
      });
      db.upsertMessage({
        messageId: "config-1",
        roundIndex: 0,
        scope: "request_aux",
        role: "config",
        createdAt: 110,
        updatedAt: 110,
        parts: [{ partType: "config", payload: { temperature: 0.2 }, isComplete: true }],
      });
      db.upsertMessage({
        messageId: "room-ingress-1",
        roundIndex: 0,
        scope: "heartbeat_part",
        role: "user",
        createdAt: 115,
        updatedAt: 115,
        parts: [
          {
            partType: "text",
            payload: {
              type: "text",
              content: 'scoreMap={"message:room-main":1} commit=weather?',
            },
            isComplete: true,
          },
        ],
      });
      db.upsertMessage({
        messageId: "response-1",
        roundIndex: 0,
        scope: "heartbeat_part",
        role: "assistant",
        aiCallId: 41,
        createdAt: 120,
        updatedAt: 120,
        parts: [{ partType: "text", payload: { type: "text", content: "reply" }, isComplete: true }],
      });
      aiCallId = db.appendAiCall({
        roundIndex: 0,
        kind: "model",
        status: "done",
        provider: "openai/chat",
        model: "gpt-test",
        requestUrl: "https://example.test/v1/chat/completions",
        requestBody: { messages: [] },
        responseBody: { text: "reply" },
        requestMessageIds: [],
        responseMessageIds: ["response-1"],
        auxiliaryMessageIds: ["config-1"],
        createdAt: 118,
        updatedAt: 130,
        completedAt: 130,
        isComplete: true,
      }).id;
      db.upsertMessage({
        messageId: "config-2",
        roundIndex: 1,
        scope: "request_aux",
        role: "config",
        createdAt: 140,
        updatedAt: 140,
        parts: [{ partType: "config", payload: { temperature: 0.4 }, isComplete: true }],
      });
    } finally {
      db.close();
    }

    const page = await caller.runtime.heartbeatGroupsPage({
      sessionId: created.session.id,
      limit: 20,
    });

    expect(page.items.map((group) => group.kind)).toEqual(["before-call", "call", "before-call-pending"]);
    expect(page.items.map((group) => group.groupId)).toEqual([
      `heartbeat-group:before-call:${aiCallId}`,
      `heartbeat-group:call:${aiCallId}`,
      `heartbeat-group:before-call-pending:${aiCallId + 1}`,
    ]);
    expect(page.items[0]?.items.map((row) => row.messageId)).toEqual(["request-1", "config-1", "room-ingress-1"]);
    expect(page.items[1]?.items.map((row) => row.messageId)).toEqual(["response-1"]);
    expect(page.items[2]?.items.map((row) => row.messageId)).toEqual(["config-2"]);

    await kernel.stop();
  });

  test("Scenario: Given mixed materialized Heartbeat facts When runtime heartbeatRecordPage is queried Then records stay ascending and latest is the tail row", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    const { caller } = await createRootSuperadminCaller(kernel);

    const created = await caller.session.create({
      cwd: root,
      name: "heartbeat-records",
      autoStart: false,
    });
    const db = new SessionDb(join(created.session.sessionRoot, "session.db"));
    try {
      db.upsertMessage({
        messageId: "record-config-1",
        roundIndex: 1,
        scope: "request_aux",
        role: "config",
        createdAt: 80,
        updatedAt: 82,
        parts: [{ partType: "config", payload: { temperature: 0.2 }, isComplete: true }],
      });

      const modelCall = db.appendAiCall({
        roundIndex: 1,
        kind: "chat",
        status: "done",
        provider: "openai",
        model: "gpt-test",
        requestUrl: "https://example.test/v1/responses",
        requestBody: { model: "gpt-test" },
        createdAt: 100,
        updatedAt: 130,
        completedAt: 130,
        isComplete: true,
      });
      db.upsertMessage({
        messageId: "record-model-response-1",
        aiCallId: modelCall.id,
        roundIndex: 1,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 120,
        updatedAt: 130,
        parts: [{ partType: "text", payload: { content: "model response" }, isComplete: true }],
      });
      db.updateAiCall(modelCall.id, { responseMessageIds: ["record-model-response-1"] });

      const compactCall = db.appendAiCall({
        roundIndex: 2,
        kind: "compact",
        status: "done",
        provider: "openai",
        model: "gpt-test",
        requestUrl: "https://example.test/v1/responses",
        requestBody: { model: "gpt-test" },
        createdAt: 150,
        updatedAt: 180,
        completedAt: 180,
        isComplete: true,
      });
      db.upsertMessage({
        messageId: "record-compact-response-1",
        aiCallId: compactCall.id,
        roundIndex: 2,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 160,
        updatedAt: 180,
        parts: [{ partType: "text", payload: { content: "compact response" }, isComplete: true }],
      });
      db.updateAiCall(compactCall.id, { responseMessageIds: ["record-compact-response-1"] });
    } finally {
      db.close();
    }

    const page = await caller.runtime.heartbeatRecordPage({
      sessionId: created.session.id,
      pageSize: 5,
      pageCount: 1,
      anchor: { kind: "latest" },
    });

    expect(page.records.map((record) => record.kind)).toEqual(["config", "model_call", "compact"]);
    expect(page.records.map((record) => record.startedAt)).toEqual([80, 100, 150]);
    expect(page.latestRecordId).toBe(page.records.at(-1)?.id ?? null);
    expect(page.totalRecords).toBe(3);

    await kernel.stop();
  });

  test("Scenario: Given orphan Heartbeat projection rows When runtime repairHeartbeatRecordProjectionHealth is invoked Then only damaged projection rows are deleted", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    try {
      const { caller } = await createRootSuperadminCaller(kernel);
      const created = await caller.session.create({
        cwd: root,
        name: "heartbeat-record-repair",
        autoStart: false,
      });
      const dbPath = join(created.session.sessionRoot, "session.db");
      const db = new SessionDb(dbPath);
      try {
        const modelCall = db.appendAiCall({
          roundIndex: 1,
          kind: "chat",
          status: "done",
          provider: "openai",
          model: "gpt-test",
          requestUrl: "https://example.test/v1/responses",
          requestBody: { model: "gpt-test" },
          createdAt: 100,
          updatedAt: 130,
          completedAt: 130,
          isComplete: true,
        });
        db.upsertMessage({
          messageId: "repair-model-response-1",
          aiCallId: modelCall.id,
          roundIndex: 1,
          scope: "heartbeat_part",
          role: "assistant",
          createdAt: 120,
          updatedAt: 130,
          parts: [{ partType: "text", payload: { content: "surviving source fact" }, isComplete: true }],
        });
        db.updateAiCall(modelCall.id, { responseMessageIds: ["repair-model-response-1"] });
        db.refreshHeartbeatRecords();
      } finally {
        db.close();
      }

      const raw = new Database(dbPath, { strict: true });
      try {
        raw
          .query(
            `insert into heartbeat_record (
               record_key,
               kind,
               status,
               primary_ai_call_id,
               ai_call_ids_json,
               source_refs_json,
               feature_flags_json,
               summary_json,
               preview_text,
               started_at,
               updated_at,
               completed_at,
               is_complete
             ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            "heartbeat-record:model_call:999999",
            "model_call",
            "completed",
            999999,
            JSON.stringify([999999]),
            JSON.stringify([{ kind: "ai_call", id: 999999, role: "primary" }]),
            JSON.stringify({}),
            JSON.stringify({
              provider: "ghost",
              model: "ghost",
              parts: [],
              counts: { parts: 0, toolCalls: 0, toolResults: 0, errors: 0 },
              firstFrameMs: null,
              thinkingDurationMs: 0,
            }),
            "orphan projection",
            140,
            145,
            145,
            1,
          );
      } finally {
        raw.close();
      }

      const result = await caller.runtime.repairHeartbeatRecordProjectionHealth({ sessionId: created.session.id });

      expect(result.before).toMatchObject({
        totalRecords: 2,
        missingPrimaryAiCallRecords: 1,
      });
      expect(result.deletedRecords).toBe(1);
      expect(result.deletedRecordIds).toEqual(result.before.orphanRecordIds);
      expect(result.after).toEqual({
        totalRecords: 1,
        missingPrimaryAiCallRecords: 0,
        orphanRecordIds: [],
      });

      const page = await caller.runtime.heartbeatRecordPage({
        sessionId: created.session.id,
        pageSize: 5,
        pageCount: 1,
        anchor: { kind: "latest" },
      });
      expect(page.totalRecords).toBe(1);
      expect(page.records.map((record) => record.previewText)).toEqual(["surviving source fact"]);
    } finally {
      await kernel.stop();
    }
  });

  test("Scenario: Given Heartbeat source facts prompt-window facts and attention files When runtime clearHeartbeatSession is invoked Then session-local Heartbeat context facts are deleted", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    try {
      const { caller } = await createRootSuperadminCaller(kernel);
      const created = await caller.session.create({
        cwd: root,
        name: "heartbeat-session-clear",
        autoStart: false,
      });
      const dbPath = join(created.session.sessionRoot, "session.db");
      const attentionRoot = join(created.session.sessionRoot, "attention-system");
      mkdirSync(attentionRoot, { recursive: true });
      writeFileSync(join(attentionRoot, "state.json"), JSON.stringify({ version: 8, contexts: [] }));
      writeFileSync(join(attentionRoot, "hash-aliases.json"), JSON.stringify({ version: 1, aliases: [] }));
      const db = new SessionDb(dbPath);
      try {
        db.setCurrentRoundIndex(7, 35);
        db.savePromptWindow({
          createdAt: 40,
          roundIndex: 7,
          messages: [{ role: "system", content: "old prompt window fact" }],
          setCurrent: true,
        });
        db.upsertMessage({
          messageId: "clear-config-1",
          roundIndex: 1,
          scope: "request_aux",
          role: "config",
          createdAt: 80,
          updatedAt: 90,
          parts: [{ partType: "config", payload: { content: { provider: "openai" } }, isComplete: true }],
        });
        const modelCall = db.appendAiCall({
          roundIndex: 1,
          kind: "chat",
          status: "done",
          provider: "openai",
          model: "gpt-test",
          requestUrl: "https://example.test/v1/responses",
          requestBody: { model: "gpt-test" },
          createdAt: 100,
          updatedAt: 140,
          completedAt: 140,
          isComplete: true,
        });
        db.upsertMessage({
          messageId: "clear-model-request-1",
          aiCallId: modelCall.id,
          roundIndex: 1,
          scope: "heartbeat_part",
          role: "user",
          createdAt: 100,
          updatedAt: 105,
          parts: [{ partType: "text", payload: { content: "clear request" }, isComplete: true }],
        });
        db.upsertMessage({
          messageId: "clear-model-response-1",
          aiCallId: modelCall.id,
          roundIndex: 1,
          scope: "heartbeat_part",
          role: "assistant",
          createdAt: 120,
          updatedAt: 140,
          parts: [{ partType: "text", payload: { content: "clear response" }, isComplete: true }],
        });
        db.updateAiCall(modelCall.id, {
          requestMessageIds: ["clear-model-request-1"],
          responseMessageIds: ["clear-model-response-1"],
        });
        db.appendEffectLedger({
          effectId: "effect-clear-message",
          actionId: "action-clear-message",
          actionKind: "message_send",
          actorId: "actor-clear",
          cycleId: 7,
          sessionModelCallId: modelCall.id,
          target: "room:clear",
          effectKind: "message_row_created",
          effectRecordId: "room:clear/1",
          timestamp: 130,
          meta: { chatId: "room:clear", messageId: 1 },
        });
        db.refreshHeartbeatRecords();
      } finally {
        db.close();
      }

      const beforePage = await caller.runtime.heartbeatRecordPage({
        sessionId: created.session.id,
        pageSize: 5,
        pageCount: 1,
        anchor: { kind: "latest" },
      });
      expect(beforePage.totalRecords).toBe(2);

      const result = await caller.runtime.clearHeartbeatSession({ sessionId: created.session.id });

      expect(result).toEqual({
        deletedAiCalls: 1,
        deletedMessageParts: 4,
        deletedHeartbeatMessageParts: 2,
        deletedRequestAuxMessageParts: 1,
        deletedPromptWindowMessageParts: 1,
        deletedHeartbeatRecords: 2,
        deletedAttentionDispatches: 0,
        deletedAttentionReceipts: 0,
        deletedEffectLedgerRecords: 1,
        resetCurrentRoundIndex: true,
        resetCurrentPromptWindow: true,
        stoppedRuntime: false,
        deletedAttentionFiles: 2,
      });
      const afterPage = await caller.runtime.heartbeatRecordPage({
        sessionId: created.session.id,
        pageSize: 5,
        pageCount: 1,
        anchor: { kind: "latest" },
      });
      expect(afterPage.totalRecords).toBe(0);
      expect(afterPage.records).toEqual([]);

      const reopened = new SessionDb(dbPath);
      try {
        expect(reopened.listAiCalls()).toEqual([]);
        expect(reopened.listMessagesByScope("heartbeat_part")).toEqual([]);
        expect(reopened.listMessagesByScope("request_aux")).toEqual([]);
        expect(reopened.listMessagesByScope("prompt_window")).toEqual([]);
        expect(reopened.listEffectLedger()).toEqual([]);
        expect(reopened.getHead()).toMatchObject({
          currentRoundIndex: 0,
          currentPromptWindowId: null,
        });
        expect(existsSync(attentionRoot)).toBe(false);
      } finally {
        reopened.close();
      }
    } finally {
      await kernel.stop();
    }
  });

  test("Scenario: Given 100+ synthetic AI facts and one real runtime turn When runtime events subscribe and heartbeatRecordPage are queried Then the live push arrives and the materialized projection stays ordered", async () => {
    const liveHarness = await createMockKernelHarness({ sessionName: "heartbeat-live-push" });

    if (!liveHarness) {
      throw new Error("expected mock kernel harness");
    }

    try {
      const { caller } = await createRootSuperadminCaller(liveHarness.kernel);
      const sessionRoot = liveHarness.session.sessionRoot;
      const sessionId = liveHarness.session.id;
      const beforeSeedPage = await caller.runtime.heartbeatRecordPage({
        sessionId,
        pageSize: 20,
        pageCount: 2,
        anchor: { kind: "latest" },
      });
      const seeded = seedHeartbeatRecords({
        dbPath: join(sessionRoot, "session.db"),
        startAt: Date.UTC(2026, 0, 1, 0, 0, 0),
        recordCount: 106,
      });
      expect(seeded.recordKeys).toHaveLength(106);

      const liveEvents: AnyRuntimeEvent[] = [];
      const subscription = (await caller.runtime.events({ afterEventId: 0 })).subscribe({
        next: (event) => {
          liveEvents.push(event);
        },
      });

      try {
        const initialPage = await caller.runtime.heartbeatRecordPage({
          sessionId,
          pageSize: 20,
          pageCount: 2,
          anchor: { kind: "latest" },
        });
        expect(initialPage.totalRecords).toBeGreaterThan(beforeSeedPage.totalRecords);
        expect(initialPage.records.map((record) => record.startedAt)).toEqual(
          [...initialPage.records.map((record) => record.startedAt)].sort((left, right) => left - right),
        );
        expect(initialPage.latestRecordId).toBe(initialPage.records.at(-1)?.id ?? null);

        const pinnedOlderAnchor = {
          kind: "fixed" as const,
          pageIndex: Math.max(0, initialPage.pageIndex - initialPage.pageCount),
          latestRecordId: initialPage.latestRecordId,
        };
        const pinnedBefore = await caller.runtime.heartbeatRecordPage({
          sessionId,
          pageSize: 20,
          pageCount: 2,
          anchor: pinnedOlderAnchor,
        });

        const sent = await liveHarness.kernel.pushUserRoomMessage({
          sessionId,
          chatId: liveHarness.room.chatId,
          text: "heartbeat live push please",
        });
        expect(sent.ok).toBe(true);

        const liveEvent = await waitForEvent(
          async () =>
            liveEvents.find((event) => event.type === "runtime.heartbeatPart" && event.sessionId === sessionId) ?? null,
          { label: "runtime heartbeat part event" },
        );
        expect(liveEvent.type).toBe("runtime.heartbeatPart");

        const latestPage = await waitForEvent(
          async () => {
            const page = await caller.runtime.heartbeatRecordPage({
              sessionId,
              pageSize: 20,
              pageCount: 2,
              anchor: { kind: "latest" },
            });
            return page.totalRecords > initialPage.totalRecords ? page : null;
          },
          { label: "updated heartbeat record page" },
        );

        expect(latestPage.totalRecords).toBeGreaterThan(initialPage.totalRecords);
        expect(latestPage.latestRecordId).toBe(latestPage.records.at(-1)?.id ?? null);
        expect(latestPage.records.map((record) => record.startedAt)).toEqual(
          [...latestPage.records.map((record) => record.startedAt)].sort((left, right) => left - right),
        );
        expect(latestPage.records.at(-1)?.id).not.toBe(initialPage.records.at(-1)?.id);

        const pinnedAfter = await caller.runtime.heartbeatRecordPage({
          sessionId,
          pageSize: 20,
          pageCount: 2,
          anchor: pinnedOlderAnchor,
        });
        expect(pinnedAfter.records.map((record) => record.id)).toEqual(pinnedBefore.records.map((record) => record.id));
        expect(pinnedAfter.records.map((record) => record.startedAt)).toEqual(
          pinnedBefore.records.map((record) => record.startedAt),
        );
        expect(pinnedAfter.newRecordsAvailable).toBe(true);

        const rows = readHeartbeatRecordRows(join(sessionRoot, "session.db"));
        expect(rows.length).toBe(latestPage.totalRecords);
        expect(rows.map((row) => row.startedAt)).toEqual(
          [...rows.map((row) => row.startedAt)].sort((left, right) => left - right),
        );
        expect(rows.slice(0, seeded.recordKeys.length).map((row) => row.recordKey)).toEqual(seeded.recordKeys);
        expect(rows.at(-1)?.recordKey.startsWith("heartbeat-record:")).toBe(true);
        expect(rows.at(-1)?.startedAt).toBe(latestPage.records.at(-1)?.startedAt);
        expect(rows.at(-1)?.kind).toBe(latestPage.records.at(-1)?.kind);
        expect(JSON.parse(rows.at(0)?.summaryJson ?? "{}")).toMatchObject({
          counts: { parts: 4, toolCalls: 1, toolResults: 0, errors: 0 },
        });
        const configRow = rows.find((row) => row.kind === "config");
        expect(configRow).toBeDefined();
        expect(JSON.parse(configRow?.sourceRefsJson ?? "[]")[0]).toMatchObject({
          kind: "message_part",
          role: "config",
        });
      } finally {
        subscription.unsubscribe();
      }
    } finally {
      await liveHarness.stop();
    }
  });

  test("Scenario: Given authenticated actors When they use kv procedures Then each actor only sees private Studio memory facts", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();

    const caller = appRouter.createCaller(await createTrpcContext(kernel));
    await expect(caller.kv.snapshot()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    const accountA = privateKeyToAccount(generatePrivateKey());
    const challengeA = await caller.auth.challengeStart({
      authId: accountA.address.toLowerCase(),
    });
    const sessionA = await caller.auth.challengeVerify({
      challengeId: challengeA.challengeId,
      signature: await accountA.signMessage({ message: challengeA.challengeText }),
    });
    const callerA = appRouter.createCaller(
      await createTrpcContext({
        kernel,
        authorizationHeader: `Bearer ${sessionA.token}`,
      }),
    );

    const accountB = privateKeyToAccount(generatePrivateKey());
    const challengeB = await caller.auth.challengeStart({
      authId: accountB.address.toLowerCase(),
    });
    const sessionB = await caller.auth.challengeVerify({
      challengeId: challengeB.challengeId,
      signature: await accountB.signMessage({ message: challengeB.challengeText }),
    });
    const callerB = appRouter.createCaller(
      await createTrpcContext({
        kernel,
        authorizationHeader: `Bearer ${sessionB.token}`,
      }),
    );

    const saved = await callerA.kv.set({
      key: "studio/devtools/tab",
      value: {
        tab: "model",
        pinned: true,
      },
    });
    expect(saved).toMatchObject({
      ok: true,
      changed: true,
      entry: {
        key: "studio/devtools/tab",
        value: {
          tab: "model",
          pinned: true,
        },
        version: 1,
      },
    });

    const actorASnapshot = await callerA.kv.snapshot();
    const actorBSnapshot = await callerB.kv.snapshot();
    expect(actorASnapshot.items).toHaveLength(1);
    expect(actorASnapshot.items[0]).toMatchObject({
      key: "studio/devtools/tab",
      value: {
        tab: "model",
        pinned: true,
      },
      version: 1,
    });
    expect(actorBSnapshot).toEqual({
      lastEventId: 0,
      items: [],
    });

    const conflict = await callerA.kv.set({
      key: "studio/devtools/tab",
      value: "cycle",
      baseVersion: null,
    });
    expect(conflict).toMatchObject({
      ok: false,
      reason: "conflict",
      latest: {
        key: "studio/devtools/tab",
        version: 1,
      },
    });

    const noopDelete = await callerB.kv.delete({
      key: "studio/devtools/tab",
    });
    expect(noopDelete).toEqual({
      ok: true,
      removed: false,
      eventId: null,
      key: "studio/devtools/tab",
      version: null,
    });

    await kernel.stop();
  });

  test("Scenario: Given authenticated actors When they use draft procedures Then avatar create drafts stay private durable and resumable per actor", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();

    const caller = appRouter.createCaller(await createTrpcContext(kernel));
    await expect(caller.drafts.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    const accountA = privateKeyToAccount(generatePrivateKey());
    const challengeA = await caller.auth.challengeStart({
      authId: accountA.address.toLowerCase(),
    });
    const sessionA = await caller.auth.challengeVerify({
      challengeId: challengeA.challengeId,
      signature: await accountA.signMessage({ message: challengeA.challengeText }),
    });
    const callerA = appRouter.createCaller(
      await createTrpcContext({
        kernel,
        authorizationHeader: `Bearer ${sessionA.token}`,
      }),
    );

    const accountB = privateKeyToAccount(generatePrivateKey());
    const challengeB = await caller.auth.challengeStart({
      authId: accountB.address.toLowerCase(),
    });
    const sessionB = await caller.auth.challengeVerify({
      challengeId: challengeB.challengeId,
      signature: await accountB.signMessage({ message: challengeB.challengeText }),
    });
    const callerB = appRouter.createCaller(
      await createTrpcContext({
        kernel,
        authorizationHeader: `Bearer ${sessionB.token}`,
      }),
    );

    const created = await callerA.drafts.create({
      kind: "avatar_create",
      state: {
        nickname: "reviewer",
        sourceAvatarNickname: "default",
      },
    });
    expect(created.entry).toMatchObject({
      kind: "avatar_create",
      version: 1,
      state: {
        nickname: "reviewer",
        sourceAvatarNickname: "default",
      },
    });

    const actorAList = await callerA.drafts.list({
      kind: "avatar_create",
    });
    expect(actorAList.items).toEqual([created.entry]);
    const actorBList = await callerB.drafts.list();
    expect(actorBList).toEqual({
      lastEventId: 0,
      items: [],
    });

    const resumed = await callerA.drafts.get({
      draftId: created.entry.draftId,
    });
    expect(resumed).toEqual(created.entry);

    const saved = await callerA.drafts.save({
      draftId: created.entry.draftId,
      kind: "avatar_create",
      state: {
        nickname: "reviewer-2",
        sourceAvatarNickname: "default",
      },
      baseVersion: created.entry.version,
    });
    expect(saved).toMatchObject({
      ok: true,
      changed: true,
      entry: {
        draftId: created.entry.draftId,
        kind: "avatar_create",
        version: 2,
        state: {
          nickname: "reviewer-2",
          sourceAvatarNickname: "default",
        },
      },
    });

    const removed = await callerA.drafts.delete({
      draftId: created.entry.draftId,
      baseVersion: 2,
    });
    expect(removed).toEqual({
      ok: true,
      removed: true,
      eventId: 3,
      draftId: created.entry.draftId,
      kind: "avatar_create",
      version: 3,
    });
    expect(
      await callerA.drafts.get({
        draftId: created.entry.draftId,
      }),
    ).toBeNull();

    await kernel.stop();
  });
});
