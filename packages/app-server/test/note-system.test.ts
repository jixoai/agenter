import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InMemoryFs } from "just-bash";

import { createNoteCommand } from "../src/note-system/cli";
import { searchNotes } from "../src/note-system/search";
import {
  NOTE_DRAFT_NOTEBOOK,
  draftNotePage,
  listNotePages,
  projectNoteCliCapabilities,
  showNotePage,
  writeNotePage,
} from "../src/note-system/storage";
import { AVATAR_HOME_ENV, serializeEnvAvatarHome } from "../src/workspace-system";

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
      env: new Map([[AVATAR_HOME_ENV, serializeEnvAvatarHome([avatarHome])]]),
      stdin: "CLI body.",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ideas/shell/cli");
    expect(readFileSync(join(avatarHome, "notes", "ideas", "shell", "cli.md"), "utf8")).toContain("CLI body.");
  });
});
