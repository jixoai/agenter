import { isAbsolute, resolve } from "node:path";

import { searchNotes } from "./search";
import {
  countNoteNotebooks,
  countNotePages,
  countNoteSections,
  listNoteNotebookSummaries,
  listNotePages,
  listNoteSectionSummaries,
  listNoteTags,
  queryNoteSql,
  renameNotePages,
  showNotePage,
  writeNotePage,
} from "./storage";
import type {
  NoteCapabilityState,
  NoteCatalogOutput,
  NoteIdentity,
  NoteListSort,
  NoteNotebookGroup,
  NoteNotebookListOutput,
  NotePage,
  NotePageListOutput,
  NotePageOutput,
  NotePageSummary,
  NotePaginationInput,
  NoteRenameInput,
  NoteRenameOutput,
  NoteSearchOutput,
  NoteSectionListOutput,
  NoteSqlQueryInput,
  NoteSqlQueryOutput,
  NoteTagQueryInput,
  NoteTagQueryOutput,
  NoteWriteInput,
} from "./types";

const normalizeAvatarHomeRoots = (avatarHome: readonly string[]): string[] => [
  ...new Set(
    avatarHome
      .map((root) => root.trim())
      .filter((root) => root.length > 0 && isAbsolute(root))
      .map((root) => resolve(root)),
  ),
];

export const buildNoteCapabilityState = (avatarHome: readonly string[]): NoteCapabilityState => {
  const readableRoots = normalizeAvatarHomeRoots(avatarHome);
  return {
    available: readableRoots.length > 0,
    readableRoots,
    writableRoot: readableRoots.at(-1) ?? null,
  };
};

const summarizeNotePage = (page: NotePage): NotePageSummary => ({
  ...page.identity,
  path: page.path,
  id: page.metadata.id,
  bookId: page.metadata.bookId,
  sectionId: page.metadata.sectionId,
  pageId: page.metadata.pageId,
  createdAt: page.metadata.createdAt,
  updatedAt: page.metadata.updatedAt,
  mime: page.metadata.mime,
  tags: [...page.metadata.tags],
  tagIds: [...page.metadata.tagIds],
  referenceCount: page.metadata.references.length,
  sourceWorkspace: page.metadata.sourceWorkspace,
  preview: page.body.trim().slice(0, 240),
});

const DEFAULT_NOTE_INDEX_LIMIT = 100;

const resolvePaginationOffset = (cursor: string | undefined): number => {
  if (cursor === undefined || cursor.trim().length === 0) {
    return 0;
  }
  const parsed = Number(cursor);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`note pagination cursor is invalid: ${cursor}`);
  }
  return parsed;
};

const resolvePaginationLimit = (limit: number | undefined): number =>
  Math.max(1, Math.min(limit ?? DEFAULT_NOTE_INDEX_LIMIT, 1_000));

const resolveNextCursor = (input: { offset: number; count: number; total: number }): string | null => {
  const nextOffset = input.offset + input.count;
  return nextOffset < input.total ? String(nextOffset) : null;
};

export const listNoteCatalog = (input: { avatarHome: readonly string[]; limit?: number }): NoteCatalogOutput => {
  const capability = buildNoteCapabilityState(input.avatarHome);
  if (!capability.available) {
    return { capability, notebooks: [], totalPages: 0 };
  }
  const pages = listNotePages({ avatarHome: capability.readableRoots, limit: input.limit });
  const notebooksByName = new Map<string, Map<string, NotePageSummary[]>>();
  for (const page of pages.map(summarizeNotePage)) {
    const sections = notebooksByName.get(page.notebook) ?? new Map<string, NotePageSummary[]>();
    const sectionPages = sections.get(page.section) ?? [];
    sectionPages.push(page);
    sections.set(page.section, sectionPages);
    notebooksByName.set(page.notebook, sections);
  }
  const notebooks: NoteNotebookGroup[] = [...notebooksByName.entries()].map(([notebook, sections]) => ({
    notebook,
    sections: [...sections.entries()].map(([section, sectionPages]) => ({
      section,
      pages: sectionPages.sort((left, right) => left.page.localeCompare(right.page)),
    })),
  }));
  return {
    capability,
    notebooks: notebooks.sort((left, right) => left.notebook.localeCompare(right.notebook)),
    totalPages: pages.length,
  };
};

export const listNoteNotebooks = (
  input: {
    avatarHome: readonly string[];
    sort?: NoteListSort;
  } & NotePaginationInput,
): NoteNotebookListOutput => {
  const capability = buildNoteCapabilityState(input.avatarHome);
  if (!capability.available) {
    return { capability, notebooks: [], totalNotebooks: 0, totalPages: 0, nextCursor: null };
  }
  const offset = resolvePaginationOffset(input.cursor);
  const limit = resolvePaginationLimit(input.limit);
  const notebooks = listNoteNotebookSummaries({
    avatarHome: capability.readableRoots,
    offset,
    limit,
    sort: input.sort,
  });
  const totalNotebooks = countNoteNotebooks({ avatarHome: capability.readableRoots });
  return {
    capability,
    notebooks,
    totalNotebooks,
    totalPages: countNotePages({ avatarHome: capability.readableRoots }),
    nextCursor: resolveNextCursor({ offset, count: notebooks.length, total: totalNotebooks }),
  };
};

