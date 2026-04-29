import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

import type { WorkspaceAvatarCatalogEntry } from "./avatar-catalog";
import {
  listRuntimeSkillsByRootKind,
  listRuntimeSkillsInRoot,
  type RuntimeSkillLookupInput,
  type RuntimeSkillRecord,
  type RuntimeSkillRoot,
  type RuntimeSkillRootKind,
} from "./runtime-skills";
import { resolveWorkspaceAvatarAssetRoot } from "./workspace-system";
import { GLOBAL_WORKSPACE_PATH, toWorkspacePath, workspaceDisplayName } from "./workspace-target";

export type SkillBrowserCatalogRootKind = "builtin" | "shared" | "global";
export type SkillBrowserPreviewKind =
  | "directory"
  | "text"
  | "image"
  | "audio"
  | "video"
  | "pdf"
  | "binary"
  | "unsupported";

export interface SkillBrowserCatalogEntry {
  name: string;
  summary: string;
  rootKind: RuntimeSkillRootKind;
  skillPath: string;
  skillDir: string;
  configPath: string;
  configExists: boolean;
}

export interface SkillBrowserTreeEntry {
  path: string;
  name: string;
  kind: "directory" | "file";
  sizeBytes: number | null;
  modifiedAtMs: number | null;
  previewKind: SkillBrowserPreviewKind;
}

export interface SkillBrowserTreePage {
  rootPath: string;
  items: SkillBrowserTreeEntry[];
  total: number;
  nextOffset: number | null;
}

export interface SkillBrowserPreview {
  path: string;
  name: string;
  kind: "directory" | "file";
  sizeBytes: number;
  modifiedAtMs: number;
  previewKind: SkillBrowserPreviewKind;
  mimeType: string | null;
  textContent: string | null;
  mediaDataUrl: string | null;
  truncated: boolean;
  note: string | null;
}

export interface SkillBrowserAvatarWorkspaceGroup {
  workspacePath: string;
  workspaceLabel: string;
  workspaceDescription: string;
  skillsRootPath: string;
  skills: SkillBrowserCatalogEntry[];
}

export interface SkillBrowserAvatarCatalogEntry {
  nickname: string;
  displayName: string | null;
  iconUrl: string | null;
  runtimeId: string;
  defaultAvatar: boolean;
  groups: SkillBrowserAvatarWorkspaceGroup[];
}

const DEFAULT_TREE_LIMIT = 1_000;
const DEFAULT_TEXT_PREVIEW_BYTES = 64 * 1024;
const DEFAULT_MEDIA_PREVIEW_BYTES = 4 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".css",
  ".csv",
  ".env",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".log",
  ".md",
  ".mjs",
  ".pdfjs",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sql",
  ".svg",
  ".svelte",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);
const IMAGE_EXTENSIONS = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const AUDIO_EXTENSIONS = new Set([".aac", ".flac", ".m4a", ".mp3", ".ogg", ".wav"]);
const VIDEO_EXTENSIONS = new Set([".m4v", ".mov", ".mp4", ".ogv", ".webm"]);
const PDF_EXTENSIONS = new Set([".pdf"]);

const compareDirectoryEntryName = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { numeric: true });

const normalizeRelativePath = (value: string | null | undefined): string => {
  const normalized = (value ?? "/").replace(/\\/gu, "/").trim();
  if (!normalized || normalized === ".") {
    return "/";
  }
  const prefixed = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return prefixed.replace(/\/+/gu, "/").replace(/\/$/u, "") || "/";
};

const ensureInsideRoot = (rootPath: string, relativePath: string): string => {
  const absolutePath = resolve(rootPath, `.${relativePath}`);
  const relativeToRoot = relative(rootPath, absolutePath);
  if (relativeToRoot.startsWith("..") || resolve(absolutePath) === resolve(rootPath, "..")) {
    throw new Error(`skill path escapes root: ${relativePath}`);
  }
  return absolutePath;
};

const resolvePreviewKind = (absolutePath: string, isDirectory: boolean): SkillBrowserPreviewKind => {
  if (isDirectory) {
    return "directory";
  }
  const extension = extname(absolutePath).toLowerCase();
  if (TEXT_EXTENSIONS.has(extension)) {
    return "text";
  }
  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }
  if (AUDIO_EXTENSIONS.has(extension)) {
    return "audio";
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }
  if (PDF_EXTENSIONS.has(extension)) {
    return "pdf";
  }
  return "binary";
};

