import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { privateKeyToAccount } from "viem/accounts";

import { AppKernel, appRouter, createTrpcContext } from "../src";

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
    expect(recent.items[0]).toBe(workspaceB);
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
    const channel = listed.items[0];
    expect(channel?.accessRole).toBe("admin");
    if (!channel) {
      throw new Error("expected default chat channel");
    }

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
          { id: `avatar:${channel.owner}`, label: channel.owner, role: "avatar" },
          { id: "user:kzf", label: "kzf", role: "user" },
          { id: "user:gaubee", label: "gaubee", role: "user" },
        ],
      },
    });
    expect(updated.channel.title).toBe("Lunch relay");
    expect(updated.channel.participants.map((participant) => participant.id)).toContain("user:gaubee");

    const issued = await caller.message.issueChannelGrant({
      sessionId,
      chatId: channel.chatId,
      accessToken: channel.accessToken,
      role: "readonly",
      label: "Viewer",
      participantId: "user:gaubee",
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
    expect(rejectedAfterRevoke.reason).toBe("message channel access denied");

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
});
