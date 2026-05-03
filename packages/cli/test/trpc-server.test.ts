import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createAgenterClient, type AuthDraftEvent, type AuthKvEvent } from "@agenter/client-sdk";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { startTrpcServer, type TrpcServerHandle } from "../src/trpc-server";
import { readStaticDocumentTitle, resolveCanonicalWebUiAssetRoot } from "../src/webui-static-root";

const tempDirs: string[] = [];
const handles: TrpcServerHandle[] = [];
const clients: Array<ReturnType<typeof createAgenterClient>> = [];

const createWorkspaceRoot = () => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-cli-server-"));
  tempDirs.push(dir);
  const workspace = join(dir, "workspace");
  mkdirSync(workspace, { recursive: true });
  return { dir, workspace };
};

const writeStaticEntry = (staticDir: string, title: string): void => {
  mkdirSync(staticDir, { recursive: true });
  writeFileSync(
    join(staticDir, "200.html"),
    `<!doctype html><html><head><title>${title}</title></head><body>${title}</body></html>`,
  );
};

const writeStaticEnv = (staticDir: string, publicWsUrl: string): void => {
  mkdirSync(join(staticDir, "_app"), { recursive: true });
  writeFileSync(join(staticDir, "_app", "env.js"), `export const env=${JSON.stringify({ PUBLIC_AGENTER_WS_URL: publicWsUrl })}\n`);
};

const createCliLayout = (input: { workspaceCheckout: boolean; workspaceBuild: boolean; packagedAssets: boolean }) => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-cli-layout-"));
  tempDirs.push(dir);

  const cliSourceDir = join(dir, "packages", "cli", "src");
  mkdirSync(cliSourceDir, { recursive: true });

  const workspaceWebUiDir = join(dir, "packages", "webui");
  const workspaceBuildDir = join(workspaceWebUiDir, "build");
  if (input.workspaceCheckout) {
    mkdirSync(workspaceWebUiDir, { recursive: true });
    writeFileSync(join(workspaceWebUiDir, "package.json"), JSON.stringify({ name: "@agenter/webui" }));
  }
  if (input.workspaceBuild) {
    writeStaticEntry(workspaceBuildDir, "workspace build");
  }

  const packagedAssetDir = join(dir, "packages", "cli", "assets", "webui");
  if (input.packagedAssets) {
    writeStaticEntry(packagedAssetDir, "packaged assets");
  }

  return {
    cliSourceDir,
    workspaceBuildDir,
    packagedAssetDir,
  };
};

const waitFor = async (predicate: () => boolean, timeoutMs = 12_000): Promise<void> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("timed out waiting for condition");
};

const createSuperadminClient = async (
  handle: TrpcServerHandle,
): Promise<{ client: ReturnType<typeof createAgenterClient>; authToken: string }> => {
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
    client,
    authToken: autoLogin.session.token,
  };
};

