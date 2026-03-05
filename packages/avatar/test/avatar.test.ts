import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AgenterAvatar, resolveAvatarLayerSettingsPath, resolveAvatarSources } from "../src";

describe("@agenter/avatar", () => {
  test("resolveAvatarSources builds user and project spaces", () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-avatar-"));
    const home = join(root, "home");
    const project = join(root, "project");
    const avatar = resolveAvatarSources({
      nickname: "Jon",
      projectRoot: project,
      homeDir: home,
    });

    expect(avatar.nickname).toBe("jon");
    expect(avatar.sources).toEqual([
      { name: "user", path: join(home, ".agenter", "avatar", "jon") },
      { name: "project", path: join(project, ".agenter", "avatar", "jon") },
    ]);
  });

  test("AgenterAvatar resolves prompt paths by source precedence", () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-avatar-paths-"));
    const userDir = join(root, "user");
    const projectDir = join(root, "project");

    mkdirSync(userDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });

    writeFileSync(join(userDir, "AGENTER_SYSTEM.mdx"), "user-system", "utf8");
    writeFileSync(join(projectDir, "AGENTER_SYSTEM.mdx"), "project-system", "utf8");

    const avatar = new AgenterAvatar({
      nickname: "jon",
      sources: [
        { name: "user", path: userDir },
        { name: "project", path: projectDir },
      ],
    });

    const paths = avatar.resolvePromptPaths();
    expect(paths.AGENTER_SYSTEM).toBe(join(projectDir, "AGENTER_SYSTEM.mdx"));
  });

  test("resolveAvatarLayerSettingsPath builds avatar settings path under source root", () => {
    const path = resolveAvatarLayerSettingsPath("/repo/.agenter/settings.json", "Jon");
    expect(path).toBe("/repo/.agenter/avatar/jon/settings.json");
  });
});
