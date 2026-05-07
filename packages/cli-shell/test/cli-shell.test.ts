import { describe, expect, test } from "bun:test";

import {
  CLI_SHELL_DEFAULT_AVATAR,
  bootstrapCliShell,
  buildShellAssistantPromptSeed,
  disableCliShellManagedMode,
  enableCliShellManagedMode,
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
  });

  test("Scenario: Given explicit avatar and session When parsing cli-shell args Then avatar override and shell name normalization stay product-local", () => {
    const parsed = parseCliShellArgs(["@default", "--session=prod", "--host", "127.0.0.2", "--port", "4600"]);
    expect(parsed.avatarNickname).toBe("default");
    expect(parsed.shellName).toBe("shell-prod");
    expect(parsed.host).toBe("127.0.0.2");
    expect(parsed.port).toBe(4600);
    expect(normalizeShellName("shell-2")).toBe("shell-2");
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
    expect(attached.terminal.entry.terminalId).toBe("shell-1");
    expect(attached.room.entry.title).toBe("shell-1");
    expect(attached.room.entry.metadata?.resourceKey).toBe("shell-1");
    expect(attached.promptSeeded).toBe(true);
    expect(attached.memoryFiles.map((file) => file.path)).toEqual(shellAssistantMemoryRoles.map((role) => role.path));
    expect(Array.from(store.privateAssets.keys())).toEqual(
      shellAssistantMemoryRoles.map((role) => `/repo:${CLI_SHELL_DEFAULT_AVATAR}:memory:${role.path}`),
    );
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

    expect(second.terminal.created).toBe(false);
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
    expect(defaultSameShell.terminal.created).toBe(false);
    expect(defaultSameShell.room.created).toBe(false);
    expect(defaultShellTwo.terminal.created).toBe(true);
    expect(defaultShellTwo.room.created).toBe(true);
    expect(store.sessions.size).toBe(2);
    expect(store.terminals.map((entry) => entry.terminalId)).toEqual(["shell-1", "shell-2"]);
    expect(store.focusTerminalCalls).toEqual([["shell-1"], ["shell-1"]]);
    expect(store.rooms.map((entry) => entry.metadata?.resourceKey)).toEqual(["shell-1", "shell-2"]);
    expect(store.rooms.map((entry) => entry.title)).toEqual(["shell-1", "shell-2"]);
    expect(store.focusRoomCalls).toEqual([[shellAssistantFirst.room.entry.chatId], [shellAssistantFirst.room.entry.chatId]]);
    expect(store.terminalGrants.get("shell-1")?.map((grant) => grant.participantId)).toEqual([
      "auth:shell-assistant",
      "auth:default",
    ]);
    expect(store.roomGrants.get(shellAssistantFirst.room.entry.chatId)?.map((grant) => grant.participantId)).toEqual([
      "auth:shell-assistant",
      "auth:default",
    ]);
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
