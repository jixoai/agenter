import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, isAbsolute, join, posix, relative, resolve } from "node:path";

import { NoteDatabase, type NoteDbPageRecord } from "./database";
import { parseNoteTags, renderNoteFile, splitNoteFrontmatter } from "./markdown";
import type {
  NoteCliCapabilityProjection,
  NoteDraftInput,
  NoteIdentity,
  NoteListInput,
  NoteMetadata,
  NoteMime,
  NotePage,
  NoteReadInput,
  NoteReference,
  NoteReferenceInput,
  NoteRenameInput,
  NoteSqlQueryInput,
  NoteTagQueryInput,
  NoteTagSummary,
  NoteWriteInput,
} from "./types";

export const NOTE_DRAFT_NOTEBOOK = "_draft";
export const DEFAULT_NOTE_MIME = "text/markdown";
export const JSON_NOTE_MIME = "application/json";
export const NOTE_URI_PREFIX = "note:";

const SEGMENT_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/u;

const padDatePart = (value: number, width: number): string => value.toString().padStart(width, "0");

const formatDraftPageTime = (date: Date): string =>
  [date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()].map((part) => padDatePart(part, 2)).join(":");

const formatDraftPageBase = (date: Date, idSuffix?: string): string => {
  const time = formatDraftPageTime(date);
  const suffix = idSuffix?.trim().slice(0, 4);
  return suffix && suffix.length > 0 ? `${time}(${suffix})` : time;
};

const formatDraftPageCandidate = (base: string, index: number): string => (index === 0 ? base : `${base}(${index})`);

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

const createNoteKey = (identity: NoteIdentity): string => `${identity.notebook}/${identity.section}/${identity.page}`;

const createNoteUri = (identity: NoteIdentity): string =>
  `${NOTE_URI_PREFIX}${identity.notebook}/${identity.section}/${identity.page}`;

const normalizeRequiredMime = (mime: NoteMime | undefined): NoteMime => {
  const normalized = mime?.trim().toLowerCase();
  if (!normalized) {
    throw new Error("note mime is required");
  }
  return normalized;
};

const normalizeOptionalMime = (mime: string | undefined): NoteMime | undefined => {
  const normalized = mime?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
};

const isMarkdownMime = (mime: NoteMime): boolean => mime === DEFAULT_NOTE_MIME || mime === "text/x-markdown";

const isJsonMime = (mime: NoteMime): boolean => mime === JSON_NOTE_MIME;

const isInlineTextMime = (mime: NoteMime): boolean =>
  isMarkdownMime(mime) || isJsonMime(mime) || mime.startsWith("text/");

const artifactExtensionForMime = (mime: NoteMime, contentPath?: string): string => {
  if (isMarkdownMime(mime)) {
    return ".md";
  }
  if (isJsonMime(mime)) {
    return ".json";
  }
  const sourceExtension = contentPath ? extname(contentPath) : "";
  return sourceExtension.length > 0 ? sourceExtension : ".bin";
};

const resolveNoteArtifactPath = (
  noteRoot: string,
  identity: NoteIdentity,
  mime: NoteMime,
  contentPath?: string,
): string => {
  const path = resolve(
    noteRoot,
    identity.notebook,
    identity.section,
    `${identity.page}${artifactExtensionForMime(mime, contentPath)}`,
  );
  const relation = relative(noteRoot, path);
  if (relation.startsWith("..") || isAbsolute(relation)) {
    throw new Error(`note path escapes note root: ${createNoteKey(identity)}`);
  }
  return path;
};

const safeReadUtf8 = (path: string): string => readFileSync(path, "utf8");

const parseJsonArray = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const parseFrontmatterIds = (
  frontmatter: Record<string, string>,
): { id?: string; bookId?: string; sectionId?: string; pageId?: string } => ({
  id: frontmatter.id || undefined,
  bookId: frontmatter.bookId || undefined,
  sectionId: frontmatter.sectionId || undefined,
  pageId: frontmatter.pageId || undefined,
});

const stripArtifactExtension = (fileName: string): string => {
  const extension = extname(fileName);
  return extension.length > 0 ? basename(fileName, extension) : fileName;
};

