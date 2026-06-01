import { defineCommand } from "just-bash";
import { z, type ZodTypeAny } from "zod";

import { AVATAR_HOME_ENV, parseEnvAvatarHome } from "../workspace-system";
import {
  parseRuntimeToolCliInput,
  renderRuntimeToolHelp,
  type RuntimeToolDescriptor,
} from "../runtime-tool-descriptors";
import { searchNotes } from "./search";
import { draftNotePage, listNotePages, listNoteTags, queryNoteSql, renameNotePages, showNotePage, writeNotePage } from "./storage";
import type { NotePage, NoteReferenceInput, NoteSearchResult, NoteWriteMode } from "./types";

interface ParsedLegacyNoteArgs {
  positional: string[];
  options: Map<string, string>;
  json: boolean;
}

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
    body: z.string().optional(),
    content: z.string().optional(),
    mode: z.enum(["append", "override"]).optional(),
    mime: z.string().trim().min(1).optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    references: z.array(noteReferenceInputSchema).optional(),
    sourcePath: z.string().trim().min(1).optional(),
  })
  .strict();

const noteDraftSchema = z
  .object({
    body: z.string().optional(),
    content: z.string().optional(),
    idSuffix: z.string().trim().min(1).optional(),
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
  descriptor: Omit<RuntimeToolDescriptor<TInput>, "namespace" | "route" | "handler">,
): RuntimeToolDescriptor<TInput> => ({
  namespace: "note",
  route: `/v1/note/${descriptor.name}`,
  handler: () => {
    throw new Error("note descriptors are CLI-local and are not exposed as runtime HTTP handlers");
  },
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
          mode: "append",
          tags: ["task", "notes"],
        },
      },
    ],
    helpNotes: [
      "Use `content` or `body` for inline text. Non-inline MIME writes require `sourcePath`.",
      "A non-empty existing page requires explicit `mode:\"append\"` or `mode:\"override\"`.",
    ],
  }),
  defineNoteDescriptor({
    name: "draft",
    description: "Capture a low-friction note under the automatic _draft date section.",
    inputSchema: noteDraftSchema,
    examples: [{ kind: "stdin", payload: { content: "Temporary evidence captured without naming a page." } }],
  }),
  defineNoteDescriptor({
    name: "list",
    description: "List pages grouped by notebook, section, and page labels.",
    inputSchema: noteListSchema,
    examples: [{ kind: "stdin", payload: { notebook: "shell-assistant-book", limit: 50 } }],
  }),
  defineNoteDescriptor({
    name: "show",
    description: "Read one note page by notebook, section, and page labels.",
    inputSchema: noteShowSchema,
    examples: [{ kind: "stdin", payload: { notebook: "shell-assistant-book", section: "working-context", page: "current-task" } }],
  }),
  defineNoteDescriptor({
    name: "search",
    description: "Search pages by text and optional tags.",
    inputSchema: noteSearchSchema,
    examples: [{ kind: "stdin", payload: { query: "terminal preference", tags: ["terminal"], limit: 10 } }],
  }),
  defineNoteDescriptor({
    name: "tags",
    description: "List tag IDs, names, and counts globally, by notebook, or by section.",
    inputSchema: noteTagsSchema,
    examples: [{ kind: "stdin", payload: { notebook: "shell-assistant-book", section: "semantic-rules" } }],
  }),
  defineNoteDescriptor({
    name: "query",
    description: "Run read-only SQL over bounded NoteSystem views.",
    inputSchema: noteQuerySchema,
    examples: [{ kind: "stdin", payload: { sql: "select page, updatedAt from note_pages_view order by updatedAt desc" } }],
    helpNotes: [
      "Available views: note_pages_view, note_tags_view, note_page_tags_view, note_references_view.",
      "Only SELECT/WITH statements are accepted; mutating SQL is rejected before execution.",
    ],
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
  }),
] as const;

const noteDescriptorByName = new Map<string, RuntimeToolDescriptor>(
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

const parseLegacyNoteArgs = (args: readonly string[]): ParsedLegacyNoteArgs => {
  const positional: string[] = [];
  const options = new Map<string, string>();
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[index + 1];
      if (!key || !value || value.startsWith("--")) {
        throw new Error(`note option requires value: ${arg}`);
      }
      options.set(key, value);
      index += 1;
      continue;
    }
    positional.push(arg);
  }
  return { positional, options, json };
};

