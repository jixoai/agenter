import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { AttentionSystem } from "@agenter/attention-system";

import { AppKernel } from "../src";
import { resolveRuntimeShellBinDir } from "../src/runtime-shell-bin";
import { resolveWorkspaceAvatarCanonicalRoot } from "../src/workspace-system/paths";
import { createRootWorkspaceShellWorld, type RootWorkspaceMountInput } from "../src/workspace-system/root-exec";
import { waitForRealValue } from "../test-support/real-kernel-harness";

const getRuntime = (kernel: AppKernel, sessionId: string) => {
  const runtimes = Reflect.get(kernel, "runtimes") as Map<string, unknown>;
  const runtime = runtimes.get(sessionId);
  if (!runtime) {
    throw new Error(`missing runtime for ${sessionId}`);
  }
  return runtime as {
    execRootWorkspaceBash: (input: {
      command: string;
      cwd?: string;
      env?: Record<string, string>;
      stdin?: string;
    }) => Promise<{ stdout: string; stderr: string; exitCode: number; cwd: string }>;
    attentionSystem: AttentionSystem;
  };
};

const execRootWorkspaceBash = async (
  kernel: AppKernel,
  sessionId: string,
  input: {
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    stdin?: string;
  },
) => await getRuntime(kernel, sessionId).execRootWorkspaceBash(input);

const execWorkspaceBash = async (
  kernel: AppKernel,
  sessionId: string,
  input: {
    workspaceId: number;
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    stdin?: string;
  },
) => {
  const runtime = getRuntime(kernel, sessionId) as Record<string, unknown>;
  const method = Reflect.get(runtime, "execWorkspaceBash");
  if (typeof method !== "function") {
    throw new Error("runtime workspace bash is unavailable");
  }
  return (await Reflect.apply(method, runtime, [input])) as {
    stdout: string;
    stderr: string;
    exitCode: number;
    cwd: string;
  };
};

const getRuntimeAttentionSystem = (kernel: AppKernel, sessionId: string): AttentionSystem =>
  getRuntime(kernel, sessionId).attentionSystem;

const getRuntimeRootWorkspacePath = (kernel: AppKernel, sessionId: string): string => {
  const mount = kernel.listRuntimeWorkspaceMounts(sessionId).find((entry) => entry.kind === "avatar-root");
  if (!mount) {
    throw new Error(`missing avatar-root mount for ${sessionId}`);
  }
  return mount.workspacePath;
};

const getConfiguredTerminalIds = (kernel: AppKernel, sessionId: string): string[] => {
  const runtime = getRuntime(kernel, sessionId) as Record<string, unknown>;
  const config = Reflect.get(runtime, "config") as { terminals?: Record<string, unknown> } | null | undefined;
  return Object.keys(config?.terminals ?? {});
};

const collectMarkedValues = (text: string): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const match of text.matchAll(/^__AGT_([A-Z_]+)__=([^\r\n]*)$/gmu)) {
    values[match[1]] = (match[2] ?? "").trimEnd();
  }
  return values;
};

const buildEnvDumpCommand = (): string =>
  [
    `marker_prefix=__AGT`,
    `printf '%s_HOME__=%s\\n' "$marker_prefix" "$HOME"`,
    `printf '%s_ROOT__=%s\\n' "$marker_prefix" "\${AGENTER_ROOT_WORKSPACE-}"`,
    `printf '%s_HOME_DIR__=%s\\n' "$marker_prefix" "\${AGENTER_HOME_DIR-}"`,
    `printf '%s_PRIVATE__=%s\\n' "$marker_prefix" "\${AGENTER_AVATAR_PRIVATE_KEY-}"`,
    `printf '%s_PATH__=%s\\n' "$marker_prefix" "$PATH"`,
    `printf '%s_DONE__=1\\n' "$marker_prefix"`,
  ].join("; ");

const buildEnvDumpWrites = (): Array<{
  key: "HOME" | "ROOT" | "HOME_DIR" | "PRIVATE" | "PATH" | "DONE";
  text: string;
}> => [
  { key: "HOME", text: `printf '__AGT_HOME__=%s\\n' "$HOME"\r` },
  { key: "ROOT", text: "printf '__AGT_ROOT__=%s\\n' \"${AGENTER_ROOT_WORKSPACE-}\"\r" },
  { key: "HOME_DIR", text: "printf '__AGT_HOME_DIR__=%s\\n' \"${AGENTER_HOME_DIR-}\"\r" },
  { key: "PRIVATE", text: "printf '__AGT_PRIVATE__=%s\\n' \"${AGENTER_AVATAR_PRIVATE_KEY-}\"\r" },
  { key: "PATH", text: `printf '__AGT_PATH__=%s\\n' "$PATH"\r` },
  { key: "DONE", text: "printf '__AGT_DONE__=1\\n'\r" },
];

const waitForTerminalSurface = async (kernel: AppKernel, sessionId: string, terminalId: string): Promise<void> => {
  await waitForRealValue(
    async () => {
      const read = await execRootWorkspaceBash(kernel, sessionId, {
        command: "terminal read",
        stdin: JSON.stringify({
          terminalId,
          mode: "snapshot",
        }),
      });
      if (read.exitCode !== 0) {
        return null;
      }
      const payload = JSON.parse(read.stdout) as {
        result?:
          | {
              kind?: "terminal-snapshot";
              tail?: string;
              snapshot?: {
                lines?: string[];
              };
            }
          | {
              kind?: "terminal-diff";
              diff?: string;
            };
      };
      const result = payload.result;
      if (!result) {
        return null;
      }
      const visibleText =
        result.kind === "terminal-snapshot"
          ? (result.snapshot?.lines?.join("\n") ?? result.tail ?? "")
          : result.kind === "terminal-diff"
            ? (result.diff ?? "")
            : "";
      return visibleText.length > 0 ? true : null;
    },
    {
      label: `terminal surface ${terminalId}`,
      timeoutMs: 15_000,
    },
  );
};

const readTerminalSnapshotText = async (
  kernel: AppKernel,
  sessionId: string,
  terminalId: string,
): Promise<string | null> => {
  const read = await execRootWorkspaceBash(kernel, sessionId, {
    command: "terminal read",
    stdin: JSON.stringify({
      terminalId,
      mode: "snapshot",
    }),
  });
  if (read.exitCode !== 0) {
    return null;
  }
  const payload = JSON.parse(read.stdout) as {
    result?:
      | {
          kind?: "terminal-snapshot";
          tail?: string;
          snapshot?: {
            lines?: string[];
          };
        }
      | {
          kind?: "terminal-diff";
          diff?: string;
        };
  };
  const result = payload.result;
  return result?.kind === "terminal-snapshot"
    ? (result.snapshot?.lines?.join("\n") ?? result.tail ?? "")
    : result?.kind === "terminal-diff"
      ? (result.diff ?? "")
      : null;
};