const getSessionRuntime = (handle: TrpcServerHandle, sessionId: string) => {
  const runtimes = Reflect.get(handle.kernel, "runtimes") as Map<string, unknown>;
  const runtime = runtimes.get(sessionId);
  if (!runtime) {
    throw new Error(`missing runtime for session ${sessionId}`);
  }
  return runtime as {
    createRuntimeTerminal: (input: {
      terminalId?: string;
      processKind?: string;
      command?: string[];
      cwd?: string;
      focus?: boolean;
    }) => Promise<{
      ok: boolean;
      message: string;
      terminal?: {
        terminalId: string;
        access?: {
          accessToken?: string;
        };
      };
    }>;
    stopRuntimeTerminal: (terminalId: string) => Promise<{ ok: boolean; message: string }>;
    inviteRuntimeMessageSeat: (input: {
      chatId: string;
      participantId: `0x${string}`;
      seatClass: "readonly" | "member" | "admin";
      authorityUrl?: string;
      accessToken?: string;
    }) => Promise<{
      invitation: {
        descriptor: {
          token: string;
          deepLink?: string;
          httpUrl?: string;
        };
      };
    }>;
    acceptRuntimeMessageSeat: (input: { descriptor: string; authorityUrl?: string }) => Promise<{
      invitation: { resourceId: string };
      access: { accessToken: string; accessRole: string };
    }>;
    inviteRuntimeTerminalSeat: (input: {
      terminalId: string;
      participantId: `0x${string}`;
      seatClass: "RO" | "RW" | "TM";
      authorityUrl?: string;
      accessToken?: string;
    }) => Promise<{
      invitation: {
        descriptor: {
          token: string;
          deepLink?: string;
          httpUrl?: string;
        };
      };
    }>;
    sendRuntimeMessage: (input: { chatId: string; content: string }) => Promise<{ ok: boolean }>;
    acceptRuntimeTerminalSeat: (input: { descriptor: string; authorityUrl?: string }) => Promise<{
      invitation: { resourceId: string };
      access: { accessToken: string; role: string };
    }>;
    writeRuntimeTerminal: (input: { terminalId: string; text: string }) => Promise<{ ok: boolean; message: string }>;
    readRuntimeTerminal: (input: {
      terminalId: string;
      mode?: "auto" | "diff" | "snapshot";
      recordActivity?: boolean;
    }) => Promise<{
      snapshot?: { lines: string[] };
    }>;
  };
};

