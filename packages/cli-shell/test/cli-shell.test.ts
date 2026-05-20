import type { GlobalRoomActorId, GlobalTerminalActorId } from "@agenter/client-sdk";
import { describe, expect, test } from "bun:test";

import {
  CLI_SHELL_DEFAULT_AVATAR,
  bootstrapCliShell,
  buildShellAssistantPromptSeed,
  cleanupCliShellResources,
  disableCliShellManagedMode,
  enableCliShellManagedMode,
  formatCliShellCleanupResult,
  hasCliShellCleanupFailures,
  isCliShellMetadataOnlyArgv,
  normalizeShellName,
  parseCliShellArgs,
  planCliShellCleanup,
  shellAssistantMemoryRoles,
} from "../src";
import { FakeCliShellStore } from "./fake-cli-shell-store";

const parseAttachArgs = (...args: Parameters<typeof parseCliShellArgs>) => {
  const parsed = parseCliShellArgs(...args);
  if (parsed.command !== "attach") {
    throw new Error("expected attach args");
  }
  return parsed;
};

describe("Feature: cli-shell orchestration", () => {
  test("Scenario: Given bare argv When parsing cli-shell args Then the product defaults to shell-assistant on shell-1", () => {
    const parsed = parseAttachArgs([]);
    expect(parsed.avatarNickname).toBe(CLI_SHELL_DEFAULT_AVATAR);
    expect(parsed.shellName).toBe("shell-1");
    expect(parsed.backend).toBeUndefined();
    expect(parsed.webPort).toBeUndefined();
    expect(parsed.debug).toBe(false);
    expect(parsed.experimentalDynamicRefresh).toBe(false);
    expect(parsed.createAvatar).toBe(false);
    expect(parsed.clearAvatar).toBe(false);
  });

  test("Scenario: Given explicit avatar session and backend When parsing cli-shell args Then avatar override shell name normalization and backend truth stay product-local", () => {
    const parsed = parseAttachArgs([
      "@default",
      "--session=prod",
      "--backend=ghostty-native",
      "--host",
      "127.0.0.2",
      "--port",
      "4600",
    ]);
    expect(parsed.avatarNickname).toBe("default");
    expect(parsed.shellName).toBe("shell-prod");
    expect(parsed.backend).toBe("ghostty-native");
    expect(parsed.host).toBe("127.0.0.2");
    expect(parsed.port).toBe(4600);
    expect(normalizeShellName("shell-2")).toBe("shell-2");
  });

  test("Scenario: Given explicit Avatar startup flags When parsing cli-shell args Then Avatar selection creation and runtime clearing stay separate from shell session", () => {
    const parsed = parseAttachArgs(["--avatar=review-4", "--session=4", "--create-avatar", "--clear-avatar"]);

    expect(parsed.avatarNickname).toBe("review-4");
    expect(parsed.shellName).toBe("shell-4");
    expect(parsed.createAvatar).toBe(true);
    expect(parsed.clearAvatar).toBe(true);
  });

  test("Scenario: Given both Avatar selectors When they disagree Then cli-shell rejects the ambiguous startup before attach", () => {
    expect(() => parseCliShellArgs(["@alpha", "--avatar=bravo"])).toThrow("conflicting avatar selectors");
    expect(parseAttachArgs(["@alpha", "--avatar=alpha"]).avatarNickname).toBe("alpha");
  });

  test("Scenario: Given a rejected Avatar shortcut When parsing cli-shell args Then the system keeps only ordinary Avatar selection", () => {
    expect(() => parseCliShellArgs(["--test-avatar=review-4"])).toThrow("unsupported cli-shell avatar selector");
    expect(() => parseCliShellArgs(["--test-avatar"])).toThrow("unsupported cli-shell avatar selector");
  });

  test("Scenario: Given debug argv When parsing cli-shell args Then debug display is an explicit startup flag", () => {
    expect(parseAttachArgs(["--debug"]).debug).toBe(true);
    expect(parseAttachArgs(["--debug"]).debugFilters).toEqual([]);
    expect(parseAttachArgs(["--debug=false"]).debug).toBe(false);
    expect(parseAttachArgs(["--debug=false"]).debugFilters).toEqual([]);
    expect(parseAttachArgs(["--debug=key,selection,follow"])).toMatchObject({
      debug: true,
      debugFilters: ["key", "selection", "follow"],
    });
    expect(parseAttachArgs(["--debug=*key*,*follow*"])).toMatchObject({
      debug: true,
      debugFilters: ["key", "follow"],
    });
  });

  test("Scenario: Given dynamic refresh argv When parsing cli-shell args Then dynamic pacing is explicit and experimental", () => {
    expect(parseAttachArgs(["--experimental-dynamic-refresh"]).experimentalDynamicRefresh).toBe(true);
    expect(parseAttachArgs(["--experimental-dynamic-refresh=false"]).experimentalDynamicRefresh).toBe(false);
  });

  test("Scenario: Given launcher-owned daemon env When parsing cli-shell args Then the product consumes daemon context without inventing a local port authority", () => {
    const parsed = parseAttachArgs([], {
      AGENTER_DAEMON_HOST: "127.0.0.9",
      AGENTER_DAEMON_PORT: "4999",
      AGENTER_AUTH_SERVICE_ENDPOINT: "http://127.0.0.1:4591",
    });
    expect(parsed.host).toBe("127.0.0.9");
    expect(parsed.port).toBe(4999);
    expect(parsed.authServiceEndpoint).toBe("http://127.0.0.1:4591");
  });

  test("Scenario: Given cli-shell web host argv When parsing args Then web mode stays a host flag instead of becoming the default backend mode", () => {
    expect(parseAttachArgs(["--web"]).webPort).toBe(0);
    expect(parseAttachArgs(["--web=3210"]).webPort).toBe(3210);
    expect(parseAttachArgs(["--web", "3211"]).webPort).toBe(3211);
    expect(parseAttachArgs(["--web", "@default"]).avatarNickname).toBe("default");
    expect(parseAttachArgs(["--web", "@default"]).webPort).toBe(0);
  });

  test("Scenario: Given cleanup argv When parsing cli-shell args Then cleanup is a product-local management command", () => {
    expect(parseCliShellArgs(["cleanup"])).toMatchObject({
      command: "cleanup",
      shellName: undefined,
      confirm: false,
    });
    expect(parseCliShellArgs(["cleanup", "--session=3", "--confirm"])).toMatchObject({
      command: "cleanup",
      shellName: "shell-3",
      confirm: true,
    });
  });

  test("Scenario: Given an unsupported backend flag When parsing cli-shell args Then the product rejects it explicitly", () => {
    expect(() => parseCliShellArgs(["--backend=ghostty-web"])).toThrow("unsupported terminal backend");
  });

  test("Scenario: Given help or version argv When classifying cli-shell execution Then product metadata requests return before attach side effects", () => {
    expect(isCliShellMetadataOnlyArgv(["--help"])).toBe(true);
    expect(isCliShellMetadataOnlyArgv(["@default", "--version"])).toBe(true);
    expect(isCliShellMetadataOnlyArgv(["@default", "--session=2"])).toBe(false);
  });

  test("Scenario: Given shell-assistant is missing When bootstrapping cli-shell Then it ensures avatar runtime prompt memory terminal and room without mutating explicit avatars", async () => {
    const store = new FakeCliShellStore();
    const attached = await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });

    expect(store.authToken).toBe("superadmin-token");
    expect(attached.avatar.nickname).toBe(CLI_SHELL_DEFAULT_AVATAR);
    expect(attached.avatarCreated).toBe(true);
    expect(attached.clearedRuntimeSessionIds).toEqual([]);
    expect(attached.session.avatar).toBe(CLI_SHELL_DEFAULT_AVATAR);
    expect(attached.shellTruthTerminal.entry.terminalId).toBe("shell-1:terminal-1");
    expect(attached.visibleTerminal.entry.terminalId).toBe("shell-1:terminal-2");
    expect(attached.visibleTerminal.entry.processKind).toBe("product");
    expect(attached.visibleTerminal.entry.metadata?.terminalRuntimeKind).toBe("composed");
    expect(attached.visibleTerminal.entry.metadata?.composedShellTerminalId).toBe("shell-1:terminal-1");
    expect(store.terminalGrants.get("shell-1:terminal-1")).toBeUndefined();
    expect(store.terminalGrants.get("shell-1:terminal-2")?.map((grant) => grant.participantId)).toEqual([
      attached.session.avatarPrincipalId as GlobalTerminalActorId,
    ]);
    expect(attached.room.entry.title).toBe("shell-1");
    expect(attached.room.entry.metadata?.resourceKey).toBe("shell-1");
    expect(attached.promptSeeded).toBe(true);
    expect(attached.memoryFiles.map((file) => file.path)).toEqual(shellAssistantMemoryRoles.map((role) => role.path));
    expect(Array.from(store.privateAssets.keys())).toEqual(
      shellAssistantMemoryRoles.map((role) => `/repo:${CLI_SHELL_DEFAULT_AVATAR}:memory:${role.path}`),
    );
  });

  test("Scenario: Given cli-shell resources When cleanup is planned and confirmed Then only product-bound terminals rooms and shell assistant sessions are removed", async () => {
    const store = new FakeCliShellStore();
    await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-2",
    });
    await store.createGlobalTerminal({
      terminalId: "ordinary-terminal",
      metadata: {
        owner: "manual",
      },
    });
    await store.createGlobalRoom({
      chatId: "ordinary-room",
      title: "ordinary",
      metadata: {
        owner: "manual",
      },
    });

    const dryRun = await planCliShellCleanup(store, { shellName: "shell-1" });
    expect(dryRun.targets).toEqual([
      {
        shellName: "shell-1",
        terminalIds: ["shell-1:terminal-1", "shell-1:terminal-2"],
        roomIds: ["room-1"],
      },
    ]);
    expect(dryRun.sessionIds).toEqual([]);

    const result = await cleanupCliShellResources(store, { confirm: true });

    expect(result.deleted.terminals).toEqual([
      "shell-1:terminal-1",
      "shell-1:terminal-2",
      "shell-2:terminal-1",
      "shell-2:terminal-2",
    ]);
    expect(result.deleted.rooms).toEqual(["room-1", "room-2"]);
    expect(result.deleted.sessions).toEqual(["session:/repo:shell-assistant"]);
    expect(store.terminals.map((entry) => entry.terminalId)).toEqual(["ordinary-terminal"]);
    expect(store.rooms.map((entry) => entry.chatId)).toEqual(["ordinary-room"]);
  });

  test("Scenario: Given legacy cli-shell single terminal resources When cleanup is planned Then product metadata still selects them by shell name", async () => {
    const store = new FakeCliShellStore();
    await store.createGlobalTerminal({
      terminalId: "shell-legacy",
      metadata: {
        productId: "cli-shell",
        resourceKey: "shell-legacy",
        ownerSystem: "terminal-system",
      },
    });

    const dryRun = await planCliShellCleanup(store, { shellName: "shell-legacy" });

    expect(dryRun.targets).toEqual([
      {
        shellName: "shell-legacy",
        terminalIds: ["shell-legacy"],
        roomIds: [],
      },
    ]);
  });

  test("Scenario: Given terminal deletion interrupts the daemon When cleanup is confirmed Then rooms and sessions are removed first and remaining terminals are reported", async () => {
    const store = new FakeCliShellStore();
    await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-2",
    });
    const order: string[] = [];
    const originalDeleteRoom = store.deleteGlobalRoom.bind(store);
    const originalDeleteSession = store.deleteSession.bind(store);
    store.deleteGlobalRoom = async (input) => {
      order.push(`room:${input.chatId}`);
      return await originalDeleteRoom(input);
    };
    store.deleteSession = async (sessionId) => {
      order.push(`session:${sessionId}`);
      return await originalDeleteSession(sessionId);
    };
    store.deleteGlobalTerminal = async (input) => {
      order.push(`terminal:${input.terminalId}`);
      if (input.terminalId === "shell-1:terminal-1") {
        throw new Error("Unable to transform response from server");
      }
      return { ok: true, message: "terminal deleted" };
    };

    const result = await cleanupCliShellResources(store, { confirm: true });

    expect(order.slice(0, 3)).toEqual(["room:room-1", "room:room-2", "session:session:/repo:shell-assistant"]);
    expect(order[3]).toBe("terminal:shell-1:terminal-1");
    expect(result.deleted.rooms).toEqual(["room-1", "room-2"]);
    expect(result.deleted.sessions).toEqual(["session:/repo:shell-assistant"]);
    expect(result.failed.terminals).toEqual([
      {
        terminalId: "shell-1:terminal-1",
        message: "Unable to transform response from server",
      },
      {
        terminalId: "shell-1:terminal-2",
        message:
          "cleanup interrupted after terminal deletion disconnected the daemon; rerun cleanup after daemon restart",
      },
      {
        terminalId: "shell-2:terminal-1",
        message:
          "cleanup interrupted after terminal deletion disconnected the daemon; rerun cleanup after daemon restart",
      },
      {
        terminalId: "shell-2:terminal-2",
        message:
          "cleanup interrupted after terminal deletion disconnected the daemon; rerun cleanup after daemon restart",
      },
    ]);
    expect(hasCliShellCleanupFailures(result)).toBe(true);
    expect(formatCliShellCleanupResult(result)).toContain("cli-shell cleanup incomplete");
  });

  test("Scenario: Given cli-shell bootstraps terminal-2 When inspecting terminal creation Then terminal-2 is a composed product terminal without a shell child command", async () => {
    const store = new FakeCliShellStore();
    const attached = await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    const shellTerminal = store.terminals.find(
      (entry) => entry.terminalId === attached.shellTruthTerminal.entry.terminalId,
    );
    const visibleTerminal = store.terminals.find(
      (entry) => entry.terminalId === attached.visibleTerminal.entry.terminalId,
    );

    expect(shellTerminal?.processKind).toBe("shell");
    expect(shellTerminal?.command).toEqual([process.env.SHELL ?? "bash", "-i"]);
    expect(visibleTerminal?.processKind).toBe("product");
    expect(visibleTerminal?.metadata?.terminalRuntimeKind).toBe("composed");
    expect(visibleTerminal?.metadata?.composedShellTerminalId).toBe(shellTerminal?.terminalId);
    expect(visibleTerminal?.command).not.toEqual(shellTerminal?.command);
    expect(visibleTerminal?.command).toEqual([]);
  });

  test("Scenario: Given a legacy Avatar grant on shell-truth terminal When bootstrapping cli-shell Then only the visible terminal remains actor-visible", async () => {
    const store = new FakeCliShellStore();
    await store.createGlobalTerminal({
      terminalId: "shell-1:terminal-1",
      processKind: "shell",
      metadata: {
        productId: "cli-shell",
        resourceKey: "shell-1:terminal-1",
        ownerSystem: "terminal-system",
      },
    });
    await store.issueGlobalTerminalGrant({
      terminalId: "shell-1:terminal-1",
      role: "guard",
      participantId: "auth:shell-assistant",
      label: "legacy shell truth grant",
    });

    const attached = await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });

    expect(attached.shellTruthTerminal.entry.terminalId).toBe("shell-1:terminal-1");
    expect(attached.visibleTerminal.entry.terminalId).toBe("shell-1:terminal-2");
    expect(store.terminalGrants.get("shell-1:terminal-1")).toEqual([]);
    expect(store.terminalGrants.get("shell-1:terminal-2")?.map((grant) => grant.participantId)).toEqual([
      attached.avatarActorId,
    ]);
  });

  test("Scenario: Given prompt and memory already exist When bootstrapping shell-assistant again Then cli-shell keeps user edits and reuses room and terminal resources", async () => {
    const store = new FakeCliShellStore();
    const first = await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    const promptFile = store.promptFiles.get(first.session.id);
    if (!promptFile) {
      throw new Error("missing prompt file");
    }
    store.promptFiles.set(first.session.id, { ...promptFile, content: "# user edited prompt\n", mtimeMs: Date.now() });
    const memoryKey = `/repo:${CLI_SHELL_DEFAULT_AVATAR}:memory:user-model.md`;
    store.privateAssets.set(memoryKey, {
      path: "user-model.md",
      created: false,
      content: "# user memory\n",
      mtimeMs: Date.now(),
    });

    const second = await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });

    expect(second.shellTruthTerminal.created).toBe(false);
    expect(second.visibleTerminal.created).toBe(false);
    expect(second.room.created).toBe(false);
    expect(second.promptSeeded).toBe(false);
    expect(store.promptFiles.get(first.session.id)?.content).toBe("# user edited prompt\n");
    expect(second.memoryFiles.find((file) => file.path === "user-model.md")?.content).toBe("# user memory\n");
  });

  test("Scenario: Given explicit avatar override When bootstrapping cli-shell Then shell-assistant seeds stay untouched and the selected avatar drives runtime identity", async () => {
    const store = new FakeCliShellStore();
    const attached = await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: "default",
      shellName: "shell-2",
    });

    expect(attached.avatar.nickname).toBe("default");
    expect(attached.session.avatar).toBe("default");
    expect(attached.promptSeeded).toBe(false);
    expect(attached.memoryFiles).toEqual([]);
    expect(store.avatars.some((entry) => entry.nickname === CLI_SHELL_DEFAULT_AVATAR)).toBe(false);
  });

  test("Scenario: Given a missing explicit Avatar without create permission When bootstrapping cli-shell Then it fails before runtime terminal or room mutation", async () => {
    const store = new FakeCliShellStore();

    await expect(
      bootstrapCliShell({
        store,
        workspacePath: "/repo",
        avatarNickname: "review-4",
        shellName: "shell-4",
      }),
    ).rejects.toThrow("avatar not found: review-4");

    expect(store.sessions.size).toBe(0);
    expect(store.terminals).toEqual([]);
    expect(store.rooms).toEqual([]);
  });

  test("Scenario: Given a missing explicit Avatar with create permission When bootstrapping cli-shell Then it creates an ordinary Avatar without shell-assistant seeds", async () => {
    const store = new FakeCliShellStore();
    const attached = await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: "review-4",
      shellName: "shell-4",
      createAvatar: true,
    });

    expect(attached.avatar.nickname).toBe("review-4");
    expect(attached.avatarCreated).toBe(true);
    expect(attached.avatar.classify).toBeNull();
    expect(attached.session.avatar).toBe("review-4");
    expect(attached.promptSeeded).toBe(false);
    expect(attached.memoryFiles).toEqual([]);
    expect(store.avatarPromptFiles.size).toBe(0);
    expect(store.privateAssets.size).toBe(0);
    expect(store.avatars.find((entry) => entry.nickname === "review-4")?.displayName).toBe("review-4");
  });

  test("Scenario: Given an explicit Avatar runtime already exists When bootstrapping with clear-avatar Then only runtime session context is deleted before replacement startup", async () => {
    const store = new FakeCliShellStore();
    store.avatars.push({
      ...store.avatars[0]!,
      nickname: "review-4",
      runtimeId: "runtime:review-4",
      displayName: "review-4",
      avatarPrincipalId: "auth:review-4",
    });
    const first = await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: "review-4",
      shellName: "shell-4",
    });
    store.avatarPromptFiles.set("/repo:auth:review-4:agenter", {
      path: "/repo/.agenter/avatars/by-principal/auth:review-4/AGENTER.mdx",
      content: "# Existing review prompt\n",
      mtimeMs: Date.now(),
    });
    store.privateAssets.set("/repo:review-4:memory:user-model.md", {
      path: "user-model.md",
      created: false,
      content: "# Existing review memory\n",
      mtimeMs: Date.now(),
    });

    const second = await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: "review-4",
      shellName: "shell-4",
      clearAvatar: true,
    });

    expect(second.avatarCreated).toBe(false);
    expect(second.clearedRuntimeSessionIds).toEqual([first.session.id]);
    expect(store.deletedSessions).toEqual([first.session.id]);
    expect(second.session.id).toBe(first.session.id);
    expect(second.shellTruthTerminal.created).toBe(false);
    expect(second.visibleTerminal.created).toBe(false);
    expect(second.room.created).toBe(false);
    expect(store.avatars.some((entry) => entry.nickname === "review-4")).toBe(true);
    expect(store.terminals.map((entry) => entry.terminalId)).toEqual(["shell-4:terminal-1", "shell-4:terminal-2"]);
    expect(store.rooms.map((entry) => entry.metadata?.resourceKey)).toEqual(["shell-4"]);
    expect(store.avatarPromptFiles.get("/repo:auth:review-4:agenter")?.content).toBe("# Existing review prompt\n");
    expect(store.privateAssets.get("/repo:review-4:memory:user-model.md")?.content).toBe("# Existing review memory\n");
    expect(second.promptSeeded).toBe(false);
    expect(second.memoryFiles).toEqual([]);
  });

  test("Scenario: Given explicit ghostty-native backend When bootstrapping cli-shell Then the terminal binding carries backend launch truth through the generic product contract", async () => {
    const store = new FakeCliShellStore();
    const attached = await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
      backend: "ghostty-native",
    });

    expect(attached.shellTruthTerminal.entry.backend).toBe("ghostty-native");
    expect(store.terminals.find((entry) => entry.terminalId === "shell-1:terminal-1")?.backend).toBe("ghostty-native");
  });

  test("Scenario: Given a running shell terminal with another backend When bootstrapping cli-shell with ghostty-native Then the mismatch is surfaced instead of silently reusing xterm", async () => {
    const store = new FakeCliShellStore();
    await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });

    await expect(
      bootstrapCliShell({
        store,
        workspacePath: "/repo",
        avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
        shellName: "shell-1",
        backend: "ghostty-native",
      }),
    ).rejects.toThrow("terminal backend mismatch");
  });

  test("Scenario: Given cli-shell managed mode is enabled and later disabled When the product toggles hosting Then only attention state changes and terminal authority is untouched", async () => {
    const store = new FakeCliShellStore();
    store.setAuthToken("superadmin-token");

    const enabled = await enableCliShellManagedMode({
      store,
      sessionId: "session:/repo:shell-assistant",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      shellName: "shell-1",
      terminalId: "shell-1",
      roomId: "room-shell-1",
      objective: "Watch test output and report failures.",
    });

    expect(enabled.contextId).toBe("ctx-hosting-shell-1");
    expect(enabled.grantedByActorId).toBe("auth:root-superadmin");
    expect(store.lastAttentionCommit).toMatchObject({
      contextId: "ctx-hosting-shell-1",
      scores: { hosting: 1000 },
      meta: {
        productId: "cli-shell",
        resourceKey: "shell-1",
        terminalId: "shell-1",
        roomId: "room-shell-1",
      },
    });
    expect(store.terminalWriteLeases).toHaveLength(0);

    const disabled = await disableCliShellManagedMode({
      store,
      sessionId: "session:/repo:shell-assistant",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      shellName: "shell-1",
      terminalId: "shell-1",
      roomId: "room-shell-1",
    });

    expect(disabled.contextId).toBe("ctx-hosting-shell-1");
    expect(store.lastAttentionSettle).toMatchObject({
      contextId: "ctx-hosting-shell-1",
      scores: { hosting: 0 },
      reason: "user_disabled",
      meta: {
        productId: "cli-shell",
        resourceKey: "shell-1",
      },
    });
    expect(store.terminalWriteLeases).toHaveLength(0);
  });

  test("Scenario: Given repeated attach and reconnect flows When reusing shell-1 and later opening shell-2 Then runtime identity stays avatar-scoped while terminal and room bindings stay shell-scoped", async () => {
    const store = new FakeCliShellStore();
    const shellAssistantFirst = await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    const shellAssistantReconnect = await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    const defaultSameShell = await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: "default",
      shellName: "shell-1",
    });
    const defaultShellTwo = await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: "default",
      shellName: "shell-2",
    });

    expect(shellAssistantReconnect.session.id).toBe(shellAssistantFirst.session.id);
    expect(defaultShellTwo.session.id).toBe(defaultSameShell.session.id);
    expect(defaultSameShell.shellTruthTerminal.created).toBe(false);
    expect(defaultSameShell.visibleTerminal.created).toBe(false);
    expect(defaultSameShell.room.created).toBe(false);
    expect(defaultShellTwo.shellTruthTerminal.created).toBe(true);
    expect(defaultShellTwo.visibleTerminal.created).toBe(true);
    expect(defaultShellTwo.room.created).toBe(true);
    expect(store.sessions.size).toBe(2);
    expect(store.terminals.map((entry) => entry.terminalId)).toEqual([
      "shell-1:terminal-1",
      "shell-1:terminal-2",
      "shell-2:terminal-1",
      "shell-2:terminal-2",
    ]);
    expect(store.focusTerminalCalls).toEqual([
      ["shell-1:terminal-2"],
      ["shell-1:terminal-2"],
      ["shell-1:terminal-2"],
      ["shell-2:terminal-2"],
    ]);
    expect(store.rooms.map((entry) => entry.metadata?.resourceKey)).toEqual(["shell-1", "shell-2"]);
    expect(store.rooms.map((entry) => entry.title)).toEqual(["shell-1", "shell-2"]);
    expect(store.focusRoomCalls).toEqual([
      [shellAssistantFirst.room.entry.chatId],
      [shellAssistantFirst.room.entry.chatId],
      [shellAssistantFirst.room.entry.chatId],
      [defaultShellTwo.room.entry.chatId],
    ]);
    expect(store.terminalGrants.get("shell-1:terminal-1")).toBeUndefined();
    expect(store.terminalGrants.get("shell-1:terminal-2")?.map((grant) => grant.participantId)).toEqual([
      shellAssistantFirst.session.avatarPrincipalId as GlobalTerminalActorId,
      defaultSameShell.session.avatarPrincipalId as GlobalTerminalActorId,
    ]);
    expect(store.roomGrants.get(shellAssistantFirst.room.entry.chatId)?.map((grant) => grant.participantId)).toEqual([
      shellAssistantFirst.session.avatarPrincipalId as GlobalRoomActorId,
      defaultSameShell.session.avatarPrincipalId as GlobalRoomActorId,
    ]);
  });

  test("Scenario: Given avatar catalog principal diverges from runtime session principal When bootstrapping cli-shell Then bindings follow the ensured session actor instead of the catalog projection", async () => {
    const store = new FakeCliShellStore();
    store.avatars = [
      {
        ...store.avatars[0]!,
        nickname: CLI_SHELL_DEFAULT_AVATAR,
        displayName: "Shell Assistant",
        avatarPrincipalId: "auth:catalog-shell-assistant",
        runtimeId: "runtime:shell-assistant",
      },
    ];
    const attached = await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });

    expect(attached.avatar.avatarPrincipalId).toBe("auth:catalog-shell-assistant");
    expect(attached.session.avatarPrincipalId).toBe("auth:shell-assistant");
    expect(attached.avatarActorId).toBe("auth:shell-assistant");
    expect(store.avatarPromptFiles.get("/repo:auth:shell-assistant:agenter")?.path).toBe(
      "/repo/.agenter/avatars/by-principal/auth:shell-assistant/AGENTER.mdx",
    );
    expect(store.avatarPromptFiles.get("/repo:auth:catalog-shell-assistant:agenter")).toBeUndefined();
    expect(store.promptFiles.get(attached.session.id)?.content).toBe("");
    expect(store.terminalGrants.get("shell-1:terminal-1")).toBeUndefined();
    expect(store.terminalGrants.get("shell-1:terminal-2")?.[0]?.participantId).toBe("auth:shell-assistant");
    expect(store.roomGrants.get(attached.room.entry.chatId)?.[0]?.participantId).toBe("auth:shell-assistant");
  });

  test("Scenario: Given the default shell-assistant prompt seed When inspecting the content Then collaboration variance memory roles and auto-dream remain explicit examples instead of built-in modes", () => {
    const prompt = buildShellAssistantPromptSeed();
    expect(prompt).toContain("senior-led");
    expect(prompt).toContain("requirement-led");
    expect(prompt).toContain("playful or companion-like");
    expect(prompt).toContain("auto-dream");
    expect(prompt).toContain("seed-if-missing user assets");
    expect(prompt).toContain("the visible product world is the current Terminal instance plus its MessageRoom");
    expect(prompt).toContain("Treat any MessageRoom conversation as being about the TerminalSystem instance");
    expect(prompt).toContain("Keep the root workspace hidden from the conversation model");
    expect(prompt).toContain("act on the current room's TerminalSystem instance through terminal APIs");
    expect(prompt).toContain("Do not run an equivalent command in `root_bash` or `workspace_bash`");
    expect(prompt).toContain("Use `workspace_bash` only for explicit one-shot workspace inspection");
    expect(prompt).toContain("Use terminal system commands as the normal bridge to that product world");
    expect(prompt).toContain("Start with `terminal list`");
    expect(prompt).toContain("the current opened Terminal is the focused terminal reported by `terminal list`");
    expect(prompt).toContain("Internal cli-shell implementation terminals are product plumbing");
    expect(prompt).not.toContain("act on the Terminal that belongs to the same cli-shell resource key");
    for (const role of shellAssistantMemoryRoles) {
      expect(prompt).toContain(role.path);
    }
  });
});
