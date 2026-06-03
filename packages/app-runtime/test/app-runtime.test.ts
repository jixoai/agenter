import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  APP_HOSTING_DISABLED_SCORES,
  APP_HOSTING_ENABLED_SCORES,
  APP_HOSTING_SCORE_KEY,
  APP_HOSTING_USER_DISABLED_REASON,
  BUNDLED_ASSETS_ROOT_ENV,
  appAssistantEnsureInputSchema,
  appAttentionCommitInputSchema,
  appAttentionProjectionSchema,
  appAttentionSettleInputSchema,
  appCommandDescriptorSchema,
  appPrivateTextAssetEnsureInputSchema,
  appRuntimeSessionClearInputSchema,
  buildAppBindingMetadata,
  createLocalFirstAppSourcePolicy,
  matchesAppBindingMetadata,
  resolveBundledAssetPath,
  resolveBundledAssetsRoot,
} from "../src";

const repoRoot = join(import.meta.dir, "..", "..", "..");
const tempDirs: string[] = [];

const listTypeScriptFiles = (root: string): string[] =>
  readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return listTypeScriptFiles(path);
    }
    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });

const readRepoFile = (relativePath: string): string => readFileSync(join(repoRoot, relativePath), "utf8");

const createTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-app-runtime-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() ?? "", { recursive: true, force: true });
  }
});

