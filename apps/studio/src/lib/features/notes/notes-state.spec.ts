import { describe, expect, test } from "vitest";

import {
  createNotePageKey,
  firstNoteNotebookName,
  firstNotePageIdentity,
  firstNotePageListIdentity,
  firstNoteSectionName,
  flattenNoteCatalog,
  hasNoteCapability,
  mapNoteSearchResultItems,
  mapNoteSearchRows,
  mapNoteSqlResultItems,
  sameNotePageIdentity,
} from "./notes-state";

const catalog = {
  avatar: {
    nickname: "shell-assistant",
    principalId: "auth:shell-assistant",
    avatarHome: ["/avatar/shell-assistant"],
  },
  capability: {
    available: true,
    readableRoots: ["/avatar/shell-assistant"],
    writableRoot: "/avatar/shell-assistant",
  },
  notebooks: [
    {
      notebook: "ideas",
      sections: [
        {
          section: "shell",
          pages: [
            {
              notebook: "ideas",
              section: "shell",
              page: "note-system",
              path: "/avatar/shell-assistant/notes/ideas/shell/note-system.md",
              id: "page_note_system",
              bookId: "book_ideas",
              sectionId: "section_shell",
              pageId: "page_note_system",
              createdAt: "2026-05-31T15:30:00.000Z",
              updatedAt: "2026-05-31T15:31:00.000Z",
              mime: "text/markdown",
              tags: [],
              tagIds: [],
              referenceCount: 0,
              preview: "NoteSystem route.",
            },
          ],
        },
      ],
    },
  ],
  totalPages: 1,
};

describe("Feature: Notes route state projection", () => {
  test("Scenario: Given no note capability When Notes route state is projected Then the no-capability state is explicit", () => {
    const emptyCatalog = {
      avatar: {
        nickname: "missing",
        principalId: null,
        avatarHome: [],
      },
      capability: {
        available: false,
        readableRoots: [],
        writableRoot: null,
      },
      notebooks: [],
      totalPages: 0,
    };

    expect(hasNoteCapability(emptyCatalog)).toBe(false);
    expect(flattenNoteCatalog(emptyCatalog)).toEqual([]);
    expect(firstNotePageIdentity(emptyCatalog)).toBeNull();
  });

  test("Scenario: Given populated notes When Notes route state is projected Then grouping and selected identity stay stable", () => {
    const rows = flattenNoteCatalog(catalog);

    expect(hasNoteCapability(catalog)).toBe(true);
    expect(rows).toEqual([
      expect.objectContaining({
        key: "ideas/shell/note-system",
        notebook: "ideas",
        section: "shell",
        page: "note-system",
      }),
    ]);
    expect(firstNotePageIdentity(catalog)).toEqual({
      notebook: "ideas",
      section: "shell",
      page: "note-system",
    });
    expect(
      sameNotePageIdentity(firstNotePageIdentity(catalog), {
        notebook: "ideas",
        section: "shell",
        page: "note-system",
      }),
    ).toBe(true);
  });

  test("Scenario: Given paged browse outputs When selecting defaults Then each stage resolves independently", () => {
    const notebooks = {
      avatar: catalog.avatar,
      capability: catalog.capability,
      notebooks: [
        {
          notebook: "ideas",
          sectionCount: 1,
          pageCount: 1,
          createdAt: "2026-05-31T15:30:00.000Z",
          updatedAt: "2026-05-31T15:31:00.000Z",
          sourceWorkspaces: [],
        },
      ],
      totalNotebooks: 1,
      totalPages: 1,
      nextCursor: null,
    };
    const sections = {
      avatar: catalog.avatar,
      capability: catalog.capability,
      notebook: "ideas",
      sections: [
        {
          notebook: "ideas",
          section: "shell",
          pageCount: 1,
          createdAt: "2026-05-31T15:30:00.000Z",
          updatedAt: "2026-05-31T15:31:00.000Z",
          sourceWorkspaces: [],
        },
      ],
      totalSections: 1,
      totalPages: 1,
      nextCursor: null,
    };
    const pages = {
      avatar: catalog.avatar,
      capability: catalog.capability,
      notebook: "ideas",
      section: "shell",
      pages: catalog.notebooks[0]?.sections[0]?.pages ?? [],
      totalPages: 1,
      nextCursor: null,
    };

    expect(firstNoteNotebookName(notebooks)).toBe("ideas");
    expect(firstNoteSectionName(sections)).toBe("shell");
    expect(firstNotePageListIdentity(pages)).toEqual({
      notebook: "ideas",
      section: "shell",
      page: "note-system",
    });
    expect(hasNoteCapability(notebooks)).toBe(true);
  });

  test("Scenario: Given search results When mapped for rendering Then result keys preserve notebook section and page identity", () => {
    const rows = mapNoteSearchRows([
      {
        notebook: "ideas",
        section: "shell",
        page: "note-system",
        id: "page_note_system",
        bookId: "book_ideas",
        sectionId: "section_shell",
        pageId: "page_note_system",
        path: "/avatar/shell-assistant/notes/ideas/shell/note-system.md",
        score: 1.25,
        snippet: "NoteSystem route.",
        tags: ["architecture"],
        references: [],
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        key: createNotePageKey({
          notebook: "ideas",
          section: "shell",
          page: "note-system",
        }),
        snippet: "NoteSystem route.",
      }),
    ]);
    expect(mapNoteSearchResultItems(rows)).toEqual([
      expect.objectContaining({
        title: "note-system",
        subtitle: "ideas / shell",
        badges: expect.arrayContaining([expect.objectContaining({ label: "architecture" })]),
      }),
    ]);
  });

  test("Scenario: Given SQL rows with note identity When mapped for Query results Then selectable rows share the page detail key", () => {
    const rows = mapNoteSqlResultItems({
      avatar: catalog.avatar,
      capability: catalog.capability,
      columns: ["notebook", "section", "page", "mime", "updatedAt"],
      rows: [
        {
          notebook: "ideas",
          section: "shell",
          page: "note-system",
          mime: "text/markdown",
          updatedAt: "2026-05-31T15:31:00.000Z",
        },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        key: "ideas/shell/note-system",
        identity: {
          notebook: "ideas",
          section: "shell",
          page: "note-system",
        },
        title: "note-system",
        subtitle: "ideas / shell",
        description: undefined,
        badges: [expect.objectContaining({ label: "text/markdown" })],
        fields: [{ label: "updatedAt", value: "2026-05-31T15:31:00.000Z" }],
      }),
    ]);
  });

  test("Scenario: Given SQL rows without complete note identity When mapped for Query results Then rows stay structured but not selectable", () => {
    const rows = mapNoteSqlResultItems({
      avatar: catalog.avatar,
      capability: catalog.capability,
      columns: ["count", "notebook"],
      rows: [
        {
          count: 3,
          notebook: "ideas",
        },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        identity: null,
        title: "Row 1",
        fields: [
          { label: "count", value: "3" },
        ],
        disabledReason: "This row does not include notebook, section, and page columns.",
      }),
    ]);
  });
});