const waitForTerminalMarkerValue = async (
  kernel: AppKernel,
  sessionId: string,
  terminalId: string,
  key: "HOME" | "ROOT" | "HOME_DIR" | "PRIVATE" | "PATH" | "DONE",
): Promise<string> =>
  await waitForRealValue(
    async () => {
      const text = await readTerminalSnapshotText(kernel, sessionId, terminalId);
      if (!text) {
        return null;
      }
      const match = text.match(new RegExp(`^__AGT_${key}__=([^\\r\\n]*)$`, "mu"));
      return match?.[1]?.trimEnd() ?? null;
    },
    {
      label: `terminal marker ${terminalId}:${key}`,
      timeoutMs: 15_000,
    },
  );

const collectTerminalEnvValues = async (
  kernel: AppKernel,
  sessionId: string,
  terminalId: string,
): Promise<Record<string, string>> => {
  const values: Record<string, string> = {};
  for (const { key, text } of buildEnvDumpWrites()) {
    const wrote = await execRootWorkspaceBash(kernel, sessionId, {
      command: "terminal write",
      stdin: JSON.stringify({
        terminalId,
        text,
      }),
    });
    if (wrote.exitCode !== 0) {
      throw new Error(`terminal write failed: ${JSON.stringify(wrote)}`);
    }
    values[key] = await waitForTerminalMarkerValue(kernel, sessionId, terminalId, key);
  }
  return values;
};

const tempDirs: string[] = [];
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

const createTempRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "agenter-workspace-system-"));
  tempDirs.push(root);
  return root;
};

const createGrantRecord = (workspacePath: string, pattern: string, mode: "ro" | "rw", ruleIndex = 0) => ({
  grantId: `grant-${ruleIndex}`,
  mountId: `mount-${ruleIndex}`,
  workspacePath,
  pattern,
  ruleIndex,
  mode,
  createdAt: new Date(ruleIndex).toISOString(),
});

