import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import type { MessageControlPlane } from "@agenter/message-system";
import type { TerminalControlPlane } from "@agenter/terminal-system";
import { AppKernel, SessionDb, appRouter, createTrpcContext } from "../src";

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-trpc-router-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const ROOT_AUTH_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f094538c5f1b6f6db1d4c4a2a2d5f6b7c8d9e0f1";

describe("Feature: app-server trpc procedures", () => {
  test("Scenario: Given caller creates session When listing and deleting Then lifecycle is reflected", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    const caller = appRouter.createCaller(await createTrpcContext(kernel));

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

  test("Scenario: Given app-server owns a managed local profile-service child When auth bootstrap is requested Then descriptor flags and reveal payload stay aligned", async () => {
    const root = makeTempDir();
    const expectedAuthId = privateKeyToAccount(ROOT_AUTH_PRIVATE_KEY).address.toLowerCase();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      profileService: {
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
    });

    const revealed = await caller.auth.bootstrapManagedKey();
    expect(revealed).toEqual({
      privateKey: ROOT_AUTH_PRIVATE_KEY,
      authId: expectedAuthId,
      rootAuthKeyPath: descriptor.rootAuthKeyPath,
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
    const caller = appRouter.createCaller(await createTrpcContext(kernel));

    const account = privateKeyToAccount(generatePrivateKey());
    const authId = account.address.toLowerCase();
    const challenge = await caller.auth.challengeStart({ authId });
    const signature = await account.signMessage({ message: challenge.challengeText });
    await caller.auth.challengeVerify({
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
    const caller = appRouter.createCaller(await createTrpcContext(kernel));

    const initialCatalog = await caller.avatar.catalog();
    expect(initialCatalog.items.some((item) => item.nickname === "default")).toBeTrue();
    const defaultEntry = initialCatalog.items.find((item) => item.nickname === "default");
    expect(defaultEntry).toMatchObject({
      avatarPrincipalId: expect.any(String),
      displayName: "Default",
      classify: null,
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
    const caller = appRouter.createCaller(await createTrpcContext(kernel));

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
    const caller = appRouter.createCaller(await createTrpcContext(kernel));

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
    const caller = appRouter.createCaller(await createTrpcContext(kernel));

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
    expect(rejectedAfterRevoke.reason).toBe("message room credential-invalid");

    await kernel.stop();
  });

  test("Scenario: Given global room routes When creating paging granting and archiving Then the room stays independent from any session route", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const caller = appRouter.createCaller(await createTrpcContext(kernel));
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
    expect(snapshot.items.some((item) => item.content === "hello ops")).toBeTrue();
    const sentMessage = snapshot.items.find((item) => item.content === "hello ops");
    expect(sentMessage?.visibleAt).toBe(sentMessage?.createdAt);
    const relay = await caller.message.globalIssueGrant({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      participantId: "session:ops-relay",
      label: "Ops relay",
    });

    const relayRead = await caller.message.globalMarkRead({
      chatId: room.chatId,
      accessToken: relay.grant.accessToken,
      messageId: sentMessage?.messageId,
    });
    expect(relayRead.channel.readProgress).toMatchObject({
      latestVisibleMessageId: sentMessage?.messageId,
      totalSeatCount: 1,
      readSeatCount: 1,
      unreadSeatCount: 0,
    });

    const page = await caller.message.globalPage({
      chatId: room.chatId,
      accessToken: room.accessToken,
      limit: 20,
    });
    expect(page.items.some((item) => item.content === "hello ops")).toBeTrue();

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

  test("Scenario: Given seat-backed room reads When seat token and superadmin both mark the same room Then durable read progress only advances for real room seats", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      profileService: {
        rootAuthPrivateKey: ROOT_AUTH_PRIVATE_KEY,
      },
    });
    await kernel.start();

    const caller = appRouter.createCaller(await createTrpcContext(kernel));
    const descriptor = await caller.auth.service();
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
    const superadminCaller = appRouter.createCaller(
      await createTrpcContext({
        kernel,
        authorizationHeader: `Bearer ${session.token}`,
      }),
    );

    const created = await caller.message.globalCreate({
      kind: "room",
      title: "Read state room",
      focus: false,
    });
    const room = created.channel;
    const relay = await caller.message.globalIssueGrant({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      participantId: "session:relay",
      label: "Relay",
    });
    const viewer = await caller.message.globalIssueGrant({
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

    const snapshot = await caller.message.globalSnapshot({
      chatId: room.chatId,
      accessToken: room.accessToken,
      limit: 20,
    });
    const latestMessageId = snapshot.items[0]?.messageId;
    if (!latestMessageId) {
      throw new Error("expected latest visible room message");
    }

    const relayRead = await caller.message.globalMarkRead({
      chatId: room.chatId,
      accessToken: relay.grant.accessToken,
      messageId: latestMessageId,
    });
    expect(relayRead.channel.readProgress).toMatchObject({
      latestVisibleMessageId: latestMessageId,
      totalSeatCount: 2,
      readSeatCount: 1,
      unreadSeatCount: 1,
    });
    const relayReadState = relayRead.channel.readStates?.find((state) => state.actorId === "session:relay");
    expect(relayReadState).toMatchObject({
      actorId: "session:relay",
      trackedByLatestVisible: true,
      hasReadLatestVisible: true,
    });

    const superadminRead = await superadminCaller.message.globalMarkRead({
      chatId: room.chatId,
      messageId: latestMessageId,
    });
    expect(superadminRead.channel.readProgress?.readSeatCount).toBe(1);
    expect(
      superadminRead.channel.readStates?.some((state) => state.actorId === `auth:${descriptor.rootAuthId}`),
    ).toBeFalse();

    const viewerRead = await caller.message.globalMarkRead({
      chatId: room.chatId,
      accessToken: viewer.grant.accessToken,
      messageId: latestMessageId,
    });
    expect(viewerRead.channel.readProgress).toMatchObject({
      latestVisibleMessageId: latestMessageId,
      totalSeatCount: 2,
      readSeatCount: 2,
      unreadSeatCount: 0,
    });
    const viewerReadState = viewerRead.channel.readStates?.find((state) => state.actorId === "auth:viewer");
    expect(viewerReadState).toMatchObject({
      actorId: "auth:viewer",
      trackedByLatestVisible: true,
      hasReadLatestVisible: true,
    });

    await kernel.stop();
  });

  test("Scenario: Given a superadmin room send When the projected room still uses the bootstrap control seat Then the durable sender is the authenticated superadmin actor", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      profileService: {
        rootAuthPrivateKey: ROOT_AUTH_PRIVATE_KEY,
      },
    });
    await kernel.start();

    const caller = appRouter.createCaller(await createTrpcContext(kernel));
    const descriptor = await caller.auth.service();
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
    const superadminCaller = appRouter.createCaller(
      await createTrpcContext({
        kernel,
        authorizationHeader: `Bearer ${session.token}`,
      }),
    );

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
    expect(message?.senderActorId).toBe(`auth:${descriptor.rootAuthId}`);

    await kernel.stop();
  });

  test("Scenario: Given global terminal routes When creating granting approving and deleting Then the terminal stays independent from session startup order", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const caller = appRouter.createCaller(await createTrpcContext(kernel));
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
      role: "requester",
      participantId: "session:avatar-pair",
      label: "Pair operator",
    });
    expect(issued.grant.accessToken).toStartWith("termtok_");

    const terminalSystem = Reflect.get(kernel, "terminalControlPlane") as TerminalControlPlane;
    const blocked = await terminalSystem.write({
      terminalId,
      text: "pending approval",
      submit: false,
      actorId: "session:avatar-pair",
      accessToken: issued.grant.accessToken,
    });
    expect(blocked.ok).toBeFalse();
    expect(blocked.approvalRequest?.terminalId).toBe(terminalId);

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
      submit: false,
      returnRead: false,
    });
    expect(allowed.ok).toBeTrue();

    const activity = await caller.terminal.activityPage({
      terminalId,
      limit: 20,
    });
    expect(activity.items.some((item) => item.kind === "terminal_write")).toBeTrue();
    expect(
      activity.items.some((item) => item.kind === "terminal_write" && item.actorId === "session:avatar-pair"),
    ).toBeTrue();

    const focused = await caller.terminal.globalFocus({
      op: "clear",
      terminalIds: [],
    });
    expect(focused.focusedTerminalIds).toEqual([]);

    const deleted = await caller.terminal.globalDelete({
      terminalId,
    });
    expect(deleted.ok).toBeTrue();
    expect((await caller.terminal.globalList()).items.some((item) => item.terminalId === terminalId)).toBeFalse();

    await kernel.stop();
  });

  test("Scenario: Given root auth identity When bearer JWT reaches the router Then superadmin-only procedures resolve through TRPC auth context", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      profileService: {
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
    const caller = appRouter.createCaller(await createTrpcContext(kernel));

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

    expect(page.items.map((group) => group.kind)).toEqual([
      "before-call",
      "call",
      "before-call-pending",
    ]);
    expect(page.items.map((group) => group.groupId)).toEqual([
      `heartbeat-group:before-call:${aiCallId}`,
      `heartbeat-group:call:${aiCallId}`,
      `heartbeat-group:before-call-pending:${aiCallId + 1}`,
    ]);
    expect(page.items[0]?.items.map((row) => row.messageId)).toEqual([
      "request-1",
      "config-1",
      "room-ingress-1",
    ]);
    expect(page.items[1]?.items.map((row) => row.messageId)).toEqual(["response-1"]);
    expect(page.items[2]?.items.map((row) => row.messageId)).toEqual(["config-2"]);

    await kernel.stop();
  });
});
