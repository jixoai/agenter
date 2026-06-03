import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

import { createAgenterClient, createRuntimeStore } from "@agenter/client-sdk";

import { startMockModelServer, type MockModelServerHandle } from "../../app-server/test-support/mock-model-server";
import { startTrpcServer, type TrpcServerHandle } from "../../cli/src/trpc-server";
import {
  CLI_SHELL_DEFAULT_AVATAR,
  bootstrapCliShell,
  disableCliShellManagedMode,
  enableCliShellManagedMode,
  readCliShellManagedState,
} from "../src";

const tempDirs: string[] = [];
const handles: TrpcServerHandle[] = [];
const clients: Array<ReturnType<typeof createAgenterClient>> = [];
const stores: Array<ReturnType<typeof createRuntimeStore>> = [];
const mockModelServers: MockModelServerHandle[] = [];

const isPresent = <T>(value: T | null | undefined): value is T => value != null;

const findFreePort = async (): Promise<number> =>
  await new Promise<number>((resolveReady, rejectReady) => {
    const server = createServer();
    server.once("error", rejectReady);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => rejectReady(new Error("failed to allocate port")));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) {
          rejectReady(error);
          return;
        }
        resolveReady(port);
      });
    });
  });

const waitForValue = async <T>(
  read: () => T | null | Promise<T | null>,
  input: {
    label: string;
    timeoutMs?: number;
    pollMs?: number;
  },
): Promise<T> => {
  const deadline = Date.now() + (input.timeoutMs ?? 30_000);
  const pollMs = input.pollMs ?? 50;
  while (Date.now() < deadline) {
    const value = await read();
    if (value !== null) {
      return value;
    }
    await new Promise<void>((resolveReady) => setTimeout(resolveReady, pollMs));
  }
  throw new Error(`timed out waiting for ${input.label}`);
};

const writeMockProviderSettings = (input: { workspacePath: string; baseUrl: string }): void => {
  mkdirSync(join(input.workspacePath, ".agenter"), { recursive: true });
  writeFileSync(
    join(input.workspacePath, ".agenter", "settings.local.json"),
    `${JSON.stringify(
      {
        ai: {
          activeProvider: "mock-live",
          temperature: 0,
          maxToken: 64_000,
          providers: {
            "mock-live": {
              apiStandard: "openai-chat",
              vendor: "mock",
              profile: "compatible",
              model: "mock-loopbus",
              apiKey: "local-test",
              baseUrl: input.baseUrl,
              maxRetries: 0,
              compactThreshold: 0.75,
            },
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
};

const createRuntimeFixture = async (
  input: { mockModelServer?: MockModelServerHandle } = {},
): Promise<{
  workspacePath: string;
  homeDir: string;
  handle: TrpcServerHandle;
  store: ReturnType<typeof createRuntimeStore>;
}> => {
  const root = mkdtempSync(join(tmpdir(), "agenter-cli-shell-integration-"));
  tempDirs.push(root);
  const workspacePath = join(root, "workspace");
  const homeDir = join(root, "home");
  mkdirSync(workspacePath, { recursive: true });
  if (input.mockModelServer) {
    writeMockProviderSettings({
      workspacePath,
      baseUrl: input.mockModelServer.baseUrl,
    });
  }
  const port = await findFreePort();
  const handle = await startTrpcServer({
    host: "127.0.0.1",
    port,
    workspaceCwd: workspacePath,
    globalSessionRoot: join(root, "sessions"),
    homeDir,
  });
  handles.push(handle);

  const client = createAgenterClient({
    wsUrl: `ws://${handle.host}:${handle.port}/trpc`,
  });
  clients.push(client);
  const autoLogin = await client.trpc.auth.autoLogin.mutate();
  if (!autoLogin.ok) {
    throw new Error(`expected daemon auto login to succeed, got ${autoLogin.reason}: ${autoLogin.message}`);
  }
  client.setAuthToken(autoLogin.session.token);

  const store = createRuntimeStore(client);
  stores.push(store);

  return {
    workspacePath,
    homeDir,
    handle,
    store,
  };
};