const executeTemporaryRootWorkspaceShell = async (input: {
  rootWorkspacePath: string;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  mounts: RootWorkspaceMountInput[];
  customCommands?: Parameters<typeof createRootWorkspaceShellWorld>[0]["customCommands"];
}) => {
  const rootWorld = createRootWorkspaceShellWorld({
    rootWorkspacePath: input.rootWorkspacePath,
    customCommands: input.customCommands,
  });
  return await rootWorld.exec({
    command: input.command,
    cwd: input.cwd,
    env: input.env,
    stdin: input.stdin,
    mounts: input.mounts,
  });
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: workspace system kernel integration", () => {
  test("Scenario: Given one global avatar session When workspaces are granted explicitly Then mounts stay empty until grant and bash writes stay inside granted paths", async () => {
    const root = createTempRoot();
    const workspaceA = join(root, "workspace-a");
    const workspaceB = join(root, "workspace-b");
    mkdirSync(workspaceA, { recursive: true });
    mkdirSync(workspaceB, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const first = await kernel.createSession({
      cwd: workspaceA,
      avatar: "architect",
      autoStart: false,
    });
    const second = await kernel.createSession({
      cwd: workspaceB,
      avatar: "architect",
      autoStart: false,
    });

    expect(second.id).toBe(first.id);
    expect(kernel.listRuntimeWorkspaceMounts(first.id)).toEqual([]);

    kernel.grantRuntimeWorkspace({
      runtimeId: first.id,
      workspacePath: workspaceB,
      grants: [{ pattern: "/shared", mode: "rw" }],
    });
    expect(kernel.listRuntimeWorkspaceMounts(first.id).map((item) => item.workspacePath)).toEqual([workspaceB]);

    const grants = kernel.grantRuntimeWorkspace({
      runtimeId: first.id,
      workspacePath: workspaceA,
      grants: [{ pattern: "/sandbox", mode: "rw" }],
    });
    expect(
      kernel
        .listRuntimeWorkspaceMounts(first.id)
        .map((item) => item.workspacePath)
        .sort(),
    ).toEqual([workspaceA, workspaceB].sort());

    const assetRoots = kernel.getRuntimeWorkspaceAssetRoots({
      workspacePath: workspaceA,
      avatar: "architect",
    });
    expect(assetRoots.privateRoots.tools).toContain(join(".agenter", "avatars", "by-principal"));
    expect(assetRoots.privateRoots.tools).not.toContain(join(".agenter", "avatars", "by-nickname"));
    writeFileSync(join(assetRoots.publicRoots.tools, "hello.sh"), "#!/usr/bin/env bash\necho tool-ok\n", "utf8");

    expect(grants).toEqual([
      expect.objectContaining({
        workspacePath: workspaceA,
        pattern: "/sandbox",
        mode: "rw",
      }),
    ]);

    const execOk = await kernel.execRuntimeWorkspace({
      runtimeId: first.id,
      workspacePath: workspaceA,
      avatar: "architect",
      command:
        "mkdir -p /workspace/sandbox && printf kernel-ok > /workspace/sandbox/out.txt && tool_hello && cat /workspace/sandbox/out.txt",
    });
    expect(execOk.exitCode).toBe(0);
    expect(execOk.stdout).toContain("tool-ok");
    expect(execOk.stdout).toContain("kernel-ok");
    expect(readFileSync(join(workspaceA, "sandbox", "out.txt"), "utf8")).toBe("kernel-ok");

    const execDenied = await kernel.execRuntimeWorkspace({
      runtimeId: first.id,
      workspacePath: workspaceA,
      avatar: "architect",
      command: "printf blocked > /workspace/blocked.txt",
    });
    expect(execDenied.exitCode).not.toBe(0);
    expect(existsSync(join(workspaceA, "blocked.txt"))).toBeFalse();

    await kernel.stop();
  });

  test("Scenario: Given ordered glob workspace rules When shell and explorer inspect the workspace Then later rules override earlier ones and ungranted paths stay hidden", async () => {
    const root = createTempRoot();
    const workspace = join(root, "workspace-a");
    mkdirSync(join(workspace, "src", "generated"), { recursive: true });
    mkdirSync(join(workspace, "src", "manual"), { recursive: true });
    mkdirSync(join(workspace, "docs"), { recursive: true });
    writeFileSync(join(workspace, "docs", "roadmap.md"), "secret-plan\n", "utf8");

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({
      cwd: workspace,
      avatar: "architect",
      autoStart: false,
    });

    const grants = kernel.grantRuntimeWorkspace({
      runtimeId: session.id,
      workspacePath: workspace,
      grants: [
        { pattern: "/src", mode: "ro" },
        { pattern: "/src/generated", mode: "rw" },
      ],
    });
    expect(grants.map((grant) => ({ pattern: grant.pattern, ruleIndex: grant.ruleIndex, mode: grant.mode }))).toEqual([
      { pattern: "/src", ruleIndex: 0, mode: "ro" },
      { pattern: "/src/generated", ruleIndex: 1, mode: "rw" },
    ]);

    const writeGenerated = await kernel.execRuntimeWorkspace({
      runtimeId: session.id,
      workspacePath: workspace,
      avatar: "architect",
      command: "printf override-ok > /workspace/src/generated/out.txt",
    });
    expect(writeGenerated.exitCode).toBe(0);
    expect(readFileSync(join(workspace, "src", "generated", "out.txt"), "utf8")).toBe("override-ok");

    const writeManual = await kernel.execRuntimeWorkspace({
      runtimeId: session.id,
      workspacePath: workspace,
      avatar: "architect",
      command: "printf blocked > /workspace/src/manual/out.txt",
    });
    expect(writeManual.exitCode).not.toBe(0);
    expect(existsSync(join(workspace, "src", "manual", "out.txt"))).toBeFalse();

    const readDocs = await kernel.execRuntimeWorkspace({
      runtimeId: session.id,
      workspacePath: workspace,
      avatar: "architect",
      command: "cat /workspace/docs/roadmap.md",
    });
    expect(readDocs.exitCode).not.toBe(0);
    expect(readDocs.stdout).not.toContain("secret-plan");

    const listedRoot = await kernel.execRuntimeWorkspace({
      runtimeId: session.id,
      workspacePath: workspace,
      avatar: "architect",
      command: "ls /workspace",
    });
    expect(listedRoot.exitCode).toBe(0);
    expect(listedRoot.stdout).toContain("src");
    expect(listedRoot.stdout).not.toContain("docs");

    const explorerTree = kernel.listWorkspaceWorkbenchTree({
      workspacePath: workspace,
      avatar: "architect",
      mode: "explorer",
      path: "/",
    });
    expect(explorerTree.items.map((item) => item.path)).toEqual(["/src"]);

    expect(() =>
      kernel.readWorkspaceWorkbenchPreview({
        workspacePath: workspace,
        avatar: "architect",
        mode: "explorer",
        path: "/docs/roadmap.md",
      }),
    ).toThrow("workspace preview denied by grants");

    const allowedPreview = kernel.readWorkspaceWorkbenchPreview({
      workspacePath: workspace,
      avatar: "architect",
      mode: "explorer",
      path: "/src/generated/out.txt",
    });
    expect(allowedPreview.textContent).toContain("override-ok");

    await kernel.stop();
  });

  test("Scenario: Given one avatar mounts a workspace root When private drawers exist for another avatar Then workspace bash and root workspace bash hide the sibling drawer the same way", async () => {
    const root = createTempRoot();
    const workspace = join(root, "workspace-a");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({
      cwd: workspace,
      avatar: "alice",
      autoStart: true,
    });
    const aliceAssetRoots = kernel.getRuntimeWorkspaceAssetRoots({
      workspacePath: workspace,
      avatar: "alice",
    });
    const aliceMemoryRoot = aliceAssetRoots.privateRoots.memory;
    const alicePrincipalId = basename(dirname(aliceMemoryRoot));
    const bobMemoryRoot = join(resolveWorkspaceAvatarCanonicalRoot(workspace, "bob"), "memory");
    mkdirSync(aliceMemoryRoot, { recursive: true });
    mkdirSync(bobMemoryRoot, { recursive: true });
    writeFileSync(join(aliceMemoryRoot, "todo.txt"), "alice-only\n", "utf8");
    writeFileSync(join(bobMemoryRoot, "todo.txt"), "bob-only\n", "utf8");
    kernel.grantRuntimeWorkspace({
      runtimeId: session.id,
      workspacePath: workspace,
      grants: [{ pattern: "/", mode: "rw" }],
    });

    const workspaceList = await kernel.execRuntimeWorkspace({
      runtimeId: session.id,
      workspacePath: workspace,
      avatar: "alice",
      command: "ls /workspace/.agenter/avatars/by-principal && ls /workspace/.agenter/avatars",
    });
    expect(workspaceList.exitCode).toBe(0);
    expect(workspaceList.stdout).toContain(alicePrincipalId);
    expect(workspaceList.stdout).not.toContain("bob");
    expect(workspaceList.stdout).not.toContain("by-nickname");

    const workspaceRead = await kernel.execRuntimeWorkspace({
      runtimeId: session.id,
      workspacePath: workspace,
      avatar: "alice",
      command: "cat /workspace/.agenter/avatars/by-principal/bob/memory/todo.txt",
    });
    expect(workspaceRead.exitCode).not.toBe(0);
    expect(workspaceRead.stdout).not.toContain("bob-only");

    const rootList = await execRootWorkspaceBash(kernel, session.id, {
      command: `ls ${JSON.stringify(join(workspace, ".agenter", "avatars", "by-principal"))} && ls ${JSON.stringify(
        join(workspace, ".agenter", "avatars"),
      )}`,
    });
    expect(rootList.exitCode).toBe(0);
    expect(rootList.stdout).toContain(alicePrincipalId);
    expect(rootList.stdout).not.toContain("bob");
    expect(rootList.stdout).not.toContain("by-nickname");

    const rootRead = await execRootWorkspaceBash(kernel, session.id, {
      command: `cat ${JSON.stringify(join(workspace, ".agenter", "avatars", "by-principal", "bob", "memory", "todo.txt"))}`,
    });
    expect(rootRead.exitCode).not.toBe(0);
    expect(rootRead.stdout).not.toContain("bob-only");

    await kernel.stop();
  });

  test("Scenario: Given runtime terminal creation depends on workspace authority When cwd is omitted or escapes grants Then kernel rejects it unless one explicit root context exists", async () => {
    const root = createTempRoot();
    const workspaceA = join(root, "workspace-a");
    const workspaceB = join(root, "workspace-b");
    const outside = join(root, "outside");
    mkdirSync(workspaceA, { recursive: true });
    mkdirSync(workspaceB, { recursive: true });
    mkdirSync(outside, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({
      cwd: workspaceA,
      avatar: "architect",
      autoStart: true,
    });

    const avatarRootTerminal = await kernel.createTerminal({
      sessionId: session.id,
      terminalId: "avatar-root",
      focus: false,
    });
    expect(avatarRootTerminal.ok).toBeTrue();
    expect(avatarRootTerminal.terminal?.cwd).toContain(join(".agenter", "avatars", "by-principal"));

    kernel.grantRuntimeWorkspace({
      runtimeId: session.id,
      workspacePath: workspaceA,
      grants: [{ pattern: "/", mode: "rw" }],
    });

    const ambiguousRoot = await kernel.createTerminal({
      sessionId: session.id,
      terminalId: "ambiguous-root",
      focus: false,
    });
    expect(ambiguousRoot.ok).toBeFalse();
    expect(ambiguousRoot.message).toContain("ambiguous");

    const workspaceARoot = await kernel.createTerminal({
      sessionId: session.id,
      terminalId: "workspace-a-root",
      cwd: workspaceA,
      focus: false,
    });
    expect(workspaceARoot.ok).toBeTrue();
    expect(workspaceARoot.terminal?.cwd).toBe(workspaceA);

    const outsideGrant = await kernel.createTerminal({
      sessionId: session.id,
      terminalId: "outside-grant",
      cwd: outside,
      focus: false,
    });
    expect(outsideGrant.ok).toBeFalse();
    expect(outsideGrant.message).toContain("outside explicit workspace grants");

    kernel.grantRuntimeWorkspace({
      runtimeId: session.id,
      workspacePath: workspaceB,
      grants: [{ pattern: "/", mode: "rw" }],
    });

    const ambiguous = await kernel.createTerminal({
      sessionId: session.id,
      terminalId: "ambiguous-after-workspace-b",
      focus: false,
    });
    expect(ambiguous.ok).toBeFalse();
    expect(ambiguous.message).toContain("ambiguous");

    const explicitRoot = await kernel.createTerminal({
      sessionId: session.id,
      terminalId: "workspace-b-root",
      cwd: workspaceB,
      focus: false,
    });
    expect(explicitRoot.ok).toBeTrue();
    expect(explicitRoot.terminal?.cwd).toBe(workspaceB);

    await kernel.stop();
  });

  test("Scenario: Given root workspace shell commands accept JSON stdin When terminal and message workflows stream payloads Then the runtime CLI preserves the descriptor contract", async () => {
    const root = createTempRoot();
    const workspace = join(root, "workspace-a");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({
      cwd: workspace,
      avatar: "architect",
      autoStart: true,
    });
    const primaryRoom = await kernel.attachSessionPrimaryRoom(session.id, { focus: true });
    kernel.grantRuntimeWorkspace({
      runtimeId: session.id,
      workspacePath: workspace,
      grants: [{ pattern: "/", mode: "rw" }],
    });

    const created = await execRootWorkspaceBash(kernel, session.id, {
      command: "terminal create",
      stdin: JSON.stringify({ cwd: workspace }),
    });
    expect(created.exitCode).toBe(0);
    const createdPayload = JSON.parse(created.stdout) as {
      result?: {
        ok: boolean;
        terminal?: {
          terminalId: string;
          cwd?: string;
          snapshot?: unknown;
          access?: unknown;
          actors?: unknown;
          transportUrl?: unknown;
        };
      };
    };
    expect(createdPayload.result?.ok).toBeTrue();
    expect(createdPayload.result?.terminal?.cwd).toBe(workspace);
    expect(createdPayload.result?.terminal?.snapshot).toBeUndefined();
    expect(createdPayload.result?.terminal?.access).toBeUndefined();
    expect(createdPayload.result?.terminal?.actors).toBeUndefined();
    expect(createdPayload.result?.terminal?.transportUrl).toBeUndefined();

    const terminalId = createdPayload.result?.terminal?.terminalId;
    expect(typeof terminalId).toBe("string");
    if (!terminalId) {
      throw new Error("expected terminal create to return terminalId");
    }

    const wrote = await execRootWorkspaceBash(kernel, session.id, {
      command: "terminal write",
      stdin: JSON.stringify({
        terminalId,
        text: "echo stdin-ok\r",
      }),
    });
    expect(wrote.exitCode).toBe(0);

    const sent = await execRootWorkspaceBash(kernel, session.id, {
      command: "message send",
      stdin: JSON.stringify({
        chatId: primaryRoom.chatId,
        content: "通过 stdin 发送房间消息",
      }),
    });
    expect(sent.exitCode).toBe(0);

    const listed = await execRootWorkspaceBash(kernel, session.id, {
      command: "message list",
    });
    expect(listed.exitCode).toBe(0);
    const listedPayload = JSON.parse(listed.stdout) as {
      channels?: Array<{
        chatId: string;
        participants?: Array<{ id: string; label?: string }>;
        presence?: {
          totalSeatCount: number;
        };
        owner?: unknown;
        metadata?: unknown;
        seatStates?: unknown;
      }>;
    };
    const listedRoom = listedPayload.channels?.find((channel) => channel.chatId === primaryRoom.chatId);
    expect(listedRoom).toBeTruthy();
    expect(listedRoom?.presence?.totalSeatCount).toBeGreaterThan(0);
    expect(listedRoom?.owner).toBeUndefined();
    expect(listedRoom?.metadata).toBeUndefined();
    expect(listedRoom?.seatStates).toBeUndefined();

    const read = await execRootWorkspaceBash(kernel, session.id, {
      command: "message read",
      stdin: JSON.stringify({
        chatId: primaryRoom.chatId,
        limit: 10,
      }),
    });
    expect(read.exitCode).toBe(0);
    const readPayload = JSON.parse(read.stdout) as {
      snapshot?: {
        channel?: {
          chatId: string;
          presence?: { totalSeatCount: number };
          owner?: unknown;
          metadata?: unknown;
          seatStates?: unknown;
        };
        items?: Array<{
          content: string;
          readActorIds?: unknown;
          unreadActorIds?: unknown;
          metadata?: unknown;
        }>;
      };
    };
    expect(readPayload.snapshot?.channel?.chatId).toBe(primaryRoom.chatId);
    expect(readPayload.snapshot?.channel?.presence?.totalSeatCount).toBeGreaterThan(0);
    expect(readPayload.snapshot?.channel?.owner).toBeUndefined();
    expect(readPayload.snapshot?.channel?.metadata).toBeUndefined();
    expect(readPayload.snapshot?.channel?.seatStates).toBeUndefined();
    expect(readPayload.snapshot?.items?.some((item) => item.content === "通过 stdin 发送房间消息")).toBeTrue();
    const deliveredItem = readPayload.snapshot?.items?.find((item) => item.content === "通过 stdin 发送房间消息");
    expect(deliveredItem?.readActorIds).toBeUndefined();
    expect(deliveredItem?.unreadActorIds).toBeUndefined();
    expect(deliveredItem?.metadata).toBeUndefined();

    const sentUtf8Argv = await execRootWorkspaceBash(kernel, session.id, {
      command: [
        "cat << 'PAYLOAD' > msg_payload.json",
        `{"chatId":"${primaryRoom.chatId}","content":"你好！有什么可以帮你的吗？😊"}`,
        "PAYLOAD",
        'message send "$(cat msg_payload.json)"',
      ].join("\n"),
    });
    expect(sentUtf8Argv.exitCode).toBe(0);

    const readUtf8 = await execRootWorkspaceBash(kernel, session.id, {
      command: "message read",
      stdin: JSON.stringify({
        chatId: primaryRoom.chatId,
        limit: 20,
      }),
    });
    expect(readUtf8.exitCode).toBe(0);
    const readUtf8Payload = JSON.parse(readUtf8.stdout) as {
      snapshot?: {
        items?: Array<{
          content: string;
        }>;
      };
    };
    expect(readUtf8Payload.snapshot?.items?.some((item) => item.content === "你好！有什么可以帮你的吗？😊")).toBeTrue();

    const workspaceList = await execRootWorkspaceBash(kernel, session.id, {
      command: "workspace list",
    });
    expect(workspaceList.exitCode).toBe(0);
    const workspacePayload = JSON.parse(workspaceList.stdout) as {
      workspaces?: Array<{
        mount: {
          workspacePath: string;
          kind: "workspace" | "avatar-root";
          mountId?: unknown;
          runtimeId?: unknown;
        };
        grants: Array<{
          pattern: string;
          ruleIndex: number;
          mode: "ro" | "rw";
          grantId?: unknown;
        }>;
      }>;
    };
    const mountedWorkspace = workspacePayload.workspaces?.find((entry) => entry.mount.workspacePath === workspace);
    expect(mountedWorkspace?.mount.kind).toBe("workspace");
    expect(mountedWorkspace?.mount.mountId).toBeUndefined();
    expect(mountedWorkspace?.mount.runtimeId).toBeUndefined();
    expect(mountedWorkspace?.grants[0]?.pattern).toBe("/");
    expect(mountedWorkspace?.grants[0]?.ruleIndex).toBe(0);
    expect(mountedWorkspace?.grants[0]?.grantId).toBeUndefined();

    const roomMessages = kernel
      .listMessageChannels(session.id)
      .flatMap((channel) => (channel.chatId === primaryRoom.chatId ? [channel.chatId] : []))
      .flatMap(
        (chatId) =>
          (
            Reflect.get(kernel, "messageControlPlane") as {
              snapshot: (inputChatId: string, limit: number) => { items: Array<{ content: string }> };
            }
          ).snapshot(chatId, 20).items,
      );
    expect(roomMessages.some((item) => item.content === "通过 stdin 发送房间消息")).toBeTrue();

    await kernel.stop();
  });

  test("Scenario: Given root_bash stays on the root-workspace profile When HOME is overridden by the caller Then the shell still resolves HOME to the avatar root workspace", async () => {
    const root = createTempRoot();
    const workspace = join(root, "workspace-a");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();
    try {
      const session = await kernel.createSession({
        cwd: workspace,
        avatar: "architect",
        autoStart: true,
      });
      const rootWorkspacePath = getRuntimeRootWorkspacePath(kernel, session.id);
      const result = await execRootWorkspaceBash(kernel, session.id, {
        command: buildEnvDumpCommand(),
        env: {
          HOME: "/tmp/not-the-root-workspace",
          PATH: "/tmp/root-shell-path",
        },
      });
      expect(result.exitCode).toBe(0);
      const values = collectMarkedValues(result.stdout);
      expect(values.HOME).toBe(rootWorkspacePath);
      expect(values.ROOT).toBe(rootWorkspacePath);
      expect(values.PATH).toBe("/tmp/root-shell-path");
    } finally {
      await kernel.stop();
    }
  });

  test("Scenario: Given workspace_bash is a public-workspace shell When it inherits caller env Then it stays pass-through and never gains root-workspace-exclusive env or CLI", async () => {
    const root = createTempRoot();
    const workspace = join(root, "workspace-a");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();
    try {
      const session = await kernel.createSession({
        cwd: workspace,
        avatar: "architect",
        autoStart: true,
      });
      kernel.grantRuntimeWorkspace({
        runtimeId: session.id,
        workspacePath: workspace,
        grants: [{ pattern: "/", mode: "rw" }],
      });

      const workspaceMount = kernel
        .listRuntimeWorkspaceMounts(session.id)
        .find((entry) => entry.workspacePath === workspace && entry.kind === "workspace");
      if (!workspaceMount) {
        throw new Error("expected mounted workspace");
      }

      const rootWorkspacePath = getRuntimeRootWorkspacePath(kernel, session.id);
      const runtimeBinDir = resolveRuntimeShellBinDir(rootWorkspacePath);
      const result = await execWorkspaceBash(kernel, session.id, {
        workspaceId: workspaceMount.runtimeWorkspaceId,
        command: buildEnvDumpCommand(),
        env: {
          HOME: "/tmp/public-workspace-home",
          PATH: "/tmp/public-workspace-path",
        },
      });
      expect(result.exitCode).toBe(0);
      const values = collectMarkedValues(result.stdout);
      expect(values.HOME).toBe("/tmp/public-workspace-home");
      expect(values.ROOT).toBe("");
      expect(values.HOME_DIR).toBe("");
      expect(values.PRIVATE).toBe("");
      expect(values.PATH).toBe("/tmp/public-workspace-path");
      expect(values.PATH.includes(runtimeBinDir)).toBeFalse();
    } finally {
      await kernel.stop();
    }
  });

  test("Scenario: Given skill info exposes a built-in skill path When root workspace bash reads that path and a sibling reference Then the same package-owned skill files are shell-readable", async () => {
    const root = createTempRoot();
    const workspace = join(root, "workspace-a");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({
      cwd: workspace,
      avatar: "architect",
      autoStart: true,
    });

    const info = await execRootWorkspaceBash(kernel, session.id, {
      command: "skill info agenter-runtime",
    });
    expect(info.exitCode).toBe(0);
    const match = info.stdout.match(/^Path: (.+)$/m);
    expect(match).toBeTruthy();
    const skillPath = match?.[1]?.trim();
    if (!skillPath) {
      throw new Error("expected skill info to include a skill path");
    }
    const referencePath = join(dirname(skillPath), "references", "shell-surface.md");

    const catSkill = await execRootWorkspaceBash(kernel, session.id, {
      command: `cat ${JSON.stringify(skillPath)}`,
    });
    expect(catSkill.exitCode).toBe(0);
    expect(catSkill.stdout).toContain("# agenter-runtime");
    expect(catSkill.stdout).toContain("skill info <skill>");

    const catReference = await execRootWorkspaceBash(kernel, session.id, {
      command: `cat ${JSON.stringify(referencePath)}`,
    });
    expect(catReference.exitCode).toBe(0);
    expect(catReference.stdout).toContain("# Runtime shell surface");
    expect(catReference.stdout).toContain("root_bash");

    await kernel.stop();
  });

  test("Scenario: Given root workspace bash exposes the runtime tool namespace When tool --help runs Then the shell shows helper discovery instead of js-exec internals", async () => {
    const root = createTempRoot();
    const workspace = join(root, "workspace-a");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({
      cwd: workspace,
      avatar: "architect",
      autoStart: true,
    });

    const result = await execRootWorkspaceBash(kernel, session.id, {
      command: "tool --help",
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("tool <file>");
    expect(result.stdout).toContain("Available files: none");
    expect(result.stdout).not.toContain("js-exec - Sandboxed JavaScript/TypeScript runtime");

    await kernel.stop();
  });

  test("Scenario: Given a shared terminal is created through the runtime CLI When its shell prints env markers Then the terminal keeps collaborative HOME semantics instead of root-workspace env or CLI", async () => {
    const root = createTempRoot();
    const workspace = join(root, "workspace-a");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();
    try {
      const session = await kernel.createSession({
        cwd: workspace,
        avatar: "architect",
        autoStart: true,
      });
      kernel.grantRuntimeWorkspace({
        runtimeId: session.id,
        workspacePath: workspace,
        grants: [{ pattern: "/", mode: "rw" }],
      });
      const rootWorkspacePath = getRuntimeRootWorkspacePath(kernel, session.id);
      const runtimeBinDir = resolveRuntimeShellBinDir(rootWorkspacePath);

      const created = await execRootWorkspaceBash(kernel, session.id, {
        command: "terminal create",
        stdin: JSON.stringify({
          cwd: workspace,
          focus: true,
          profile: {
            gitLog: "normal",
          },
        }),
      });
      expect(created.exitCode).toBe(0);
      const createdPayload = JSON.parse(created.stdout) as {
        result?: {
          terminal?: { terminalId?: string };
        };
      };
      const terminalId = createdPayload.result?.terminal?.terminalId;
      if (!terminalId) {
        throw new Error("expected terminalId from terminal create");
      }
      await waitForTerminalSurface(kernel, session.id, terminalId);

      const values = await collectTerminalEnvValues(kernel, session.id, terminalId);
      expect(values.HOME).not.toBe(rootWorkspacePath);
      if (process.env.HOME) {
        expect(values.HOME).toBe(process.env.HOME);
      }
      expect(values.ROOT).toBe("");
      expect(values.HOME_DIR).toBe("");
      expect(values.PRIVATE).toBe("");
      expect(values.PATH.includes(runtimeBinDir)).toBeFalse();
    } finally {
      await kernel.stop();
    }
  }, 20_000);

  test("Scenario: Given a configured terminal is recovered through the runtime When it starts from the shared profile path Then root-workspace env and CLI still stay out", async () => {
    const root = createTempRoot();
    const workspace = join(root, "workspace-a");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();
    try {
      const session = await kernel.createSession({
        cwd: workspace,
        avatar: "architect",
        autoStart: true,
      });
      kernel.grantRuntimeWorkspace({
        runtimeId: session.id,
        workspacePath: workspace,
        grants: [{ pattern: "/", mode: "rw" }],
      });
      const configuredTerminalId = getConfiguredTerminalIds(kernel, session.id)[0];
      if (!configuredTerminalId) {
        throw new Error("expected a configured terminal id");
      }
      const rootWorkspacePath = getRuntimeRootWorkspacePath(kernel, session.id);
      const runtimeBinDir = resolveRuntimeShellBinDir(rootWorkspacePath);

      const recovered = await kernel.createTerminal({
        sessionId: session.id,
        terminalId: configuredTerminalId,
        focus: false,
      });
      expect(recovered.ok).toBeTrue();

      const values = await collectTerminalEnvValues(kernel, session.id, configuredTerminalId);
      expect(values.HOME).not.toBe(rootWorkspacePath);
      if (process.env.HOME) {
        expect(values.HOME).toBe(process.env.HOME);
      }
      expect(values.ROOT).toBe("");
      expect(values.HOME_DIR).toBe("");
      expect(values.PRIVATE).toBe("");
      expect(values.PATH.includes(runtimeBinDir)).toBeFalse();
    } finally {
      await kernel.stop();
    }
  }, 20_000);

  test("Scenario: Given a shared terminal starts inside the avatar root cwd When its shell prints env markers Then the terminal still keeps collaboration semantics instead of root-workspace HOME", async () => {
    const root = createTempRoot();
    const workspace = join(root, "workspace-a");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();
    try {
      const session = await kernel.createSession({
        cwd: workspace,
        avatar: "architect",
        autoStart: true,
      });
      const rootWorkspacePath = getRuntimeRootWorkspacePath(kernel, session.id);
      const runtimeBinDir = resolveRuntimeShellBinDir(rootWorkspacePath);

      const created = await execRootWorkspaceBash(kernel, session.id, {
        command: "terminal create",
        stdin: JSON.stringify({
          cwd: rootWorkspacePath,
          focus: false,
        }),
      });
      expect(created.exitCode).toBe(0);
      const createdPayload = JSON.parse(created.stdout) as {
        result?: {
          terminal?: { terminalId?: string };
        };
      };
      const terminalId = createdPayload.result?.terminal?.terminalId;
      if (!terminalId) {
        throw new Error("expected terminalId from terminal create");
      }
      await waitForTerminalSurface(kernel, session.id, terminalId);

      const values = await collectTerminalEnvValues(kernel, session.id, terminalId);
      expect(values.HOME).not.toBe(rootWorkspacePath);
      if (process.env.HOME) {
        expect(values.HOME).toBe(process.env.HOME);
      }
      expect(values.ROOT).toBe("");
      expect(values.HOME_DIR).toBe("");
      expect(values.PRIVATE).toBe("");
      expect(values.PATH.includes(runtimeBinDir)).toBeFalse();
    } finally {
      await kernel.stop();
    }
  }, 20_000);

  test("Scenario: Given active attention When JSON attention commit marks done Then runtime clears the current context debt", async () => {
    const root = createTempRoot();
    const workspace = join(root, "workspace-a");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({
      cwd: workspace,
      avatar: "architect",
      autoStart: true,
    });

    const attentionSystem = getRuntimeAttentionSystem(kernel, session.id);
    attentionSystem.createContext({
      contextId: "ctx-chat-main",
      owner: "architect",
    });
    attentionSystem.commit("ctx-chat-main", {
      meta: {
        author: "user",
        source: "test",
      },
      scores: {
        "delivery-hash": 100,
      },
      summary: "Need delivery follow-up",
      change: {
        type: "update",
        value: "pending",
        format: "text/plain",
      },
    });

    const before = await kernel.inspectAttentionState(session.id);
    expect(before.active.some((item) => item.contextId === "ctx-chat-main")).toBeTrue();

    const settled = await execRootWorkspaceBash(kernel, session.id, {
      command: `attention commit '${JSON.stringify({
        contextId: "ctx-chat-main",
        summary: "done",
        done: true,
      })}'`,
    });
    expect(settled.exitCode).toBe(0);

    const after = await kernel.inspectAttentionState(session.id);
    expect(after.active.some((item) => item.contextId === "ctx-chat-main")).toBeFalse();
    expect(
      after.snapshot.contexts.find((context) => context.contextId === "ctx-chat-main")?.scoreMap["delivery-hash"],
    ).toBe(0);

    await kernel.stop();
  });

  test("Scenario: Given active attention When JSON attention commit sends done with its own score map Then runtime still clears the existing context debt", async () => {
    const root = createTempRoot();
    const workspace = join(root, "workspace-a");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({
      cwd: workspace,
      avatar: "architect",
      autoStart: true,
    });

    const attentionSystem = getRuntimeAttentionSystem(kernel, session.id);
    attentionSystem.createContext({
      contextId: "ctx-chat-main",
      owner: "architect",
    });
    attentionSystem.commit("ctx-chat-main", {
      meta: {
        author: "user",
        source: "test",
      },
      scores: {
        "delivery-hash": 100,
      },
      summary: "Need delivery follow-up",
      change: {
        type: "update",
        value: "pending",
        format: "text/plain",
      },
    });

    const settled = await execRootWorkspaceBash(kernel, session.id, {
      command: `attention commit '${JSON.stringify({
        contextId: "ctx-chat-main",
        summary: "done",
        done: true,
        scores: {
          delivery: 0,
        },
      })}'`,
    });
    expect(settled.exitCode).toBe(0);

    const after = await kernel.inspectAttentionState(session.id);
    expect(after.active.some((item) => item.contextId === "ctx-chat-main")).toBeFalse();
    const context = after.snapshot.contexts.find((item) => item.contextId === "ctx-chat-main");
    expect(context?.scoreMap["delivery-hash"]).toBe(0);
    expect(context?.scoreMap.delivery).toBe(0);

    await kernel.stop();
  });

  test("Scenario: Given one-shot bash surfaces see background statements When a command tries to persist a process with ampersand Then the shell rejects it and points back to terminals", async () => {
    const root = createTempRoot();
    const workspace = join(root, "workspace-a");
    const rootWorkspace = join(root, "avatar-root");
    mkdirSync(workspace, { recursive: true });
    mkdirSync(rootWorkspace, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({
      cwd: workspace,
      avatar: "architect",
      autoStart: true,
    });
    kernel.grantRuntimeWorkspace({
      runtimeId: session.id,
      workspacePath: workspace,
      grants: [{ pattern: "/", mode: "rw" }],
    });

    const rootResponse = await executeTemporaryRootWorkspaceShell({
      rootWorkspacePath: rootWorkspace,
      command: "sleep 5 &",
      mounts: [],
    });
    expect(rootResponse.exitCode).toBe(1);
    expect(rootResponse.stderr).toContain("one-shot bash cannot keep background processes alive");
    expect(rootResponse.stderr).toContain("terminal");

    const workspaceResponse = await kernel.execRuntimeWorkspace({
      runtimeId: session.id,
      workspacePath: workspace,
      avatar: "architect",
      command: "sleep 5 &",
    });
    expect(workspaceResponse.exitCode).toBe(1);
    expect(workspaceResponse.stderr).toContain("one-shot bash cannot keep background processes alive");
    expect(workspaceResponse.stderr).toContain("terminal");

    await kernel.stop();
  });

  test("Scenario: Given duplicate root workspace mounts resolve to one path When root exec builds the shell Then the shared mount is merged instead of rejected", async () => {
    const root = createTempRoot();
    const rootWorkspace = join(root, "avatar-root");
    const sharedMount = join(root, "shared");
    mkdirSync(rootWorkspace, { recursive: true });
    mkdirSync(sharedMount, { recursive: true });

    const response = await executeTemporaryRootWorkspaceShell({
      rootWorkspacePath: rootWorkspace,
      command: `cd ${JSON.stringify(sharedMount)} && printf "merged-ok"`,
      mounts: [
        { path: sharedMount, mode: "ro" },
        { path: sharedMount, mode: "rw" },
      ],
    });

    expect(response.exitCode).toBe(0);
    expect(response.stdout).toContain("merged-ok");
  });

  test("Scenario: Given root exec receives nested mount roots When one mount lives inside another Then it fails fast with a clear overlap error", async () => {
    const root = createTempRoot();
    const rootWorkspace = join(root, "avatar-root");
    mkdirSync(rootWorkspace, { recursive: true });
    const nestedSkillRoot = join(repoRoot, "packages", "app-server", "skills", "collaboration");

    const response = await executeTemporaryRootWorkspaceShell({
      rootWorkspacePath: rootWorkspace,
      command: 'printf "never-runs"',
      mounts: [
        { path: repoRoot, mode: "ro" },
        { path: nestedSkillRoot, mode: "ro" },
      ],
    });

    expect(response.exitCode).toBe(1);
    expect(response.stderr).toContain("root workspace mount overlap");
    expect(response.stderr).toContain(nestedSkillRoot);
    expect(response.stderr).toContain(repoRoot);
  });

  test("Scenario: Given one durable root shell world When later execs run Then filesystem state persists while shell env and cwd reset", async () => {
    const root = createTempRoot();
    const rootWorkspace = join(root, "avatar-root");
    mkdirSync(rootWorkspace, { recursive: true });

    const rootWorld = createRootWorkspaceShellWorld({
      rootWorkspacePath: rootWorkspace,
    });

    const first = await rootWorld.exec({
      command: ['printf "persisted" > keep.txt', "export HELLO=world", "cd /"].join("; "),
      mounts: [],
    });
    expect(first.exitCode).toBe(0);

    const second = await rootWorld.exec({
      command: ['printf "__AGT_PWD__=%s\\n" "$(pwd)"', 'printf "__AGT_HELLO__=%s\\n" "${HELLO-}"', "cat keep.txt"].join(
        "; ",
      ),
      mounts: [],
    });

    expect(second.exitCode).toBe(0);
    const values = collectMarkedValues(second.stdout);
    expect(values.PWD).toBe(rootWorkspace);
    expect(values.HELLO).toBe("");
    expect(second.stdout).toContain("persisted");
  });

  test("Scenario: Given one durable root shell world When mount rules and hidden paths change Then later execs see the refreshed authority without rebuilding the shell host", async () => {
    const root = createTempRoot();
    const rootWorkspace = join(root, "avatar-root");
    const workspace = join(root, "workspace-a");
    mkdirSync(rootWorkspace, { recursive: true });
    mkdirSync(join(workspace, "notes"), { recursive: true });
    writeFileSync(join(workspace, "notes", "todo.md"), "ship\n", "utf8");

    const todoPath = join(workspace, "notes", "todo.md");
    const rootWorld = createRootWorkspaceShellWorld({
      rootWorkspacePath: rootWorkspace,
    });

    const readable = await rootWorld.exec({
      command: `cat ${JSON.stringify(todoPath)}`,
      mounts: [
        {
          path: workspace,
          mode: "rw",
          grants: [createGrantRecord(workspace, "/notes/**", "ro")],
        },
      ],
    });
    expect(readable.exitCode).toBe(0);
    expect(readable.stdout.trim()).toBe("ship");

    const hidden = await rootWorld.exec({
      command: `cat ${JSON.stringify(todoPath)} || true`,
      mounts: [
        {
          path: workspace,
          mode: "rw",
          grants: [createGrantRecord(workspace, "/notes/**", "ro")],
          hiddenPaths: ["/notes"],
        },
      ],
    });
    expect(hidden.exitCode).toBe(0);
    expect(hidden.stdout.trim()).toBe("");
    expect(hidden.stderr).toContain("No such file or directory");

    const unmounted = await rootWorld.exec({
      command: `cat ${JSON.stringify(todoPath)} || true`,
      mounts: [],
    });
    expect(unmounted.exitCode).toBe(0);
    expect(unmounted.stdout.trim()).toBe("");
    expect(unmounted.stderr).toContain("No such file or directory");
  });

  test("Scenario: Given concurrent root shell calls with different mount sets When the durable world refreshes per call Then serialized execution prevents mount-state corruption", async () => {
    const root = createTempRoot();
    const rootWorkspace = join(root, "avatar-root");
    const workspaceA = join(root, "workspace-a");
    const workspaceB = join(root, "workspace-b");
    mkdirSync(rootWorkspace, { recursive: true });
    mkdirSync(workspaceA, { recursive: true });
    mkdirSync(workspaceB, { recursive: true });
    writeFileSync(join(workspaceA, "a.txt"), "alpha\n", "utf8");
    writeFileSync(join(workspaceB, "b.txt"), "beta\n", "utf8");

    const rootWorld = createRootWorkspaceShellWorld({
      rootWorkspacePath: rootWorkspace,
    });

    const [resultA, resultB] = await Promise.all([
      rootWorld.exec({
        command: `sleep 0.05; cat ${JSON.stringify(join(workspaceA, "a.txt"))}`,
        mounts: [
          {
            path: workspaceA,
            mode: "rw",
            grants: [createGrantRecord(workspaceA, "/", "ro")],
          },
        ],
      }),
      rootWorld.exec({
        command: `cat ${JSON.stringify(join(workspaceB, "b.txt"))}`,
        mounts: [
          {
            path: workspaceB,
            mode: "rw",
            grants: [createGrantRecord(workspaceB, "/", "ro")],
          },
        ],
      }),
    ]);

    expect(resultA.exitCode).toBe(0);
    expect(resultA.stdout.trim()).toBe("alpha");
    expect(resultB.exitCode).toBe(0);
    expect(resultB.stdout.trim()).toBe("beta");
  });

  test("Scenario: Given a mounted workspace already covers the repo subtree When root_bash runs Then nested builtin skill mounts are filtered before shell setup", async () => {
    const root = createTempRoot();
    const scratch = join(root, "scratch");
    mkdirSync(scratch, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    try {
      const session = await kernel.createSession({
        cwd: scratch,
        avatar: "architect",
        autoStart: true,
      });
      kernel.grantRuntimeWorkspace({
        runtimeId: session.id,
        workspacePath: repoRoot,
        grants: [{ pattern: "/", mode: "ro" }],
      });

      const response = await execRootWorkspaceBash(kernel, session.id, {
        command: 'printf "root-bash-ok"',
      });

      expect(response.exitCode).toBe(0);
      expect(response.stdout).toContain("root-bash-ok");
      expect(response.stderr).toBe("");
    } finally {
      await kernel.stop();
    }
  });

  test("Scenario: Given root workspace bash verifies a local URL When the runtime serves loopback HTTP Then one-shot bash networking can reach 127.0.0.1", async () => {
    const root = createTempRoot();
    const rootWorkspace = join(root, "avatar-root");
    mkdirSync(rootWorkspace, { recursive: true });

    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("loopback-ok");
    });
    await new Promise<void>((resolveReady, rejectReady) => {
      server.once("error", rejectReady);
      server.listen(0, "127.0.0.1", () => resolveReady());
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    if (!port) {
      throw new Error("expected loopback test server port");
    }

    try {
      const response = await executeTemporaryRootWorkspaceShell({
        rootWorkspacePath: rootWorkspace,
        command: `curl -s http://127.0.0.1:${port}/`,
        mounts: [],
      });
      if (response.exitCode !== 0) {
        throw new Error(`root workspace curl failed: ${JSON.stringify(response)}`);
      }
      expect(response.stdout.trim()).toBe("loopback-ok");
    } finally {
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()));
      });
    }
  });

  test("Scenario: Given root workspace bash checks a dead loopback URL When curl writes only the HTTP code Then transport failure stays non-zero instead of fabricating 502", async () => {
    const root = createTempRoot();
    const rootWorkspace = join(root, "avatar-root");
    mkdirSync(rootWorkspace, { recursive: true });

    const response = await executeTemporaryRootWorkspaceShell({
      rootWorkspacePath: rootWorkspace,
      command: 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:65500/',
      mounts: [],
    });

    expect(response.exitCode).not.toBe(0);
    expect(response.stdout.trim()).not.toBe("502");
  });

  test("Scenario: Given a mounted workspace is detached while the session is stopped When the runtime starts again Then recovery does not resurrect that workspace authority", async () => {
    const root = createTempRoot();
    const workspace = join(root, "workspace-a");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({
      cwd: workspace,
      avatar: "architect",
      autoStart: true,
    });
    kernel.grantRuntimeWorkspace({
      runtimeId: session.id,
      workspacePath: workspace,
      grants: [{ pattern: "/", mode: "rw" }],
    });

    await kernel.stopSession(session.id);
    expect(kernel.detachRuntimeWorkspace({ runtimeId: session.id, workspacePath: workspace })).toEqual({
      detached: true,
    });

    await kernel.startSession(session.id);

    expect(kernel.listRuntimeWorkspaceMounts(session.id)).toEqual([
      expect.objectContaining({
        kind: "avatar-root",
      }),
    ]);
    expect(
      kernel.listRuntimeWorkspaceMounts(session.id).some((mount) => mount.workspacePath === workspace),
    ).toBeFalse();

    const avatarRootTerminal = await kernel.createTerminal({
      sessionId: session.id,
      terminalId: "after-detach-avatar-root",
      focus: false,
    });
    expect(avatarRootTerminal.ok).toBeTrue();

    const recreated = await kernel.createTerminal({
      sessionId: session.id,
      terminalId: "after-detach-project-root",
      cwd: workspace,
      focus: false,
    });
    expect(recreated.ok).toBeFalse();
    expect(recreated.message).toContain("outside explicit workspace grants");

    await kernel.stop();
  });
});