const identityFromNoteArtifactPath = (noteRoot: string, path: string): NoteIdentity | null => {
  const parts = relative(noteRoot, path).split(/[\\/]/u);
  if (parts.length !== 3) {
    return null;
  }
  const extension = extname(parts[2]!);
  if (extension.length === 0) {
    return null;
  }
  try {
    return normalizeIdentity(
      {
        notebook: parts[0]!,
        section: parts[1]!,
        page: stripArtifactExtension(parts[2]!),
      },
      { allowDraftNotebook: parts[0] === NOTE_DRAFT_NOTEBOOK },
    );
  } catch {
    return null;
  }
};

const listNoteArtifactFiles = (root: string): string[] => {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return [];
  }
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listNoteArtifactFiles(path));
      continue;
    }
    if (entry.isFile() && extname(entry.name).length > 0) {
      files.push(path);
    }
  }
  return files;
};

const inferMimeForArtifact = (path: string, frontmatter: Record<string, string>, existingMime?: NoteMime): NoteMime => {
  const frontmatterMime = normalizeOptionalMime(frontmatter.mime);
  if (frontmatterMime) {
    return frontmatterMime;
  }
  if (existingMime) {
    return existingMime;
  }
  if (path.endsWith(".json")) {
    return JSON_NOTE_MIME;
  }
  if (path.endsWith(".md") || path.endsWith(".markdown")) {
    return DEFAULT_NOTE_MIME;
  }
  if (path.endsWith(".txt")) {
    return "text/plain";
  }
  return "application/octet-stream";
};

const readArtifactBody = (path: string, mime: NoteMime): { frontmatter: Record<string, string>; body: string } => {
  if (!isInlineTextMime(mime)) {
    return { frontmatter: {}, body: "" };
  }
  const raw = safeReadUtf8(path);
  if (isMarkdownMime(mime)) {
    return splitNoteFrontmatter(raw);
  }
  return { frontmatter: {}, body: raw };
};

const recordToMetadata = (record: NoteDbPageRecord): NoteMetadata => ({
  id: record.pageId,
  bookId: record.bookId,
  sectionId: record.sectionId,
  pageId: record.pageId,
  kind: "note",
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  mime: record.mime,
  notebook: record.notebook,
  section: record.section,
  page: record.page,
  tags: [...record.tags],
  tagIds: [...record.tagIds],
  references: record.references.map((reference) => ({ ...reference })),
  sourceWorkspace: record.sourceWorkspace,
});

const recordToPage = (record: NoteDbPageRecord): NotePage => {
  const stats = existsSync(record.path) ? statSync(record.path) : null;
  const body = existsSync(record.path) ? readArtifactBody(record.path, record.mime).body : "";
  return {
    identity: {
      notebook: record.notebook,
      section: record.section,
      page: record.page,
    },
    metadata: recordToMetadata(record),
    path: record.path,
    body,
    content: {
      inline: isInlineTextMime(record.mime),
      sizeBytes: stats?.size ?? 0,
      sourcePath: record.path,
    },
  };
};

const normalizeTags = (tags: readonly string[] | undefined): string[] =>
  [...new Set((tags ?? []).map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0))].sort(
    (left, right) => left.localeCompare(right),
  );

const parseNoteUriIdentity = (uri: string): NoteIdentity | null => {
  if (!uri.startsWith(NOTE_URI_PREFIX)) {
    return null;
  }
  const parts = uri.slice(NOTE_URI_PREFIX.length).split("/");
  if (parts.length !== 3) {
    return null;
  }
  return normalizeIdentity(
    {
      notebook: parts[0]!,
      section: parts[1]!,
      page: stripArtifactExtension(parts[2]!),
    },
    { allowDraftNotebook: parts[0] === NOTE_DRAFT_NOTEBOOK },
  );
};

