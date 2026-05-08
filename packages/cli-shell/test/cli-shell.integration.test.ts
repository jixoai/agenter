import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createAgenterClient, createRuntimeStore } from "@agenter/client-sdk";

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

const createRuntimeFixture = async (): Promise<{
  workspacePath: string;
  store: ReturnType<typeof createRuntimeStore>;
}> => {
  const root = mkdtempSync(join(tmpdir(), "agenter-cli-shell-integration-"));
  tempDirs.push(root);
  const workspacePath = join(root, "workspace");
  mkdirSync(workspacePath, { recursive: true });
  const port = await findFreePort();
  const handle = await startTrpcServer({
    host: "127.0.0.1",
    port,
    workspaceCwd: workspacePath,
    globalSessionRoot: join(root, "sessions"),
    homeDir: join(root, "home"),
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

  return {
    workspacePath,
    store: createRuntimeStore(client),
  };
};

afterEach(async () => {
  while (clients.length > 0) {
    clients.pop()?.close();
  }
  while (handles.length > 0) {
    await handles.pop()?.stop();
  }
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("Feature: cli-shell real daemon integration", () => {
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
    const shellAssistantActorId = first.avatar.avatarPrincipalId;
    if (!shellAssistantActorId) {
      throw new Error("expected shell-assistant principal id");
    }
    const defaultActorId = defaultSameShell.avatar.avatarPrincipalId;
    if (!defaultActorId) {
      throw new Error("expected default avatar principal id");
    }
    const terminalGrants = await fixture.store.listGlobalTerminalGrants("shell-1");
    const roomGrants = await fixture.store.listGlobalRoomGrants({ chatId: shellOneRoom.chatId });
    const terminalGrantActors = terminalGrants.map((grant) => grant.participantId).filter(isPresent).map(String);
    const roomGrantActors = roomGrants.map((grant) => grant.participantId).filter(isPresent).map(String);

    expect(reconnect.session.id).toBe(first.session.id);
    expect(defaultShellTwo.session.id).toBe(defaultSameShell.session.id);
    expect(defaultSameShell.terminal.created).toBe(false);
    expect(defaultSameShell.room.created).toBe(false);
    expect(defaultShellTwo.terminal.created).toBe(true);
    expect(defaultShellTwo.room.created).toBe(true);
    expect(terminals.map((entry) => entry.terminalId).sort()).toEqual(["shell-1", "shell-2"]);
    expect(
      rooms
        .map((entry) => entry.metadata?.resourceKey)
        .filter(isPresent)
        .sort(),
    ).toEqual(["shell-1", "shell-2"]);
    expect(terminalGrantActors).toHaveLength(2);
    expect(terminalGrantActors).toContain(shellAssistantActorId);
    expect(terminalGrantActors).toContain(defaultActorId);
    expect(roomGrantActors).toContain(shellAssistantActorId);
    expect(roomGrantActors).toContain(defaultActorId);
  }, 45_000);

  test("Scenario: Given managed mode is enabled on a real daemon When cli-shell reconnects the same avatar and shell Then hosting attention and delegation state are projected from platform truth", async () => {
    const fixture = await createRuntimeFixture();

    const attached = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    if (!attached.avatar.avatarPrincipalId) {
      throw new Error("expected shell-assistant principal id");
    }

    const enabled = await enableCliShellManagedMode({
      store: fixture.store,
      sessionId: attached.session.id,
      runtimeId: attached.avatar.runtimeId,
      avatarActorId: attached.avatar.avatarPrincipalId,
      shellName: "shell-1",
      terminalId: attached.terminal.entry.terminalId,
      roomId: attached.room.entry.chatId,
      objective: "Watch terminal output and report failures.",
    });
    const projected = await readCliShellManagedState({
      store: fixture.store,
      sessionId: attached.session.id,
      runtimeId: attached.avatar.runtimeId,
      avatarActorId: attached.avatar.avatarPrincipalId,
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
    expect(projected.activeDelegation?.status).toBe("active");
    expect(reconnect.managed.managed).toBe(true);

    const disabled = await disableCliShellManagedMode({
      store: fixture.store,
      sessionId: reconnect.session.id,
      runtimeId: reconnect.avatar.runtimeId,
      avatarActorId: reconnect.avatar.avatarPrincipalId ?? attached.avatar.avatarPrincipalId,
      shellName: "shell-1",
      terminalId: reconnect.terminal.entry.terminalId,
      roomId: reconnect.room.entry.chatId,
    });
    const afterDisable = await readCliShellManagedState({
      store: fixture.store,
      sessionId: reconnect.session.id,
      runtimeId: reconnect.avatar.runtimeId,
      avatarActorId: reconnect.avatar.avatarPrincipalId ?? attached.avatar.avatarPrincipalId,
      shellName: "shell-1",
    });

    expect(disabled.revokedDelegations).toHaveLength(1);
    expect(afterDisable.hostingActive).toBe(false);
    expect(afterDisable.activeDelegation).toBeNull();
    expect(afterDisable.managed).toBe(false);
  }, 45_000);

  test("Scenario: Given a reused shell terminal was previously stopped When cli-shell reattaches the same shell Then product runtime binding bootstraps it back to a readable PTY", async () => {
    const fixture = await createRuntimeFixture();

    const first = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    await fixture.store.stopGlobalTerminal({
      terminalId: first.terminal.entry.terminalId,
    });

    const reconnect = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    const read = await fixture.store.readGlobalTerminal({
      terminalId: reconnect.terminal.entry.terminalId,
      mode: "snapshot",
    });

    expect(reconnect.terminal.created).toBe(false);
    expect(reconnect.terminal.entry.processPhase).toBe("running");
    expect(read.terminalId).toBe("shell-1");
  }, 45_000);

  test("Scenario: Given a stopped shell terminal already exists When cli-shell reattaches with ghostty-native Then the product patches backend launch truth before bootstrap", async () => {
    const fixture = await createRuntimeFixture();

    const first = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
    });
    await fixture.store.stopGlobalTerminal({
      terminalId: first.terminal.entry.terminalId,
    });

    const reconnect = await bootstrapCliShell({
      store: fixture.store,
      workspacePath: fixture.workspacePath,
      avatarNickname: CLI_SHELL_DEFAULT_AVATAR,
      shellName: "shell-1",
      backend: "ghostty-native",
    });
    const terminals = await fixture.store.listGlobalTerminals();
    const shellTerminal = terminals.find((entry) => entry.terminalId === "shell-1");

    expect(reconnect.terminal.created).toBe(false);
    expect(reconnect.terminal.entry.backend).toBe("ghostty-native");
    expect(shellTerminal?.backend).toBe("ghostty-native");
    expect(reconnect.terminal.entry.processPhase).toBe("running");
  }, 90_000);

  test("Scenario: Given a running shell terminal already uses xterm When cli-shell reattaches with ghostty-native Then the product surfaces backend mismatch instead of silently attaching", async () => {
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
});
