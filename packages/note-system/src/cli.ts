import { defineCommand } from "just-bash";
import { isAbsolute, resolve } from "node:path";
import { z, type ZodTypeAny } from "zod";

import { parseNoteCliInput, renderNoteCliHelp, type NoteCliDescriptor } from "./cli-descriptor";
import { NOTE_AVATAR_HOME_ENV, parseNoteAvatarHomeEnv } from "./env";
import { searchNotes } from "./search";
import {
  draftNotePage,
  listNotePages,
  listNoteTags,
  queryNoteSql,
  renameNotePages,
  showNotePage,
  writeNotePage,
} from "./storage";
import type { NoteContentInput, NoteReferenceInput } from "./types";

const noteReferenceInputSchema = z.union([
  z.string().trim().min(1),
  z
    .object({
      label: z.string().trim().min(1).optional(),
      uri: z.string().trim().min(1).optional(),
      bookId: z.string().trim().min(1).optional(),
      sectionId: z.string().trim().min(1).optional(),
      pageId: z.string().trim().min(1).optional(),
      notebook: z.string().trim().min(1).optional(),
      section: z.string().trim().min(1).optional(),
      page: z.string().trim().min(1).optional(),
      path: z.string().trim().min(1).optional(),
    })
    .strict(),
]);

const noteWriteSchema = z
  .object({
    notebook: z.string().trim().min(1),
    section: z.string().trim().min(1),
    page: z.string().trim().min(1),
    content: z.string().optional(),
    contentFile: z.string().trim().min(1).optional(),
    mode: z.enum(["append", "override"]).optional(),
    mime: z.string().trim().min(1),
    tags: z.array(z.string().trim().min(1)).optional(),
    references: z.array(noteReferenceInputSchema).optional(),
  })
  .refine((input) => (input.content !== undefined) !== (input.contentFile !== undefined), {
    message: "note write requires exactly one content source: content or contentFile",
    path: ["content"],
  })
  .strict();

const noteDraftSchema = z
  .object({
    content: z.string().optional(),
    contentFile: z.string().trim().min(1).optional(),
    mime: z.string().trim().min(1),
    idSuffix: z.string().trim().min(1).optional(),
  })
  .refine((input) => (input.content !== undefined) !== (input.contentFile !== undefined), {
    message: "note draft requires exactly one content source: content or contentFile",
    path: ["content"],
  })
  .strict();

const noteListSchema = z
  .object({
    notebook: z.string().trim().min(1).optional(),
    section: z.string().trim().min(1).optional(),
    limit: z.number().int().positive().max(1_000).optional(),
  })
  .strict();

const noteShowSchema = z
  .object({
    notebook: z.string().trim().min(1),
    section: z.string().trim().min(1),
    page: z.string().trim().min(1),
  })
  .strict();