const stripReferenceSuffix = (value: string): string => value.split(/[?#]/u)[0] ?? value;

const looksLikeNoteReference = (value: string): boolean => {
  const target = stripReferenceSuffix(value.trim());
  return (
    target.startsWith(NOTE_URI_PREFIX) ||
    target.startsWith("./") ||
    target.startsWith("../") ||
    target.endsWith(".md") ||
    target.endsWith(".markdown") ||
    target.endsWith(".json")
  );
};

const relativeReferenceToIdentity = (source: NoteIdentity, rawTarget: string): NoteIdentity => {
  const target = stripReferenceSuffix(rawTarget.trim());
  const sourcePath = `${source.notebook}/${source.section}/${source.page}.md`;
  const normalized = posix.normalize(posix.join(posix.dirname(sourcePath), target));
  const parts = normalized.split("/");
  if (parts.length !== 3 || parts.some((part) => part === ".." || part.length === 0)) {
    throw new Error(`note reference cannot be resolved from ${createNoteKey(source)}: ${rawTarget}`);
  }
  return normalizeIdentity(
    {
      notebook: parts[0]!,
      section: parts[1]!,
      page: stripArtifactExtension(parts[2]!),
    },
    { allowDraftNotebook: parts[0] === NOTE_DRAFT_NOTEBOOK },
  );
};

const referenceFromRecord = (record: NoteDbPageRecord, label?: string): NoteReference => ({
  label,
  uri: createNoteUri(record),
  bookId: record.bookId,
  sectionId: record.sectionId,
  pageId: record.pageId,
  notebook: record.notebook,
  section: record.section,
  page: record.page,
});

const resolveReferenceInput = (
  db: NoteDatabase,
  source: NoteIdentity,
  reference: NoteReferenceInput,
): NoteReference => {
  if (typeof reference === "string") {
    const trimmed = reference.trim();
    const idCandidate = trimmed.startsWith("page:") ? trimmed.slice("page:".length) : trimmed;
    const byId = db.getPageRecordById(idCandidate);
    if (byId) {
      return referenceFromRecord(byId);
    }
    const uriIdentity = parseNoteUriIdentity(trimmed);
    const identity = uriIdentity ?? relativeReferenceToIdentity(source, trimmed);
    const record = db.getPageRecordByIdentity(identity);
    if (!record) {
      throw new Error(`note reference target not found: ${trimmed}`);
    }
    return referenceFromRecord(record);
  }
  const label = reference.label;
  if (reference.pageId) {
    const record = db.getPageRecordById(reference.pageId);
    if (!record) {
      throw new Error(`note reference pageId not found: ${reference.pageId}`);
    }
    return referenceFromRecord(record, label);
  }
  if (reference.uri) {
    return { ...resolveReferenceInput(db, source, reference.uri), label };
  }
  if (reference.path) {
    return { ...resolveReferenceInput(db, source, reference.path), label };
  }
  if (reference.notebook && reference.section && reference.page) {
    const identity = normalizeIdentity(
      {
        notebook: reference.notebook,
        section: reference.section,
        page: reference.page,
      },
      { allowDraftNotebook: reference.notebook === NOTE_DRAFT_NOTEBOOK },
    );
    const record = db.getPageRecordByIdentity(identity);
    if (!record) {
      throw new Error(`note reference target not found: ${createNoteKey(identity)}`);
    }
    return referenceFromRecord(record, label);
  }
  throw new Error("note reference requires pageId, uri, path, or notebook/section/page");
};

const dedupeReferences = (references: readonly NoteReference[]): NoteReference[] => {
  const byKey = new Map<string, NoteReference>();
  for (const reference of references) {
    byKey.set(`${reference.pageId}:${reference.uri}`, reference);
  }
  return [...byKey.values()].sort((left, right) => left.uri.localeCompare(right.uri));
};

const normalizeMarkdownReferences = (
  db: NoteDatabase,
  source: NoteIdentity,
  body: string,
): { body: string; references: NoteReference[] } => {
  const references: NoteReference[] = [];
  let nextBody = body.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/gu, (match, rawLabel: string, rawTarget: string) => {
    if (!looksLikeNoteReference(rawTarget)) {
      return match;
    }
    const reference = resolveReferenceInput(db, source, { label: rawLabel, uri: rawTarget });
    references.push(reference);
    return `[${rawLabel}](${reference.uri})`;
  });
  nextBody = nextBody.replace(
    /^(\[[^\]\n]+\]:\s*)(\S+)(.*)$/gmu,
    (match, prefix: string, rawTarget: string, suffix: string) => {
      if (!looksLikeNoteReference(rawTarget)) {
        return match;
      }
      const reference = resolveReferenceInput(db, source, rawTarget);
      references.push(reference);
      return `${prefix}${reference.uri}${suffix}`;
    },
  );
  return { body: nextBody, references: dedupeReferences(references) };
};

const tryResolveIndexReferences = (
  db: NoteDatabase,
  identity: NoteIdentity,
  frontmatter: Record<string, string>,
  body: string,
): NoteReference[] => {
  const references: NoteReference[] = [];
  for (const uri of parseJsonArray(frontmatter.references)) {
    try {
      references.push(resolveReferenceInput(db, identity, uri));
    } catch {
      // Existing user files are indexed without destructive rewrites or hard failures.
    }
  }
  try {
    references.push(...normalizeMarkdownReferences(db, identity, body).references);
  } catch {
    // Existing unresolved relative links should not make the whole note store unreadable.
  }
  return dedupeReferences(references);
};

