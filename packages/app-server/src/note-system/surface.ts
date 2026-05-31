import { isAbsolute, resolve } from "node:path";

import { searchNotes } from "./search";
import { listNotePages, showNotePage } from "./storage";
import type {
  NoteCapabilityState,
  NoteCatalogOutput,
  NoteIdentity,
  NoteNotebookGroup,
  NotePage,
  NotePageOutput,
  NotePageSummary,
  NoteSearchOutput,
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
  createdAt: page.metadata.createdAt,
  updatedAt: page.metadata.updatedAt,
  tags: [...page.metadata.tags],
  sourceWorkspace: page.metadata.sourceWorkspace,
  preview: page.body.trim().slice(0, 240),
});

export const listNoteCatalog = (input: {
  avatarHome: readonly string[];
  limit?: number;
}): NoteCatalogOutput => {
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
    }),
  };
};