afterEach(async () => {
  while (stores.length > 0) {
    stores.pop()?.disconnect();
  }
  while (clients.length > 0) {
    clients.pop()?.close();
  }
  while (handles.length > 0) {
    await handles.pop()?.stop();
  }
  while (mockModelServers.length > 0) {
    await mockModelServers.pop()?.stop();
  }
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("Feature: cli-shell real daemon integration", () => {
  test("Scenario: Given a real daemon and an ordinary Avatar name When cli-shell starts with create-avatar and later clear-avatar Then only runtime session context is reset", async () => {
    const fixture = await createRuntimeFixture();

    const first = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: "review-smoke",
      shellName: "shell-smoke",
      createAvatar: true,
    });
    const second = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: "review-smoke",
      shellName: "shell-smoke",
      createAvatar: true,
      clearAvatar: true,
    });

    expect(first.avatar.nickname).toBe("review-smoke");
    expect(first.avatarCreated).toBe(true);
    expect(first.avatar.classify).toBeNull();
    expect(first.promptSeeded).toBe(false);
    expect(first.memoryFiles).toEqual([]);
    expect(second.avatarCreated).toBe(false);
    expect(second.clearedRuntimeSessionIds).toEqual([first.session.id]);
    expect(second.promptSeeded).toBe(false);
    expect(second.memoryFiles).toEqual([]);
    expect(second.shellTruthTerminal.entry.terminalId).toBe(first.shellTruthTerminal.entry.terminalId);
    expect(second.visibleTerminal.entry.terminalId).toBe(first.visibleTerminal.entry.terminalId);
    expect(second.room.entry.chatId).toBe(first.room.entry.chatId);
    expect(second.shellTruthTerminal.created).toBe(false);
    expect(second.visibleTerminal.created).toBe(false);
    expect(second.room.created).toBe(false);
  });

  test("Scenario: Given a real daemon When cli-shell reattaches shell-1, overrides @default, and opens shell-2 Then runtime identity stays avatar-scoped while terminal and room resources stay deduplicated by shell name", async () => {
    const fixture = await createRuntimeFixture();

    const first = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    const reconnect = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    const defaultSameShell = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: "default",
      shellName: "shell-1",
    });
    const defaultShellTwo = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: "default",
      shellName: "shell-2",
    });

    const terminals = await fixture.store.listGlobalTerminals();
    const rooms = await fixture.store.listGlobalRooms();
    const shellOneRoom = rooms.find((entry) => entry.metadata?.resourceKey === "shell-1");
    if (!shellOneRoom) {
      throw new Error("expected shell-1 room");
    }
    const shellAssistantActorId = first.session.avatarPrincipalId;
    if (!shellAssistantActorId) {
      throw new Error("expected shell-assistant principal id");
    }
    const defaultActorId = defaultSameShell.session.avatarPrincipalId;
    if (!defaultActorId) {
      throw new Error("expected default avatar principal id");
    }
    const shellTruthTerminalGrants = await fixture.store.listGlobalTerminalGrants("shell-1:terminal-1");
    const visibleTerminalGrants = await fixture.store.listGlobalTerminalGrants("shell-1:terminal-2");
    const roomGrants = await fixture.store.listGlobalRoomGrants({ chatId: shellOneRoom.chatId });
    const shellTruthGrantActors = shellTruthTerminalGrants
      .map((grant) => grant.participantId)
      .filter(isPresent)
      .map(String);
    const visibleGrantActors = visibleTerminalGrants
      .map((grant) => grant.participantId)
      .filter(isPresent)
      .map(String);
    const roomGrantActors = roomGrants
      .map((grant) => grant.participantId)
      .filter(isPresent)
      .map(String);

    expect(reconnect.session.id).toBe(first.session.id);
    expect(defaultShellTwo.session.id).toBe(defaultSameShell.session.id);
    expect(defaultSameShell.shellTruthTerminal.created).toBe(false);
    expect(defaultSameShell.visibleTerminal.created).toBe(false);
    expect(defaultSameShell.room.created).toBe(false);
    expect(defaultShellTwo.shellTruthTerminal.created).toBe(true);
    expect(defaultShellTwo.visibleTerminal.created).toBe(true);
    expect(defaultShellTwo.room.created).toBe(true);
    expect(terminals.map((entry) => entry.terminalId).sort()).toEqual([
      "shell-1:terminal-1",
      "shell-1:terminal-2",
      "shell-2:terminal-1",
      "shell-2:terminal-2",
    ]);
    expect(
      rooms
        .map((entry) => entry.metadata?.resourceKey)
        .filter(isPresent)
        .sort(),
    ).toEqual(["shell-1", "shell-2"]);
    expect(shellTruthGrantActors).toHaveLength(0);
    expect(visibleGrantActors).toHaveLength(2);
    expect(visibleGrantActors).toContain(shellAssistantActorId);
    expect(visibleGrantActors).toContain(defaultActorId);
    expect(roomGrantActors).toContain(shellAssistantActorId);
    expect(roomGrantActors).toContain(defaultActorId);
  }, 45_000);

  test("Scenario: Given managed mode is enabled on a real daemon When cli-shell reconnects the same avatar and shell Then hosting attention is projected from platform truth", async () => {
    const fixture = await createRuntimeFixture();

    const attached = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    if (!attached.session.avatarPrincipalId) {
      throw new Error("expected shell-assistant principal id");
    }

    const enabled = await enableCliShellManagedMode({
      store: fixture.store,
      sessionId: attached.session.id,
      runtimeId: attached.avatar.runtimeId,
      avatarActorId: attached.avatarActorId,
      shellName: "shell-1",
      terminalId: attached.shellTruthTerminal.entry.terminalId,
      roomId: attached.room.entry.chatId,
      objective: "Watch terminal output and report failures.",
    });
    const projected = await readCliShellManagedState({
      store: fixture.store,
      sessionId: attached.session.id,
      runtimeId: attached.avatar.runtimeId,
      avatarActorId: attached.avatarActorId,
      shellName: "shell-1",
    });
    const reconnect = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });

    expect(enabled.contextId).toBe("ctx-hosting-shell-1");
    expect(projected.hostingActive).toBe(true);
    expect(reconnect.managed.managed).toBe(true);

    const disabled = await disableCliShellManagedMode({
      store: fixture.store,
      sessionId: reconnect.session.id,
      runtimeId: reconnect.avatar.runtimeId,
      avatarActorId: reconnect.avatarActorId,
      shellName: "shell-1",
      terminalId: reconnect.shellTruthTerminal.entry.terminalId,
      roomId: reconnect.room.entry.chatId,
    });
    const afterDisable = await readCliShellManagedState({
      store: fixture.store,
      sessionId: reconnect.session.id,
      runtimeId: reconnect.avatar.runtimeId,
      avatarActorId: reconnect.avatarActorId,
      shellName: "shell-1",
    });

    expect(afterDisable.hostingActive).toBe(false);
    expect(afterDisable.managed).toBe(false);
  }, 45_000);

  test("Scenario: Given a reused shell terminal was previously stopped When cli-shell reattaches the same shell Then app runtime binding bootstraps it back to a readable PTY", async () => {
    const fixture = await createRuntimeFixture();

    const first = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    await fixture.store.stopGlobalTerminal({
      terminalId: first.shellTruthTerminal.entry.terminalId,
    });

    const reconnect = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    const read = await fixture.store.readGlobalTerminal({
      terminalId: reconnect.shellTruthTerminal.entry.terminalId,
      mode: "snapshot",
    });

    expect(reconnect.shellTruthTerminal.created).toBe(false);
    expect(reconnect.shellTruthTerminal.entry.processPhase).toBe("running");
    expect(read.terminalId).toBe("shell-1:terminal-1");
  }, 45_000);

  test("Scenario: Given a stopped shell terminal already exists When cli-shell reattaches with ghostty-native Then the app patches backend launch truth before bootstrap", async () => {
    const fixture = await createRuntimeFixture();

    const first = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    await fixture.store.stopGlobalTerminal({
      terminalId: first.shellTruthTerminal.entry.terminalId,
    });

    const reconnect = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
      backend: "ghostty-native",
    });
    const terminals = await fixture.store.listGlobalTerminals();
    const shellTerminal = terminals.find((entry) => entry.terminalId === "shell-1:terminal-1");

    expect(reconnect.shellTruthTerminal.created).toBe(false);
    expect(reconnect.shellTruthTerminal.entry.backend).toBe("ghostty-native");
    expect(shellTerminal?.backend).toBe("ghostty-native");
    expect(reconnect.shellTruthTerminal.entry.processPhase).toBe("running");
  }, 90_000);

  test("Scenario: Given a running shell terminal already uses xterm When cli-shell reattaches with ghostty-native Then the app surfaces backend mismatch instead of silently attaching", async () => {
    const fixture = await createRuntimeFixture();

    await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });

    await expect(
      bootstrapCliShell({
        store: fixture.store,
        workspacePath: fixture.workspacePath,
        avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
        shellName: "shell-1",
        backend: "ghostty-native",
      }),
    ).rejects.toThrow("terminal backend mismatch");
  }, 45_000);

  test("Scenario: Given avatar catalog principal differs from session principal on a real daemon When cli-shell binds shell-1 Then runtime-visible grants and focus follow the session actor truth", async () => {
    const fixture = await createRuntimeFixture();

    const first = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    await fixture.store.hydrateSessionArtifacts(first.session.id, {
      includeChatHistory: false,
      observabilityMode: "heartbeat",
    });
    const runtime = fixture.store.getRuntime(first.session.id);
    const shellTruthTerminalGrants = await fixture.store.listGlobalTerminalGrants("shell-1:terminal-1");
    const visibleTerminalGrants = await fixture.store.listGlobalTerminalGrants("shell-1:terminal-2");

    expect(first.avatar.avatarPrincipalId).not.toBe(first.session.avatarPrincipalId);
    const sessionActorId = first.session.avatarPrincipalId;
    expect(sessionActorId).toBeTruthy();
    expect(first.avatarActorId).toBe(sessionActorId as typeof first.avatarActorId);
    expect(shellTruthTerminalGrants.some((grant) => grant.participantId === sessionActorId)).toBe(false);
    expect(visibleTerminalGrants.some((grant) => grant.participantId === sessionActorId)).toBe(true);
    expect(runtime?.focusedTerminalIds).toEqual(["shell-1:terminal-2"]);
  }, 45_000);

  test("Scenario: Given a fresh shell-assistant session When a MessageRoom message wakes the runtime Then the first model request uses the principal-root Shell Assistant prompt", async () => {
    const mockModelServer = await startMockModelServer();
    mockModelServers.push(mockModelServer);
    const fixture = await createRuntimeFixture({ mockModelServer });

    const attached = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    const avatarPrincipalId = attached.session.avatarPrincipalId;
    if (!avatarPrincipalId) {
      throw new Error("expected shell-assistant session principal id");
    }
    await fixture.store.connect();
    await fixture.store.hydrateSessionArtifacts(attached.session.id, {
      includeChatHistory: false,
      observabilityMode: "heartbeat",
    });

    const promptPath = join(
      fixture.workspacePath,
      ".agenter",
      "avatars",
      "by-principal",
      avatarPrincipalId,
      "AGENTER.mdx",
    );
    const stalePrincipalRoot = join(
      fixture.homeDir,
      ".agenter",
      "avatars",
      "by-principal",
      "0x0000000000000000000000000000000000000bad",
    );
    const nicknameAliasPath = join(fixture.homeDir, ".agenter", "avatars", "by-nickname", CLI_SHELL_DEFAULT_AVATAR);
    expect(existsSync(promptPath)).toBe(true);
    const promptContent = readFileSync(promptPath, "utf8");
    expect(promptContent).toContain("the visible app world is the current Terminal instance plus its MessageRoom");
    expect(promptContent).toContain("Do not run an equivalent command in `root_bash` or `workspace_bash`");
    rmSync(nicknameAliasPath, { recursive: true, force: true });
    mkdirSync(stalePrincipalRoot, { recursive: true });
    writeFileSync(
      join(stalePrincipalRoot, "AGENTER.mdx"),
      "# stale nickname prompt\n\nroot workspace is the visible shell.\n",
      "utf8",
    );
    symlinkSync(relative(dirname(nicknameAliasPath), stalePrincipalRoot), nicknameAliasPath, "dir");

    const send = await fixture.store.sendGlobalRoomMessage({
      chatId: attached.room.entry.chatId,
      accessToken: attached.room.entry.accessToken,
      text: "请看一下当前 Terminal 里发生了什么，不要去 root workspace 另开命令。",
    });
    expect(send).toEqual({ ok: true });

    const request = await waitForValue(
      () => mockModelServer.requests.find((candidate) => (candidate.tools?.length ?? 0) > 0) ?? null,
      {
        label: "cli-shell model request",
        timeoutMs: 45_000,
      },
    );
    const systemPrompt = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content ?? "")
      .join("\n");

    expect(systemPrompt).toContain("the visible app world is the current Terminal instance plus its MessageRoom");
    expect(systemPrompt).toContain(
      "Treat any MessageRoom conversation as being about the TerminalSystem instance bound to that cli-shell room by default",
    );
    expect(systemPrompt).toContain("Do not run an equivalent command in `root_bash` or `workspace_bash`");
    expect(systemPrompt).not.toContain("root workspace is the visible shell");
  }, 60_000);
});
