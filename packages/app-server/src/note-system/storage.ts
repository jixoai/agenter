import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import { parseNoteTags, renderNoteFile, splitNoteFrontmatter } from "./markdown";
import type {
  NoteCliCapabilityProjection,
  NoteDraftInput,
  NoteIdentity,
  NoteListInput,
  NoteMetadata,
  NotePage,
  NoteReadInput,
  NoteWriteInput,
} from "./types";

export const NOTE_DRAFT_NOTEBOOK = "_draft";

const SEGMENT_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/u;

const padDatePart = (value: number, width: number): string => value.toString().padStart(width, "0");

const normalizeAvatarHome = (avatarHome: readonly string[]): string[] =>
  avatarHome.map((path) => resolve(path)).filter((path) => isAbsolute(path));

const resolveWritableAvatarHome = (avatarHome: readonly string[]): string => {
  const normalized = normalizeAvatarHome(avatarHome);
  const writableRoot = normalized.at(-1);
  if (!writableRoot) {
    throw new Error("note CLI requires non-empty AVATAR_HOME");
  }
  return writableRoot;
};

const noteRootForAvatarHome = (avatarHome: string): string => resolve(avatarHome, "notes");

const validateNoteSegment = (
  value: string,
  input: {
    label: "notebook" | "section" | "page";
    allowDraftNotebook?: boolean;
  },
): string => {
  const segment = value.trim();
  if (
    segment.length === 0 ||
    segment === "." ||
    segment === ".." ||
    segment.includes("/") ||
    segment.includes("\\") ||
    SEGMENT_CONTROL_PATTERN.test(segment) ||
    (input.label === "notebook" && segment === NOTE_DRAFT_NOTEBOOK && input.allowDraftNotebook !== true)
  ) {
    throw new Error(`note ${input.label} segment is unsafe: ${value}`);
  }
  return segment;
};

const normalizeIdentity = (identity: NoteIdentity, input: { allowDraftNotebook?: boolean } = {}): NoteIdentity => ({
  notebook: validateNoteSegment(identity.notebook, {
    label: "notebook",
    allowDraftNotebook: input.allowDraftNotebook,
  }),
  section: validateNoteSegment(identity.section, { label: "section" }),
  page: validateNoteSegment(identity.page, { label: "page" }),
});

const resolveNotePath = (
  avatarHome: string,
  identity: NoteIdentity,
  input: { allowDraftNotebook?: boolean } = {},
): { noteRoot: string; path: string; identity: NoteIdentity } => {
  const normalizedIdentity = normalizeIdentity(identity, input);
  const noteRoot = noteRootForAvatarHome(avatarHome);
  const path = resolve(
    noteRoot,
    normalizedIdentity.notebook,
    normalizedIdentity.section,
    `${normalizedIdentity.page}.md`,
  );
  const relation = relative(noteRoot, path);
  if (relation.startsWith("..") || isAbsolute(relation)) {
    throw new Error(`note path escapes note root: ${identity.notebook}/${identity.section}/${identity.page}`);
  }
  return { noteRoot, path, identity: normalizedIdentity };
};

const createNoteId = (identity: NoteIdentity): string =>
  `${identity.notebook}/${identity.section}/${identity.page}`;

const readNotePageFile = (path: string, identity: NoteIdentity): NotePage | null => {
  if (!existsSync(path)) {
    return null;
  }
  const { frontmatter, body } = splitNoteFrontmatter(readFileSync(path, "utf8"));
  const metadata: NoteMetadata = {
    id: frontmatter.id || createNoteId(identity),
    kind: "note",
    createdAt: frontmatter.createdAt || new Date(0).toISOString(),
    updatedAt: frontmatter.updatedAt || new Date(0).toISOString(),
    notebook: identity.notebook,
    section: identity.section,
    page: identity.page,
    tags: parseNoteTags(frontmatter.tags),
    sourceWorkspace: frontmatter.sourceWorkspace || undefined,
  };
  return { identity, metadata, path, body };
};

export const projectNoteCliCapabilities = (input: {
  avatarHome: readonly string[];
}): NoteCliCapabilityProjection[] => {
  const normalized = normalizeAvatarHome(input.avatarHome);
  const writableRoot = normalized.at(-1);
  return writableRoot
    ? [
        {
          command: "note",
          capability: "avatar-private",
          writableRoot,
        },
      ]
    : [];
};