export const listNoteSections = (
  input: {
    avatarHome: readonly string[];
    notebook: string;
    sort?: NoteListSort;
  } & NotePaginationInput,
): NoteSectionListOutput => {
  const capability = buildNoteCapabilityState(input.avatarHome);
  if (!capability.available) {
    return { capability, notebook: input.notebook, sections: [], totalSections: 0, totalPages: 0, nextCursor: null };
  }
  const offset = resolvePaginationOffset(input.cursor);
  const limit = resolvePaginationLimit(input.limit);
  const sections = listNoteSectionSummaries({
    avatarHome: capability.readableRoots,
    notebook: input.notebook,
    offset,
    limit,
    sort: input.sort,
  });
  const totalSections = countNoteSections({ avatarHome: capability.readableRoots, notebook: input.notebook });
  return {
    capability,
    notebook: input.notebook,
    sections,
    totalSections,
    totalPages: countNotePages({ avatarHome: capability.readableRoots, notebook: input.notebook }),
    nextCursor: resolveNextCursor({ offset, count: sections.length, total: totalSections }),
  };
};

export const listNoteSectionPages = (
  input: {
    avatarHome: readonly string[];
    notebook: string;
    section: string;
    sort?: NoteListSort;
  } & NotePaginationInput,
): NotePageListOutput => {
  const capability = buildNoteCapabilityState(input.avatarHome);
  if (!capability.available) {
    return {
      capability,
      notebook: input.notebook,
      section: input.section,
      pages: [],
      totalPages: 0,
      nextCursor: null,
    };
  }
  const offset = resolvePaginationOffset(input.cursor);
  const limit = resolvePaginationLimit(input.limit);
  const pages = listNotePages({
    avatarHome: capability.readableRoots,
    notebook: input.notebook,
    section: input.section,
    offset,
    limit,
    sort: input.sort,
  }).map(summarizeNotePage);
  const totalPages = countNotePages({
    avatarHome: capability.readableRoots,
    notebook: input.notebook,
    section: input.section,
  });
  return {
    capability,
    notebook: input.notebook,
    section: input.section,
    pages,
    totalPages,
    nextCursor: resolveNextCursor({ offset, count: pages.length, total: totalPages }),
  };
};

export const readNotePage = (
  input: NoteIdentity & {
    avatarHome: readonly string[];
  },
): NotePageOutput => {
  const capability = buildNoteCapabilityState(input.avatarHome);
  if (!capability.available) {
    return { capability, page: null };
  }
  return {
    capability,
    page: showNotePage({ ...input, avatarHome: capability.readableRoots }),
  };
};

export const searchNoteCatalog = (input: {
  avatarHome: readonly string[];
  query: string;
  limit?: number;
  tags?: readonly string[];
}): NoteSearchOutput => {
  const capability = buildNoteCapabilityState(input.avatarHome);
  if (!capability.available) {
    return { capability, results: [] };
  }
  return {
    capability,
    results: searchNotes({
      avatarHome: capability.readableRoots,
      query: input.query,
      limit: input.limit,
      tags: input.tags,
    }),
  };
};

export const listNoteTagCatalog = (input: NoteTagQueryInput): NoteTagQueryOutput => {
  const capability = buildNoteCapabilityState(input.avatarHome);
  if (!capability.available) {
    return { capability, tags: [] };
  }
  return {
    capability,
    tags: listNoteTags({
      avatarHome: capability.readableRoots,
      notebook: input.notebook,
      section: input.section,
    }),
  };
};

export const queryNoteCatalogSql = (input: NoteSqlQueryInput): NoteSqlQueryOutput => {
  const capability = buildNoteCapabilityState(input.avatarHome);
  if (!capability.available) {
    return { capability, columns: [], rows: [] };
  }
  const result = queryNoteSql({ ...input, avatarHome: capability.readableRoots });
  return { capability, ...result };
};

export const renameNoteCatalogPages = (input: NoteRenameInput): NoteRenameOutput => {
  const capability = buildNoteCapabilityState(input.avatarHome);
  if (!capability.available) {
    return { capability, pages: [] };
  }
  return { capability, pages: renameNotePages({ ...input, avatarHome: capability.readableRoots }) };
};

export const writeNoteCatalogPage = (input: NoteWriteInput): NotePageOutput => {
  const capability = buildNoteCapabilityState(input.avatarHome);
  if (!capability.available) {
    return { capability, page: null };
  }
  return { capability, page: writeNotePage({ ...input, avatarHome: capability.readableRoots }) };
};
