import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InMemoryFs } from "just-bash";

import {
  NOTE_AVATAR_HOME_ENV,
  NOTE_DRAFT_NOTEBOOK,
  createNoteCommand,
  draftNotePage,
  listNoteCatalog,
  listNoteNotebooks,
  listNotePages,
  listNoteSectionPages,
  listNoteSections,
  listNoteTags,
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
      content: "Capture capability projection as env law.",
      mime: "text/markdown",
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
      content: "# Note\n\nUse markdown.",
      mime: "text/markdown",
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
        content: "bad",
        mime: "text/markdown",
      }),
    ).toThrow("note notebook segment is unsafe");
    expect(existsSync(join(avatarHome, "escape.md"))).toBeFalse();
  });

  test("Scenario: Given note draft When content is captured Then the draft notebook uses date section and readable time page", () => {
    const avatarHome = createTempRoot();

    const result = draftNotePage({
      avatarHome: [avatarHome],
      content: "Fast capture.",
      mime: "text/markdown",
      now: new Date("2026-05-31T15:30:00.123Z"),
    });

    expect(result.identity.notebook).toBe(NOTE_DRAFT_NOTEBOOK);
    expect(result.identity.section).toBe("2026-05-31");
    expect(result.identity.page).toBe("15:30:00");
    expect(result.path).toBe(join(avatarHome, "notes", NOTE_DRAFT_NOTEBOOK, "2026-05-31", "15:30:00.md"));
  });

  test("Scenario: Given repeated note drafts in the same second When content is captured Then only collisions receive a short counter tail", () => {
    const avatarHome = createTempRoot();
    const now = new Date("2026-05-31T15:30:00.123Z");

    const first = draftNotePage({
      avatarHome: [avatarHome],
      content: "First capture.",
      mime: "text/markdown",
      now,
    });
    const second = draftNotePage({
      avatarHome: [avatarHome],
      content: "Second capture.",
      mime: "text/markdown",
      now,
    });

    expect(first.identity.page).toBe("15:30:00");
    expect(second.identity.page).toBe("15:30:00(1)");
    expect(readFileSync(first.path, "utf8")).toContain("First capture.");
    expect(readFileSync(second.path, "utf8")).toContain("Second capture.");
  });

  test("Scenario: Given a non-empty page When note write runs without mode Then a conflict error is returned and content is unchanged", () => {
    const avatarHome = createTempRoot();
    const first = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      page: "conflict",
      content: "Original body.",
      mime: "text/markdown",
      now: new Date("2026-05-31T15:30:00.000Z"),
    });

    expect(() =>
      writeNotePage({
        avatarHome: [avatarHome],
        notebook: "ideas",
        section: "shell",
        page: "conflict",
        content: "New body.",
        mime: "text/markdown",
      }),
    ).toThrow("note page already has content; pass mode append or override");
    expect(
      showNotePage({ avatarHome: [avatarHome], notebook: "ideas", section: "shell", page: "conflict" })?.body,
    ).toBe(first.body);
  });

  test("Scenario: Given a non-empty page When append mode is used Then content is appended and metadata is updated", () => {
    const avatarHome = createTempRoot();
    writeNotePage({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      page: "append",
      content: "Original body.",
      mime: "text/markdown",
      now: new Date("2026-05-31T15:30:00.000Z"),
    });

    const result = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      page: "append",
      content: "Appended body.",
      mime: "text/markdown",
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
      content: "Original body.",
      mime: "text/markdown",
      now: new Date("2026-05-31T15:30:00.000Z"),
    });

    const result = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      page: "override",
      content: "Replacement body.",
      mime: "text/markdown",
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
      content: "Env first capability projection should be searchable.",
      mime: "text/markdown",
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
      content: "Current workspace note.",
      mime: "text/markdown",
    });
    writeNotePage({
      avatarHome: [otherAvatarHome],
      notebook: "ideas",
      section: "shell",
      page: "other",
      content: "Other workspace hidden note.",
      mime: "text/markdown",
    });

    expect(listNotePages({ avatarHome: [currentAvatarHome] }).map((page) => page.identity.page)).toEqual(["current"]);
    expect(
      showNotePage({ avatarHome: [currentAvatarHome], notebook: "ideas", section: "shell", page: "other" }),
    ).toBeNull();
    expect(searchNotes({ avatarHome: [currentAvatarHome], query: "hidden" })).toEqual([]);
  });

  test("Scenario: Given note CLI has AVATAR_HOME When note write runs Then JSON stdin content is written through the command", async () => {
    const avatarHome = createTempRoot();
    const command = createNoteCommand();

    const result = await command.execute(["write"], {
      fs: new InMemoryFs(),
      cwd: "/repo",
      env: new Map([[NOTE_AVATAR_HOME_ENV, serializeNoteAvatarHomeEnv([avatarHome])]]),
      stdin: JSON.stringify({
        notebook: "ideas",
        section: "shell",
        page: "cli",
        content: "CLI body.",
        mime: "text/markdown",
      }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"page": "cli"');
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
          mime: "text/markdown",
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

  test("Scenario: Given note CLI contentFile input When the file is relative Then it resolves from the command cwd", async () => {
    const avatarHome = createTempRoot();
    const cwd = createTempRoot();
    const command = createNoteCommand();
    writeFileSync(join(cwd, "payload.json"), '{ "z": 3, "ok": true }', "utf8");

    const result = await command.execute(["write"], {
      fs: new InMemoryFs(),
      cwd,
      env: new Map([[NOTE_AVATAR_HOME_ENV, serializeNoteAvatarHomeEnv([avatarHome])]]),
      stdin: JSON.stringify({
        notebook: "shell-assistant-book",
        section: "working-context",
        page: "json-file",
        contentFile: "payload.json",
        mime: "application/json",
      }),
    });

    expect(result.exitCode).toBe(0);
    expect(
      readFileSync(join(avatarHome, "notes", "shell-assistant-book", "working-context", "json-file.json"), "utf8"),
    ).toBe('{"z":3,"ok":true}');
  });

  test("Scenario: Given invalid note CLI write sources When schema validation runs Then MIME and content source laws are enforced", async () => {
    const avatarHome = createTempRoot();
    const cwd = createTempRoot();
    const command = createNoteCommand();
    const contentFile = join(cwd, "payload.md");
    writeFileSync(contentFile, "File content.", "utf8");

    const missingMime = await command.execute(["write"], {
      fs: new InMemoryFs(),
      cwd,
      env: new Map([[NOTE_AVATAR_HOME_ENV, serializeNoteAvatarHomeEnv([avatarHome])]]),
      stdin: JSON.stringify({
        notebook: "shell-assistant-book",
        section: "working-context",
        page: "missing-mime",
        content: "Missing MIME.",
      }),
    });
    const duplicateSource = await command.execute(["write"], {
      fs: new InMemoryFs(),
      cwd,
      env: new Map([[NOTE_AVATAR_HOME_ENV, serializeNoteAvatarHomeEnv([avatarHome])]]),
      stdin: JSON.stringify({
        notebook: "shell-assistant-book",
        section: "working-context",
        page: "duplicate-source",
        content: "Inline content.",
        contentFile,
        mime: "text/markdown",
      }),
    });
    const binaryInline = await command.execute(["write"], {
      fs: new InMemoryFs(),
      cwd,
      env: new Map([[NOTE_AVATAR_HOME_ENV, serializeNoteAvatarHomeEnv([avatarHome])]]),
      stdin: JSON.stringify({
        notebook: "shell-assistant-book",
        section: "working-context",
        page: "binary-inline",
        content: "not really binary",
        mime: "video/mp4",
      }),
    });

    expect(missingMime.exitCode).toBe(1);
    expect(missingMime.stderr).toContain("mime");
    expect(duplicateSource.exitCode).toBe(1);
    expect(duplicateSource.stderr).toContain("content source");
    expect(binaryInline.exitCode).toBe(1);
    expect(binaryInline.stderr).toContain("contentFile");
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
          mime: "text/markdown",
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
      content: "Target body.",
      mime: "text/markdown",
      tags: ["Anchor"],
      now: new Date("2026-06-01T08:00:00.000Z"),
    });

    const source = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "source",
      content: "See [target](./target.md).",
      mime: "text/markdown",
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
      content: "Terminal preference.",
      mime: "text/markdown",
      tags: ["terminal", "preference"],
    });
    writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "task",
      content: "Task context.",
      mime: "text/markdown",
      tags: ["task"],
    });

    expect(
      listNoteTags({ avatarHome: [avatarHome], notebook: "shell-assistant-book" }).map((tag) => [tag.name, tag.count]),
    ).toEqual([
      ["preference", 1],
      ["task", 1],
      ["terminal", 1],
    ]);
    expect(
      listNoteTags({ avatarHome: [avatarHome], notebook: "shell-assistant-book", section: "semantic-rules" }).map(
        (tag) => tag.name,
      ),
    ).toEqual(["preference", "terminal"]);
    expect(
      searchNotes({ avatarHome: [avatarHome], query: "", tags: ["terminal", "preference"] }).map((page) => page.page),
    ).toEqual(["terminal"]);
  });

  test("Scenario: Given note facts When SQL query runs Then SELECT succeeds and mutating statements are rejected", () => {
    const avatarHome = createTempRoot();
    writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "sql",
      content: "SQL visible.",
      mime: "text/markdown",
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
    const contentFile = join(createTempRoot(), "payload.mp4");
    writeFileSync(contentFile, "binary-ish", "utf8");

    const json = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "json",
      content: '{ "b": 2, "a": [1, true] }',
      mime: "application/json",
    });
    const binary = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "asset",
      contentFile,
      mime: "video/mp4",
    });

    expect(json.path.endsWith(".json")).toBeTrue();
    expect(readFileSync(json.path, "utf8")).toBe('{"b":2,"a":[1,true]}');
    expect(binary.path.endsWith(".mp4")).toBeTrue();
    expect(readFileSync(binary.path, "utf8")).toBe("binary-ish");
    expect(() =>
      writeNotePage({
        avatarHome: [avatarHome],
        notebook: "shell-assistant-book",
        section: "working-context",
        page: "json",
        content: "{ invalid",
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
      content: "Target.",
      mime: "text/markdown",
    });

    expect(() =>
      writeNotePage({
        avatarHome: [avatarHome],
        notebook: "shell-assistant-book",
        section: "semantic-rules",
        page: "broken",
        content: "Broken [missing](./missing.md).",
        mime: "text/markdown",
      }),
    ).toThrow("note reference target not found");
    expect(existsSync(join(avatarHome, "notes", "shell-assistant-book", "semantic-rules", "broken.md"))).toBeFalse();

    const json = writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "semantic-rules",
      page: "json-ref",
      content: '{"ok":true}',
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
      content: "Target.",
      mime: "text/markdown",
    });
    writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "source",
      content: "See [target](./target.md).",
      mime: "text/markdown",
    });
    writeNotePage({
      avatarHome: [avatarHome],
      notebook: "shell-assistant-book",
      section: "working-context",
      page: "conflict",
      content: "Conflict.",
      mime: "text/markdown",
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
    expect(
      showNotePage({
        avatarHome: [avatarHome],
        notebook: "shell-assistant-book",
        section: "working-context",
        page: "renamed",
      })?.metadata.pageId,
    ).toBe(target.metadata.pageId);
  });

  test("Scenario: Given notes exist under AVATAR_HOME When note catalog is requested Then notebooks sections pages and capability state are returned", () => {
    const avatarHome = createTempRoot();
    writeNotePage({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      page: "catalog",
      content: "Catalog body.",
      mime: "text/markdown",
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

  test("Scenario: Given many note scopes When paged browse indexes are requested Then notebooks sections and pages page independently", () => {
    const avatarHome = createTempRoot();
    for (const page of [
      { notebook: "ideas", section: "shell", page: "alpha", content: "Alpha body.", sourceWorkspace: "/repo-a" },
      { notebook: "ideas", section: "shell", page: "beta", content: "Beta body.", sourceWorkspace: "/repo-b" },
      { notebook: "ideas", section: "ux", page: "draft", content: "UX body.", sourceWorkspace: "/repo-a" },
      { notebook: "logs", section: "daily", page: "today", content: "Log body.", sourceWorkspace: "/repo-c" },
    ]) {
      writeNotePage({
        avatarHome: [avatarHome],
        notebook: page.notebook,
        section: page.section,
        page: page.page,
        content: page.content,
        mime: "text/markdown",
        sourceWorkspace: page.sourceWorkspace,
      });
    }

    const firstNotebookPage = listNoteNotebooks({ avatarHome: [avatarHome], limit: 1 });
    const secondNotebookPage = listNoteNotebooks({
      avatarHome: [avatarHome],
      cursor: firstNotebookPage.nextCursor ?? undefined,
      limit: 1,
    });
    const firstSectionPage = listNoteSections({ avatarHome: [avatarHome], notebook: "ideas", limit: 1 });
    const secondSectionPage = listNoteSections({
      avatarHome: [avatarHome],
      notebook: "ideas",
      cursor: firstSectionPage.nextCursor ?? undefined,
      limit: 1,
    });
    const firstPages = listNoteSectionPages({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      limit: 1,
    });
    const secondPages = listNoteSectionPages({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      cursor: firstPages.nextCursor ?? undefined,
      limit: 1,
    });

    expect(firstNotebookPage).toMatchObject({
      totalNotebooks: 2,
      totalPages: 4,
      nextCursor: "1",
    });
    expect(firstNotebookPage.notebooks[0]).toMatchObject({
      notebook: "ideas",
      sectionCount: 2,
      pageCount: 3,
      sourceWorkspaces: ["/repo-a", "/repo-b"],
    });
    expect(secondNotebookPage.notebooks.map((notebook) => notebook.notebook)).toEqual(["logs"]);
    expect(secondNotebookPage.nextCursor).toBeNull();

    expect(firstSectionPage).toMatchObject({
      notebook: "ideas",
      totalSections: 2,
      totalPages: 3,
      nextCursor: "1",
    });
    expect(firstSectionPage.sections[0]).toMatchObject({ section: "shell", pageCount: 2 });
    expect(secondSectionPage.sections.map((section) => section.section)).toEqual(["ux"]);

    expect(firstPages).toMatchObject({
      notebook: "ideas",
      section: "shell",
      totalPages: 2,
      nextCursor: "1",
    });
    expect(firstPages.pages[0]?.page).toBe("alpha");
    expect(secondPages.pages[0]).toMatchObject({ page: "beta", preview: "Beta body." });
    expect(secondPages.nextCursor).toBeNull();
  });

  test("Scenario: Given paged note browse lists When a sort option is requested Then the facade sorts before cursor slicing", () => {
    const avatarHome = createTempRoot();
    for (const page of [
      {
        notebook: "omega",
        section: "z-later",
        page: "a-old-page",
        content: "Old body.",
        now: new Date("2026-06-01T00:00:00.000Z"),
      },
      {
        notebook: "beta",
        section: "earlier",
        page: "new-page",
        content: "New body.",
        now: new Date("2026-06-01T00:02:00.000Z"),
      },
      {
        notebook: "omega",
        section: "z-later",
        page: "z-fresh-page",
        content: "Fresh body.",
        now: new Date("2026-06-01T00:03:00.000Z"),
      },
    ]) {
      writeNotePage({
        avatarHome: [avatarHome],
        notebook: page.notebook,
        section: page.section,
        page: page.page,
        content: page.content,
        mime: "text/markdown",
        now: page.now,
      });
    }

    expect(
      listNoteSectionPages({ avatarHome: [avatarHome], notebook: "omega", section: "z-later", limit: 1 }).pages[0]
        ?.page,
    ).toBe("a-old-page");
    expect(
      listNoteSectionPages({
        avatarHome: [avatarHome],
        notebook: "omega",
        section: "z-later",
        sort: "updatedAt",
        limit: 1,
      }).pages[0]?.page,
    ).toBe("z-fresh-page");
    expect(listNoteNotebooks({ avatarHome: [avatarHome], sort: "updatedAt", limit: 1 }).notebooks[0]?.notebook).toBe(
      "omega",
    );
    expect(
      listNoteSections({ avatarHome: [avatarHome], notebook: "omega", sort: "createdAt", limit: 1 }).sections[0],
    ).toMatchObject({
      section: "z-later",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:03:00.000Z",
    });
  });

  test("Scenario: Given a notebook section page identity When note page is requested Then metadata and Markdown body are returned", () => {
    const avatarHome = createTempRoot();
    writeNotePage({
      avatarHome: [avatarHome],
      notebook: "ideas",
      section: "shell",
      page: "detail",
      content: "# Detail\n\nNote body.",
      mime: "text/markdown",
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
      content: "Searchable capability projection note body.",
      mime: "text/markdown",
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
    expect(listNoteNotebooks({ avatarHome: [] })).toEqual({
      capability: { available: false, readableRoots: [], writableRoot: null },
      notebooks: [],
      totalNotebooks: 0,
      totalPages: 0,
      nextCursor: null,
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