const indexNoteRoot = (noteRoot: string): NoteDatabase => {
  const db = new NoteDatabase(noteRoot);
  const files = listNoteArtifactFiles(noteRoot).sort((left, right) => left.localeCompare(right));
  const indexed: Array<{
    identity: NoteIdentity;
    path: string;
    mime: NoteMime;
    frontmatter: Record<string, string>;
    body: string;
  }> = [];
  for (const path of files) {
    const identity = identityFromNoteArtifactPath(noteRoot, path);
    if (!identity) {
      continue;
    }
    const rawFrontmatter =
      path.endsWith(".md") || path.endsWith(".markdown") ? splitNoteFrontmatter(safeReadUtf8(path)) : null;
    const frontmatter = rawFrontmatter?.frontmatter ?? {};
    const existingRecord = db.getPageRecordByIdentity(identity);
    const mime = inferMimeForArtifact(
      path,
      frontmatter,
      existingRecord?.path === path ? existingRecord.mime : undefined,
    );
    const { body } = rawFrontmatter ?? readArtifactBody(path, mime);
    const stats = statSync(path);
    db.indexExistingPage({
      identity,
      path,
      mime,
      createdAt: frontmatter.createdAt || stats.birthtime.toISOString(),
      updatedAt: frontmatter.updatedAt || stats.mtime.toISOString(),
      sourceWorkspace: frontmatter.sourceWorkspace || undefined,
      tags: parseNoteTags(frontmatter.tags),
      ids: parseFrontmatterIds(frontmatter),
    });
    indexed.push({ identity, path, mime, frontmatter, body });
  }
  for (const page of indexed) {
    const references = isMarkdownMime(page.mime)
      ? tryResolveIndexReferences(db, page.identity, page.frontmatter, page.body)
      : [];
    db.indexExistingPage({
      identity: page.identity,
      path: page.path,
      mime: page.mime,
      createdAt: page.frontmatter.createdAt || statSync(page.path).birthtime.toISOString(),
      updatedAt: page.frontmatter.updatedAt || statSync(page.path).mtime.toISOString(),
      sourceWorkspace: page.frontmatter.sourceWorkspace || undefined,
      tags: parseNoteTags(page.frontmatter.tags),
      references: references.length > 0 ? references : undefined,
      ids: parseFrontmatterIds(page.frontmatter),
    });
  }
  return db;
};

const withIndexedDatabase = <T>(avatarHome: string, fn: (db: NoteDatabase, noteRoot: string) => T): T => {
  const noteRoot = noteRootForAvatarHome(avatarHome);
  const db = indexNoteRoot(noteRoot);
  try {
    return fn(db, noteRoot);
  } finally {
    db.close();
  }
};

type WriteContentSource =
  | {
      kind: "inline";
      content: string;
    }
  | {
      kind: "file";
      path: string;
    };

const resolveWriteContentSource = (input: Pick<NoteWriteInput, "content" | "contentFile">): WriteContentSource => {
  const hasInlineContent = input.content !== undefined;
  const hasContentFile = input.contentFile !== undefined;
  if (hasInlineContent === hasContentFile) {
    throw new Error("note write requires exactly one content source: content or contentFile");
  }
  if (hasInlineContent) {
    return { kind: "inline", content: input.content ?? "" };
  }
  const contentFile = input.contentFile?.trim() ?? "";
  if (contentFile.length === 0) {
    throw new Error("note contentFile is required");
  }
  return { kind: "file", path: resolve(contentFile) };
};