const writeNotePageInternal = (
  input: NoteWriteInput,
  options: {
    allowDraftNotebook?: boolean;
  } = {},
): NotePage => {
  const writableHome = resolveWritableAvatarHome(input.avatarHome);
  const resolved = resolveNotePath(writableHome, input, {
    allowDraftNotebook: options.allowDraftNotebook,
  });
  const existing = readNotePageFile(resolved.path, resolved.identity);
  if (existing && existing.body.trim().length > 0 && !input.mode) {
    throw new Error("note page already has content; pass mode append or override");
  }
  const now = (input.now ?? new Date()).toISOString();
  const nextBody =
    existing && input.mode === "append"
      ? [existing.body.trimEnd(), input.body.trim()].filter((part) => part.length > 0).join("\n\n")
      : input.body.trimEnd();
  const metadata: NoteMetadata = {
    id: existing?.metadata.id ?? createNoteId(resolved.identity),
    kind: "note",
    createdAt: existing?.metadata.createdAt ?? now,
    updatedAt: now,
    notebook: resolved.identity.notebook,
    section: resolved.identity.section,
    page: resolved.identity.page,
    tags: existing?.metadata.tags ?? [],
    sourceWorkspace: input.sourceWorkspace ?? existing?.metadata.sourceWorkspace,
  };
  mkdirSync(resolve(resolved.noteRoot, resolved.identity.notebook, resolved.identity.section), { recursive: true });
  writeFileSync(resolved.path, renderNoteFile(metadata, nextBody), "utf8");
  return {
    identity: resolved.identity,
    metadata,
    path: resolved.path,
    body: nextBody,
  };
};

export const writeNotePage = (input: NoteWriteInput): NotePage => writeNotePageInternal(input);

export const draftNotePage = (input: NoteDraftInput): NotePage => {
  const now = input.now ?? new Date();
  const timePage = [
    padDatePart(now.getUTCHours(), 2),
    padDatePart(now.getUTCMinutes(), 2),
    padDatePart(now.getUTCSeconds(), 2),
    padDatePart(now.getUTCMilliseconds(), 3),
  ].join("");
  return writeNotePageInternal(
    {
      avatarHome: input.avatarHome,
      notebook: NOTE_DRAFT_NOTEBOOK,
      section: now.toISOString().slice(0, 10),
      page: `${timePage}-${input.idSuffix ?? randomUUID().slice(0, 8)}`,
      body: input.body,
      now,
      sourceWorkspace: input.sourceWorkspace,
      mode: "override",
    },
    { allowDraftNotebook: true },
  );
};

export const showNotePage = (input: NoteReadInput): NotePage | null => {
  const identity = normalizeIdentity(input);
  for (const avatarHome of [...normalizeAvatarHome(input.avatarHome)].reverse()) {
    const resolved = resolveNotePath(avatarHome, identity, {
      allowDraftNotebook: identity.notebook === NOTE_DRAFT_NOTEBOOK,
    });
    const page = readNotePageFile(resolved.path, resolved.identity);
    if (page) {
      return page;
    }
  }
  return null;
};

const listMarkdownFiles = (root: string): string[] => {
  if (!existsSync(root)) {
    return [];
  }
  const stats = statSync(root);
  if (!stats.isDirectory()) {
    return [];
  }
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMarkdownFiles(path));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path);
    }
  }
  return files;
};

const identityFromNotePath = (noteRoot: string, path: string): NoteIdentity | null => {
  const parts = relative(noteRoot, path).split(/[\\/]/u);
  if (parts.length !== 3 || !parts[2]?.endsWith(".md")) {
    return null;
  }
  try {
    return normalizeIdentity(
      {
        notebook: parts[0]!,
        section: parts[1]!,
        page: parts[2]!.slice(0, -".md".length),
      },
      { allowDraftNotebook: parts[0] === NOTE_DRAFT_NOTEBOOK },
    );
  } catch {
    return null;
  }
};

export const listNotePages = (input: NoteListInput): NotePage[] => {
  const visible = new Map<string, NotePage>();
  for (const avatarHome of normalizeAvatarHome(input.avatarHome)) {
    const noteRoot = noteRootForAvatarHome(avatarHome);
    for (const path of listMarkdownFiles(noteRoot).sort((left, right) => left.localeCompare(right))) {
      const identity = identityFromNotePath(noteRoot, path);
      if (!identity) {
        continue;
      }
      if (input.notebook && identity.notebook !== input.notebook) {
        continue;
      }
      if (input.section && identity.section !== input.section) {
        continue;
      }
      const page = readNotePageFile(path, identity);
      if (page) {
        visible.set(createNoteId(identity), page);
      }
    }
  }
  const limit = Math.max(1, Math.min(input.limit ?? 100, 1_000));
  return [...visible.values()]
    .sort((left, right) => left.path.localeCompare(right.path))
    .slice(0, limit);
};
