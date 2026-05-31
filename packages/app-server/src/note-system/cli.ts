import { defineCommand } from "just-bash";

import { AVATAR_HOME_ENV, parseEnvAvatarHome } from "../workspace-system";
import { searchNotes } from "./search";
import { draftNotePage, listNotePages, showNotePage, writeNotePage } from "./storage";
import type { NotePage, NoteSearchResult, NoteWriteMode } from "./types";

interface ParsedNoteArgs {
  positional: string[];
  options: Map<string, string>;
  json: boolean;
}

const parseNoteArgs = (args: readonly string[]): ParsedNoteArgs => {
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

const resolveBody = (parsed: ParsedNoteArgs, stdin: string): string => {
  const body = parsed.positional.join(" ").trim() || stdin.trimEnd();
  if (!body) {
    throw new Error("note body is required");
  }
  return body;
};

const renderPage = (page: NotePage): string => `${page.identity.notebook}/${page.identity.section}/${page.identity.page} ${page.path}\n`;

const renderSearchResult = (result: NoteSearchResult): string =>
  `${result.notebook}/${result.section}/${result.page} score=${result.score.toFixed(4)} ${result.path}\n${result.snippet}\n`;

const parseAvatarHomeFromEnv = (env: Map<string, string>): string[] =>
  parseEnvAvatarHome(env.get(AVATAR_HOME_ENV));

export const createNoteCommand = (): ReturnType<typeof defineCommand> =>
  defineCommand("note", async (args, ctx) => {
    try {
      const [subcommand, ...rest] = args;
      if (!subcommand || subcommand === "--help") {
        return {
          stdout: [
            "note write --notebook <name> --section <name> --page <name> [--mode append|override] [--json]",
            "note draft [--json]",
            "note list [--notebook <name>] [--section <name>] [--limit <n>] [--json]",
            "note show --notebook <name> --section <name> --page <name> [--json]",
            "note search <query> [--limit <n>] [--json]",
            "",
          ].join("\n"),
          stderr: "",
          exitCode: 0,
        };
      }
      const avatarHome = parseAvatarHomeFromEnv(ctx.env);
      if (avatarHome.length === 0) {
        return {
          stdout: "",
          stderr: "note CLI is not projected because AVATAR_HOME is empty\n",
          exitCode: 1,
        };
      }
      const parsed = parseNoteArgs(rest);
      if (subcommand === "write") {
        const page = writeNotePage({
          avatarHome,
          notebook: requireOption(parsed.options, "notebook"),
          section: requireOption(parsed.options, "section"),
          page: requireOption(parsed.options, "page"),
          mode: parseMode(parsed.options.get("mode")),
          body: resolveBody(parsed, ctx.stdin),
          sourceWorkspace: ctx.cwd,
        });
        return {
          stdout: parsed.json ? `${JSON.stringify(page)}\n` : renderPage(page),
          stderr: "",
          exitCode: 0,
        };
      }
      if (subcommand === "draft") {
        const page = draftNotePage({
          avatarHome,
          body: resolveBody(parsed, ctx.stdin),
          sourceWorkspace: ctx.cwd,
        });
        return {
          stdout: parsed.json ? `${JSON.stringify(page)}\n` : renderPage(page),
          stderr: "",
          exitCode: 0,
        };
      }
      if (subcommand === "list") {
        const pages = listNotePages({
          avatarHome,
          notebook: parsed.options.get("notebook"),
          section: parsed.options.get("section"),
          limit: parsed.options.get("limit") ? Number(parsed.options.get("limit")) : undefined,
        });
        return {
          stdout: parsed.json ? `${JSON.stringify(pages)}\n` : pages.map(renderPage).join(""),
          stderr: "",
          exitCode: 0,
        };
      }
      if (subcommand === "show") {
        const page = showNotePage({
          avatarHome,
          notebook: requireOption(parsed.options, "notebook"),
          section: requireOption(parsed.options, "section"),
          page: requireOption(parsed.options, "page"),
        });
        if (!page) {
          throw new Error("note page not found");
        }
        return {
          stdout: parsed.json ? `${JSON.stringify(page)}\n` : `${page.body}\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      if (subcommand === "search") {
        const query = parsed.positional.join(" ");
        const results = searchNotes({
          avatarHome,
          query,
          limit: parsed.options.get("limit") ? Number(parsed.options.get("limit")) : undefined,
        });
        return {
          stdout: parsed.json ? `${JSON.stringify(results)}\n` : results.map(renderSearchResult).join(""),
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