const readWriteTextContent = (
  input: NoteWriteInput,
  mime: NoteMime,
  existing: NotePage | null,
  contentSource: WriteContentSource,
): string => {
  const raw = contentSource.kind === "file" ? safeReadUtf8(contentSource.path) : contentSource.content;
  if (isJsonMime(mime)) {
    if (input.mode === "append" && existing && existing.body.trim().length > 0) {
      throw new Error("note JSON writes do not support append mode");
    }
    try {
      return JSON.stringify(JSON.parse(raw) as unknown);
    } catch (error) {
      throw new Error(`note JSON body is invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return input.mode === "append" && existing
    ? [existing.body.trimEnd(), raw.trim()].filter((part) => part.length > 0).join("\n\n")
    : raw.trimEnd();
};

const materializeArtifact = (input: {
  page: NotePage;
  body: string;
  contentSource: WriteContentSource;
  previousPath?: string;
}): void => {
  mkdirSync(dirname(input.page.path), { recursive: true });
  if (input.previousPath && input.previousPath !== input.page.path && existsSync(input.previousPath)) {
    rmSync(input.previousPath, { force: true });
  }
  const mime = input.page.metadata.mime;
  if (isMarkdownMime(mime)) {
    writeFileSync(input.page.path, renderNoteFile(input.page.metadata, input.body), "utf8");
    return;
  }
  if (isInlineTextMime(mime)) {
    writeFileSync(input.page.path, input.body, "utf8");
    return;
  }
  if (input.contentSource.kind !== "file") {
    throw new Error("note binary-like MIME writes require contentFile");
  }
  copyFileSync(input.contentSource.path, input.page.path);
};

const writeNotePageInternal = (
  input: NoteWriteInput,
  options: {
    allowDraftNotebook?: boolean;
  } = {},
): NotePage => {
  const writableHome = resolveWritableAvatarHome(input.avatarHome);
  return withIndexedDatabase(writableHome, (db, noteRoot) => {
    const identity = normalizeIdentity(input, {
      allowDraftNotebook: options.allowDraftNotebook,
    });
    const mime = normalizeRequiredMime(input.mime);
    const contentSource = resolveWriteContentSource(input);
    if (!isInlineTextMime(mime) && contentSource.kind !== "file") {
      throw new Error("note binary-like MIME writes require contentFile");
    }
    const existingRecord = db.getPageRecordByIdentity(identity);
    const existingPage = existingRecord ? recordToPage(existingRecord) : null;
    if (existingPage && (existsSync(existingPage.path) || existingPage.body.trim().length > 0) && !input.mode) {
      throw new Error("note page already has content; pass mode append or override");
    }
    const rawBody = isInlineTextMime(mime) ? readWriteTextContent(input, mime, existingPage, contentSource) : "";
    const normalizedMarkdown = isMarkdownMime(mime)
      ? normalizeMarkdownReferences(db, identity, rawBody)
      : { body: rawBody, references: [] };
    const explicitReferences = (input.references ?? []).map((reference) =>
      resolveReferenceInput(db, identity, reference),
    );
    const references = dedupeReferences([...normalizedMarkdown.references, ...explicitReferences]);
    const now = (input.now ?? new Date()).toISOString();
    const path = resolveNoteArtifactPath(
      noteRoot,
      identity,
      mime,
      contentSource.kind === "file" ? contentSource.path : undefined,
    );
    const record = db.upsertPage({
      identity,
      path,
      mime,
      now,
      sourceWorkspace: input.sourceWorkspace ?? existingRecord?.sourceWorkspace,
      tags: normalizeTags(input.tags ?? existingRecord?.tags ?? []),
      references,
      existing: existingRecord
        ? {
            id: existingRecord.id,
            bookId: existingRecord.bookId,
            sectionId: existingRecord.sectionId,
            pageId: existingRecord.pageId,
            createdAt: existingRecord.createdAt,
          }
        : undefined,
    });
    const page = recordToPage(record);
    const body = isMarkdownMime(mime) ? normalizedMarkdown.body : rawBody;
    materializeArtifact({
      page,
      body,
      contentSource,
      previousPath: existingRecord?.path,
    });
    return { ...page, body };
  });
};

export const projectNoteCliCapabilities = (input: { avatarHome: readonly string[] }): NoteCliCapabilityProjection[] => {
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

export const writeNotePage = (input: NoteWriteInput): NotePage => writeNotePageInternal(input);

export const draftNotePage = (input: NoteDraftInput): NotePage => {
  const now = input.now ?? new Date();
  const writableHome = resolveWritableAvatarHome(input.avatarHome);
  const section = now.toISOString().slice(0, 10);
  const pageBase = formatDraftPageBase(now, input.idSuffix);
  const page = withIndexedDatabase(writableHome, (db) => {
    for (let index = 0; index < 1_000; index += 1) {
      const candidate = formatDraftPageCandidate(pageBase, index);
      if (!db.getPageRecordByIdentity({ notebook: NOTE_DRAFT_NOTEBOOK, section, page: candidate })) {
        return candidate;
      }
    }
    throw new Error(`note draft page collision overflow for ${NOTE_DRAFT_NOTEBOOK}/${section}/${pageBase}`);
  });
  const writeInputBase = {
    avatarHome: input.avatarHome,
    notebook: NOTE_DRAFT_NOTEBOOK,
    section,
    page,
    mime: input.mime,
    now,
    sourceWorkspace: input.sourceWorkspace,
    mode: "override" as const,
  };
  return writeNotePageInternal(
    input.contentFile !== undefined
      ? { ...writeInputBase, contentFile: input.contentFile }
      : { ...writeInputBase, content: input.content },
    { allowDraftNotebook: true },
  );
};

export const showNotePage = (input: NoteReadInput): NotePage | null => {
  const identity = normalizeIdentity(input, {
    allowDraftNotebook: input.notebook === NOTE_DRAFT_NOTEBOOK,
  });
  for (const avatarHome of [...normalizeAvatarHome(input.avatarHome)].reverse()) {
    const page = withIndexedDatabase(avatarHome, (db) => {
      const record = db.getPageRecordByIdentity(identity);
      return record ? recordToPage(record) : null;
    });
    if (page) {
      return page;
    }
  }
  return null;
};

export const listNotePages = (input: NoteListInput): NotePage[] => {
  const visible = new Map<string, NotePage>();
  for (const avatarHome of normalizeAvatarHome(input.avatarHome)) {
    const pages = withIndexedDatabase(avatarHome, (db) =>
      db.listPages({ notebook: input.notebook, section: input.section, limit: 1_000 }).map(recordToPage),
    );
    for (const page of pages) {
      visible.set(createNoteKey(page.identity), page);
    }
  }
  const limit = Math.max(1, Math.min(input.limit ?? 100, 1_000));
  return [...visible.values()].sort((left, right) => left.path.localeCompare(right.path)).slice(0, limit);
};

export const listNoteTags = (input: NoteTagQueryInput): NoteTagSummary[] => {
  const counts = new Map<string, { id: string; name: string; count: number }>();
  for (const page of listNotePages({
    avatarHome: input.avatarHome,
    notebook: input.notebook,
    section: input.section,
    limit: 1_000,
  })) {
    page.metadata.tags.forEach((tag, index) => {
      const current = counts.get(tag);
      counts.set(tag, {
        id: page.metadata.tagIds[index] ?? current?.id ?? tag,
        name: tag,
        count: (current?.count ?? 0) + 1,
      });
    });
  }
  return [...counts.values()].sort((left, right) => left.name.localeCompare(right.name));
};

export const queryNoteSql = (input: NoteSqlQueryInput): { columns: string[]; rows: Array<Record<string, unknown>> } => {
  const writableHome = resolveWritableAvatarHome(input.avatarHome);
  return withIndexedDatabase(writableHome, (db) => db.queryReadOnly(input.sql, input.limit));
};

export const renameNotePages = (input: NoteRenameInput): NotePage[] => {
  const writableHome = resolveWritableAvatarHome(input.avatarHome);
  return withIndexedDatabase(writableHome, (db, noteRoot) => {
    const notebook = validateNoteSegment(input.notebook, {
      label: "notebook",
      allowDraftNotebook: input.notebook === NOTE_DRAFT_NOTEBOOK,
    });
    const section = validateNoteSegment(input.section, { label: "section" });
    const page = input.page ? validateNoteSegment(input.page, { label: "page" }) : undefined;
    const toNotebook = input.toNotebook ? validateNoteSegment(input.toNotebook, { label: "notebook" }) : undefined;
    const toSection = input.toSection ? validateNoteSegment(input.toSection, { label: "section" }) : undefined;
    const toPage = input.toPage ? validateNoteSegment(input.toPage, { label: "page" }) : undefined;
    const records = db.rename({
      notebook,
      section,
      page,
      toNotebook,
      toSection,
      toPage,
      resolvePath: (identity, record) => resolveNoteArtifactPath(noteRoot, identity, record.mime, record.path),
    });
    return records.map((record) => {
      const pageRecord = recordToPage(record);
      if (isMarkdownMime(pageRecord.metadata.mime)) {
        materializeArtifact({
          page: pageRecord,
          body: pageRecord.body,
          contentSource: { kind: "inline", content: pageRecord.body },
        });
      }
      return pageRecord;
    });
  });
};
