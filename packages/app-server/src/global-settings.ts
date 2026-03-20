import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { defaultAvatarNickname, normalizeAvatarNickname } from "@agenter/avatar";

const GLOBAL_SETTINGS_PATH = (homeDir = homedir()): string => join(homeDir, ".agenter", "settings.json");

const parseActiveAvatar = (content: string): string => {
  try {
    const parsed = JSON.parse(content) as { avatar?: unknown };
    if (typeof parsed.avatar === "string" && parsed.avatar.trim().length > 0) {
      return normalizeAvatarNickname(parsed.avatar);
    }
  } catch {
    // ignored
  }
  return normalizeAvatarNickname(defaultAvatarNickname());
};

export const readGlobalSettingsFile = async (
  homeDir = homedir(),
): Promise<{ path: string; content: string; mtimeMs: number; activeAvatar: string }> => {
  const path = GLOBAL_SETTINGS_PATH(homeDir);
  try {
    const [content, info] = await Promise.all([readFile(path, "utf8"), stat(path)]);
    return {
      path,
      content,
      mtimeMs: info.mtimeMs,
      activeAvatar: parseActiveAvatar(content),
    };
  } catch {
    const content = '{\n  "avatar": "' + normalizeAvatarNickname(defaultAvatarNickname()) + '"\n}\n';
    return {
      path,
      content,
      mtimeMs: 0,
      activeAvatar: parseActiveAvatar(content),
    };
  }
};

export const saveGlobalSettingsFile = async (input: {
  content: string;
  baseMtimeMs: number;
  homeDir?: string;
}): Promise<
  | { ok: true; file: { path: string; content: string; mtimeMs: number; activeAvatar: string } }
  | { ok: false; reason: "conflict"; latest: { path: string; content: string; mtimeMs: number; activeAvatar: string } }
> => {
  const latest = await readGlobalSettingsFile(input.homeDir);
  if (Math.abs(latest.mtimeMs - input.baseMtimeMs) > 0.5) {
    return {
      ok: false,
      reason: "conflict",
      latest,
    };
  }
  await mkdir(dirname(latest.path), { recursive: true });
  await writeFile(latest.path, input.content, "utf8");
  return {
    ok: true,
    file: await readGlobalSettingsFile(input.homeDir),
  };
};