const requireOption = (options: Map<string, string>, key: string): string => {
  const value = options.get(key);
  if (!value) {
    throw new Error(`note requires --${key}`);
  }
  return value;
};

const parseMode = (value: string | undefined): NoteWriteMode | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === "append" || value === "override") {
    return value;
  }
  throw new Error(`note mode must be append or override: ${value}`);
};

const resolveLegacyBody = (parsed: ParsedLegacyNoteArgs, stdin: string): string => {
  const body = parsed.positional.join(" ").trim() || stdin.trimEnd();
  if (!body) {
    throw new Error("note body is required");
  }
  return body;
};

const resolveJsonBody = (input: { body?: string; content?: string }): string => {
  const body = input.content ?? input.body;
  if (!body) {
    throw new Error("note content is required");
  }
  return body;
};

const renderPage = (page: NotePage): string => `${page.identity.notebook}/${page.identity.section}/${page.identity.page} ${page.path}\n`;

const renderSearchResult = (result: NoteSearchResult): string =>
  `${result.notebook}/${result.section}/${result.page} score=${result.score.toFixed(4)} ${result.path}\n${result.snippet}\n`;

const parseAvatarHomeFromEnv = (env: Map<string, string>): string[] => parseEnvAvatarHome(env.get(AVATAR_HOME_ENV));

const isHelpArg = (value: string | undefined): boolean => value === "--help" || value === "-h";

const wantsLegacyFlags = (args: readonly string[]): boolean =>
  args.some((arg) => arg.startsWith("--") && arg !== "--json" && arg !== "--compact");

const wantsLegacyPositionalBody = (args: readonly string[], stdin: string): boolean =>
  args.length > 0 && !args[0]?.trim().startsWith("{") && stdin.trim().length === 0;

