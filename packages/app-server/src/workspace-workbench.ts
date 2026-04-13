import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

import type { WorkspaceGrantMode, WorkspaceGrantRecord } from "./workspace-system";
import { resolveWorkspaceAvatarPrivateRoot, resolveWorkspaceGrantModeFromAbsolutePath } from "./workspace-system";
import { toWorkspaceCwd } from "./workspace-target";

export type WorkspaceWorkbenchMode = "explorer" | "private";
export type WorkspaceWorkbenchPreviewKind = "directory" | "text" | "image" | "audio" | "video" | "none";

export interface WorkspaceWorkbenchTreeEntry {
  path: string;
  name: string;
  kind: "directory" | "file";
  sizeBytes: number | null;
  modifiedAtMs: number | null;
  previewKind: WorkspaceWorkbenchPreviewKind;
  accessMode?: WorkspaceGrantMode | "none";
}

export interface WorkspaceWorkbenchTreePage {
  rootPath: string;
  items: WorkspaceWorkbenchTreeEntry[];
  total: number;
  nextOffset: number | null;
}

export interface WorkspaceWorkbenchPreview {
  path: string;
  name: string;
  kind: "directory" | "file";
  sizeBytes: number;
  modifiedAtMs: number;
  previewKind: WorkspaceWorkbenchPreviewKind;
  mimeType: string | null;
  textContent: string | null;
  mediaDataUrl: string | null;
  truncated: boolean;
  note: string | null;
}

const DEFAULT_TREE_LIMIT = 1_000;
const DEFAULT_PREVIEW_BYTES = 64 * 1024;
const DEFAULT_MEDIA_PREVIEW_BYTES = 512 * 1024;

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
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sql",
  ".svelte",
  ".svg",
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
const VIDEO_EXTENSIONS = new Set([".mov", ".mp4", ".m4v", ".ogv", ".webm"]);

const toRelativePath = (value: string): string => {
  const normalized = value.replace(/\\/gu, "/").trim();
  if (normalized.length === 0 || normalized === ".") {
    return "/";
  }
  const prefixed = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return prefixed.replace(/\/+/gu, "/").replace(/\/$/u, "") || "/";
};

const ensureInsideRoot = (rootPath: string, relativePath: string): string => {
  const absolutePath = resolve(rootPath, `.${relativePath}`);
  const relativeToRoot = relative(rootPath, absolutePath);
  if (relativeToRoot.startsWith("..") || resolve(absolutePath) === resolve(rootPath, "..")) {
    throw new Error(`workspace path escapes root: ${relativePath}`);
  }
  return absolutePath;
};

const resolveWorkbenchRoot = (input: {
  workspacePath: string;
  avatar: string;
  mode: WorkspaceWorkbenchMode;
}): string => {
  if (input.mode === "private") {
    const root = resolveWorkspaceAvatarPrivateRoot(input.workspacePath, input.avatar);
    mkdirSync(root, { recursive: true });
    return root;
  }
  return toWorkspaceCwd(input.workspacePath);
};

const compareDirectoryEntryName = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { numeric: true });

const resolvePreviewKind = (absolutePath: string, isDirectory: boolean): WorkspaceWorkbenchPreviewKind => {
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
  return "none";
};

const resolveMimeType = (previewKind: WorkspaceWorkbenchPreviewKind, absolutePath: string): string | null => {
  const extension = extname(absolutePath).toLowerCase();
  if (previewKind === "text") {
    if (extension === ".md") {
      return "text/markdown";
    }
    if (extension === ".json") {
      return "application/json";
    }
    if (extension === ".svg") {
      return "image/svg+xml";
    }
    return "text/plain";
  }
  if (previewKind === "image") {
    if (extension === ".svg") {
      return "image/svg+xml";
    }
    return `image/${extension.slice(1)}`;
  }
  if (previewKind === "audio") {
    return extension === ".m4a" ? "audio/mp4" : `audio/${extension.slice(1)}`;
  }
  if (previewKind === "video") {
    return extension === ".m4v" ? "video/mp4" : `video/${extension.slice(1)}`;
  }
  return null;
};

const resolveAccessMode = (
  absolutePath: string,
  isDirectory: boolean,
  grants: readonly WorkspaceGrantRecord[],
): WorkspaceGrantMode | "none" => {
  return grants.length === 0
    ? "none"
    : resolveWorkspaceGrantModeFromAbsolutePath({
        workspaceRoot: grants[0]!.workspacePath,
        absolutePath,
        grants,
        partial: isDirectory,
      });
};

