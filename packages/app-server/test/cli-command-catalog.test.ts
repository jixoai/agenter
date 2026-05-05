import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InMemoryFs } from "just-bash";

import { buildWorkspaceCliCommandCatalog, createWorkspaceHelpcenterCommand } from "../src/cli-command-catalog";
import { resolveWorkspaceAvatarAssetRoot, resolveWorkspacePublicAssetRoot } from "../src/workspace-system";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const createTempRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "agenter-cli-catalog-"));
  tempDirs.push(root);
  return root;
};

const createCommandContext = () => ({
  fs: new InMemoryFs(),
  cwd: "/",
  env: new Map<string, string>(),
  stdin: "",
});

describe("Feature: workspace CLI command catalog", () => {
  test("Scenario: Given registered and legacy workspace tools When the browser catalog is built Then builtins runtime CLI and workspace tool groups share one structured truth source", async () => {
    const root = createTempRoot();
    const workspacePath = join(root, "workspace-a");
    const avatar = "architect";
    const publicToolsRoot = resolveWorkspacePublicAssetRoot(workspacePath, "tools");
    const privateToolsRoot = resolveWorkspaceAvatarAssetRoot(workspacePath, avatar, "tools");
    mkdirSync(publicToolsRoot, { recursive: true });
    mkdirSync(privateToolsRoot, { recursive: true });

    writeFileSync(join(publicToolsRoot, "review.sh"), "#!/usr/bin/env bash\necho review\n");
    writeFileSync(
      join(publicToolsRoot, "review.sh.cli.json"),
      JSON.stringify({
        name: "Review workspace",
        description: "Run the shared workspace review helper.",
      }),
    );
    writeFileSync(join(privateToolsRoot, "draft.ts"), "#!/usr/bin/env node\nconsole.log('draft')\n");

    const catalog = await buildWorkspaceCliCommandCatalog({
      workspacePath,
      avatar,
      perspective: "browser",
    });

    expect(catalog.groups.map((group) => group.id)).toEqual([
      "just-bash-builtins",
      "root-runtime-cli",
      "workspace-public-tools",
      "workspace-private-tools",
    ]);
    expect(catalog.groups[0]?.entries.some((entry) => entry.commandLabel === "cd")).toBeTrue();
    expect(catalog.groups[1]?.entries.some((entry) => entry.commandLabel === "message send")).toBeTrue();
    expect(catalog.groups[2]?.entries).toEqual([
      expect.objectContaining({
        commandLabel: "tool_review",
        displayName: "Review workspace",
        metadataState: "registered",
      }),
    ]);
    expect(catalog.groups[3]?.entries).toEqual([
      expect.objectContaining({
        commandLabel: "tool_draft",
        displayName: "draft.ts",
        metadataState: "fallback",
      }),
    ]);
  });

  test("Scenario: Given the public workspace helpcenter shell When it lists JSON Then builtins and workspace tool groups are visible without root runtime CLI drift", async () => {
    const root = createTempRoot();
    const workspacePath = join(root, "workspace-a");
    const avatar = "architect";
    const publicToolsRoot = resolveWorkspacePublicAssetRoot(workspacePath, "tools");
    mkdirSync(publicToolsRoot, { recursive: true });
    writeFileSync(join(publicToolsRoot, "review.sh"), "#!/usr/bin/env bash\necho review\n");

    const helpcenter = createWorkspaceHelpcenterCommand({
      workspacePath,
      avatar,
    });
    const result = await helpcenter.execute(["list", "--json"], createCommandContext());

    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      groups: Array<{
        id: string;
        entries: Array<{ commandLabel: string }>;
      }>;
    };
    expect(payload.groups.map((group) => group.id)).toEqual(["just-bash-builtins", "workspace-public-tools"]);
    expect(payload.groups[0]?.entries.some((entry) => entry.commandLabel === "cd")).toBeTrue();
    expect(payload.groups[1]?.entries).toEqual([
      expect.objectContaining({
        commandLabel: "tool_review",
      }),
    ]);
  });
});