export const createNoteCommand = (): ReturnType<typeof defineCommand> =>
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
        return { stdout: renderRuntimeToolHelp(descriptor), stderr: "", exitCode: 0 };
      }
      const avatarHome = parseAvatarHomeFromEnv(ctx.env);
      if (avatarHome.length === 0) {
        return {
          stdout: "",
          stderr: "note CLI is not projected because AVATAR_HOME is empty\n",
          exitCode: 1,
        };
      }
      const compactMode = rest.includes("--compact");
      const payloadArgs = rest.filter((item) => item !== "--json" && item !== "--compact");
      const jsonMode = !wantsLegacyFlags(rest);
      if (subcommand === "write") {
        if (wantsLegacyFlags(rest)) {
          const parsed = parseLegacyNoteArgs(rest);
          const page = writeNotePage({
            avatarHome,
            notebook: requireOption(parsed.options, "notebook"),
            section: requireOption(parsed.options, "section"),
            page: requireOption(parsed.options, "page"),
            mode: parseMode(parsed.options.get("mode")),
            body: resolveLegacyBody(parsed, ctx.stdin),
            sourceWorkspace: ctx.cwd,
          });
          return {
            stdout: parsed.json ? `${JSON.stringify(page)}\n` : renderPage(page),
            stderr: "",
            exitCode: 0,
          };
        }
        const input = noteWriteSchema.parse(
          parseRuntimeToolCliInput(descriptor, payloadArgs, ctx.stdin, compactMode ? "compact" : "object"),
        );
        const page = writeNotePage({
          avatarHome,
          notebook: input.notebook,
          section: input.section,
          page: input.page,
          body: input.sourcePath ? input.body ?? input.content : resolveJsonBody(input),
          mode: input.mode,
          mime: input.mime,
          tags: input.tags,
          references: input.references as readonly NoteReferenceInput[] | undefined,
          sourcePath: input.sourcePath,
          sourceWorkspace: ctx.cwd,
        });
        return { stdout: `${JSON.stringify(page, null, 2)}\n`, stderr: "", exitCode: 0 };
      }
      if (subcommand === "draft") {
        if (wantsLegacyPositionalBody(rest, ctx.stdin)) {
          const parsed = parseLegacyNoteArgs(rest);
          const page = draftNotePage({
            avatarHome,
            body: resolveLegacyBody(parsed, ctx.stdin),
            sourceWorkspace: ctx.cwd,
          });
          return { stdout: parsed.json ? `${JSON.stringify(page)}\n` : renderPage(page), stderr: "", exitCode: 0 };
        }
        const input = noteDraftSchema.parse(
          parseRuntimeToolCliInput(descriptor, payloadArgs, ctx.stdin, compactMode ? "compact" : "object"),
        );
        const page = draftNotePage({
          avatarHome,
          body: resolveJsonBody(input),
          idSuffix: input.idSuffix,
          sourceWorkspace: ctx.cwd,
        });
        return { stdout: `${JSON.stringify(page, null, 2)}\n`, stderr: "", exitCode: 0 };
      }
      if (subcommand === "list") {
        const input = jsonMode
          ? noteListSchema.parse(
              parseRuntimeToolCliInput(descriptor, payloadArgs, ctx.stdin, compactMode ? "compact" : "object"),
            )
          : (() => {
              const parsed = parseLegacyNoteArgs(rest);
              return {
                notebook: parsed.options.get("notebook"),
                section: parsed.options.get("section"),
                limit: parsed.options.get("limit") ? Number(parsed.options.get("limit")) : undefined,
                legacyJson: parsed.json,
              };
            })();
        const pages = listNotePages({
          avatarHome,
          notebook: input.notebook,
          section: input.section,
          limit: input.limit,
        });
        const legacyJson = "legacyJson" in input ? input.legacyJson === true : false;
        return {
          stdout: jsonMode || legacyJson ? `${JSON.stringify(pages, null, 2)}\n` : pages.map(renderPage).join(""),
          stderr: "",
          exitCode: 0,
        };
      }
      if (subcommand === "show") {
        const input = jsonMode
          ? noteShowSchema.parse(
              parseRuntimeToolCliInput(descriptor, payloadArgs, ctx.stdin, compactMode ? "compact" : "object"),
            )
          : (() => {
              const parsed = parseLegacyNoteArgs(rest);
              return {
                notebook: requireOption(parsed.options, "notebook"),
                section: requireOption(parsed.options, "section"),
                page: requireOption(parsed.options, "page"),
                legacyJson: parsed.json,
              };
            })();
        const page = showNotePage({ avatarHome, notebook: input.notebook, section: input.section, page: input.page });
        if (!page) {
          throw new Error("note page not found");
        }
        const legacyJson = "legacyJson" in input ? input.legacyJson === true : false;
        return { stdout: jsonMode || legacyJson ? `${JSON.stringify(page, null, 2)}\n` : `${page.body}\n`, stderr: "", exitCode: 0 };
      }
      if (subcommand === "search") {
        const input = jsonMode
          ? noteSearchSchema.parse(
              parseRuntimeToolCliInput(descriptor, payloadArgs, ctx.stdin, compactMode ? "compact" : "object"),
            )
          : (() => {
              const parsed = parseLegacyNoteArgs(rest);
              return {
                query: parsed.positional.join(" "),
                limit: parsed.options.get("limit") ? Number(parsed.options.get("limit")) : undefined,
                legacyJson: parsed.json,
              };
            })();
        const results = searchNotes({
          avatarHome,
          query: input.query ?? "",
          limit: input.limit,
          tags: "tags" in input ? input.tags : undefined,
        });
        const legacyJson = "legacyJson" in input ? input.legacyJson === true : false;
        return {
          stdout: jsonMode || legacyJson ? `${JSON.stringify(results, null, 2)}\n` : results.map(renderSearchResult).join(""),
          stderr: "",
          exitCode: 0,
        };
      }
      if (subcommand === "tags") {
        const input = noteTagsSchema.parse(
          parseRuntimeToolCliInput(descriptor, payloadArgs, ctx.stdin, compactMode ? "compact" : "object"),
        );
        return {
          stdout: `${JSON.stringify(listNoteTags({ avatarHome, notebook: input.notebook, section: input.section }), null, 2)}\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      if (subcommand === "query") {
        const input = noteQuerySchema.parse(
          parseRuntimeToolCliInput(descriptor, payloadArgs, ctx.stdin, compactMode ? "compact" : "object"),
        );
        return {
          stdout: `${JSON.stringify(queryNoteSql({ avatarHome, sql: input.sql, limit: input.limit }), null, 2)}\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      if (subcommand === "rename") {
        const input = noteRenameSchema.parse(
          parseRuntimeToolCliInput(descriptor, payloadArgs, ctx.stdin, compactMode ? "compact" : "object"),
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