afterEach(async () => {
  while (clients.length > 0) {
    clients.pop()?.close();
  }
  while (handles.length > 0) {
    const handle = handles.pop();
    if (handle) {
      await handle.stop();
    }
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("Feature: cli server contracts", () => {
  test("Scenario: Given a workspace checkout When resolving the canonical webui root Then the fresh workspace build wins over packaged assets", () => {
    const layout = createCliLayout({
      workspaceCheckout: true,
      workspaceBuild: true,
      packagedAssets: true,
    });

    const resolved = resolveCanonicalWebUiAssetRoot(layout.cliSourceDir);

    expect(resolved.kind).toBe("workspace-build");
    expect(resolved.staticDir).toBe(layout.workspaceBuildDir);
    expect(readStaticDocumentTitle(resolved.staticDir)).toBe("workspace build");
  });

  test("Scenario: Given static web assets with stale build-time env When serving _app env Then the CLI injects the live runtime websocket endpoint", async () => {
    const { dir } = createWorkspaceRoot();
    const staticDir = join(dir, "static");
    writeStaticEntry(staticDir, "runtime env");
    writeStaticEnv(staticDir, "ws://127.0.0.1:19190/trpc");

    const handle = await startTrpcServer({
      host: "127.0.0.1",
      port: 0,
      globalSessionRoot: join(dir, "sessions"),
      workspacesPath: join(dir, "workspaces.yaml"),
      homeDir: join(dir, "home"),
      staticDir,
      publicEnv: {
        PUBLIC_AGENTER_WS_URL: "ws://127.0.0.1:4580/trpc",
      },
    });
    handles.push(handle);

    const response = await fetch(`http://${handle.host}:${handle.port}/_app/env.js`);
    const source = await response.text();

    expect(response.status).toBe(200);
    expect(source).toContain('ws://127.0.0.1:4580/trpc');
    expect(source).not.toContain('ws://127.0.0.1:19190/trpc');
  });

  test("Scenario: Given packaged web assets with stale build-time env When no explicit public websocket URL is configured Then runtime env keeps browser location fallback available", async () => {
    const { dir } = createWorkspaceRoot();
    const staticDir = join(dir, "static");
    writeStaticEntry(staticDir, "runtime env fallback");
    writeStaticEnv(staticDir, "ws://127.0.0.1:19190/trpc");

    const handle = await startTrpcServer({
      host: "127.0.0.1",
      port: 0,
      globalSessionRoot: join(dir, "sessions"),
      workspacesPath: join(dir, "workspaces.yaml"),
      homeDir: join(dir, "home"),
      staticDir,
      publicEnv: {},
    });
    handles.push(handle);

    const response = await fetch(`http://${handle.host}:${handle.port}/_app/env.js`);
    const source = await response.text();

    expect(response.status).toBe(200);
    expect(source).toBe("export const env={}\n");
    expect(source).not.toContain("PUBLIC_AGENTER_WS_URL");
    expect(source).not.toContain("ws://127.0.0.1:19190/trpc");
  });

  test("Scenario: Given a workspace checkout without a build When resolving the canonical webui root Then startup fails fast with rebuild guidance", () => {
    const layout = createCliLayout({
      workspaceCheckout: true,
      workspaceBuild: false,
      packagedAssets: true,
    });

    let error: unknown;
    try {
      resolveCanonicalWebUiAssetRoot(layout.cliSourceDir);
    } catch (caught) {
      error = caught;
    }

    if (!(error instanceof Error)) {
      throw new Error("expected canonical root resolution to throw an Error");
    }

    expect(error.message).toContain("run `bun run build:webui` before `agenter web`");
    expect(error.message).toContain("`packages/cli/assets/webui` is packaging-only in a workspace checkout.");
  });

  test("Scenario: Given a packaged cli install When resolving the canonical webui root Then bundled assets are used", () => {
    const layout = createCliLayout({
      workspaceCheckout: false,
      workspaceBuild: false,
      packagedAssets: true,
    });

    const resolved = resolveCanonicalWebUiAssetRoot(layout.cliSourceDir);

    expect(resolved.kind).toBe("packaged-assets");
    expect(resolved.staticDir).toBe(layout.packagedAssetDir);
    expect(readStaticDocumentTitle(resolved.staticDir)).toBe("packaged assets");
  });

  test("Scenario: Given session asset uploads When posting supported files Then image and file assets are persisted and retrievable", async () => {
    const { dir, workspace } = createWorkspaceRoot();
    const handle = await startTrpcServer({
      host: "127.0.0.1",
      port: 0,
      globalSessionRoot: join(dir, "sessions"),
      workspacesPath: join(dir, "workspaces.yaml"),
      homeDir: join(dir, "home"),
    });
    handles.push(handle);

    const { client, authToken } = await createSuperadminClient(handle);

    const created = await client.trpc.session.create.mutate({
      cwd: workspace,
      autoStart: false,
    });

    const form = new FormData();
    form.append("files", new File([new Uint8Array([137, 80, 78, 71])], "diagram.png", { type: "image/png" }));
    form.append("files", new File(["hello"], "notes.txt", { type: "text/plain" }));
    const uploadResponse = await fetch(
      `http://${handle.host}:${handle.port}/api/sessions/${encodeURIComponent(created.session.id)}/assets`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        body: form,
      },
    );
    const uploadPayload = (await uploadResponse.json()) as {
      ok: boolean;
      items?: Array<{ assetId: string; url: string; mimeType: string }>;
      error?: string;
    };

    expect(uploadResponse.status).toBe(200);
    expect(uploadPayload.ok).toBe(true);
    expect(uploadPayload.items).toHaveLength(2);
    expect(uploadPayload.items?.[0]?.mimeType).toBe("image/png");
    expect(uploadPayload.items?.[1]?.mimeType).toContain("text/plain");

    const asset = uploadPayload.items?.[0];
    if (!asset) {
      throw new Error("expected uploaded asset metadata");
    }

    const mediaUrl = new URL(`http://${handle.host}:${handle.port}${asset.url}`);
    mediaUrl.searchParams.set("authToken", authToken);
    const mediaResponse = await fetch(mediaUrl);
    const mediaBytes = new Uint8Array(await mediaResponse.arrayBuffer());
    expect(mediaResponse.status).toBe(200);
    expect(mediaResponse.headers.get("content-type")).toBe("image/png");
    expect([...mediaBytes]).toEqual([137, 80, 78, 71]);
  });

  test("Scenario: Given cross-origin HTTP tRPC queries When requesting runtime snapshot Then the /trpc prefix is rewritten and CORS headers are present", async () => {
    const { dir } = createWorkspaceRoot();
    const handle = await startTrpcServer({
      host: "127.0.0.1",
      port: 0,
      globalSessionRoot: join(dir, "sessions"),
      workspacesPath: join(dir, "workspaces.yaml"),
      homeDir: join(dir, "home"),
    });
    handles.push(handle);
    const { authToken } = await createSuperadminClient(handle);
    const allowedOrigin = "http://127.0.0.1:4273";

    const response = await fetch(
      `http://${handle.host}:${handle.port}/trpc/runtime.snapshot?batch=1&input=${encodeURIComponent(
        JSON.stringify({ 0: { json: null } }),
      )}`,
      {
        headers: {
          authorization: `Bearer ${authToken}`,
          origin: allowedOrigin,
        },
      },
    );
    const payload = (await response.json()) as Array<{
      result?: {
        data?: {
          json?: {
            version: number;
            sessions: unknown[];
          };
        };
      };
    }>;

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(allowedOrigin);
    expect(payload[0]?.result?.data?.json?.version).toBe(1);
    expect(Array.isArray(payload[0]?.result?.data?.json?.sessions)).toBe(true);
  });

  test("Scenario: Given two agenters on different ports and one shared room When agenter-B shares its terminal to agenter-A Then agenter-A accepts and both sides verify the same terminal collaboration truth", async () => {
    const a = createWorkspaceRoot();
    const b = createWorkspaceRoot();
    const handleA = await startTrpcServer({
      host: "127.0.0.1",
      port: 0,
      globalSessionRoot: join(a.dir, "sessions"),
      workspacesPath: join(a.dir, "workspaces.yaml"),
      homeDir: join(a.dir, "home"),
    });
    handles.push(handleA);
    const handleB = await startTrpcServer({
      host: "127.0.0.1",
      port: 0,
      globalSessionRoot: join(b.dir, "sessions"),
      workspacesPath: join(b.dir, "workspaces.yaml"),
      homeDir: join(b.dir, "home"),
    });
    handles.push(handleB);

    const { client: clientA } = await createSuperadminClient(handleA);
    const { client: clientB } = await createSuperadminClient(handleB);

    const sessionA = await clientA.trpc.session.create.mutate({
      cwd: a.workspace,
      avatar: "avatar-a",
      autoStart: true,
    });
    const sessionB = await clientB.trpc.session.create.mutate({
      cwd: b.workspace,
      avatar: "avatar-b",
      autoStart: true,
    });
    if (!sessionA.session.avatarPrincipalId || !sessionB.session.avatarPrincipalId) {
      throw new Error("expected avatar principals for both servers");
    }

    const roomOnA = await clientA.trpc.message.globalCreate.mutate({
      kind: "room",
      title: "cross-instance-managed-seat",
      initialUsers: [
        {
          actorId: sessionA.session.avatarPrincipalId as `0x${string}`,
          label: "Avatar A",
          role: "member",
          focused: true,
        },
        {
          actorId: sessionB.session.avatarPrincipalId as `0x${string}`,
          label: "Avatar B",
          role: "member",
          focused: true,
        },
      ],
    });

    const runtimeA = getSessionRuntime(handleA, sessionA.session.id);
    const runtimeB = getSessionRuntime(handleB, sessionB.session.id);

    const roomInvitePayload = await runtimeA.inviteRuntimeMessageSeat({
      chatId: roomOnA.channel.chatId,
      participantId: sessionB.session.avatarPrincipalId as `0x${string}`,
      seatClass: "member",
      authorityUrl: `http://${handleA.host}:${handleA.port}`,
    });
    const roomDescriptor =
      roomInvitePayload.invitation?.descriptor.httpUrl ??
      roomInvitePayload.invitation?.descriptor.deepLink ??
      roomInvitePayload.invitation?.descriptor.token;
    if (!roomDescriptor) {
      throw new Error("expected room invitation descriptor");
    }

    const acceptedRoomOnB = await runtimeB.acceptRuntimeMessageSeat({
      descriptor: roomDescriptor,
    });
    expect(acceptedRoomOnB.access.accessRole).toBe("member");

    const bridgeMessage = `bridge-room-${Date.now()}`;
    const sentFromB = await runtimeB.sendRuntimeMessage({
      chatId: roomOnA.channel.chatId,
      content: bridgeMessage,
    });
    expect(sentFromB.ok).toBe(true);

    const roomSnapshot = await clientA.trpc.message.globalSnapshot.query({
      chatId: roomOnA.channel.chatId,
      accessToken: roomOnA.channel.accessToken,
      limit: 10,
    });
    expect(roomSnapshot.items.some((item) => item.content === bridgeMessage)).toBe(true);

    const terminalOnB = await runtimeB.createRuntimeTerminal({
      terminalId: "cross-instance-terminal",
      processKind: "shell",
      command: ["sh", "-lc", "cat"],
      focus: true,
    });
    if (!terminalOnB.ok || !terminalOnB.terminal?.terminalId || !terminalOnB.terminal.access?.accessToken) {
      throw new Error("expected B terminal create to return terminal access");
    }
    const terminalId = terminalOnB.terminal.terminalId;

    const invitePayload = await runtimeB.inviteRuntimeTerminalSeat({
      terminalId,
      participantId: sessionA.session.avatarPrincipalId as `0x${string}`,
      seatClass: "RW",
      authorityUrl: `http://${handleB.host}:${handleB.port}`,
    });
    const descriptor =
      invitePayload.invitation?.descriptor.httpUrl ??
      invitePayload.invitation?.descriptor.deepLink ??
      invitePayload.invitation?.descriptor.token;
    if (!descriptor) {
      throw new Error("expected terminal invitation descriptor");
    }

    const sent = await runtimeB.sendRuntimeMessage({
      chatId: roomOnA.channel.chatId,
      content: descriptor,
    });
    expect(sent.ok).toBe(true);

    const snapshotOnA = await clientA.trpc.message.globalSnapshot.query({
      chatId: roomOnA.channel.chatId,
      accessToken: roomOnA.channel.accessToken,
      limit: 10,
    });
    expect(snapshotOnA.items.some((item) => item.content === descriptor)).toBe(true);

    const accepted = await runtimeA.acceptRuntimeTerminalSeat({
      descriptor,
    });
    expect(accepted.access.role).toBe("writer");

    const marker = `cross-instance-${Date.now()}`;
    const wroteByA = await runtimeA.writeRuntimeTerminal({
      terminalId,
      text: `${marker}\r`,
    });
    expect(wroteByA.ok).toBe(true);

    const readByA = await runtimeA.readRuntimeTerminal({
      terminalId,
      mode: "snapshot",
      recordActivity: false,
    });
    expect(readByA.snapshot?.lines.join("\n")).toContain(marker);

    const readByB = await clientB.trpc.terminal.read.query({
      terminalId,
      accessToken: terminalOnB.terminal.access.accessToken,
      mode: "snapshot",
      recordActivity: false,
    });
    expect(readByB.snapshot?.lines.join("\n")).toContain(marker);

    const stopped = await runtimeB.stopRuntimeTerminal(terminalId);
    expect(stopped.ok).toBe(true);
  }, 30_000);

  test("Scenario: Given app-server starts a child profile-service When the client discovers it Then icon traffic goes to the independent profile endpoint", async () => {
    const { dir, workspace } = createWorkspaceRoot();
    const handle = await startTrpcServer({
      host: "127.0.0.1",
      port: 0,
      globalSessionRoot: join(dir, "sessions"),
      workspacesPath: join(dir, "workspaces.yaml"),
      homeDir: join(dir, "home"),
      profileService: {
        dataDir: join(dir, "profile-service"),
      },
    });
    handles.push(handle);

    const { client } = await createSuperadminClient(handle);

    const created = await client.trpc.session.create.mutate({
      cwd: workspace,
      autoStart: false,
      avatar: "gaubee",
    });

    const profileService = await client.trpc.profile.service.query();
    expect(profileService.endpoint).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(profileService.endpoint).not.toBe(`http://${handle.host}:${handle.port}`);

    const sessionIconResponse = await fetch(
      `${profileService.endpoint}/media/sessions/${encodeURIComponent(created.session.id)}/icon`,
    );
    expect(sessionIconResponse.status).toBe(200);
    expect(sessionIconResponse.headers.get("content-type")).toBe("image/png");

    const profileIconResponse = await fetch(`${profileService.endpoint}/media/profiles/gaubee/icon`);
    expect(profileIconResponse.status).toBe(200);
    expect(profileIconResponse.headers.get("content-type")).toBe("image/png");

    const proxiedSessionIconResponse = await fetch(
      `http://${handle.host}:${handle.port}/media/sessions/${encodeURIComponent(created.session.id)}/icon`,
    );
    expect(proxiedSessionIconResponse.status).toBe(404);

    const uploadResponse = await fetch(
      `${profileService.endpoint}/sessions/${encodeURIComponent(created.session.id)}/icon`,
      {
        method: "POST",
        headers: { "content-type": "image/svg+xml" },
        body: `<svg xmlns="http://www.w3.org/2000/svg"><text x="0" y="10">profile-service</text></svg>`,
      },
    );
    const uploadPayload = (await uploadResponse.json()) as { ok: boolean; iconUrl?: string };
    expect(uploadResponse.status).toBe(200);
    expect(uploadPayload.ok).toBe(true);
    expect(uploadPayload.iconUrl).toBe(
      `${profileService.endpoint}/media/sessions/${encodeURIComponent(created.session.id)}/icon`,
    );

    const uploadedSessionIconResponse = await fetch(
      `${profileService.endpoint}/media/sessions/${encodeURIComponent(created.session.id)}/icon?format=svg`,
    );
    expect(uploadedSessionIconResponse.status).toBe(200);
    expect(uploadedSessionIconResponse.headers.get("content-type")).toContain("image/svg+xml");
    expect(await uploadedSessionIconResponse.text()).toContain("profile-service");
  });

  test("Scenario: Given an authenticated kv subscription When the actor mutates WebUI memory Then websocket replay only delivers that actor's matching keys", async () => {
    const { dir } = createWorkspaceRoot();
    const handle = await startTrpcServer({
      host: "127.0.0.1",
      port: 0,
      globalSessionRoot: join(dir, "sessions"),
      workspacesPath: join(dir, "workspaces.yaml"),
      homeDir: join(dir, "home"),
    });
    handles.push(handle);

    const authClient = createAgenterClient({
      wsUrl: `ws://${handle.host}:${handle.port}/trpc`,
    });
    clients.push(authClient);

    const account = privateKeyToAccount(generatePrivateKey());
    const challenge = await authClient.trpc.auth.challengeStart.mutate({
      authId: account.address.toLowerCase(),
    });
    const session = await authClient.trpc.auth.challengeVerify.mutate({
      challengeId: challenge.challengeId,
      signature: await account.signMessage({ message: challenge.challengeText }),
    });
    const client = createAgenterClient({
      wsUrl: `ws://${handle.host}:${handle.port}/trpc`,
      initialAuthToken: session.token,
    });
    clients.push(client);
    const baseline = await client.trpc.kv.snapshot.query();
    expect(baseline).toEqual({
      lastEventId: 0,
      items: [],
    });

    const first = await client.trpc.kv.set.mutate({
      key: "webui/devtools/tab",
      value: "model",
    });
    expect(first).toMatchObject({
      ok: true,
      changed: true,
      entry: {
        key: "webui/devtools/tab",
        value: "model",
        version: 1,
      },
    });

    await client.trpc.kv.set.mutate({
      key: "webui/workspace/split",
      value: 0.4,
    });
    const removed = await client.trpc.kv.delete.mutate({
      key: "webui/devtools/tab",
      baseVersion: 1,
    });
    expect(removed).toEqual({
      ok: true,
      removed: true,
      eventId: 3,
      key: "webui/devtools/tab",
      version: 2,
    });

    const replayClient = createAgenterClient({
      wsUrl: `ws://${handle.host}:${handle.port}/trpc`,
      initialAuthToken: session.token,
    });
    clients.push(replayClient);
    const received: Array<{
      kind: string;
      key: string;
      version: number;
    }> = [];
    const sub = replayClient.trpc.kv.events.subscribe(
      {
        afterEventId: baseline.lastEventId,
        prefix: "webui/devtools/",
      },
      {
        onData: (event: AuthKvEvent) => {
          received.push({
            kind: event.kind,
            key: event.kind === "set" ? event.entry.key : event.key,
            version: event.kind === "set" ? event.entry.version : event.version,
          });
        },
      },
    );

    await waitFor(() => received.length === 2);
    expect(received).toEqual([
      {
        kind: "set",
        key: "webui/devtools/tab",
        version: 1,
      },
      {
        kind: "delete",
        key: "webui/devtools/tab",
        version: 2,
      },
    ]);

    sub.unsubscribe();
  });

  test("Scenario: Given an authenticated draft subscription When the actor mutates avatar-create drafts Then websocket replay delivers the durable draft lifecycle", async () => {
    const { dir } = createWorkspaceRoot();
    const handle = await startTrpcServer({
      host: "127.0.0.1",
      port: 0,
      globalSessionRoot: join(dir, "sessions"),
      workspacesPath: join(dir, "workspaces.yaml"),
      homeDir: join(dir, "home"),
    });
    handles.push(handle);

    const authClient = createAgenterClient({
      wsUrl: `ws://${handle.host}:${handle.port}/trpc`,
    });
    clients.push(authClient);

    const account = privateKeyToAccount(generatePrivateKey());
    const challenge = await authClient.trpc.auth.challengeStart.mutate({
      authId: account.address.toLowerCase(),
    });
    const session = await authClient.trpc.auth.challengeVerify.mutate({
      challengeId: challenge.challengeId,
      signature: await account.signMessage({ message: challenge.challengeText }),
    });
    const client = createAgenterClient({
      wsUrl: `ws://${handle.host}:${handle.port}/trpc`,
      initialAuthToken: session.token,
    });
    clients.push(client);

    const baseline = await client.trpc.drafts.list.query({
      kind: "avatar_create",
    });
    expect(baseline).toEqual({
      lastEventId: 0,
      items: [],
    });

    const created = await client.trpc.drafts.create.mutate({
      kind: "avatar_create",
      state: {
        nickname: "reviewer",
        sourceAvatarNickname: "default",
      },
    });
    expect(created.entry).toMatchObject({
      kind: "avatar_create",
      version: 1,
    });

    const saved = await client.trpc.drafts.save.mutate({
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
        version: 2,
      },
    });

    const removed = await client.trpc.drafts.delete.mutate({
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

    const replayClient = createAgenterClient({
      wsUrl: `ws://${handle.host}:${handle.port}/trpc`,
      initialAuthToken: session.token,
    });
    clients.push(replayClient);
    const received: Array<{
      kind: string;
      draftId: string;
      version: number;
    }> = [];
    const sub = replayClient.trpc.drafts.events.subscribe(
      {
        afterEventId: baseline.lastEventId,
        kind: "avatar_create",
      },
      {
        onData: (event: AuthDraftEvent) => {
          received.push({
            kind: event.kind,
            draftId: event.kind === "upsert" ? event.entry.draftId : event.draftId,
            version: event.kind === "upsert" ? event.entry.version : event.version,
          });
        },
      },
    );

    await waitFor(() => received.length === 3);
    expect(received).toEqual([
      {
        kind: "upsert",
        draftId: created.entry.draftId,
        version: 1,
      },
      {
        kind: "upsert",
        draftId: created.entry.draftId,
        version: 2,
      },
      {
        kind: "delete",
        draftId: created.entry.draftId,
        version: 3,
      },
    ]);

    sub.unsubscribe();
  });
});