const resolveMimeType = (previewKind: SkillBrowserPreviewKind, absolutePath: string): string | null => {
  const extension = extname(absolutePath).toLowerCase();
  if (previewKind === "text") {
    if (extension === ".json") {
      return "application/json";
    }
    if (extension === ".md") {
      return "text/markdown";
    }
    if (extension === ".svg") {
      return "image/svg+xml";
    }
    if (extension === ".yaml" || extension === ".yml") {
      return "application/yaml";
    }
    return "text/plain";
  }
  if (previewKind === "image") {
    return extension === ".svg" ? "image/svg+xml" : `image/${extension.slice(1)}`;
  }
  if (previewKind === "audio") {
    return extension === ".m4a" ? "audio/mp4" : `audio/${extension.slice(1)}`;
  }
  if (previewKind === "video") {
    return extension === ".m4v" ? "video/mp4" : `video/${extension.slice(1)}`;
  }
  if (previewKind === "pdf") {
    return "application/pdf";
  }
  return null;
};

const projectSkillRecord = (skill: RuntimeSkillRecord): SkillBrowserCatalogEntry => ({
  name: skill.name,
  summary: skill.summary,
  rootKind: skill.rootKind,
  skillPath: skill.path,
  skillDir: skill.skillDir,
  configPath: skill.configPath,
  configExists: skill.configExists,
});

const findSkillByName = (skills: readonly RuntimeSkillRecord[], name: string): RuntimeSkillRecord => {
  const normalizedName = name.trim();
  const skill = skills.find((entry) => entry.name === normalizedName);
  if (!skill) {
    throw new Error(`skill not found: ${normalizedName}`);
  }
  return skill;
};

const listAvatarWorkspacePaths = (workspacePaths: readonly string[]): string[] => {
  const seen = new Set<string>();
  const ordered = [GLOBAL_WORKSPACE_PATH, ...workspacePaths]
    .map((workspacePath) => toWorkspacePath(workspacePath))
    .filter((workspacePath) => {
      if (seen.has(workspacePath)) {
        return false;
      }
      seen.add(workspacePath);
      return true;
    });
  return [
    GLOBAL_WORKSPACE_PATH,
    ...ordered.filter((workspacePath) => workspacePath !== GLOBAL_WORKSPACE_PATH).sort((left, right) =>
      left.localeCompare(right),
    ),
  ];
};

const buildAvatarWorkspaceGroup = (input: {
  workspacePath: string;
  avatarNickname: string;
  homeDir: string;
}): SkillBrowserAvatarWorkspaceGroup => {
  const root: RuntimeSkillRoot = {
    kind: "avatar",
    path: resolveWorkspaceAvatarAssetRoot(input.workspacePath, input.avatarNickname, "skills", input.homeDir),
  };
  const skills = listRuntimeSkillsInRoot(root).map(projectSkillRecord);
  return {
    workspacePath: input.workspacePath,
    workspaceLabel: input.workspacePath === GLOBAL_WORKSPACE_PATH ? "Root workspace" : workspaceDisplayName(input.workspacePath),
    workspaceDescription: input.workspacePath === GLOBAL_WORKSPACE_PATH ? input.homeDir : input.workspacePath,
    skillsRootPath: root.path,
    skills,
  };
};

const findAvatarWorkspaceGroup = (input: {
  avatarNickname: string;
  workspacePath: string;
  workspacePaths: readonly string[];
  homeDir: string;
}): SkillBrowserAvatarWorkspaceGroup => {
  const normalizedWorkspacePath = toWorkspacePath(input.workspacePath);
  const group = buildAvatarWorkspaceGroup({
    workspacePath: normalizedWorkspacePath,
    avatarNickname: input.avatarNickname,
    homeDir: input.homeDir,
  });
  if (normalizedWorkspacePath !== GLOBAL_WORKSPACE_PATH && group.skills.length === 0) {
    throw new Error(`avatar skill group not found: ${input.avatarNickname} @ ${normalizedWorkspacePath}`);
  }
  if (!listAvatarWorkspacePaths(input.workspacePaths).includes(normalizedWorkspacePath)) {
    throw new Error(`workspace is not tracked: ${normalizedWorkspacePath}`);
  }
  return group;
};

export const listSkillBrowserCatalog = (input: {
  lookup: RuntimeSkillLookupInput;
  rootKind: SkillBrowserCatalogRootKind;
}): SkillBrowserCatalogEntry[] =>
  listRuntimeSkillsByRootKind(input.lookup, input.rootKind).map(projectSkillRecord);

