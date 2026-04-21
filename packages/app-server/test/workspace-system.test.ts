import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import type { AttentionSystem } from "@agenter/attention-system";

import { AppKernel } from "../src";
import { executeRootWorkspaceBash } from "../src/workspace-system/root-exec";
import { resolveWorkspaceAvatarCanonicalRoot } from "../src/workspace-system/paths";
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

const getRuntimeAttentionSystem = (kernel: AppKernel, sessionId: string): AttentionSystem =>
  getRuntime(kernel, sessionId).attentionSystem;

const tempDirs: string[] = [];

const createTempRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "agenter-workspace-system-"));
  tempDirs.push(root);
  return root;
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
        text: "echo stdin-ok",
        submit: true,
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
        readStates?: unknown;
      }>;
    };
    const listedRoom = listedPayload.channels?.find((channel) => channel.chatId === primaryRoom.chatId);
    expect(listedRoom).toBeTruthy();
    expect(listedRoom?.presence?.totalSeatCount).toBeGreaterThan(0);
    expect(listedRoom?.owner).toBeUndefined();
    expect(listedRoom?.metadata).toBeUndefined();
    expect(listedRoom?.readStates).toBeUndefined();

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
          readStates?: unknown;
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
    expect(readPayload.snapshot?.channel?.readStates).toBeUndefined();
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
    expect(catReference.stdout).toContain("root_workspace_bash");

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

  test("Scenario: Given a runtime-created terminal When it runs tool and skill commands Then the terminal shell inherits the runtime CLI surface", async () => {
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

    const wrote = await execRootWorkspaceBash(kernel, session.id, {
      command: "terminal write",
      stdin: JSON.stringify({
        terminalId,
        text: "command -v tool | xargs basename && command -v skill | xargs basename",
        submit: true,
      }),
    });
    expect(wrote.exitCode).toBe(0);

    let terminalOutput: string;
    let observedOutput = "";
    try {
      terminalOutput = await waitForRealValue(
        async () => {
          const read = await execRootWorkspaceBash(kernel, session.id, {
            command: "terminal read",
            stdin: JSON.stringify({
              terminalId,
              mode: "diff",
            }),
          });
          if (read.exitCode !== 0) {
            return null;
          }
          const payload = JSON.parse(read.stdout) as {
            result?:
              | {
                  kind?: "terminal-diff";
                  diff?: string;
                }
              | {
                  kind?: "terminal-snapshot";
                  tail?: string;
                };
          };
          const readResult = payload.result;
          const content =
            readResult?.kind === "terminal-diff"
              ? (readResult.diff ?? "")
              : readResult?.kind === "terminal-snapshot"
                ? (readResult.tail ?? "")
                : "";
          if (content.length > 0) {
            observedOutput = `${observedOutput}\n${content}`.trim();
          }
          return observedOutput.includes("tool") && observedOutput.includes("skill") ? observedOutput : null;
        },
        {
          label: "runtime terminal cli surface",
          timeoutMs: 15_000,
        },
      );
    } catch (error) {
      const read = await execRootWorkspaceBash(kernel, session.id, {
        command: "terminal read",
        stdin: JSON.stringify({
          terminalId,
          mode: "diff",
        }),
      });
      throw new Error(
        `runtime terminal cli surface failed: ${error instanceof Error ? error.message : String(error)}\nobserved:\n${observedOutput}\nlatest:\n${read.stdout}`,
      );
    }

    expect(terminalOutput).toContain("tool");
    expect(terminalOutput).toContain("skill");

    await kernel.stop();
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

    const rootResponse = await executeRootWorkspaceBash({
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
      const response = await executeRootWorkspaceBash({
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

    const response = await executeRootWorkspaceBash({
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
