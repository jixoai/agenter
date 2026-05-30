import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  APP_HOSTING_DISABLED_SCORES,
  APP_HOSTING_ENABLED_SCORES,
  APP_HOSTING_SCORE_KEY,
  APP_HOSTING_USER_DISABLED_REASON,
  buildAppBindingMetadata,
  createLocalFirstAppSourcePolicy,
  matchesAppBindingMetadata,
  appAttentionCommitInputSchema,
  appAttentionProjectionSchema,
  appAttentionSettleInputSchema,
  appCommandDescriptorSchema,
  appPrivateTextAssetEnsureInputSchema,
} from "../src";

const repoRoot = join(import.meta.dir, "..", "..", "..");

const listTypeScriptFiles = (root: string): string[] =>
  readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return listTypeScriptFiles(path);
    }
    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });

const readRepoFile = (relativePath: string): string => readFileSync(join(repoRoot, relativePath), "utf8");

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

  test("Scenario: Given avatar-private text assets When ensuring prompt or memory seeds Then seed-if-missing targets stay generic and reusable beyond Shell", () => {
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
        const source = readFileSync(filePath, "utf8");
        for (const token of forbiddenTokens) {
          expect(source).not.toContain(token);
        }
      }
    }
  });
});
