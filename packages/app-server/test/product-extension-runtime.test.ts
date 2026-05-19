import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveGlobalAvatarCanonicalRoot } from "@agenter/avatar";
import {
  AppKernel,
  appRouter,
  createTrpcContext,
  resolveWorkspaceAvatarAssetRoot,
  resolveWorkspaceAvatarCanonicalRoot,
} from "../src";

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
  test("Scenario: Given product-owned assistant prompt seed When the product extension route is used Then AGENTER.mdx is created under the avatar principal root and later edits remain truth", async () => {
    const root = makeTempDir();
    const homeDir = join(root, "home");
    const principalId = "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66";
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir,
    });
    await kernel.start();
    const caller = await createRootSuperadminCaller(kernel);

    const first = await caller.productExtension.ensureAvatarPromptSeed({
      avatarPrincipalId: principalId,
      kind: "agenter",
      seedContent: "# Seeded Shell Assistant\n",
    });
    const promptPath = join(resolveGlobalAvatarCanonicalRoot(principalId, homeDir), "AGENTER.mdx");
    writeFileSync(promptPath, "# User-edited Shell Assistant\n", "utf8");
    const second = await caller.productExtension.ensureAvatarPromptSeed({
      avatarPrincipalId: principalId,
      kind: "agenter",
      seedContent: "# Replacement Shell Assistant\n",
    });

    expect(first.seeded).toBe(true);
    expect(first.file.path).toBe(promptPath);
    expect(second.seeded).toBe(false);
    expect(second.file.content).toBe("# User-edited Shell Assistant\n");
    expect(readFileSync(promptPath, "utf8")).toBe("# User-edited Shell Assistant\n");

    await kernel.stop();
  });

  test("Scenario: Given product-owned assistant prompt seed names a workspace When the product extension route is used Then AGENTER.mdx is created under the workspace principal root", async () => {
    const root = makeTempDir();
    const homeDir = join(root, "home");
    const workspacePath = join(root, "workspace");
    const principalId = "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66";
    mkdirSync(workspacePath, { recursive: true });
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir,
    });
    await kernel.start();
    const caller = await createRootSuperadminCaller(kernel);

    const first = await caller.productExtension.ensureAvatarPromptSeed({
      avatarPrincipalId: principalId,
      workspacePath,
      kind: "agenter",
      seedContent: "# Workspace Shell Assistant\n",
    });
    const promptPath = join(resolveWorkspaceAvatarCanonicalRoot(workspacePath, principalId, homeDir), "AGENTER.mdx");
    const globalPromptPath = join(resolveGlobalAvatarCanonicalRoot(principalId, homeDir), "AGENTER.mdx");

    expect(first.seeded).toBe(true);
    expect(first.file.path).toBe(promptPath);
    expect(readFileSync(promptPath, "utf8")).toBe("# Workspace Shell Assistant\n");
    expect(() => readFileSync(globalPromptPath, "utf8")).toThrow();

    await kernel.stop();
  });

  test("Scenario: Given product-owned assistant prompt seed targets a non-principal path When the product extension route is used Then the route rejects it before filesystem mutation", async () => {
    const root = makeTempDir();
    const homeDir = join(root, "home");
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir,
    });
    await kernel.start();
    const caller = await createRootSuperadminCaller(kernel);

    await expect(
      caller.productExtension.ensureAvatarPromptSeed({
        avatarPrincipalId: "../shell-assistant",
        kind: "agenter",
        seedContent: "# Seeded Shell Assistant\n",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    await kernel.stop();
  });

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

    const assetPath = join(
      resolveWorkspaceAvatarAssetRoot(workspace, "shell-assistant", "memory", homeDir),
      "pairing-playbook.md",
    );
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

  test("Scenario: Given product extension routes When inspected Then product delegation is not exposed as terminal authority", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    const caller = await createRootSuperadminCaller(kernel);

    expect(Object.keys(caller.productExtension)).toEqual(["ensureAvatarPromptSeed"]);

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
    expect(settled.active.some((context) => context.contextId === "ctx-self-evolution")).toBe(false);

    await kernel.stop();
  });
});
