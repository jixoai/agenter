import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AgenterAvatar, resolveAvatarSources } from "../src";

describe("@agenter/avatar", () => {
  test("resolveAvatarSources returns the nickname alias path before a principal root exists", () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-avatar-"));
    const home = join(root, "home");
    const avatar = resolveAvatarSources({
      nickname: "Jon",
      homeDir: home,
    });

    expect(avatar.nickname).toBe("jon");
    expect(avatar.sources).toEqual([
      { name: "user", path: join(home, ".agenter", "avatars", "by-nickname", "jon") },
    ]);
  });

  test("resolveAvatarSources follows nickname aliases to the principal-keyed root", () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-avatar-principal-"));
    const home = join(root, "home");
    const canonicalRoot = join(home, ".agenter", "avatars", "by-principal", "0xabc123");
    const aliasRoot = join(home, ".agenter", "avatars", "by-nickname");
    mkdirSync(canonicalRoot, { recursive: true });
    mkdirSync(aliasRoot, { recursive: true });
    symlinkSync("../by-principal/0xabc123", join(aliasRoot, "jon"), "dir");

    const avatar = resolveAvatarSources({
      nickname: "Jon",
      homeDir: home,
    });

    expect(avatar.sources).toEqual([{ name: "user", path: realpathSync(canonicalRoot) }]);
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
});