export const listSkillBrowserAvatarCatalog = (input: {
  avatars: readonly WorkspaceAvatarCatalogEntry[];
  workspacePaths: readonly string[];
  homeDir: string;
}): SkillBrowserAvatarCatalogEntry[] => {
  const workspacePaths = listAvatarWorkspacePaths(input.workspacePaths);
  return input.avatars.map((avatar) => {
    const groups = workspacePaths
      .map((workspacePath) =>
        buildAvatarWorkspaceGroup({
          workspacePath,
          avatarNickname: avatar.nickname,
          homeDir: input.homeDir,
        }),
      )
      .filter((group) => group.workspacePath === GLOBAL_WORKSPACE_PATH || group.skills.length > 0);
    return {
      nickname: avatar.nickname,
      displayName: avatar.displayName,
      iconUrl: avatar.iconUrl,
      runtimeId: avatar.runtimeId,
      defaultAvatar: avatar.defaultAvatar,
      groups,
    };
  });
};

export const listSkillBrowserTree = (input: {
  rootPath: string;
  path?: string;
  offset?: number;
  limit?: number;
}): SkillBrowserTreePage => {
  const rootPath = resolve(input.rootPath);
  const relativePath = normalizeRelativePath(input.path);
  const absolutePath = ensureInsideRoot(rootPath, relativePath);
  const directoryStat = statSync(absolutePath);
  if (!directoryStat.isDirectory()) {
    throw new Error(`skill tree target is not a directory: ${relativePath}`);
  }

  const entries = readdirSync(absolutePath, { withFileTypes: true }).sort((left, right) => {
    if (left.isDirectory() !== right.isDirectory()) {
      return left.isDirectory() ? -1 : 1;
    }
    return compareDirectoryEntryName(left.name, right.name);
  });
  const projectedEntries = entries.map((entry) => {
    const childRelativePath = normalizeRelativePath(
      relativePath === "/" ? entry.name : join(relativePath.slice(1), entry.name),
    );
    const childAbsolutePath = ensureInsideRoot(rootPath, childRelativePath);
    const childStat = statSync(childAbsolutePath);
    const kind = childStat.isDirectory() ? "directory" : "file";
    return {
      path: childRelativePath,
      name: entry.name,
      kind,
      sizeBytes: kind === "file" ? childStat.size : null,
      modifiedAtMs: childStat.mtimeMs,
      previewKind: resolvePreviewKind(childAbsolutePath, kind === "directory"),
    } satisfies SkillBrowserTreeEntry;
  });
  const offset = Math.max(0, input.offset ?? 0);
  const limit = Math.max(1, Math.min(DEFAULT_TREE_LIMIT, input.limit ?? DEFAULT_TREE_LIMIT));
  const pagedEntries = projectedEntries.slice(offset, offset + limit);
  return {
    rootPath: relativePath,
    items: pagedEntries,
    total: projectedEntries.length,
    nextOffset: offset + pagedEntries.length < projectedEntries.length ? offset + pagedEntries.length : null,
  };
};

