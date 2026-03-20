import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readGlobalSettingsFile, saveGlobalSettingsFile } from "../src/global-settings";
import {
  buildAvatarIconUrl,
  buildSessionIconUrl,
  createAvatarCatalogItem,
  listUserAvatarNicknames,
  renderAvatarFallbackSvg,
  renderSessionFallbackSvg,
  resolveAvatarForWorkspace,
  resolveAvatarIconFile,
  resolveSessionIconFile,
  writeAvatarIconUpload,
  writeSessionIconUpload,
} from "../src/profile-images";

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-profile-images-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: profile image helpers and global settings", () => {
  test("Scenario: Given a session and avatar identity When rendering fallbacks Then stable semantic svg and media URLs are produced", () => {
    const sessionSvg = renderSessionFallbackSvg({
      sessionId: "session-42",
      workspacePath: "/repo/demo",
      label: "42",
    });
    const avatarSvg = renderAvatarFallbackSvg({
      nickname: "jon",
      label: "J",
    });

    expect(sessionSvg).toContain("<svg");
    expect(sessionSvg).toContain(">42<");
    expect(avatarSvg).toContain("<svg");
    expect(avatarSvg).toContain(">J<");
    expect(buildSessionIconUrl("session-42")).toBe("/media/sessions/session-42/icon");
    expect(buildAvatarIconUrl("jon", "/repo/demo")).toContain("/media/avatars/jon/icon?workspacePath=");
    expect(createAvatarCatalogItem({ nickname: "jon", active: true }).active).toBeTrue();
  });

  test("Scenario: Given uploaded session and avatar icons When resolving them Then helper APIs expose stored files and catalog entries", () => {
    const homeDir = makeTempDir();
    const sessionRoot = join(homeDir, "sessions", "session-42");

    const sessionPath = writeSessionIconUpload(sessionRoot, {
      bytes: new Uint8Array([1, 2, 3]),
      name: "session-icon.webp",
      mimeType: "image/webp",
    });
    expect(existsSync(sessionPath)).toBeTrue();

    const sessionIcon = resolveSessionIconFile(sessionRoot);
    expect(sessionIcon?.mimeType).toBe("image/webp");
    expect(readFileSync(sessionIcon?.filePath ?? "", "utf8").length).toBeGreaterThan(0);

    writeAvatarIconUpload(
      "nova",
      {
        bytes: new Uint8Array([4, 5, 6]),
        name: "avatar-icon.png",
        mimeType: "image/png",
      },
      homeDir,
    );

    const resolvedAvatar = resolveAvatarForWorkspace("/repo/demo", "nova", homeDir);
    const avatarIcon = resolveAvatarIconFile(resolvedAvatar);
    expect(avatarIcon?.mimeType).toBe("image/png");
    expect(listUserAvatarNicknames(homeDir)).toEqual(["nova"]);
  });

  test("Scenario: Given global settings edits When saving with stale metadata Then conflicts preserve the latest avatar selection", async () => {
    const homeDir = makeTempDir();

    const initial = await readGlobalSettingsFile(homeDir);
    expect(initial.content).toContain('"avatar"');
    expect(initial.activeAvatar.length).toBeGreaterThan(0);

    const saved = await saveGlobalSettingsFile({
      content: '{\n  "avatar": "nova"\n}\n',
      baseMtimeMs: initial.mtimeMs,
      homeDir,
    });
    expect(saved.ok).toBeTrue();
    if (!saved.ok) {
      throw new Error("Expected save to succeed.");
    }
    expect(saved.file.activeAvatar).toBe("nova");

    const conflict = await saveGlobalSettingsFile({
      content: '{\n  "avatar": "jon"\n}\n',
      baseMtimeMs: initial.mtimeMs,
      homeDir,
    });
    expect(conflict.ok).toBeFalse();
    if (conflict.ok) {
      throw new Error("Expected save conflict.");
    }
    expect(conflict.latest.activeAvatar).toBe("nova");
  });
});
