import { describe, expect, test } from "bun:test";
import type { GlobalRoomActorId, GlobalTerminalActorId } from "@agenter/client-sdk";

import {
  CLI_SHELL_DEFAULT_AVATAR,
  bootstrapCliShell,
  buildShellAssistantPromptSeed,
  disableCliShellManagedMode,
  enableCliShellManagedMode,
  isCliShellMetadataOnlyArgv,
  normalizeShellName,
  parseCliShellArgs,
  shellAssistantMemoryRoles,
} from "../src";
import { FakeCliShellStore } from "./fake-cli-shell-store";

describe("Feature: cli-shell orchestration", () => {
  test("Scenario: Given bare argv When parsing cli-shell args Then the product defaults to shell-assistant on shell-1", () => {
    const parsed = parseCliShellArgs([]);
    expect(parsed.avatarNickname).toBe(CLI_SHELL_DEFAULT_AVATAR);
    expect(parsed.shellName).toBe("shell-1");
    expect(parsed.backend).toBeUndefined();
    expect(parsed.webPort).toBeUndefined();
    expect(parsed.debug).toBe(false);
    expect(parsed.experimentalDynamicRefresh).toBe(false);
  });

  test("Scenario: Given explicit avatar session and backend When parsing cli-shell args Then avatar override shell name normalization and backend truth stay product-local", () => {
    const parsed = parseCliShellArgs([
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

  test("Scenario: Given debug argv When parsing cli-shell args Then debug display is an explicit startup flag", () => {
    expect(parseCliShellArgs(["--debug"]).debug).toBe(true);
    expect(parseCliShellArgs(["--debug=false"]).debug).toBe(false);
  });

  test("Scenario: Given dynamic refresh argv When parsing cli-shell args Then dynamic pacing is explicit and experimental", () => {
    expect(parseCliShellArgs(["--experimental-dynamic-refresh"]).experimentalDynamicRefresh).toBe(true);
    expect(parseCliShellArgs(["--experimental-dynamic-refresh=false"]).experimentalDynamicRefresh).toBe(false);
  });

  test("Scenario: Given launcher-owned daemon env When parsing cli-shell args Then the product consumes daemon context without inventing a local port authority", () => {
    const parsed = parseCliShellArgs([], {
      AGENTER_DAEMON_HOST: "127.0.0.9",
      AGENTER_DAEMON_PORT: "4999",
      AGENTER_AUTH_SERVICE_ENDPOINT: "http://127.0.0.1:4591",
    });
    expect(parsed.host).toBe("127.0.0.9");
    expect(parsed.port).toBe(4999);
    expect(parsed.authServiceEndpoint).toBe("http://127.0.0.1:4591");
  });

  test("Scenario: Given cli-shell web host argv When parsing args Then web mode stays a host flag instead of becoming the default backend mode", () => {
    expect(parseCliShellArgs(["--web"]).webPort).toBe(0);
    expect(parseCliShellArgs(["--web=3210"]).webPort).toBe(3210);
    expect(parseCliShellArgs(["--web", "3211"]).webPort).toBe(3211);
    expect(parseCliShellArgs(["--web", "@default"]).avatarNickname).toBe("default");
    expect(parseCliShellArgs(["--web", "@default"]).webPort).toBe(0);
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
    expect(attached.session.avatar).toBe(CLI_SHELL_DEFAULT_AVATAR);
    expect(attached.shellTruthTerminal.entry.terminalId).toBe("shell-1:terminal-1");
    expect(attached.visibleTerminal.entry.terminalId).toBe("shell-1:terminal-2");
    expect(attached.visibleTerminal.entry.processKind).toBe("product");
    expect(attached.visibleTerminal.entry.metadata?.terminalRuntimeKind).toBe("composed");
    expect(attached.visibleTerminal.entry.metadata?.composedShellTerminalId).toBe("shell-1:terminal-1");
    expect(attached.room.entry.title).toBe("shell-1");
    expect(attached.room.entry.metadata?.resourceKey).toBe("shell-1");
    expect(attached.promptSeeded).toBe(true);
    expect(attached.memoryFiles.map((file) => file.path)).toEqual(shellAssistantMemoryRoles.map((role) => role.path));
    expect(Array.from(store.privateAssets.keys())).toEqual(
      shellAssistantMemoryRoles.map((role) => `/repo:${CLI_SHELL_DEFAULT_AVATAR}:memory:${role.path}`),
    );
  });

  test("Scenario: Given cli-shell bootstraps terminal-2 When inspecting terminal creation Then terminal-2 is a composed product terminal without a shell child command", async () => {
    const store = new FakeCliShellStore();
    const attached = await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    const shellTerminal = store.terminals.find((entry) => entry.terminalId === attached.shellTruthTerminal.entry.terminalId);
    const visibleTerminal = store.terminals.find((entry) => entry.terminalId === attached.visibleTerminal.entry.terminalId);

    expect(shellTerminal?.processKind).toBe("shell");
    expect(shellTerminal?.command).toEqual([process.env.SHELL ?? "bash", "-i"]);
    expect(visibleTerminal?.processKind).toBe("product");
    expect(visibleTerminal?.metadata?.terminalRuntimeKind).toBe("composed");
    expect(visibleTerminal?.metadata?.composedShellTerminalId).toBe(shellTerminal?.terminalId);
    expect(visibleTerminal?.command).not.toEqual(shellTerminal?.command);
    expect(visibleTerminal?.command).toEqual([]);
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
    store.privateAssets.set(memoryKey, { path: "user-model.md", created: false, content: "# user memory\n", mtimeMs: Date.now() });

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

  test("Scenario: Given cli-shell managed mode is enabled and later disabled When the product uses runtime attention and delegation helpers Then hosting facts and delegated authority stay platform-backed", async () => {
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
    expect(enabled.delegation.policy.mode).toBe("write");
    expect(enabled.delegation.provenance.attentionContextId).toBe("ctx-hosting-shell-1");
    expect(enabled.delegation.provenance.terminalLeaseId).toBeDefined();
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
    expect(store.delegations).toHaveLength(1);
    expect(
      store.terminalWriteLeases.find(
        (lease) => lease.terminalId === "shell-1" && lease.participantId === "auth:shell-assistant" && lease.revokedAt === undefined,
      )?.leaseId,
    ).toBe(enabled.delegation.provenance.terminalLeaseId);

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
    expect(disabled.revokedDelegations).toHaveLength(1);
    expect(disabled.revokedDelegations[0]?.status).toBe("revoked");
    expect(store.lastAttentionSettle).toMatchObject({
      contextId: "ctx-hosting-shell-1",
      scores: { hosting: 0 },
      reason: "user_disabled",
      meta: {
        productId: "cli-shell",
        resourceKey: "shell-1",
      },
    });
    expect(
      store.terminalWriteLeases.every(
        (lease) => lease.participantId !== "auth:shell-assistant" || lease.revokedAt !== undefined,
      ),
    ).toBe(true);
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
      ["shell-1:terminal-1"],
      ["shell-1:terminal-2"],
      ["shell-1:terminal-1"],
      ["shell-1:terminal-2"],
      ["shell-1:terminal-1"],
      ["shell-1:terminal-2"],
      ["shell-2:terminal-1"],
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
    expect(store.terminalGrants.get("shell-1:terminal-1")?.map((grant) => grant.participantId)).toEqual([
      shellAssistantFirst.session.avatarPrincipalId as GlobalTerminalActorId,
      defaultSameShell.session.avatarPrincipalId as GlobalTerminalActorId,
    ]);
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
    expect(store.terminalGrants.get("shell-1:terminal-1")?.[0]?.participantId).toBe("auth:shell-assistant");
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
    for (const role of shellAssistantMemoryRoles) {
      expect(prompt).toContain(role.path);
    }
  });
});