export const readSkillBrowserPreview = (input: {
  rootPath: string;
  path: string;
  maxBytes?: number;
}): SkillBrowserPreview => {
  const rootPath = resolve(input.rootPath);
  const relativePath = normalizeRelativePath(input.path);
  const absolutePath = ensureInsideRoot(rootPath, relativePath);
  const targetStat = statSync(absolutePath);
  const kind = targetStat.isDirectory() ? "directory" : "file";
  const previewKind = resolvePreviewKind(absolutePath, kind === "directory");
  const mimeType = resolveMimeType(previewKind, absolutePath);

  if (kind === "directory") {
    return {
      path: relativePath,
      name: relativePath === "/" ? "." : relativePath.split("/").filter(Boolean).at(-1) ?? ".",
      kind,
      sizeBytes: 0,
      modifiedAtMs: targetStat.mtimeMs,
      previewKind,
      mimeType,
      textContent: null,
      mediaDataUrl: null,
      truncated: false,
      note: "Select a file inside this directory to inspect it.",
    };
  }

  const sizeBytes = targetStat.size;
  const maxBytes = Math.max(
    1,
    Math.min(
      previewKind === "text" ? DEFAULT_TEXT_PREVIEW_BYTES : DEFAULT_MEDIA_PREVIEW_BYTES,
      input.maxBytes ?? (previewKind === "text" ? DEFAULT_TEXT_PREVIEW_BYTES : DEFAULT_MEDIA_PREVIEW_BYTES),
    ),
  );
  const truncated = sizeBytes > maxBytes;

  if (previewKind === "text") {
    const buffer = readFileSync(absolutePath);
    const sliced = truncated ? buffer.subarray(0, maxBytes) : buffer;
    return {
      path: relativePath,
      name: relativePath.split("/").filter(Boolean).at(-1) ?? "",
      kind,
      sizeBytes,
      modifiedAtMs: targetStat.mtimeMs,
      previewKind,
      mimeType,
      textContent: sliced.toString("utf8"),
      mediaDataUrl: null,
      truncated,
      note: truncated ? `Preview truncated to ${maxBytes} bytes.` : null,
    };
  }

  if (previewKind === "image" || previewKind === "audio" || previewKind === "video" || previewKind === "pdf") {
    if (truncated) {
      return {
        path: relativePath,
        name: relativePath.split("/").filter(Boolean).at(-1) ?? "",
        kind,
        sizeBytes,
        modifiedAtMs: targetStat.mtimeMs,
        previewKind,
        mimeType,
        textContent: null,
        mediaDataUrl: null,
        truncated: true,
        note: `Preview unavailable because the file exceeds the ${maxBytes}-byte preview limit.`,
      };
    }
    const buffer = readFileSync(absolutePath);
    return {
      path: relativePath,
      name: relativePath.split("/").filter(Boolean).at(-1) ?? "",
      kind,
      sizeBytes,
      modifiedAtMs: targetStat.mtimeMs,
      previewKind,
      mimeType,
      textContent: null,
      mediaDataUrl: mimeType ? `data:${mimeType};base64,${buffer.toString("base64")}` : null,
      truncated: false,
      note: mimeType ? null : "Preview mime type is unavailable.",
    };
  }

  return {
    path: relativePath,
    name: relativePath.split("/").filter(Boolean).at(-1) ?? "",
    kind,
    sizeBytes,
    modifiedAtMs: targetStat.mtimeMs,
    previewKind,
    mimeType,
    textContent: null,
    mediaDataUrl: null,
    truncated: false,
    note:
      previewKind === "binary"
        ? "Binary preview is not available in the workbench."
        : "This file type is not supported by the workbench previewer.",
  };
};

export const listSkillBrowserCatalogTree = (input: {
  lookup: RuntimeSkillLookupInput;
  rootKind: SkillBrowserCatalogRootKind;
  name: string;
  path?: string;
  offset?: number;
  limit?: number;
}): SkillBrowserTreePage => {
  const skill = findSkillByName(listRuntimeSkillsByRootKind(input.lookup, input.rootKind), input.name);
  return listSkillBrowserTree({
    rootPath: skill.skillDir,
    path: input.path,
    offset: input.offset,
    limit: input.limit,
  });
};

export const readSkillBrowserCatalogPreview = (input: {
  lookup: RuntimeSkillLookupInput;
  rootKind: SkillBrowserCatalogRootKind;
  name: string;
  path: string;
  maxBytes?: number;
}): SkillBrowserPreview => {
  const skill = findSkillByName(listRuntimeSkillsByRootKind(input.lookup, input.rootKind), input.name);
  return readSkillBrowserPreview({
    rootPath: skill.skillDir,
    path: input.path,
    maxBytes: input.maxBytes,
  });
};

export const listSkillBrowserAvatarTree = (input: {
  avatarNickname: string;
  workspacePath: string;
  workspacePaths: readonly string[];
  homeDir: string;
  name: string;
  path?: string;
  offset?: number;
  limit?: number;
}): SkillBrowserTreePage => {
  const group = findAvatarWorkspaceGroup(input);
  const skill = findSkillByName(
    listRuntimeSkillsInRoot({
      kind: "avatar",
      path: group.skillsRootPath,
    }),
    input.name,
  );
  return listSkillBrowserTree({
    rootPath: skill.skillDir,
    path: input.path,
    offset: input.offset,
    limit: input.limit,
  });
};

export const readSkillBrowserAvatarPreview = (input: {
  avatarNickname: string;
  workspacePath: string;
  workspacePaths: readonly string[];
  homeDir: string;
  name: string;
  path: string;
  maxBytes?: number;
}): SkillBrowserPreview => {
  const group = findAvatarWorkspaceGroup(input);
  const skill = findSkillByName(
    listRuntimeSkillsInRoot({
      kind: "avatar",
      path: group.skillsRootPath,
    }),
    input.name,
  );
  return readSkillBrowserPreview({
    rootPath: skill.skillDir,
    path: input.path,
    maxBytes: input.maxBytes,
  });
};

export const hasSkillBrowserRoot = (rootPath: string): boolean => existsSync(resolve(rootPath));
