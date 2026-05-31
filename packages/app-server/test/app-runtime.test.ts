import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveGlobalAvatarCanonicalRoot } from "@agenter/avatar";
import { appAvatarPromptSeedInputSchema, appMemoryPackEnsureInputSchema } from "@agenter/app-runtime";
import { AppKernel, appRouter, createTrpcContext, resolveWorkspaceAvatarAssetRoot } from "../src";

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-app-runtime-"));
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

describe("Feature: app runtime platform contracts", () => {
  test("Scenario: Given app-owned assistant prompt seed When the app runtime route is used Then AGENTER.mdx is created under the avatar principal root and later edits remain truth", async () => {
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

    const first = await caller.appRuntime.ensureAvatarPromptSeed({
      avatarPrincipalId: principalId,
      kind: "agenter",
      seedContent: "# Seeded Shell Assistant\n",
    });
    const promptPath = join(resolveGlobalAvatarCanonicalRoot(principalId, homeDir), "AGENTER.mdx");
    writeFileSync(promptPath, "# User-edited Shell Assistant\n", "utf8");
    const second = await caller.appRuntime.ensureAvatarPromptSeed({
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

  test("Scenario: Given workspace prompt residue exists When app prompt seed runs Then AGENTER.mdx is created under the global avatar root", async () => {
    const root = makeTempDir();
    const homeDir = join(root, "home");
    const workspacePath = join(root, "workspace");
    const principalId = "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66";
    mkdirSync(workspacePath, { recursive: true });
    const workspacePromptPath = join(workspacePath, ".agenter", "avatars", "by-principal", principalId, "AGENTER.mdx");
    mkdirSync(join(workspacePromptPath, ".."), { recursive: true });
    writeFileSync(workspacePromptPath, "# Stale Workspace Shell Assistant\n", "utf8");
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir,
    });
    await kernel.start();
    const caller = await createRootSuperadminCaller(kernel);

    const first = await caller.appRuntime.ensureAvatarPromptSeed({
      avatarPrincipalId: principalId,
      kind: "agenter",
      seedContent: "# Workspace Shell Assistant\n",
    });
    const globalPromptPath = join(resolveGlobalAvatarCanonicalRoot(principalId, homeDir), "AGENTER.mdx");

    expect(first.seeded).toBe(true);
    expect(first.file.path).toBe(globalPromptPath);
    expect(readFileSync(globalPromptPath, "utf8")).toBe("# Workspace Shell Assistant\n");
    expect(readFileSync(workspacePromptPath, "utf8")).toBe("# Stale Workspace Shell Assistant\n");

    await kernel.stop();
  });

  test("Scenario: Given legacy prompt seed input includes workspacePath When parsed Then the app contract rejects the old prompt root field", () => {
    expect(
      appAvatarPromptSeedInputSchema.safeParse({
        avatarPrincipalId: "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66",
        workspacePath: "/repo",
        kind: "agenter",
        seedContent: "# Shell Assistant\n",
      }).success,
    ).toBe(false);
  });

  test("Scenario: Given legacy memory pack seed input includes workspacePath When parsed Then the app contract rejects project workspace authority", () => {
    expect(
      appMemoryPackEnsureInputSchema.safeParse({
        avatarPrincipalId: "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66",
        workspacePath: "/repo",
        avatarNickname: "shell-assistant",
        roles: [{ role: "pairing-playbook", path: "pairing-playbook.md", seedContent: "# Pairing playbook\n" }],
      }).success,
    ).toBe(false);
  });

  test("Scenario: Given app-owned assistant prompt seed targets a non-principal path When the app runtime route is used Then the route rejects it before filesystem mutation", async () => {
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
      caller.appRuntime.ensureAvatarPromptSeed({
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

  test("Scenario: Given app-owned memory roles are seeded for a principal When workspace memory residue exists Then role files are created under the global avatar memory root", async () => {
    const root = makeTempDir();
    const workspace = join(root, "workspace");
    const homeDir = join(root, "home");
    const principalId = "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66";
    mkdirSync(workspace, { recursive: true });
    const workspaceMemoryPath = join(
      resolveWorkspaceAvatarAssetRoot(workspace, "shell-assistant", "memory", homeDir),
      "pairing-playbook.md",
    );
    mkdirSync(join(workspaceMemoryPath, ".."), { recursive: true });
    writeFileSync(workspaceMemoryPath, "# Stale workspace playbook\n", "utf8");

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir,
    });
    await kernel.start();
    const caller = await createRootSuperadminCaller(kernel);

    const first = await caller.appRuntime.ensureAvatarMemoryPack({
      avatarPrincipalId: principalId,
      roles: [
        {
          role: "pairing-playbook",
          path: "pairing-playbook.md",
          seedContent: "# Pairing playbook\n",
        },
      ],
    });
    const globalMemoryPath = join(
      resolveGlobalAvatarCanonicalRoot(principalId, homeDir),
      "memory",
      "pairing-playbook.md",
    );
    writeFileSync(globalMemoryPath, "# User-edited global playbook\n", "utf8");
    const second = await caller.appRuntime.ensureAvatarMemoryPack({
      avatarPrincipalId: principalId,
      roles: [
        {
          role: "pairing-playbook",
          path: "pairing-playbook.md",
          seedContent: "# Replacement playbook\n",
        },
      ],
    });

    expect(first[0]?.created).toBe(true);
    expect(first[0]?.path).toBe(globalMemoryPath);
    expect(readFileSync(workspaceMemoryPath, "utf8")).toBe("# Stale workspace playbook\n");
    expect(second[0]?.created).toBe(false);
    expect(second[0]?.content).toBe("# User-edited global playbook\n");

    await kernel.stop();
  });

  test("Scenario: Given app-owned memory role path tries to escape When the app runtime route is used Then the route rejects it before filesystem mutation", async () => {
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

    await expect(
      caller.appRuntime.ensureAvatarMemoryPack({
        avatarPrincipalId: principalId,
        roles: [
          {
            role: "pairing-playbook",
            path: "../pairing-playbook.md",
            seedContent: "# Pairing playbook\n",
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    await kernel.stop();
  });

  test("Scenario: Given app runtime routes When inspected Then app delegation is not exposed as terminal authority", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    const caller = await createRootSuperadminCaller(kernel);

    expect(typeof caller.appRuntime.ensureAvatarPromptSeed).toBe("function");

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
