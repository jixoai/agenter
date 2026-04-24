import { AttentionStore, AttentionSystem } from "@agenter/attention-system";
import { MessageControlPlane, resolveMessageControlDbPath } from "@agenter/message-system";
import { SessionDb } from "@agenter/session-system";
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { MessageDb } from "../../message-system/src/message-db";
import { AppKernel } from "../src";
import { formatMessageAttentionSrc } from "../src/attention-src";

const tempDirs: string[] = [];

const createKernel = (): AppKernel => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
  tempDirs.push(dir);
  return new AppKernel({
    homeDir: join(dir, "home"),
    globalSessionRoot: join(dir, "sessions"),
    archiveSessionRoot: join(dir, "archive", "sessions"),
    workspacesPath: join(dir, "workspaces.yaml"),
  });
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: app kernel event replay", () => {
  test("Scenario: Given kernel boot cwd When start called Then workspace is tracked in workspaces.yaml", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(dir);
    const workspacePath = join(dir, "workspace");
    const workspacesPath = join(dir, "workspaces.yaml");
    const kernel = new AppKernel({
      homeDir: join(dir, "home"),
      globalSessionRoot: join(dir, "sessions"),
      archiveSessionRoot: join(dir, "archive", "sessions"),
      workspacesPath,
      initialWorkspace: workspacePath,
    });

    await kernel.start();

    const yaml = readFileSync(workspacesPath, "utf8");
    expect(yaml).toContain(`- ${JSON.stringify(resolve(workspacePath))}`);
    expect(yaml).toContain("favoriteSessions:");
  });

  test("Scenario: Given emitted events When reading getEventsAfter Then return ordered backlog", async () => {
    const kernel = createKernel();
    const first = await kernel.createSession({ cwd: process.cwd(), name: "alpha", autoStart: false });
    const second = await kernel.createSession({ cwd: process.cwd(), name: "beta", autoStart: false });

    const full = kernel.getEventsAfter(0);
    expect(full.length).toBe(2);
    expect(full[0]?.eventId).toBe(1);
    expect(full[1]?.eventId).toBe(2);
    expect((full[0]?.payload as { session: { id: string } }).session.id).toBe(first.id);
    expect((full[1]?.payload as { session: { id: string } }).session.id).toBe(second.id);

    const incremental = kernel.getEventsAfter(1);
    expect(incremental.length).toBe(1);
    expect(incremental[0]?.eventId).toBe(2);
  });

  test("Scenario: Given workspace session stored globally When listing workspaces Then counts still reflect the workspace session", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const workspace = join(root, "workspace");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({ cwd: workspace, name: "global-workspace", autoStart: false });
    expect(session.storeTarget).toBe("global");
    expect(session.workspacePath).toBe(resolve(workspace));

    const workspaces = kernel.listAllWorkspaces();
    expect(workspaces[0]?.path).toBe("~/");
    expect(workspaces[0]?.counts).toEqual({ all: 0, running: 0, stopped: 0, archive: 0 });
    expect(workspaces[1]?.path).toBe(resolve(workspace));
    expect(workspaces[1]?.counts).toEqual({ all: 1, running: 0, stopped: 1, archive: 0 });

    const page = kernel.listWorkspaceSessions({ path: workspace, tab: "all", limit: 20 });
    expect(page.counts).toEqual({ all: 1, running: 0, stopped: 1, archive: 0 });
    expect(page.items[0]?.sessionId).toBe(session.id);
  });

  test("Scenario: Given a fresh runtime boot When no explicit mounts or attachments are orchestrated Then the runtime stays unattached by default", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const workspace = join(root, "workspace");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({ cwd: workspace, name: "cold-empty", autoStart: true });
    const runtime = kernel.getSnapshot().runtimes[session.id];

    expect(kernel.listRuntimeWorkspaceMounts(session.id)).toEqual([
      expect.objectContaining({
        kind: "avatar-root",
      }),
    ]);
    expect(kernel.listMessageChannels(session.id)).toEqual([]);
    expect(runtime?.terminals ?? []).toEqual([]);
    expect(runtime?.focusedTerminalIds ?? []).toEqual([]);

    const db = new SessionDb(join(session.sessionRoot, "session.db"));
    try {
      const currentPromptWindow = db.getCurrentPromptWindow();
      const promptWindowRows = currentPromptWindow
        ? db.listMessagesByScope("prompt_window", { windowId: currentPromptWindow.promptWindowId })
        : [];

      expect(currentPromptWindow?.messages).toEqual([]);
      expect(promptWindowRows).toHaveLength(1);
      expect(promptWindowRows[0]?.parts[0]?.partType).toBe("state");
    } finally {
      db.close();
    }

    await kernel.stop();
  });

  test("Scenario: Given a stopped session When runtime settings sources are read or saved Then the kernel uses durable files without booting the runtime", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const workspace = join(root, "workspace");
    mkdirSync(join(workspace, ".agenter"), { recursive: true });
    writeFileSync(join(workspace, ".agenter", "AGENTER.mdx"), "# Persisted prompt\n", "utf8");

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({
      cwd: workspace,
      avatar: "persisted-editor",
      name: "persisted-editor",
      autoStart: false,
    });

    expect(kernel.getSnapshot().runtimes[session.id]).toBeUndefined();

    const original = await kernel.readSettings({ sessionId: session.id, kind: "agenter" });
    expect(original.path).toBe(resolve(workspace, ".agenter", "AGENTER.mdx"));
    expect(original.content).toBe("# Persisted prompt\n");
    expect(kernel.getSnapshot().runtimes[session.id]).toBeUndefined();

    const saved = await kernel.saveSettings({
      sessionId: session.id,
      kind: "agenter",
      content: "# Updated prompt\n",
      baseMtimeMs: original.mtimeMs,
    });
    expect(saved).toEqual({
      ok: true,
      file: {
        path: resolve(workspace, ".agenter", "AGENTER.mdx"),
        content: "# Updated prompt\n",
        mtimeMs: expect.any(Number),
      },
    });
    expect(readFileSync(resolve(workspace, ".agenter", "AGENTER.mdx"), "utf8")).toBe("# Updated prompt\n");
    expect(kernel.getSnapshot().runtimes[session.id]).toBeUndefined();

    await kernel.stop();
  });

  test("Scenario: Given a running session without an attached primary room When sendChat is called Then the kernel rejects the chat instead of synthesizing a hidden room", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const workspace = join(root, "workspace");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({ cwd: workspace, name: "chat-needs-room", autoStart: true });

    await expect(kernel.sendChat(session.id, "hello")).resolves.toEqual({
      ok: false,
      reason: expect.stringContaining("default room is not attached"),
    });
    expect(kernel.listMessageChannels(session.id)).toEqual([]);

    const room = await kernel.attachSessionPrimaryRoom(session.id, { focus: true });
    expect(room.chatId).toBeTruthy();
    await expect(kernel.sendChat(session.id, "hello")).resolves.toEqual({ ok: true });

    await kernel.stop();
  });

  test("Scenario: Given explicit room terminal and workspace authorities When the session stops and starts Then recovery reuses those durable facts without synthesizing new defaults", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const workspace = join(root, "workspace");
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
      avatar: "recoverer",
      name: "recoverer",
      autoStart: true,
    });
    const room = await kernel.attachSessionPrimaryRoom(session.id, { focus: true });
    kernel.grantRuntimeWorkspace({
      runtimeId: session.id,
      workspacePath: workspace,
      grants: [{ pattern: "/", mode: "rw" }],
    });
    const terminalResult = await kernel.createTerminal({
      sessionId: session.id,
      terminalId: "recovery-main",
      cwd: workspace,
      focus: true,
    });
    expect(terminalResult.ok).toBeTrue();

    expect(kernel.listRuntimeWorkspaceMounts(session.id)).toEqual([
      expect.objectContaining({
        kind: "avatar-root",
      }),
      expect.objectContaining({
        kind: "workspace",
        workspacePath: resolve(workspace),
      }),
    ]);

    await kernel.stopSession(session.id);

    expect(kernel.listMessageChannels(session.id).some((entry) => entry.chatId === room.chatId)).toBeTrue();
    expect(
      kernel
        .listGlobalTerminals({
          actorId: (session.avatarPrincipalId ?? `session:${session.id}`) as never,
        })
        .some((entry) => entry.terminalId === "recovery-main"),
    ).toBeTrue();
    expect(kernel.listRuntimeWorkspaceMounts(session.id)).toEqual([
      expect.objectContaining({
        kind: "avatar-root",
      }),
      expect.objectContaining({
        kind: "workspace",
        workspacePath: resolve(workspace),
      }),
    ]);

    const resumed = await kernel.startSession(session.id);
    const runtime = kernel.getSnapshot().runtimes[session.id];

    expect(resumed.status).toBe("running");
    expect(runtime?.messageChannels?.some((entry) => entry.chatId === room.chatId)).toBeTrue();
    expect(runtime?.terminals.some((entry) => entry.terminalId === "recovery-main")).toBeTrue();
    expect(runtime?.focusedTerminalIds).toContain("recovery-main");
    expect(kernel.listRuntimeWorkspaceMounts(session.id)).toEqual([
      expect.objectContaining({
        kind: "avatar-root",
      }),
      expect.objectContaining({
        kind: "workspace",
        workspacePath: resolve(workspace),
      }),
    ]);

    await kernel.stop();
  });

  test("Scenario: Given kernel startup When creating global room and terminal surfaces Then live transport URLs initial snapshots and absolute cwd are available immediately", async () => {
    const kernel = createKernel();
    await kernel.start();

    const room = await kernel.createGlobalRoom({
      title: "Ops room",
      focus: false,
    });
    const terminalResult = await kernel.createGlobalTerminal({
      cwd: ".",
      focus: false,
    });

    expect(room.chatId).toMatch(/^0x[0-9a-f]{40}$/);
    expect(room.transportUrl).toContain("ws://127.0.0.1:");
    expect(room.transportUrl).toContain("/room/");
    expect(terminalResult.terminal?.transportUrl).toContain("ws://127.0.0.1:");
    expect(terminalResult.terminal?.transportUrl).toContain("/pty/");
    expect(terminalResult.terminal?.cwd).toBe(resolve("."));
    expect(terminalResult.terminal?.snapshot?.rows).toBeGreaterThan(0);
    expect(terminalResult.terminal?.snapshot?.cols).toBeGreaterThan(0);
  });

  test("Scenario: Given a stopped global terminal boots through transport When live snapshot and status updates arrive Then app-kernel does not escalate them into catalogChanged invalidations", async () => {
    const kernel = createKernel();
    await kernel.start();

    const terminalResult = await kernel.createGlobalTerminal({
      terminalId: "transport-boot-without-catalog-storm",
      cwd: process.cwd(),
      command: ["sh", "-lc", "printf first-frame; sleep 0.05; printf second-frame"],
      focus: false,
    });
    const transportUrl = terminalResult.terminal?.transportUrl;
    if (!transportUrl) {
      throw new Error("expected global terminal transport url");
    }

    // Let the create-time catalog invalidation flush before we observe the
    // runtime boot path for this transport session.
    await Bun.sleep(160);

    const surfaceEvents: Array<{ payload?: { catalogChanged?: boolean } }> = [];
    const unsubscribe = kernel.onEvent((event) => {
      if (event.type === "terminal.surface.updated") {
        surfaceEvents.push(event);
      }
    });

    const socket = new WebSocket(transportUrl);
    const messages: Array<{ type?: string; data?: string }> = [];
    const opened = new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("websocket-open-failed")), { once: true });
    });
    const closed = new Promise<void>((resolve) => {
      socket.addEventListener("close", () => resolve(), { once: true });
    });
    socket.addEventListener("message", (event) => {
      messages.push(JSON.parse(String(event.data)) as { type?: string; data?: string });
    });

    await opened;
    await closed;
    await Bun.sleep(160);

    unsubscribe();

    expect(messages.some((message) => message.type === "snapshot")).toBeTrue();
    expect(messages.some((message) => message.type === "output" && message.data?.includes("first-frame"))).toBeTrue();
    expect(surfaceEvents.some((event) => event.payload?.catalogChanged)).toBeFalse();

    await kernel.stop();
  });

  test("Scenario: Given a room message is sent before a stopped avatar session starts When the kernel starts that session Then startup replay loads the unread room message for that avatar principal", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const workspace = join(root, "workspace");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({
      cwd: workspace,
      avatar: "jane",
      name: "jane",
      autoStart: false,
    });
    if (!session.avatarPrincipalId) {
      throw new Error("expected avatar principal id");
    }

    const room = await kernel.createGlobalRoom({
      title: "Startup replay room",
      initialUsers: [
        {
          actorId: "auth:kzf",
          label: "kzf",
          role: "member",
          focused: true,
        },
        {
          actorId: session.avatarPrincipalId as `0x${string}`,
          label: "jane",
          role: "member",
          focused: true,
        },
      ],
    });

    const sent = kernel.sendGlobalRoomMessage({
      chatId: room.chatId,
      accessToken: room.accessToken,
      superadminActorId: "auth:kzf",
      text: "hello before jane starts",
    });
    expect(sent.ok).toBeTrue();

    const before = kernel
      .pageGlobalRoomMessages({
        chatId: room.chatId,
        accessToken: room.accessToken,
        limit: 4,
      })
      .items.find((message) => message.content === "hello before jane starts");
    expect(before?.unreadActorIds).toContain(session.avatarPrincipalId as `0x${string}`);

    await kernel.startSession(session.id);

    const deadline = Date.now() + 5_000;
    let loaded = before ?? null;
    while (Date.now() < deadline) {
      loaded =
        kernel
          .pageGlobalRoomMessages({
            chatId: room.chatId,
            accessToken: room.accessToken,
            limit: 4,
          })
          .items.find((message) => message.content === "hello before jane starts") ?? null;
      if (
        loaded &&
        loaded.readActorIds.includes(session.avatarPrincipalId as `0x${string}`) &&
        !loaded.unreadActorIds.includes(session.avatarPrincipalId as `0x${string}`)
      ) {
        break;
      }
      await new Promise<void>((resolveReady) => setTimeout(resolveReady, 50));
    }

    expect(loaded?.readActorIds).toContain(session.avatarPrincipalId as `0x${string}`);
    expect(loaded?.unreadActorIds).not.toContain(session.avatarPrincipalId as `0x${string}`);

    await kernel.stop();
  });

  test("Scenario: Given a room still granted to a legacy session actor When the avatar starts Then grants and unread membership are repaired to the avatar principal", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const workspace = join(root, "workspace");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({
      cwd: workspace,
      avatar: "jane",
      name: "legacy-jane",
      autoStart: false,
    });
    if (!session.avatarPrincipalId) {
      throw new Error("expected avatar principal id");
    }
    const legacyActorId = `session:${session.id}` as const;

    const room = await kernel.createGlobalRoom({
      title: "Legacy actor repair room",
      initialUsers: [
        {
          actorId: "auth:kzf",
          label: "kzf",
          role: "member",
          focused: true,
        },
        {
          actorId: legacyActorId,
          label: "jane",
          role: "member",
          focused: true,
        },
      ],
    });

    const sent = kernel.sendGlobalRoomMessage({
      chatId: room.chatId,
      accessToken: room.accessToken,
      superadminActorId: "auth:kzf",
      text: "hello legacy jane",
    });
    expect(sent.ok).toBeTrue();

    const before = kernel
      .pageGlobalRoomMessages({
        chatId: room.chatId,
        accessToken: room.accessToken,
        limit: 4,
      })
      .items.find((message) => message.content === "hello legacy jane");
    expect(before?.unreadActorIds).toContain(legacyActorId);
    expect(before?.unreadActorIds).not.toContain(session.avatarPrincipalId as `0x${string}`);
    expect(
      kernel
        .listGlobalRooms({
          actorId: session.avatarPrincipalId as `0x${string}`,
        })
        .some((entry) => entry.chatId === room.chatId),
    ).toBeFalse();

    await kernel.startSession(session.id);

    const grants = kernel.listGlobalRoomGrants({
      chatId: room.chatId,
      accessToken: room.accessToken,
    });
    expect(grants.some((grant) => grant.participantId === legacyActorId)).toBeFalse();
    expect(
      grants.some(
        (grant) => grant.participantId === (session.avatarPrincipalId as `0x${string}`) && grant.role === "member",
      ),
    ).toBeTrue();
    expect(
      kernel
        .listGlobalRooms({
          actorId: session.avatarPrincipalId as `0x${string}`,
        })
        .some((entry) => entry.chatId === room.chatId),
    ).toBeTrue();

    const deadline = Date.now() + 5_000;
    let loaded = before ?? null;
    while (Date.now() < deadline) {
      loaded =
        kernel
          .pageGlobalRoomMessages({
            chatId: room.chatId,
            accessToken: room.accessToken,
            limit: 4,
          })
          .items.find((message) => message.content === "hello legacy jane") ?? null;
      if (
        loaded &&
        loaded.readActorIds.includes(session.avatarPrincipalId as `0x${string}`) &&
        !loaded.readActorIds.includes(legacyActorId) &&
        !loaded.unreadActorIds.includes(session.avatarPrincipalId as `0x${string}`) &&
        !loaded.unreadActorIds.includes(legacyActorId)
      ) {
        break;
      }
      await new Promise<void>((resolveReady) => setTimeout(resolveReady, 50));
    }

    expect(loaded?.readActorIds).toContain(session.avatarPrincipalId as `0x${string}`);
    expect(loaded?.readActorIds).not.toContain(legacyActorId);
    expect(loaded?.unreadActorIds).not.toContain(session.avatarPrincipalId as `0x${string}`);
    expect(loaded?.unreadActorIds).not.toContain(legacyActorId);

    await kernel.stop();
  });

  test("Scenario: Given session runtime When inspecting model debug Then resolved provider config and empty history are returned", async () => {
    const kernel = createKernel();
    await kernel.start();

    const session = await kernel.createSession({ cwd: process.cwd(), name: "model-debug", autoStart: false });
    const debug = await kernel.inspectModelDebug(session.id);

    expect(debug.config?.providerId).toBeTruthy();
    expect(debug.config?.apiStandard).toBeTruthy();
    expect(debug.config?.model).toBeTruthy();
    expect(debug.config?.capabilities.streaming).toBeBoolean();
    expect(debug.promptWindow).toEqual([]);
    expect(debug.latestModelCall).toBeNull();
    expect(debug.recentApiCalls).toEqual([]);
  });

  test("Scenario: Given a stopped session When retaining the Devtools API stream Then the kernel stays stopped and reports recording disabled", async () => {
    const kernel = createKernel();
    await kernel.start();

    const session = await kernel.createSession({ cwd: process.cwd(), name: "stopped-devtools", autoStart: false });
    const retained = await kernel.retainApiCallSubscription(session.id);

    expect(retained).toEqual({ enabled: false, refCount: 0 });
    const snapshot = kernel.getSnapshot();
    expect(snapshot.runtimes[session.id]).toBeUndefined();
    expect(snapshot.sessions.find((item) => item.id === session.id)?.status).toBe("stopped");
  });

  test("Scenario: Given a running session When stop resume and abort are requested Then stop detaches runtime ownership and resume creates a fresh runtime", async () => {
    const kernel = createKernel();
    await kernel.start();

    const session = await kernel.createSession({ cwd: process.cwd(), name: "pause-abort", autoStart: true });
    const kernelInternal = kernel as unknown as {
      runtimes: Map<string, unknown>;
    };
    const firstRuntime = kernelInternal.runtimes.get(session.id);

    expect(kernel.getSnapshot().sessions.find((item) => item.id === session.id)?.status).toBe("running");
    expect(kernel.getSnapshot().runtimes[session.id]).toBeDefined();
    expect(firstRuntime).toBeDefined();

    const paused = await kernel.stopSession(session.id);
    expect(paused.status).toBe("stopped");
    expect(kernel.getSnapshot().sessions.find((item) => item.id === session.id)?.status).toBe("stopped");
    expect(kernel.getSnapshot().runtimes[session.id]).toBeUndefined();
    expect(kernelInternal.runtimes.get(session.id)).toBeUndefined();

    const resumed = await kernel.startSession(session.id);
    const resumedRuntime = kernelInternal.runtimes.get(session.id);
    expect(resumed.status).toBe("running");
    expect(kernel.getSnapshot().sessions.find((item) => item.id === session.id)?.status).toBe("running");
    expect(kernel.getSnapshot().runtimes[session.id]).toBeDefined();
    expect(resumedRuntime).toBeDefined();
    expect(resumedRuntime).not.toBe(firstRuntime);

    const aborted = await kernel.abortSession(session.id);
    expect(aborted.status).toBe("stopped");
    expect(kernel.getSnapshot().sessions.find((item) => item.id === session.id)?.status).toBe("stopped");
    expect(kernel.getSnapshot().runtimes[session.id]).toBeUndefined();
    expect(kernelInternal.runtimes.get(session.id)).toBeUndefined();
  });

  test("Scenario: Given a stopped session When a persisted attention push is written Then notification snapshot reads the persisted truth instead of stale runtime state", async () => {
    const kernel = createKernel();
    await kernel.start();

    const session = await kernel.createSession({
      cwd: process.cwd(),
      name: "stopped-persisted-notification",
      autoStart: true,
    });
    await kernel.stopSession(session.id);

    expect(kernel.getSnapshot().runtimes[session.id]).toBeUndefined();

    const sessionMeta = kernel.getSession(session.id);
    if (!sessionMeta?.primaryRoomId) {
      throw new Error("expected persisted session metadata with primary room id");
    }

    await kernel.setChatVisibility({
      sessionId: session.id,
      chatId: sessionMeta.primaryRoomId,
      visible: true,
      focused: false,
    });

    const attentionStore = new AttentionStore(join(sessionMeta.sessionRoot, "attention-system"));
    const attentionSystem = AttentionSystem.fromSnapshot(await attentionStore.load());
    const contextId = `ctx-${sessionMeta.primaryRoomId}`;
    if (!attentionSystem.getContext(contextId)) {
      attentionSystem.createContext({
        contextId,
        owner: sessionMeta.avatar,
        focusState: "background",
      });
    } else {
      attentionSystem.setContextFocusState(contextId, "background");
    }
    attentionSystem.commit(contextId, {
      ingressType: "push",
      meta: {
        author: "assistant",
        source: "message",
        src: formatMessageAttentionSrc({ chatId: sessionMeta.primaryRoomId, messageId: 1 }),
      },
      scores: { persisted_ping: 100 },
      summary: "Persisted background ping",
      change: {
        type: "update",
        value: "Persisted background ping",
      },
    });
    await attentionStore.save(attentionSystem.snapshot());

    const unreadSnapshot = await kernel.getNotificationSnapshot();
    expect(unreadSnapshot.unreadBySession[session.id]).toBe(1);
    expect(unreadSnapshot.unreadByBucket[session.id]?.[`msg:${sessionMeta.primaryRoomId}`]).toBe(1);
    expect(unreadSnapshot.items[0]?.src).toBe(
      formatMessageAttentionSrc({ chatId: sessionMeta.primaryRoomId, messageId: 1 }),
    );

    const consumedSnapshot = await kernel.consumeNotifications({
      sessionId: session.id,
      upToSrc: formatMessageAttentionSrc({ chatId: sessionMeta.primaryRoomId, messageId: 1 }),
    });
    expect(consumedSnapshot.unreadBySession[session.id] ?? 0).toBe(0);
    expect(consumedSnapshot.unreadByBucket[session.id]?.[`msg:${sessionMeta.primaryRoomId}`]).toBeUndefined();
  });

  test("Scenario: Given legacy or broken session preview store When listing workspace sessions Then page still renders without crashing", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-preview-"));
    tempDirs.push(root);
    const workspace = join(root, "workspace");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({ cwd: workspace, name: "broken-preview", autoStart: false });
    writeFileSync(join(session.sessionRoot, "session.db"), "not-a-sqlite-db", "utf8");

    const page = kernel.listWorkspaceSessions({ path: workspace, tab: "all", limit: 20 });
    expect(page.items[0]?.sessionId).toBe(session.id);
    expect(page.items[0]?.preview).toEqual({ firstUserMessage: null, latestMessages: [] });
  });

  test("Scenario: Given invalid workspace directory When creating session Then kernel rejects the malformed path", async () => {
    const kernel = createKernel();
    await kernel.start();

    await expect(
      kernel.createSession({
        cwd: 'path: "/tmp/agenter-chat-smoke-Rpho"',
        name: "broken",
        autoStart: false,
      }),
    ).rejects.toThrow("invalid workspace directory");
  });

  test("Scenario: Given missing workspaces tracked When cleaning them Then only broken entries are removed", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const existingWorkspace = join(root, "workspace-existing");
    const missingWorkspace = join(root, "workspace-missing");
    mkdirSync(existingWorkspace, { recursive: true });
    const workspacesPath = join(root, "workspaces.yaml");
    writeFileSync(
      workspacesPath,
      [
        "version: 2",
        "updatedAt: 2026-03-06T00:00:00.000Z",
        "workspaces:",
        `  - ${JSON.stringify(resolve(existingWorkspace))}`,
        `  - ${JSON.stringify(resolve(missingWorkspace))}`,
        "favoriteWorkspaces:",
        `  - ${JSON.stringify(resolve(missingWorkspace))}`,
        "favoriteSessions:",
        "",
      ].join("\n"),
      "utf8",
    );

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath,
    });
    await kernel.start();

    expect(kernel.listAllWorkspaces().find((item) => item.path === resolve(missingWorkspace))?.missing).toBe(true);
    expect(kernel.removeMissingWorkspaces()).toEqual({ removed: [resolve(missingWorkspace)] });
    expect(kernel.listAllWorkspaces().some((item) => item.path === resolve(missingWorkspace))).toBe(false);
    expect(kernel.listAllWorkspaces().some((item) => item.path === resolve(existingWorkspace))).toBe(true);
    expect(readFileSync(workspacesPath, "utf8")).not.toContain(JSON.stringify(resolve(missingWorkspace)));
  });

  test("Scenario: Given workspace session When creating and archiving Then active paths stay global and archive tab can see it", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const workspace = join(root, "workspace");
    mkdirSync(join(workspace, ".agenter"), { recursive: true });
    writeFileSync(
      join(workspace, ".agenter", "settings.json"),
      JSON.stringify({ sessionStoreTarget: "workspace" }, null, 2),
      "utf8",
    );
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({ cwd: workspace, name: "bucketed", autoStart: false });
    const created = new Date(session.createdAt);
    const bucket = [
      String(created.getUTCFullYear()).padStart(4, "0"),
      String(created.getUTCMonth() + 1).padStart(2, "0"),
      String(created.getUTCDate()).padStart(2, "0"),
    ];
    expect(session.sessionRoot).toBe(join(root, "sessions", ...bucket, session.id));
    expect(session.workspacePath).toBe(resolve(workspace));

    const archived = await kernel.archiveSession(session.id);
    const archivedDate = new Date(archived.archivedAt!);
    const archiveBucket = [
      String(archivedDate.getUTCFullYear()).padStart(4, "0"),
      String(archivedDate.getUTCMonth() + 1).padStart(2, "0"),
      String(archivedDate.getUTCDate()).padStart(2, "0"),
    ];
    expect(archived.sessionRoot).toBe(join(root, "archive", "sessions", ...archiveBucket, session.id));

    const page = kernel.listWorkspaceSessions({ path: workspace, tab: "archive", limit: 20 });
    expect(page.counts.archive).toBe(1);
    expect(page.items[0]?.sessionId).toBe(session.id);

    const restored = await kernel.restoreSession(session.id);
    expect(restored.storageState).toBe("active");
    expect(restored.sessionRoot).toBe(join(root, "sessions", ...bucket, session.id));
  });

  test("Scenario: Given the same workspace and avatar pair When launching twice Then the kernel reuses one stable session identity", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-session-reuse-"));
    tempDirs.push(root);
    const workspace = join(root, "workspace");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const first = await kernel.createSession({ cwd: workspace, avatar: "default", autoStart: false });
    const second = await kernel.createSession({ cwd: workspace, avatar: "default", autoStart: false });

    expect(second.id).toBe(first.id);
    expect(kernel.listWorkspaceSessions({ path: workspace, tab: "all", limit: 20 }).items).toHaveLength(1);
  });

  test("Scenario: Given terminal preset command is missing When auto-starting session Then kernel still accepts chat input", async () => {
    const kernel = createKernel();
    await kernel.start();

    const workspace = mkdtempSync(join(tmpdir(), "agenter-missing-terminal-"));
    tempDirs.push(workspace);
    mkdirSync(join(workspace, ".agenter"), { recursive: true });
    writeFileSync(
      join(workspace, ".agenter", "settings.json"),
      JSON.stringify(
        {
          terminal: {
            presets: {
              shell: {
                command: ["__agenter_missing_binary__"],
              },
            },
            gitLog: false,
          },
          features: {
            terminal: {
              bootTerminals: [{ id: "shell", focus: true, autoRun: true }],
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const session = await kernel.createSession({
      cwd: workspace,
      autoStart: true,
    });

    expect(session.status).toBe("running");
    await kernel.attachSessionPrimaryRoom(session.id, { focus: true });
    await expect(kernel.sendChat(session.id, "hello")).resolves.toEqual({ ok: true });
    await kernel.stop();
  });

  test("Scenario: Given a workspace draft When resolving provider capabilities and fuzzy path completions Then quick-start metadata is ready before a session exists", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-draft-"));
    tempDirs.push(root);
    const workspace = join(root, "workspace");
    mkdirSync(join(workspace, "src"), { recursive: true });
    mkdirSync(join(workspace, "ignored"), { recursive: true });
    writeFileSync(join(workspace, ".gitignore"), "ignored\n", "utf8");
    writeFileSync(join(workspace, "README.md"), "# demo\n", "utf8");
    writeFileSync(join(workspace, "src", "index.ts"), "export const demo = true;\n", "utf8");
    writeFileSync(join(workspace, "ignored", "secret.ts"), "export const secret = true;\n", "utf8");

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const draft = await kernel.resolveDraft({ cwd: workspace });
    const rootCompletions = kernel.searchWorkspacePaths({ cwd: workspace, query: "@", limit: 10 });
    const nestedCompletions = kernel.searchWorkspacePaths({ cwd: workspace, query: "@src/", limit: 10 });
    const fuzzyCompletions = kernel.searchWorkspacePaths({ cwd: workspace, query: "@idx", limit: 10 });
    const ignoredCompletions = kernel.searchWorkspacePaths({ cwd: workspace, query: "@secret", limit: 10 });

    expect(draft.cwd).toBe(resolve(workspace));
    expect(draft.provider.providerId).toBeTruthy();
    expect(typeof draft.modelCapabilities.imageInput).toBe("boolean");
    expect(rootCompletions).toEqual(
      expect.arrayContaining([
        {
          label: "src/",
          path: "src/",
          isDirectory: true,
        },
        {
          label: "README.md",
          path: "README.md",
          isDirectory: false,
        },
      ]),
    );
    expect(nestedCompletions).toEqual([
      {
        label: "src/index.ts",
        path: "src/index.ts",
        isDirectory: false,
      },
    ]);
    expect(fuzzyCompletions[0]).toEqual({
      label: "src/index.ts",
      path: "src/index.ts",
      isDirectory: false,
    });
    expect(ignoredCompletions).toEqual([]);

    await kernel.stop();
  });

  test("Scenario: Given uploaded session assets When sending chat and deleting the session Then attachments persist and the asset files follow the session lifecycle", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-assets-"));
    tempDirs.push(root);
    const workspace = join(root, "workspace");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({ cwd: workspace, name: "asset-chat", autoStart: false });
    const uploads = await kernel.uploadSessionAssets(session.id, [
      {
        name: "diagram.png",
        mimeType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71]),
      },
    ]);
    const attachment = uploads[0];
    if (!attachment) {
      throw new Error("expected uploaded asset metadata");
    }

    const media = kernel.getSessionAsset(session.id, attachment.assetId);
    expect(media?.mimeType).toBe("image/png");
    expect(media?.name).toBe("diagram.png");

    await kernel.attachSessionPrimaryRoom(session.id, { focus: true });
    const sendResult = await kernel.sendChat(session.id, "Please inspect the image.", [attachment.assetId]);
    expect(sendResult).toEqual({ ok: true });

    const messages = kernel.listChatMessages(session.id, 0, 20);
    const userMessage = messages.find((item) => item.role === "user" && item.content === "Please inspect the image.");
    const userAttachments = userMessage?.attachments ?? [];
    expect(userAttachments).toHaveLength(1);
    expect(userAttachments[0]?.assetId).toBe(attachment.assetId);
    expect(userAttachments[0]?.url).toBe(
      `/media/sessions/${encodeURIComponent(session.id)}/assets/${encodeURIComponent(attachment.assetId)}`,
    );

    const sessionRoot = session.sessionRoot;
    expect(media ? readFileSync(media.filePath).byteLength : 0).toBe(4);

    await kernel.deleteSession(session.id);
    expect(existsSync(sessionRoot)).toBe(false);
  });

  test("Scenario: Given uploaded room assets When sending a global room message Then attachments persist across reload and media reads stay durable", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-room-assets-"));
    tempDirs.push(root);
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const room = await kernel.createGlobalRoom({
      title: "Room assets",
      focus: true,
    });
    expect(room.chatId).toMatch(/^0x[0-9a-f]{40}$/);
    const uploads = await kernel.uploadGlobalRoomAssets({
      chatId: room.chatId,
      accessToken: room.accessToken,
      files: [
        {
          name: "diagram.png",
          mimeType: "image/png",
          bytes: new Uint8Array([137, 80, 78, 71]),
        },
      ],
    });
    const attachment = uploads[0];
    if (!attachment) {
      throw new Error("expected uploaded room asset metadata");
    }
    expect(attachment.uploadedByActorId).toBe(room.participantId);

    const listedAssets = kernel.listGlobalRoomAssets({
      chatId: room.chatId,
      accessToken: room.accessToken,
    });
    expect(listedAssets).toHaveLength(1);
    expect(listedAssets[0]).toMatchObject({
      assetId: attachment.assetId,
      name: "diagram.png",
      mimeType: "image/png",
      uploadedByActorId: room.participantId,
    });

    const media = kernel.getGlobalRoomAsset(room.chatId, attachment.assetId);
    expect(media?.mimeType).toBe("image/png");
    expect(media?.name).toBe("diagram.png");

    const sent = kernel.sendGlobalRoomMessage({
      chatId: room.chatId,
      accessToken: room.accessToken,
      text: "please inspect the room image",
      assetIds: [attachment.assetId],
    });
    expect(sent).toEqual({ ok: true });

    const snapshot = kernel.snapshotGlobalRoom({
      chatId: room.chatId,
      accessToken: room.accessToken,
      limit: 20,
    });
    const message = snapshot.items.find((item) => item.content === "please inspect the room image");
    expect(message?.attachments).toHaveLength(1);
    expect(message?.attachments?.[0]?.assetId).toBe(attachment.assetId);
    expect(message?.attachments?.[0]?.url).toBe(
      `/media/rooms/${encodeURIComponent(room.chatId)}/assets/${encodeURIComponent(attachment.assetId)}`,
    );
    expect(media ? readFileSync(media.filePath).byteLength : 0).toBe(4);

    await kernel.stop();

    const restarted = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await restarted.start();
    const restartedRoom = restarted
      .listGlobalRooms({ includeArchived: true })
      .find((item) => item.chatId === room.chatId);
    if (!restartedRoom?.accessToken) {
      throw new Error("expected restarted room projection");
    }

    const restartedSnapshot = restarted.snapshotGlobalRoom({
      chatId: room.chatId,
      accessToken: restartedRoom.accessToken,
      limit: 20,
    });
    const restartedMessage = restartedSnapshot.items.find((item) => item.content === "please inspect the room image");
    expect(restartedMessage?.attachments?.[0]?.assetId).toBe(attachment.assetId);
    expect(restarted.getGlobalRoomAsset(room.chatId, attachment.assetId)?.sizeBytes).toBe(4);

    await restarted.stop();
  });

  test("Scenario: Given a room created by a session When that session is deleted Then the global room truth remains in .message", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({ cwd: process.cwd(), name: "room-survival", autoStart: true });
    const room = await kernel.attachSessionPrimaryRoom(session.id, { focus: false });

    const sent = await kernel.sendMessageChannelError({
      sessionId: session.id,
      chatId: room.chatId,
      accessToken: room.accessToken,
      content: "still here",
      error: {
        title: "still here",
      },
    });
    expect(sent.ok).toBeTrue();

    await kernel.deleteSession(session.id);

    const globalPlane = new MessageControlPlane({
      dbPath: resolveMessageControlDbPath(join(root, ".message")),
    });
    try {
      const persistedRoom = globalPlane.getChannel(room.chatId, { includeArchived: true });
      expect(persistedRoom?.chatId).toBe(room.chatId);
      expect(globalPlane.snapshot(room.chatId, 20).items.some((item) => item.content === "still here")).toBeTrue();
    } finally {
      globalPlane.close();
    }

    await kernel.stop();
  });

  test("Scenario: Given global room authority When kernel lists sends grants and archives Then room truth stays outside session ownership", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const room = await kernel.createGlobalRoom({
      title: "Ops room",
      focus: true,
    });
    expect(room.chatId).toMatch(/^0x[0-9a-f]{40}$/);
    expect(kernel.listGlobalRooms().some((item) => item.chatId === room.chatId && item.focused)).toBeFalse();

    const sent = kernel.sendGlobalRoomMessage({
      chatId: room.chatId,
      accessToken: room.accessToken,
      text: "global hello",
    });
    expect(sent.ok).toBeTrue();

    const snapshot = kernel.snapshotGlobalRoom({
      chatId: room.chatId,
      accessToken: room.accessToken,
      limit: 20,
    });
    expect(snapshot.items.some((item) => item.content === "global hello")).toBeTrue();
    const sentMessage = snapshot.items.find((item) => item.content === "global hello");
    expect(sentMessage?.visibleAt).toBe(sentMessage?.createdAt);
    expect(sentMessage?.senderActorId).toBe("system:trusted-bootstrap");
    const issued = kernel.issueGlobalRoomGrant({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      participantId: "session:avatar-pair",
      label: "Pair operator",
    });
    expect(issued.accessToken).toStartWith("msgtok_");

    const memberSent = kernel.sendGlobalRoomMessage({
      chatId: room.chatId,
      accessToken: issued.accessToken,
      text: "pair operator hello",
    });
    expect(memberSent.ok).toBeTrue();

    const memberSnapshot = kernel.snapshotGlobalRoom({
      chatId: room.chatId,
      accessToken: issued.accessToken,
      limit: 20,
    });
    const memberMessage = memberSnapshot.items.find((item) => item.content === "pair operator hello");
    expect(memberMessage?.senderActorId).toBe("session:avatar-pair");

    const readProjection = kernel.markGlobalRoomRead({
      chatId: room.chatId,
      accessToken: issued.accessToken,
      messageId: memberMessage?.messageId,
    });
    expect(Object.prototype.hasOwnProperty.call(readProjection, "readProgress")).toBeFalse();
    expect(readProjection.seatStates?.find((state) => state.actorId === "session:avatar-pair")).toMatchObject({
      actorId: "session:avatar-pair",
      role: "member",
    });

    const page = kernel.pageGlobalRoomMessages({
      chatId: room.chatId,
      accessToken: room.accessToken,
      limit: 20,
    });
    expect(page.items.some((item) => item.content === "global hello")).toBeTrue();
    expect(page.items.find((item) => item.content === "pair operator hello")?.senderActorId).toBe(
      "session:avatar-pair",
    );

    const superadminSendAs = kernel.sendGlobalRoomMessage({
      chatId: room.chatId,
      accessToken: issued.accessToken,
      superadminActorId: "auth:root-admin",
      sendAsActorId: "session:avatar-pair",
      text: "superadmin as pair",
    });
    expect(superadminSendAs.ok).toBeTrue();
    expect(
      kernel
        .snapshotGlobalRoom({
          chatId: room.chatId,
          accessToken: room.accessToken,
          limit: 20,
        })
        .items.find((item) => item.content === "superadmin as pair")?.senderActorId,
    ).toBe("session:avatar-pair");

    const invalidSendAs = kernel.sendGlobalRoomMessage({
      chatId: room.chatId,
      accessToken: room.accessToken,
      superadminActorId: "auth:root-admin",
      sendAsActorId: "session:avatar-pair",
      text: "invalid send-as",
    });
    expect(invalidSendAs.ok).toBeFalse();
    expect(invalidSendAs.reason).toContain("send-as actor invalid");

    const updated = kernel.updateGlobalRoom({
      chatId: room.chatId,
      accessToken: room.accessToken,
      patch: {
        title: "Ops renamed",
        metadata: { topic: "ops" },
      },
    });
    expect(updated.title).toBe("Ops renamed");

    expect(kernel.listGlobalRoomGrants({ chatId: room.chatId, accessToken: room.accessToken })).toHaveLength(1);

    const revoked = kernel.revokeGlobalRoomGrant({
      chatId: room.chatId,
      accessToken: room.accessToken,
      grantId: issued.grantId,
    });
    expect(revoked.ok).toBeTrue();

    const archived = kernel.archiveGlobalRoom({
      chatId: room.chatId,
      accessToken: room.accessToken,
      archivedBy: "ops-admin",
    });
    expect(archived.archivedBy).toBe("ops-admin");
    expect(kernel.listGlobalRooms().some((item) => item.chatId === room.chatId)).toBeFalse();

    const disposable = await kernel.createGlobalRoom({
      title: "Disposable room",
    });
    const deleted = kernel.deleteGlobalRoom({
      chatId: disposable.chatId,
      accessToken: disposable.accessToken,
    });
    expect(deleted.chatId).toBe(disposable.chatId);
    expect(
      kernel.listGlobalRooms({ includeArchived: true }).some((item) => item.chatId === disposable.chatId),
    ).toBeFalse();

    await kernel.stop();
  });

  test("Scenario: Given global room initial users When the kernel creates the room Then grants and focus are available without follow-up mutations", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const room = await kernel.createGlobalRoom({
      title: "Seeded room",
      initialUsers: [
        {
          actorId: "auth:viewer",
          label: "Viewer",
          role: "readonly",
          focused: true,
        },
        {
          actorId: "session:jj",
          label: "JJ",
          role: "member",
          focused: false,
        },
      ],
    });
    expect(room.chatId).toMatch(/^0x[0-9a-f]{40}$/);

    expect(room.participants).toEqual([
      { id: "auth:viewer", label: "Viewer" },
      { id: "session:jj", label: "JJ" },
    ]);
    expect(
      kernel.listGlobalRoomGrants({
        chatId: room.chatId,
        accessToken: room.accessToken,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          participantId: "auth:viewer",
          role: "readonly",
        }),
        expect.objectContaining({
          participantId: "session:jj",
          role: "member",
        }),
      ]),
    );
    expect(
      kernel.listGlobalRooms({
        actorId: "auth:viewer",
      })[0],
    ).toMatchObject({
      chatId: room.chatId,
      focused: true,
      accessRole: "readonly",
    });
    expect(
      kernel.listGlobalRooms({
        actorId: "session:jj",
      })[0],
    ).toMatchObject({
      chatId: room.chatId,
      focused: false,
      accessRole: "member",
    });

    await kernel.stop();
  });

  test("Scenario: Given one selected initial user When the kernel creates a room Then omitted avatars do not receive room grants or focus", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const room = await kernel.createGlobalRoom({
      title: "Invite Jane only",
      initialUsers: [
        {
          actorId: "auth:jane",
          label: "Jane",
          role: "member",
          focused: true,
        },
      ],
    });

    const grants = kernel.listGlobalRoomGrants({
      chatId: room.chatId,
      accessToken: room.accessToken,
    });
    expect(grants.some((grant) => grant.participantId === "auth:jane")).toBeTrue();
    expect(grants.some((grant) => grant.participantId === "session:jj")).toBeFalse();
    expect(
      kernel
        .listGlobalRooms({
          actorId: "auth:jane",
        })
        .some((entry) => entry.chatId === room.chatId && entry.focused),
    ).toBeTrue();
    expect(
      kernel
        .listGlobalRooms({
          actorId: "session:jj",
        })
        .some((entry) => entry.chatId === room.chatId),
    ).toBeFalse();

    await kernel.stop();
  });

  test("Scenario: Given a superadmin-created room When the kernel materializes the room Then the creator also becomes a durable admin user seat", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const room = await kernel.createGlobalRoom({
      title: "Creator admin seat",
      superadminActorId: "auth:creator",
      focus: false,
      initialUsers: [
        {
          actorId: "session:jj",
          label: "JJ",
          role: "member",
          focused: true,
        },
      ],
    });

    expect(room.participants).toEqual([{ id: "auth:creator" }, { id: "session:jj", label: "JJ" }]);
    const grants = kernel.listGlobalRoomGrants({
      chatId: room.chatId,
      accessToken: room.accessToken,
    });
    expect(grants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          participantId: "auth:creator",
          role: "admin",
        }),
        expect.objectContaining({
          participantId: "session:jj",
          role: "member",
        }),
      ]),
    );
    expect(
      kernel
        .listGlobalRooms({
          actorId: "auth:creator",
        })
        .some((entry) => entry.chatId === room.chatId && entry.accessRole === "admin" && entry.focused === false),
    ).toBeTrue();

    await kernel.stop();
  });

  test("Scenario: Given a legacy primary room participant list When the kernel reattaches to that room Then the stored room truth is repaired", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({ cwd: process.cwd(), name: "repair-room", autoStart: false });
    const room = await kernel.attachSessionPrimaryRoom(session.id, { focus: false });
    if (!room) {
      throw new Error("expected primary room");
    }

    const db = new MessageDb(resolveMessageControlDbPath(join(root, ".message")));
    try {
      db.updateChannel(room.chatId, {
        participants: [
          { id: "avatar:default", label: "Default avatar" },
          { id: "session:observer", label: " Observer " },
          { id: "user", label: "Legacy user" },
        ],
      });
      expect(db.getChannel(room.chatId)?.participants.map((participant) => participant.id)).toEqual([
        "avatar:default",
        "session:observer",
        "user",
      ]);
    } finally {
      db.close();
    }

    const repaired = await kernel.attachSessionPrimaryRoom(session.id, { focus: false });
    expect(repaired?.participants).toEqual([{ id: "session:observer", label: "Observer" }]);

    const repairedDb = new MessageDb(resolveMessageControlDbPath(join(root, ".message")));
    try {
      expect(repairedDb.getChannel(room.chatId)?.participants).toEqual([{ id: "session:observer", label: "Observer" }]);
    } finally {
      repairedDb.close();
    }

    await kernel.stop();
  });
});