export const listWorkspaceWorkbenchTree = (input: {
  workspacePath: string;
  avatar: string;
  mode: WorkspaceWorkbenchMode;
  path?: string;
  offset?: number;
  limit?: number;
  grants?: readonly WorkspaceGrantRecord[];
}): WorkspaceWorkbenchTreePage => {
  const rootPath = resolveWorkbenchRoot(input);
  const relativePath = toRelativePath(input.path ?? "/");
  const absolutePath = ensureInsideRoot(rootPath, relativePath);
  const directoryStat = statSync(absolutePath);
  if (!directoryStat.isDirectory()) {
    throw new Error(`workspace tree target is not a directory: ${relativePath}`);
  }
  const entries = readdirSync(absolutePath, { withFileTypes: true }).sort((left, right) => {
    if (left.isDirectory() !== right.isDirectory()) {
      return left.isDirectory() ? -1 : 1;
    }
    return compareDirectoryEntryName(left.name, right.name);
  });
  const grants = input.grants ?? [];
  const projectedEntries = entries.flatMap((entry) => {
    const childRelativePath = toRelativePath(
      relativePath === "/" ? entry.name : join(relativePath.slice(1), entry.name),
    );
    const childAbsolutePath = ensureInsideRoot(rootPath, childRelativePath);
    const childStat = statSync(childAbsolutePath);
    const kind = childStat.isDirectory() ? "directory" : "file";
    const accessMode =
      input.mode === "explorer" ? resolveAccessMode(childAbsolutePath, kind === "directory", grants) : undefined;
    if (input.mode === "explorer" && accessMode === "none") {
      return [];
    }
    return [
      {
        path: childRelativePath,
        name: entry.name,
        kind,
        sizeBytes: kind === "file" ? childStat.size : null,
        modifiedAtMs: childStat.mtimeMs,
        previewKind: resolvePreviewKind(childAbsolutePath, kind === "directory"),
        accessMode,
      } satisfies WorkspaceWorkbenchTreeEntry,
    ];
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

export const readWorkspaceWorkbenchPreview = (input: {
  workspacePath: string;
  avatar: string;
  mode: WorkspaceWorkbenchMode;
  path: string;
  maxBytes?: number;
  grants?: readonly WorkspaceGrantRecord[];
}): WorkspaceWorkbenchPreview => {
  const rootPath = resolveWorkbenchRoot(input);
  const relativePath = toRelativePath(input.path);
  const absolutePath = ensureInsideRoot(rootPath, relativePath);
  const targetStat = statSync(absolutePath);
  if (
    input.mode === "explorer" &&
    (input.grants?.length ?? 0) > 0 &&
    resolveWorkspaceGrantModeFromAbsolutePath({
      workspaceRoot: rootPath,
      absolutePath,
      grants: input.grants ?? [],
      partial: targetStat.isDirectory(),
    }) === "none"
  ) {
    throw new Error(`workspace preview denied by grants: ${relativePath}`);
  }
  const kind = targetStat.isDirectory() ? "directory" : "file";
  const previewKind = resolvePreviewKind(absolutePath, kind === "directory");
  const mimeType = resolveMimeType(previewKind, absolutePath);

  if (kind === "directory") {
    return {
      path: relativePath,
      name: relativePath === "/" ? "/" : (relativePath.split("/").at(-1) ?? relativePath),
      kind,
      sizeBytes: 0,
      modifiedAtMs: targetStat.mtimeMs,
      previewKind,
      mimeType,
      textContent: null,
      mediaDataUrl: null,
      truncated: false,
      note: "Directory preview is not available.",
    };
  }

  const maxBytes = Math.max(1, input.maxBytes ?? DEFAULT_PREVIEW_BYTES);
  if (previewKind === "text") {
    const raw = readFileSync(absolutePath);
    const truncated = raw.byteLength > maxBytes;
    return {
      path: relativePath,
      name: relativePath.split("/").at(-1) ?? relativePath,
      kind,
      sizeBytes: targetStat.size,
      modifiedAtMs: targetStat.mtimeMs,
      previewKind,
      mimeType,
      textContent: raw.subarray(0, maxBytes).toString("utf8"),
      mediaDataUrl: null,
      truncated,
      note: truncated ? `Preview truncated to ${maxBytes} bytes.` : null,
    };
  }

  if (previewKind === "image" || previewKind === "audio" || previewKind === "video") {
    const raw = readFileSync(absolutePath);
    const overLimit = raw.byteLength > DEFAULT_MEDIA_PREVIEW_BYTES;
    return {
      path: relativePath,
      name: relativePath.split("/").at(-1) ?? relativePath,
      kind,
      sizeBytes: targetStat.size,
      modifiedAtMs: targetStat.mtimeMs,
      previewKind,
      mimeType,
      textContent: null,
      mediaDataUrl: overLimit || !mimeType ? null : `data:${mimeType};base64,${raw.toString("base64")}`,
      truncated: false,
      note: overLimit ? "Preview omitted because the file is too large for inline media rendering." : null,
    };
  }

  return {
    path: relativePath,
    name: relativePath.split("/").at(-1) ?? relativePath,
    kind,
    sizeBytes: targetStat.size,
    modifiedAtMs: targetStat.mtimeMs,
    previewKind,
    mimeType,
    textContent: null,
    mediaDataUrl: null,
    truncated: false,
    note: "No preview is available for this file type.",
  };
};

export const createWorkspacePrivateAsset = (input: {
  workspacePath: string;
  avatar: string;
  parentPath?: string;
  name: string;
  kind: "file" | "directory";
}): { path: string } => {
  const rootPath = resolveWorkbenchRoot({
    workspacePath: input.workspacePath,
    avatar: input.avatar,
    mode: "private",
  });
  const parentPath = toRelativePath(input.parentPath ?? "/");
  const parentAbsolutePath = ensureInsideRoot(rootPath, parentPath);
  mkdirSync(parentAbsolutePath, { recursive: true });
  const targetRelativePath = toRelativePath(parentPath === "/" ? input.name : join(parentPath.slice(1), input.name));
  const targetAbsolutePath = ensureInsideRoot(rootPath, targetRelativePath);
  if (input.kind === "directory") {
    mkdirSync(targetAbsolutePath, { recursive: true });
  } else {
    mkdirSync(resolve(targetAbsolutePath, ".."), { recursive: true });
    writeFileSync(targetAbsolutePath, "", "utf8");
  }
  return { path: targetRelativePath };
};