describe("Feature: app runtime contracts", () => {
  test("Scenario: Given the launcher needs a first-party app descriptor When parsing descriptor data Then local-first resolution and runtime planes stay explicit data", () => {
    const descriptor = appCommandDescriptorSchema.parse({
      appId: "shell",
      command: "shell",
      description: "run Shell terminal workspace",
      packageName: "agenter-app-shell",
      bin: { name: "agenter-shell", mainExport: "runShell" },
      sourcePolicy: createLocalFirstAppSourcePolicy(),
      capabilityHints: {
        interactive: true,
        foregroundProcess: true,
        requiresDaemon: true,
        runtimePlanes: ["launch", "resources", "assistant", "attention"],
      },
    });

    expect(descriptor.sourcePolicy.resolutionOrder).toEqual(["workspace", "installed", "remote"]);
    expect(descriptor.description).toBe("run Shell terminal workspace");
    expect(descriptor.bin.mainExport).toBe("runShell");
    expect(descriptor.capabilityHints.runtimePlanes).not.toContain("delegation");
  });

  test("Scenario: Given Studio is a GUI app When parsing descriptor data Then it reuses the same app runtime law as terminal apps", () => {
    const descriptor = appCommandDescriptorSchema.parse({
      appId: "studio",
      command: "studio",
      packageName: "agenter-app-studio",
      bin: { name: "agenter-studio", mainExport: "runStudio" },
      sourcePolicy: createLocalFirstAppSourcePolicy(),
      capabilityHints: {
        interactive: true,
        foregroundProcess: true,
        requiresDaemon: true,
        runtimePlanes: ["launch", "resources", "assistant", "attention"],
      },
    });

    expect(descriptor.sourcePolicy.resolutionOrder).toEqual(["workspace", "installed", "remote"]);
    expect(descriptor.bin.mainExport).toBe("runStudio");
    expect(descriptor.capabilityHints.runtimePlanes).toContain("launch");
  });

  test("Scenario: Given package identities are inspected When resolving app packages Then Studio and Icon Studio have distinct package atoms", () => {
    const studioPkg = JSON.parse(readRepoFile("apps/studio/package.json")) as { name?: string };
    const iconStudioPkg = JSON.parse(readRepoFile("packages/icon-studio/package.json")) as { name?: string };

    expect(studioPkg.name).toBe("agenter-app-studio");
    expect(iconStudioPkg.name).toBe("@agenter/icon-studio");
  });

  test("Scenario: Given app-owned resource metadata When matching bindings Then app identity stays generic and Shell naming stays outside core law", () => {
    const metadata = buildAppBindingMetadata({
      appId: "shell",
      resourceKey: "shell-1",
      resourceKind: "terminal",
      ownerSystem: "terminal-system",
    });

    expect(matchesAppBindingMetadata(metadata, { appId: "shell", resourceKey: "shell-1" })).toBe(true);
    expect(matchesAppBindingMetadata(metadata, { appId: "shell", resourceKey: "shell-2" })).toBe(false);
  });

  test("Scenario: Given hosting attention helpers When managed mode toggles Then the fixed hosting score and user-disabled reason stay durable runtime law", () => {
    expect(APP_HOSTING_SCORE_KEY).toBe("hosting");
    expect(APP_HOSTING_ENABLED_SCORES).toEqual({ hosting: 1000 });
    expect(APP_HOSTING_DISABLED_SCORES).toEqual({ hosting: 0 });
    expect(APP_HOSTING_USER_DISABLED_REASON).toBe("user_disabled");
  });

  test("Scenario: Given app-owned attention projections When parsing them Then heartbeat unread terminal and lifecycle facts stay app-scoped data", () => {
    const projection = appAttentionProjectionSchema.parse({
      appId: "shell",
      resourceKey: "shell-1",
      runtimeId: "runtime-shell-assistant",
      kind: "heartbeat",
      terminalId: "terminal-shell-1",
      roomId: "room-shell-1",
      heartbeatText: "Waiting for build output.",
      metadata: {
        ownerSystem: "terminal-system",
      },
    });

    expect(projection.kind).toBe("heartbeat");
    expect(projection.heartbeatText).toBe("Waiting for build output.");
  });

  test("Scenario: Given a self-evolution attention loop When the app commits or settles it Then hosting and terminal authority remain optional and separate", () => {
    const commit = appAttentionCommitInputSchema.parse({
      contextId: "ctx-self-evolution",
      summary: "Captured a new user preference for future pairing.",
      body: "Prefer proving behavior with route-level evidence before UI narration.",
    });
    const settled = appAttentionSettleInputSchema.parse({
      contextId: "ctx-self-evolution",
      summary: "Stored the learned preference without enabling managed mode.",
      reason: "reflection_complete",
    });

    expect(commit.scores).toBeUndefined();
    expect(commit.meta).toBeUndefined();
    expect(settled.reason).toBe("reflection_complete");
  });

  test("Scenario: Given explicit workspace-private text assets When ensuring an overlay Then workspace scope stays a tool surface", () => {
    const ensured = appPrivateTextAssetEnsureInputSchema.parse({
      workspacePath: "/repo",
      avatarNickname: "shell-assistant",
      assetKind: "memory",
      relativePath: "pairing-playbook.md",
      seedContent: "# Pairing playbook\n",
    });

    expect(ensured.assetKind).toBe("memory");
    expect(ensured.relativePath).toBe("pairing-playbook.md");
  });

  test("Scenario: Given assistant ensure input includes workspacePath When parsed Then app assistant creation rejects project authority", () => {
    const parsed = appAssistantEnsureInputSchema.safeParse({
      appId: "shell",
      workspacePath: "/repo",
      avatarNickname: "shell-assistant",
      displayName: "Shell Assistant",
      classify: "assistant",
    });

    expect(parsed.success).toBe(false);
  });

  test("Scenario: Given assistant ensure input uses Avatar catalog fields When parsed Then app assistant creation stays project independent", () => {
    const parsed = appAssistantEnsureInputSchema.parse({
      appId: "shell",
      avatarNickname: "shell-assistant",
      displayName: "Shell Assistant",
      classify: "assistant",
    });

    expect(parsed.avatarNickname).toBe("shell-assistant");
  });

  test("Scenario: Given runtime clear input includes workspacePath and avatarNickname When parsed Then project-shaped session authority is rejected", () => {
    const parsed = appRuntimeSessionClearInputSchema.safeParse({
      workspacePath: "/repo",
      avatarNickname: "shell-assistant",
    });

    expect(parsed.success).toBe(false);
  });

  test("Scenario: Given runtime clear input uses principal identity When parsed Then session authority is Avatar-scoped", () => {
    const parsed = appRuntimeSessionClearInputSchema.parse({
      avatarPrincipalId: "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66",
    });

    expect(parsed.avatarPrincipalId).toBe("0x888bb66a5ec389d52df0c9ff3e19a61dec890a66");
  });

  test("Scenario: Given core packages are inspected When checking their source and dependencies Then Shell remains removable without a core implementation import", () => {
    const corePackageJsons = [
      "packages/app-server/package.json",
      "packages/client-sdk/package.json",
      "packages/cli/package.json",
    ] as const;
    for (const relativePath of corePackageJsons) {
      const pkg = JSON.parse(readRepoFile(relativePath)) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      expect(pkg.dependencies?.["agenter-app-shell"]).toBeUndefined();
      expect(pkg.devDependencies?.["agenter-app-shell"]).toBeUndefined();
      expect(pkg.dependencies?.["agenter-app-studio"]).toBeUndefined();
      expect(pkg.devDependencies?.["agenter-app-studio"]).toBeUndefined();
    }

    const coreSourceRoots = ["packages/app-server/src", "packages/client-sdk/src", "packages/cli/src"] as const;
    for (const root of coreSourceRoots) {
      for (const filePath of listTypeScriptFiles(join(repoRoot, root))) {
        const source = readFileSync(filePath, "utf8");
        expect(source).not.toContain('from "agenter-app-shell"');
        expect(source).not.toContain('require("agenter-app-shell")');
        expect(source).not.toContain('from "agenter-app-studio"');
        expect(source).not.toContain('require("agenter-app-studio")');
      }
    }
  });

  test("Scenario: Given core runtime planes are inspected When checking app-specific branches Then Shell grammar layout and terminal naming stay outside core", () => {
    const forbiddenTokens = [
      "--session",
      "@avatar",
      "shell-assistant",
      "shell-1",
      "managed/takeover",
      "toolbar",
      "auto-dream",
    ];
    const sourceRoots = ["packages/app-server/src", "packages/client-sdk/src"] as const;

    for (const root of sourceRoots) {
      for (const filePath of listTypeScriptFiles(join(repoRoot, root))) {
        if (filePath.endsWith("packages/app-server/src/generated/runtime-skill-catalog.generated.ts")) {
          continue;
        }
        const source = readFileSync(filePath, "utf8");
        for (const token of forbiddenTokens) {
          expect(source).not.toContain(token);
        }
      }
    }
  });

  test("Scenario: Given a wrapper exports AGENTER_BUNDLED_ASSETS_ROOT When resolving assets Then env override stays the first published truth", () => {
    const root = createTempDir();
    const assetsRoot = join(root, "wrapper-assets");
    mkdirSync(join(assetsRoot, "auth-service"), { recursive: true });
    writeFileSync(join(assetsRoot, "auth-service", "webauthn-ui"), "ui");

    expect(resolveBundledAssetsRoot({ env: { [BUNDLED_ASSETS_ROOT_ENV]: assetsRoot } })).toBe(assetsRoot);
    expect(resolveBundledAssetPath(["auth-service", "webauthn-ui"], { env: { [BUNDLED_ASSETS_ROOT_ENV]: assetsRoot } }))
      .toBe(join(assetsRoot, "auth-service", "webauthn-ui"));
  });

  test("Scenario: Given a native archive places assets next to the executable When runtime resolves them Then executable-adjacent assets become the fallback truth", () => {
    const root = createTempDir();
    const binaryPath = join(root, "agenter");
    const assetsRoot = join(root, "assets");
    mkdirSync(join(assetsRoot, "i18n-en", "prompts"), { recursive: true });
    writeFileSync(binaryPath, "");
    writeFileSync(join(assetsRoot, "i18n-en", "prompts", "AGENTER.mdx"), "prompt");

    expect(resolveBundledAssetsRoot({ execPath: binaryPath, env: {} })).toBe(realpathSync(assetsRoot));
    expect(resolveBundledAssetPath(["i18n-en", "prompts", "AGENTER.mdx"], { execPath: binaryPath, env: {} })).toBe(
      join(realpathSync(assetsRoot), "i18n-en", "prompts", "AGENTER.mdx"),
    );
  });

  test("Scenario: Given a platform package keeps the binary under bin and assets under package root When runtime resolves them Then parent-sibling assets are supported", () => {
    const root = createTempDir();
    const binaryPath = join(root, "bin", "agenter");
    const assetsRoot = join(root, "assets");
    mkdirSync(join(root, "bin"), { recursive: true });
    mkdirSync(join(assetsRoot, "auth-service"), { recursive: true });
    writeFileSync(binaryPath, "");
    writeFileSync(join(assetsRoot, "auth-service", "webauthn-ui"), "ui");

    expect(resolveBundledAssetsRoot({ execPath: binaryPath, env: {} })).toBe(realpathSync(assetsRoot));
    expect(resolveBundledAssetPath(["auth-service", "webauthn-ui"], { execPath: binaryPath, env: {} })).toBe(
      join(realpathSync(assetsRoot), "auth-service", "webauthn-ui"),
    );
  });
});
