import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AppKernel, appRouter, createTrpcContext, resolveWorkspaceAvatarAssetRoot } from "../src";

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-product-runtime-"));
  tempDirs.push(dir);
  return dir;
};

const settleFilesystem = async (): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, 25));
};

afterEach(async () => {
  await settleFilesystem();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const createRootSuperadminCaller = async (kernel: AppKernel) => {
  const anonymousCaller = appRouter.createCaller(await createTrpcContext(kernel));
  const autoLogin = await anonymousCaller.auth.autoLogin();
  if (!autoLogin.ok) {
    throw new Error(`expected daemon auto login to succeed, got ${autoLogin.reason}: ${autoLogin.message}`);
  }
  return appRouter.createCaller(
    await createTrpcContext({
      kernel,
      authorizationHeader: `Bearer ${autoLogin.session.token}`,
    }),
  );
};

describe("Feature: product extension runtime platform contracts", () => {
  test("Scenario: Given a missing avatar-private text asset When the workspace route ensures it twice Then seeding happens only once and later user edits remain intact", async () => {
    const root = makeTempDir();
    const workspace = join(root, "workspace");
    const homeDir = join(root, "home");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir,
    });
    await kernel.start();
    const caller = await createRootSuperadminCaller(kernel);

    const first = await caller.workspace.ensurePrivateTextAsset({
      workspacePath: workspace,
      avatarNickname: "shell-assistant",
      assetKind: "memory",
      relativePath: "pairing-playbook.md",
      seedContent: "# Pairing playbook\n",
    });

    const assetPath = join(resolveWorkspaceAvatarAssetRoot(workspace, "shell-assistant", "memory", homeDir), "pairing-playbook.md");
    writeFileSync(assetPath, "# User-edited playbook\n", "utf8");

    const second = await caller.workspace.ensurePrivateTextAsset({
      workspacePath: workspace,
      avatarNickname: "shell-assistant",
      assetKind: "memory",
      relativePath: "pairing-playbook.md",
      seedContent: "# Replacement playbook\n",
    });

    expect(first.created).toBe(true);
    expect(first.content).toBe("# Pairing playbook\n");
    expect(second.created).toBe(false);
    expect(second.content).toBe("# User-edited playbook\n");
    expect(readFileSync(assetPath, "utf8")).toBe("# User-edited playbook\n");

    await kernel.stop();
  });

  test("Scenario: Given product delegations are created listed and revoked When the generic route is used Then durable lease facts keep product provenance and revocation separate from terminal authority", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    const caller = await createRootSuperadminCaller(kernel);

    const created = await caller.productExtension.createDelegation({
      productId: "cli-shell",
      resourceKey: "shell-1",
      runtimeId: "runtime-shell-assistant",
      avatarActorId: "auth:shell-assistant",
      grantedByActorId: "auth:user",
      terminalId: "shell-1",
      roomId: "room-shell-1",
      enabledAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      policy: { mode: "write" },
      provenance: {
        source: "product-extension-runtime",
        attentionContextId: "ctx-hosting-shell-1",
      },
    });
    const active = await caller.productExtension.listDelegations({
      productId: "cli-shell",
    });
    const revoked = await caller.productExtension.revokeDelegation({
      delegationId: created.delegation.delegationId,
      revokedAt: 20,
      revokedReason: "user_disabled",
    });
    const withRevoked = await caller.productExtension.listDelegations({
      productId: "cli-shell",
      includeRevoked: true,
    });

    expect(created.delegation.status).toBe("active");
    expect(active.items.map((record) => record.delegationId)).toEqual([created.delegation.delegationId]);
    expect(revoked.delegation.status).toBe("revoked");
    expect(revoked.delegation.provenance.attentionContextId).toBe("ctx-hosting-shell-1");
    expect(withRevoked.items[0]?.revokedReason).toBe("user_disabled");

    await kernel.stop();
  });

  test("Scenario: Given a self-evolution attention context When runtime commit and settle are called Then hosting is not required and terminal delegations are not created implicitly", async () => {
    const root = makeTempDir();
    const workspace = join(root, "workspace");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    const caller = await createRootSuperadminCaller(kernel);

    const session = await caller.session.create({
      cwd: workspace,
      avatar: "shell-assistant",
      autoStart: true,
    });

    await caller.runtime.attentionCommit({
      sessionId: session.session.id,
      contextId: "ctx-self-evolution",
      summary: "Recorded a learned user preference.",
      body: "Prefer route-level evidence before interface narration.",
      scores: {
        reflection: 100,
      },
    });
    const committed = await caller.runtime.attentionState({
      sessionId: session.session.id,
    });
    const queried = await caller.runtime.attentionQuery({
      sessionId: session.session.id,
      query: "minscore:0",
    });
    const noDelegations = await caller.productExtension.listDelegations({
      productId: "cli-shell",
      includeRevoked: true,
    });

    await caller.runtime.attentionSettle({
      sessionId: session.session.id,
      contextId: "ctx-self-evolution",
      summary: "Stored the preference without managed hosting.",
      reason: "reflection_complete",
    });
    const settled = await caller.runtime.attentionState({
      sessionId: session.session.id,
    });

    expect(committed.snapshot.contexts.some((context) => context.contextId === "ctx-self-evolution")).toBe(true);
    expect(queried.items.some((item) => item.contextId === "ctx-self-evolution")).toBe(true);
    expect(noDelegations.items).toEqual([]);
    expect(settled.active.some((context) => context.contextId === "ctx-self-evolution")).toBe(false);

    await kernel.stop();
  });
});
