import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InMemoryFs } from "just-bash";

import {
  NOTE_DRAFT_NOTEBOOK,
  NOTE_AVATAR_HOME_ENV,
  createNoteCommand,
  draftNotePage,
  listNotePages,
  listNoteTags,
  listNoteCatalog,
  parseNoteAvatarHomeEnv,
  projectNoteCliCapabilities,
  queryNoteSql,
  readNotePage,
  renameNotePages,
  searchNoteCatalog,
  searchNotes,
  serializeNoteAvatarHomeEnv,
  showNotePage,
  writeNotePage,
} from "../src";

const tempDirs: string[] = [];

const createTempRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "agenter-note-system-"));
  tempDirs.push(root);
  return root;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: NoteSystem avatar-private note projection", () => {
  test("Scenario: Given empty AVATAR_HOME When note CLI projection runs Then avatar-private note CLI is withheld", () => {
    expect(projectNoteCliCapabilities({ avatarHome: [] })).toEqual([]);
  });

  test("Scenario: Given a workspace gains note capability When projection is inspected Then no hidden note file is created", () => {
    const avatarHome = createTempRoot();

    const projection = projectNoteCliCapabilities({ avatarHome: [avatarHome] });

    expect(projection).toEqual([
      {
        command: "note",
        capability: "avatar-private",
        writableRoot: avatarHome,
      },
    ]);
    expect(existsSync(join(avatarHome, "notes"))).toBeFalse();
  });

  test("Scenario: Given non-empty AVATAR_HOME When a note is written Then it is stored as a note fact", () => {
    const avatarHome = createTempRoot();

    const result = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      page: "env-first",
      body: "Capture capability projection as env law.",
      now: new Date("2026-05-31T15:30:00.000Z"),
      sourceWorkspace: "/repo",
    });

    expect(result.path).toBe(join(avatarHome, "notes", "ideas", "shell", "env-first.md"));
    const content = readFileSync(result.path, "utf8");
    expect(content).toContain("kind: note");
    expect(content).toContain("notebook: ideas");
    expect(content).toContain("sourceWorkspace: /repo");
    expect(content).not.toContain("kind: memory");
  });

  test("Scenario: Given notebook section page input When a note page is written Then Markdown frontmatter is stored under that hierarchy", () => {
    const avatarHome = createTempRoot();

    const result = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "产品想法",
      section: "shell",
      page: "note-system",
      body: "# Note\n\nUse markdown.",
      now: new Date("2026-05-31T15:30:00.000Z"),
    });

    expect(result.identity).toMatchObject({
      notebook: "产品想法",
      section: "shell",
      page: "note-system",
    });
    expect(result.body).toBe("# Note\n\nUse markdown.");
    expect(readFileSync(result.path, "utf8")).toContain("---\nkind: note\n");
  });

  test("Scenario: Given unsafe note path segments When note write runs Then traversal names are rejected", () => {
    const avatarHome = createTempRoot();

    expect(() =>
      writeNotePage({
        avatarHome: [avatarHome],
        notebook: "../escape",
        section: "shell",
        page: "bad",
        body: "bad",
      }),
    ).toThrow("note notebook segment is unsafe");
    expect(existsSync(join(avatarHome, "escape.md"))).toBeFalse();
  });

  test("Scenario: Given note draft When content is captured Then the draft notebook uses date section and high-precision page", () => {
    const avatarHome = createTempRoot();

    const result = draftNotePage({
      avatarHome: [avatarHome],
      body: "Fast capture.",
      now: new Date("2026-05-31T15:30:00.123Z"),
      idSuffix: "abc123",
    });

    expect(result.identity.notebook).toBe(NOTE_DRAFT_NOTEBOOK);
    expect(result.identity.section).toBe("2026-05-31");
    expect(result.identity.page).toBe("153000123-abc123");
    expect(result.path).toBe(join(avatarHome, "notes", NOTE_DRAFT_NOTEBOOK, "2026-05-31", "153000123-abc123.md"));
  });

  test("Scenario: Given a non-empty page When note write runs without mode Then a conflict error is returned and content is unchanged", () => {
    const avatarHome = createTempRoot();
    const first = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      page: "conflict",
      body: "Original body.",
      now: new Date("2026-05-31T15:30:00.000Z"),
    });

    expect(() =>
      writeNotePage({
        avatarHome: [avatarHome],
        notebook: "ideas",
        section: "shell",
        page: "conflict",
        body: "New body.",
      }),
    ).toThrow("note page already has content; pass mode append or override");
    expect(showNotePage({ avatarHome: [avatarHome], notebook: "ideas", section: "shell", page: "conflict" })?.body).toBe(
      first.body,
    );
  });

  test("Scenario: Given a non-empty page When append mode is used Then content is appended and metadata is updated", () => {
    const avatarHome = createTempRoot();
    writeNotePage({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      page: "append",
      body: "Original body.",
      now: new Date("2026-05-31T15:30:00.000Z"),
    });

    const result = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      page: "append",
      body: "Appended body.",
      mode: "append",
      now: new Date("2026-05-31T15:31:00.000Z"),
    });

    expect(result.body).toBe("Original body.\n\nAppended body.");
    expect(result.metadata.createdAt).toBe("2026-05-31T15:30:00.000Z");
    expect(result.metadata.updatedAt).toBe("2026-05-31T15:31:00.000Z");
  });

  test("Scenario: Given a non-empty page When override mode is used Then body content is replaced while identity remains stable", () => {
    const avatarHome = createTempRoot();
    const first = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      page: "override",
      body: "Original body.",
      now: new Date("2026-05-31T15:30:00.000Z"),
    });

    const result = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      page: "override",
      body: "Replacement body.",
      mode: "override",
      now: new Date("2026-05-31T15:32:00.000Z"),
    });

    expect(result.body).toBe("Replacement body.");
    expect(result.metadata.id).toBe(first.metadata.id);
    expect(result.identity).toEqual(first.identity);
  });

  test("Scenario: Given local notes When note search runs Then MiniSearch returns note metadata without external services", () => {
    const avatarHome = createTempRoot();
    writeNotePage({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      page: "searchable",
      body: "Env first capability projection should be searchable.",
    });

    const results = searchNotes({ avatarHome: [avatarHome], query: "capability projection" });

    expect(results[0]).toMatchObject({
      notebook: "ideas",
      section: "shell",
      page: "searchable",
    });
    expect(results[0]?.score).toBeGreaterThan(0);
    expect(results[0]?.snippet).toContain("capability projection");
  });

  test("Scenario: Given another workspace has notes When note list show and search run Then only the current workspace group is used", () => {
    const currentAvatarHome = createTempRoot();
    const otherAvatarHome = createTempRoot();
    writeNotePage({
      avatarHome: [currentAvatarHome],
      notebook: "ideas",
      section: "shell",
      page: "current",
      body: "Current workspace note.",
    });
    writeNotePage({
      avatarHome: [otherAvatarHome],
      notebook: "ideas",
      section: "shell",
      page: "other",
      body: "Other workspace hidden note.",
    });

    expect(listNotePages({ avatarHome: [currentAvatarHome] }).map((page) => page.identity.page)).toEqual(["current"]);
    expect(showNotePage({ avatarHome: [currentAvatarHome], notebook: "ideas", section: "shell", page: "other" })).toBeNull();
    expect(searchNotes({ avatarHome: [currentAvatarHome], query: "hidden" })).toEqual([]);
  });

  test("Scenario: Given note CLI has AVATAR_HOME When note write runs Then stdin content is written through the command", async () => {
    const avatarHome = createTempRoot();
    const command = createNoteCommand();

    const result = await command.execute(["write", "--notebook", "ideas", "--section", "shell", "--page", "cli"], {
      fs: new InMemoryFs(),
      cwd: "/repo",
      env: new Map([[NOTE_AVATAR_HOME_ENV, serializeNoteAvatarHomeEnv([avatarHome])]]),
      stdin: "CLI body.",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ideas/shell/cli");
    expect(readFileSync(join(avatarHome, "notes", "ideas", "shell", "cli.md"), "utf8")).toContain("CLI body.");
  });

  test("Scenario: Given descriptor-backed note CLI When help and JSON write run Then schema help and structured metadata are returned", async () => {
    const avatarHome = createTempRoot();
    const command = createNoteCommand();

    const help = await command.execute(["write", "--help"], {
      fs: new InMemoryFs(),
      cwd: "/repo",
      env: new Map([[NOTE_AVATAR_HOME_ENV, serializeNoteAvatarHomeEnv([avatarHome])]]),
      stdin: "",
    });
    const result = await command.execute(
      [
        "write",
        JSON.stringify({
          notebook: "shell-assistant-book",
          section: "working-context",
          page: "json-cli",
          content: "JSON CLI body.",
          tags: ["Task", "Terminal"],
        }),
      ],
      {
        fs: new InMemoryFs(),
        cwd: "/repo",
        env: new Map([[NOTE_AVATAR_HOME_ENV, serializeNoteAvatarHomeEnv([avatarHome])]]),
        stdin: "",
      },
    );

    expect(help.stdout).toContain("Input JSON schema");
    expect(help.stdout).toContain("Only canonical JSON input is accepted");
    expect(result.exitCode).toBe(0);
    const page = JSON.parse(result.stdout) as Awaited<ReturnType<typeof writeNotePage>>;
    expect(page.metadata).toMatchObject({
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "json-cli",
      mime: "text/markdown",
      tags: ["task", "terminal"],
    });
    expect(page.metadata.bookId).toStartWith("book_");
    expect(page.metadata.sectionId).toStartWith("section_");
    expect(page.metadata.pageId).toStartWith("page_");
    expect(page.metadata.tagIds).toHaveLength(2);
  });

  test("Scenario: Given a host env reader When note CLI runs Then the package does not own host env parsing", async () => {
    const avatarHome = createTempRoot();
    const command = createNoteCommand({
      readAvatarHome: (env) => parseNoteAvatarHomeEnv(env.get("HOST_AVATAR_HOME")),
    });

    const result = await command.execute(
      [
        "write",
        JSON.stringify({
          notebook: "ideas",
          section: "shell",
          page: "host-env",
          content: "Host env reader injected.",
        }),
      ],
      {
        fs: new InMemoryFs(),
        cwd: "/repo",
        env: new Map([["HOST_AVATAR_HOME", serializeNoteAvatarHomeEnv([avatarHome])]]),
        stdin: "",
      },
    );

    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(avatarHome, "notes", "ideas", "shell", "host-env.md"), "utf8")).toContain(
      "Host env reader injected.",
    );
  });

  test("Scenario: Given markdown notes with tags and relative links When write completes Then SQLite IDs references and note URI frontmatter are returned", () => {
    const avatarHome = createTempRoot();
    const target = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "target",
      body: "Target body.",
      tags: ["Anchor"],
      now: new Date("2026-06-01T08:00:00.000Z"),
    });

    const source = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "source",
      body: "See [target](./target.md).",
      tags: ["Terminal", "Preference"],
      now: new Date("2026-06-01T08:01:00.000Z"),
    });

    expect(source.metadata.references).toEqual([
      expect.objectContaining({
        uri: "note:shell-assistant-book/working-context/target",
        pageId: target.metadata.pageId,
        notebook: "shell-assistant-book",
        section: "working-context",
        page: "target",
      }),
    ]);
    expect(source.body).toBe("See [target](note:shell-assistant-book/working-context/target).");
    const stored = readFileSync(source.path, "utf8");
    expect(stored).toContain("bookId: book_");
    expect(stored).toContain('tags: ["preference","terminal"]');
    expect(stored).toContain('references: ["note:shell-assistant-book/working-context/target"]');
  });

  test("Scenario: Given existing markdown files When note index builds Then files are indexed without rewriting user content", () => {
    const avatarHome = createTempRoot();
    const pagePath = join(avatarHome, "notes", "ideas", "shell", "manual.md");
    mkdirSync(join(avatarHome, "notes", "ideas", "shell"), { recursive: true });
    const original = "# Manual\n\nExisting note without frontmatter.\n";
    writeFileSync(pagePath, original, "utf8");

    const pages = listNotePages({ avatarHome: [avatarHome] });

    expect(pages[0]?.metadata.pageId).toStartWith("page_");
    expect(pages[0]?.body).toContain("Existing note without frontmatter.");
    expect(readFileSync(pagePath, "utf8")).toBe(original);
  });

  test("Scenario: Given tagged pages When tags are queried Then notebook section and tag-filtered search are supported", () => {
    const avatarHome = createTempRoot();
    writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "semantic-rules",
      page: "terminal",
      body: "Terminal preference.",
      tags: ["terminal", "preference"],
    });
    writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "task",
      body: "Task context.",
      tags: ["task"],
    });

    expect(listNoteTags({ avatarHome: [avatarHome], notebook: "shell-assistant-book" }).map((tag) => [tag.name, tag.count])).toEqual([
      ["preference", 1],
      ["task", 1],
      ["terminal", 1],
    ]);
    expect(listNoteTags({ avatarHome: [avatarHome], notebook: "shell-assistant-book", section: "semantic-rules" }).map((tag) => tag.name)).toEqual([
      "preference",
      "terminal",
    ]);
    expect(searchNotes({ avatarHome: [avatarHome], query: "", tags: ["terminal", "preference"] }).map((page) => page.page)).toEqual([
      "terminal",
    ]);
  });

  test("Scenario: Given note facts When SQL query runs Then SELECT succeeds and mutating statements are rejected", () => {
    const avatarHome = createTempRoot();
    writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "sql",
      body: "SQL visible.",
      tags: ["query"],
    });

    const result = queryNoteSql({
      avatarHome: [avatarHome],
      sql: "select notebook, section, page from note_pages_view where notebook = 'shell-assistant-book'",
    });

    expect(result.columns).toEqual(["notebook", "section", "page"]);
    expect(result.rows).toEqual([{ notebook: "shell-assistant-book", section: "working-context", page: "sql" }]);
    expect(() => queryNoteSql({ avatarHome: [avatarHome], sql: "delete from note_pages" })).toThrow("read-only");
  });

  test("Scenario: Given MIME writes When JSON and binary-like source inputs run Then JSON is compacted and source files are copied safely", () => {
    const avatarHome = createTempRoot();
    const sourcePath = join(createTempRoot(), "payload.bin");
    writeFileSync(sourcePath, "binary-ish", "utf8");

    const json = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "json",
      body: '{ "b": 2, "a": [1, true] }',
      mime: "application/json",
    });
    const binary = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "asset",
      mime: "application/octet-stream",
      sourcePath,
    });

    expect(json.path.endsWith(".json")).toBeTrue();
    expect(readFileSync(json.path, "utf8")).toBe('{"b":2,"a":[1,true]}');
    expect(binary.path.endsWith(".bin")).toBeTrue();
    expect(readFileSync(binary.path, "utf8")).toBe("binary-ish");
    expect(() =>
      writeNotePage({
        avatarHome: [avatarHome],
        notebook: "shell-assistant-book",
        section: "working-context",
        page: "json",
        body: "{ invalid",
        mime: "application/json",
        mode: "override",
      }),
    ).toThrow("note JSON body is invalid");
    expect(readFileSync(json.path, "utf8")).toBe('{"b":2,"a":[1,true]}');
  });

  test("Scenario: Given invalid and explicit references When notes are written Then invalid references fail and explicit ID references resolve", () => {
    const avatarHome = createTempRoot();
    const target = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "semantic-rules",
      page: "target",
      body: "Target.",
    });

    expect(() =>
      writeNotePage({
        avatarHome: [avatarHome],
        notebook: "shell-assistant-book",
        section: "semantic-rules",
        page: "broken",
        body: "Broken [missing](./missing.md).",
      }),
    ).toThrow("note reference target not found");
    expect(existsSync(join(avatarHome, "notes", "shell-assistant-book", "semantic-rules", "broken.md"))).toBeFalse();

    const json = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "semantic-rules",
      page: "json-ref",
      body: '{"ok":true}',
      mime: "application/json",
      references: [{ pageId: target.metadata.pageId, label: "target" }],
    });
    expect(json.metadata.references[0]).toMatchObject({
      pageId: target.metadata.pageId,
      uri: "note:shell-assistant-book/semantic-rules/target",
      label: "target",
    });
  });

  test("Scenario: Given referenced pages When rename runs Then pageId and reference edges survive and conflicts are rejected", () => {
    const avatarHome = createTempRoot();
    const target = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "target",
      body: "Target.",
    });
    writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "source",
      body: "See [target](./target.md).",
    });
    writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "conflict",
      body: "Conflict.",
    });

    const renamed = renameNotePages({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "target",
      toPage: "renamed",
    });
    const source = showNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "source",
    });

    expect(renamed[0]?.metadata.pageId).toBe(target.metadata.pageId);
    expect(renamed[0]?.identity.page).toBe("renamed");
    expect(source?.metadata.references[0]).toMatchObject({
      pageId: target.metadata.pageId,
      page: "renamed",
    });
    expect(() =>
      renameNotePages({
        avatarHome: [avatarHome],
        notebook: "shell-assistant-book",
        section: "working-context",
        page: "renamed",
        toPage: "conflict",
      }),
    ).toThrow("note rename conflict");
    expect(showNotePage({ avatarHome: [avatarHome], notebook: "shell-assistant-book", section: "working-context", page: "renamed" })?.metadata.pageId).toBe(
      target.metadata.pageId,
    );
  });

  test("Scenario: Given notes exist under AVATAR_HOME When note catalog is requested Then notebooks sections pages and capability state are returned", () => {
    const avatarHome = createTempRoot();
    writeNotePage({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      page: "catalog",
      body: "Catalog body.",
      now: new Date("2026-05-31T15:30:00.000Z"),
      sourceWorkspace: "/repo",
    });

    const catalog = listNoteCatalog({ avatarHome: [avatarHome] });

    expect(catalog.capability).toEqual({
      available: true,
      readableRoots: [avatarHome],
      writableRoot: avatarHome,
    });
    expect(catalog.totalPages).toBe(1);
    expect(catalog.notebooks[0]?.notebook).toBe("ideas");
    expect(catalog.notebooks[0]?.sections[0]?.section).toBe("shell");
    expect(catalog.notebooks[0]?.sections[0]?.pages[0]).toMatchObject({
      notebook: "ideas",
      section: "shell",
      page: "catalog",
      sourceWorkspace: "/repo",
      preview: "Catalog body.",
    });
  });

  test("Scenario: Given a notebook section page identity When note page is requested Then metadata and Markdown body are returned", () => {
    const avatarHome = createTempRoot();
    writeNotePage({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      page: "detail",
      body: "# Detail\n\nNote body.",
    });

    const found = readNotePage({ avatarHome: [avatarHome], notebook: "ideas", section: "shell", page: "detail" });
    const missing = readNotePage({ avatarHome: [avatarHome], notebook: "ideas", section: "shell", page: "missing" });

    expect(found.page?.body).toBe("# Detail\n\nNote body.");
    expect(found.page?.metadata.kind).toBe("note");
    expect(missing.capability.available).toBeTrue();
    expect(missing.page).toBeNull();
  });

  test("Scenario: Given local notes When note search is requested Then note metadata score snippet and path are preserved", () => {
    const avatarHome = createTempRoot();
    writeNotePage({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      page: "search-api",
      body: "Searchable capability projection note body.",
    });

    const result = searchNoteCatalog({ avatarHome: [avatarHome], query: "projection" });

    expect(result.capability.available).toBeTrue();
    expect(result.results[0]).toMatchObject({
      notebook: "ideas",
      section: "shell",
      page: "search-api",
    });
    expect(result.results[0]?.score).toBeGreaterThan(0);
    expect(result.results[0]?.snippet).toContain("projection");
    expect(result.results[0]?.path).toBe(join(avatarHome, "notes", "ideas", "shell", "search-api.md"));
  });

  test("Scenario: Given empty AVATAR_HOME When note surface APIs run Then no capability is reported", () => {
    expect(listNoteCatalog({ avatarHome: [] })).toEqual({
      capability: { available: false, readableRoots: [], writableRoot: null },
      notebooks: [],
      totalPages: 0,
    });
    expect(readNotePage({ avatarHome: [], notebook: "ideas", section: "shell", page: "missing" })).toEqual({
      capability: { available: false, readableRoots: [], writableRoot: null },
      page: null,
    });
    expect(searchNoteCatalog({ avatarHome: [], query: "anything" })).toEqual({
      capability: { available: false, readableRoots: [], writableRoot: null },
      results: [],
    });
  });
});