const noteSearchSchema = z
  .object({
    query: z.string().optional(),
    limit: z.number().int().positive().max(100).optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();

const noteTagsSchema = z
  .object({
    notebook: z.string().trim().min(1).optional(),
    section: z.string().trim().min(1).optional(),
  })
  .strict();

const noteQuerySchema = z
  .object({
    sql: z.string().trim().min(1),
    limit: z.number().int().positive().max(200).optional(),
  })
  .strict();

const noteRenameSchema = z
  .object({
    notebook: z.string().trim().min(1),
    section: z.string().trim().min(1),
    page: z.string().trim().min(1).optional(),
    toNotebook: z.string().trim().min(1).optional(),
    toSection: z.string().trim().min(1).optional(),
    toPage: z.string().trim().min(1).optional(),
  })
  .strict();

const defineNoteDescriptor = <TInput extends ZodTypeAny>(
  descriptor: Omit<NoteCliDescriptor<TInput>, "namespace">,
): NoteCliDescriptor<TInput> => ({
  namespace: "note",
  ...descriptor,
});

const noteDescriptors = [
  defineNoteDescriptor({
    name: "write",
    description: "Write one strict note page using JSON input and return normalized page metadata.",
    inputSchema: noteWriteSchema,
    examples: [
      {
        kind: "stdin",
        payload: {
          notebook: "shell-assistant-book",
          section: "working-context",
          page: "current-task",
          content: "The active task is upgrading NoteSystem before app-shell.",
          mime: "text/markdown",
          mode: "append",
          tags: ["task", "notes"],
        },
      },
    ],
    helpNotes: [
      "`mime` is required. Markdown must use `text/markdown`.",
      "Use `content` for inline text-like payloads. Use `contentFile` when a script already produced JSON, Markdown, media, or another file payload.",
      "Binary-like MIME writes require `contentFile`; inline `content` is only for text-like MIME.",
      'A non-empty existing page requires explicit `mode:"append"` or `mode:"override"`.',
    ],
    compactFields: ["notebook", "section", "page", "mime", "content", "contentFile", "mode", "tags", "references"],
  }),
  defineNoteDescriptor({
    name: "draft",
    description: "Capture a low-friction note under the automatic _draft date section.",
    inputSchema: noteDraftSchema,
    examples: [
      {
        kind: "stdin",
        payload: { content: "Temporary evidence captured without naming a page.", mime: "text/markdown" },
      },
    ],
    compactFields: ["mime", "content", "contentFile", "idSuffix"],
  }),
  defineNoteDescriptor({
    name: "list",
    description: "List pages grouped by notebook, section, and page labels.",
    inputSchema: noteListSchema,
    examples: [{ kind: "stdin", payload: { notebook: "shell-assistant-book", limit: 50 } }],
    compactFields: ["notebook", "section", "limit"],
  }),
  defineNoteDescriptor({
    name: "show",
    description: "Read one note page by notebook, section, and page labels.",
    inputSchema: noteShowSchema,
    examples: [
      {
        kind: "stdin",
        payload: { notebook: "shell-assistant-book", section: "working-context", page: "current-task" },
      },
    ],
    compactFields: ["notebook", "section", "page"],
  }),
  defineNoteDescriptor({
    name: "search",
    description: "Search pages by text and optional tags.",
    inputSchema: noteSearchSchema,
    examples: [{ kind: "stdin", payload: { query: "terminal preference", tags: ["terminal"], limit: 10 } }],
    compactFields: ["query", "limit", "tags"],
  }),
  defineNoteDescriptor({
    name: "tags",
    description: "List tag IDs, names, and counts globally, by notebook, or by section.",
    inputSchema: noteTagsSchema,
    examples: [{ kind: "stdin", payload: { notebook: "shell-assistant-book", section: "semantic-rules" } }],
    compactFields: ["notebook", "section"],
  }),
  defineNoteDescriptor({
    name: "query",
    description: "Run read-only SQL over bounded NoteSystem views.",
    inputSchema: noteQuerySchema,
    examples: [
      { kind: "stdin", payload: { sql: "select page, updatedAt from note_pages_view order by updatedAt desc" } },
    ],
    helpNotes: [
      "Available views: note_pages_view, note_tags_view, note_page_tags_view, note_references_view.",
      "Only SELECT/WITH statements are accepted; mutating SQL is rejected before execution.",
    ],
    compactFields: ["sql", "limit"],
  }),
  defineNoteDescriptor({
    name: "rename",
    description: "Rename a notebook, section, or page while preserving stable IDs and reference edges.",
    inputSchema: noteRenameSchema,
    examples: [
      {
        kind: "stdin",
        payload: {
          notebook: "shell-assistant-book",
          section: "working-context",
          page: "current",
          toPage: "current-task",
        },
      },
    ],
    compactFields: ["notebook", "section", "page", "toNotebook", "toSection", "toPage"],
  }),
] as const;

const noteDescriptorByName = new Map<string, NoteCliDescriptor>(
  noteDescriptors.map((descriptor) => [descriptor.name, descriptor]),
);

const renderNoteNamespaceHelp = (): string =>
  [
    "note",
    "",
    "Available subcommands:",
    ...noteDescriptors.map((descriptor) => `- ${descriptor.name}: ${descriptor.description}`),
    "",
    "Use `note <subcommand> --help` to inspect the JSON schema and canonical examples.",
    "",
  ].join("\n");

export interface NoteCommandOptions {
  readAvatarHome?: (env: ReadonlyMap<string, string>) => readonly string[];
}

const parseAvatarHomeFromEnv = (env: ReadonlyMap<string, string>, options: NoteCommandOptions): string[] => [
  ...(options.readAvatarHome?.(env) ?? parseNoteAvatarHomeEnv(env.get(NOTE_AVATAR_HOME_ENV))),
];

const isHelpArg = (value: string | undefined): boolean => value === "--help" || value === "-h";

const resolveCliContentFile = (contentFile: string, cwd: string): string =>
  isAbsolute(contentFile) ? contentFile : resolve(cwd, contentFile);

const resolveCliContentInput = (input: { content?: string; contentFile?: string }, cwd: string): NoteContentInput =>
  input.contentFile !== undefined
    ? { contentFile: resolveCliContentFile(input.contentFile, cwd) }
    : input.content !== undefined
      ? { content: input.content }
      : (() => {
          throw new Error("note requires exactly one content source: content or contentFile");
        })();

export const createNoteCommand = (options: NoteCommandOptions = {}): ReturnType<typeof defineCommand> =>
  defineCommand("note", async (args, ctx) => {
    try {
      const [subcommand, ...rest] = args;
      if (!subcommand || isHelpArg(subcommand)) {
        return {
          stdout: renderNoteNamespaceHelp(),
          stderr: "",
          exitCode: 0,
        };
      }
      const descriptor = noteDescriptorByName.get(subcommand);
      if (!descriptor) {
        return {
          stdout: "",
          stderr: `unknown note subcommand: ${subcommand}\n`,
          exitCode: 1,
        };
      }
      if (rest.some(isHelpArg)) {
        return { stdout: renderNoteCliHelp(descriptor), stderr: "", exitCode: 0 };
      }
      const avatarHome = parseAvatarHomeFromEnv(ctx.env, options);
      if (avatarHome.length === 0) {
        return {
          stdout: "",
          stderr: "note CLI is not projected because AVATAR_HOME is empty\n",
          exitCode: 1,
        };
      }
      const compactMode = rest.includes("--compact");
      const payloadArgs = rest.filter((item) => item !== "--compact");
      if (subcommand === "write") {
        const input = noteWriteSchema.parse(
          parseNoteCliInput(descriptor, payloadArgs, ctx.stdin, compactMode ? "compact" : "object"),
        );
        const page = writeNotePage({
          avatarHome,
          notebook: input.notebook,
          section: input.section,
          page: input.page,
          ...resolveCliContentInput(input, ctx.cwd),
          mode: input.mode,
          mime: input.mime,
          tags: input.tags,
          references: input.references as readonly NoteReferenceInput[] | undefined,
          sourceWorkspace: ctx.cwd,
        });
        return { stdout: `${JSON.stringify(page, null, 2)}\n`, stderr: "", exitCode: 0 };
      }
      if (subcommand === "draft") {
        const input = noteDraftSchema.parse(
          parseNoteCliInput(descriptor, payloadArgs, ctx.stdin, compactMode ? "compact" : "object"),
        );
        const page = draftNotePage({
          avatarHome,
          ...resolveCliContentInput(input, ctx.cwd),
          mime: input.mime,
          idSuffix: input.idSuffix,
          sourceWorkspace: ctx.cwd,
        });
        return { stdout: `${JSON.stringify(page, null, 2)}\n`, stderr: "", exitCode: 0 };
      }
      if (subcommand === "list") {
        const input = noteListSchema.parse(
          parseNoteCliInput(descriptor, payloadArgs, ctx.stdin, compactMode ? "compact" : "object"),
        );
        const pages = listNotePages({
          avatarHome,
          notebook: input.notebook,
          section: input.section,
          limit: input.limit,
        });
        return {
          stdout: `${JSON.stringify(pages, null, 2)}\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      if (subcommand === "show") {
        const input = noteShowSchema.parse(
          parseNoteCliInput(descriptor, payloadArgs, ctx.stdin, compactMode ? "compact" : "object"),
        );
        const page = showNotePage({ avatarHome, notebook: input.notebook, section: input.section, page: input.page });
        if (!page) {
          throw new Error("note page not found");
        }
        return { stdout: `${JSON.stringify(page, null, 2)}\n`, stderr: "", exitCode: 0 };
      }
      if (subcommand === "search") {
        const input = noteSearchSchema.parse(
          parseNoteCliInput(descriptor, payloadArgs, ctx.stdin, compactMode ? "compact" : "object"),
        );
        const results = searchNotes({
          avatarHome,
          query: input.query ?? "",
          limit: input.limit,
          tags: "tags" in input ? input.tags : undefined,
        });
        return {
          stdout: `${JSON.stringify(results, null, 2)}\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      if (subcommand === "tags") {
        const input = noteTagsSchema.parse(
          parseNoteCliInput(descriptor, payloadArgs, ctx.stdin, compactMode ? "compact" : "object"),
        );
        return {
          stdout: `${JSON.stringify(listNoteTags({ avatarHome, notebook: input.notebook, section: input.section }), null, 2)}\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      if (subcommand === "query") {
        const input = noteQuerySchema.parse(
          parseNoteCliInput(descriptor, payloadArgs, ctx.stdin, compactMode ? "compact" : "object"),
        );
        return {
          stdout: `${JSON.stringify(queryNoteSql({ avatarHome, sql: input.sql, limit: input.limit }), null, 2)}\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      if (subcommand === "rename") {
        const input = noteRenameSchema.parse(
          parseNoteCliInput(descriptor, payloadArgs, ctx.stdin, compactMode ? "compact" : "object"),
        );
        return {
          stdout: `${JSON.stringify(renameNotePages({ avatarHome, ...input }), null, 2)}\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      throw new Error(`unknown note subcommand: ${subcommand}`);
    } catch (error) {
      return {
        stdout: "",
        stderr: `${error instanceof Error ? error.message : String(error)}\n`,
        exitCode: 1,
      };
    }
  });
