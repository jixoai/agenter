import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { defineCommand } from "just-bash";

import {
  RUNTIME_API_BASE_URL_ENV,
  RUNTIME_HOME_DIR_ENV,
  RUNTIME_MANAGED_SEAT_AUTHORITY_URL_ENV,
  RUNTIME_PRINCIPAL_ID_ENV,
  RUNTIME_PRIVATE_KEY_ENV,
  RUNTIME_ROOT_WORKSPACE_ENV,
} from "./runtime-skills";

const RUNTIME_BIN_DIRNAME = ".runtime-bin";
const RUNTIME_SHELL_COMMANDS = [
  "attention",
  "message",
  "message-manage",
  "workspace",
  "terminal",
  "terminal-manage",
  "skill",
  "tool",
] as const;

const writeExecutable = (filePath: string, content: string): void => {
  writeFileSync(filePath, content, "utf8");
  chmodSync(filePath, 0o755);
};

export const resolveRuntimeShellBinDir = (rootWorkspacePath: string): string =>
  resolve(rootWorkspacePath, RUNTIME_BIN_DIRNAME);

export const materializeRuntimeShellBin = (rootWorkspacePath: string): string => {
  const binDir = resolveRuntimeShellBinDir(rootWorkspacePath);
  mkdirSync(binDir, { recursive: true });

  for (const commandName of RUNTIME_SHELL_COMMANDS) {
    writeExecutable(
      join(binDir, commandName),
      [
        "#!/usr/bin/env bash",
        `${commandName} "$@"`,
        "",
      ].join("\n"),
    );
  }

  return binDir;
};

const renderWhichHelp = (): string =>
  [
    "Usage: which [-as] program ...",
    "",
    "Options:",
    "  -a        list all matching executables in PATH and runtime shell projections",
    "  -s        no output; exit 0 if all programs are found",
    "  --help    display this help and exit",
    "",
  ].join("\n");

const parseWhichArgs = (
  args: readonly string[],
): { ok: true; showAll: boolean; silent: boolean; programs: string[] } | { ok: false; error: string } => {
  let showAll = false;
  let silent = false;
  const programs: string[] = [];
  for (const arg of args) {
    if (arg === "--help") {
      return { ok: false, error: renderWhichHelp() };
    }
    if (arg.startsWith("-") && arg !== "-") {
      for (const flag of arg.slice(1)) {
        if (flag === "a") {
          showAll = true;
          continue;
        }
        if (flag === "s") {
          silent = true;
          continue;
        }
        return {
          ok: false,
          error: `which: invalid option -- '${flag}'\n${renderWhichHelp()}`,
        };
      }
      continue;
    }
    programs.push(arg);
  }
  return { ok: true, showAll, silent, programs };
};

export const createRuntimeShellWhichCommand = (rootWorkspacePath: string): ReturnType<typeof defineCommand> =>
  defineCommand("which", async (args, ctx) => {
    const parsed = parseWhichArgs(args);
    if (!parsed.ok) {
      const isHelp = parsed.error.startsWith("Usage:");
      return {
        stdout: isHelp ? `${parsed.error}\n` : "",
        stderr: isHelp ? "" : `${parsed.error}\n`,
        exitCode: isHelp ? 0 : 1,
      };
    }
    if (parsed.programs.length === 0) {
      return {
        stdout: "",
        stderr: "",
        exitCode: 1,
      };
    }

    const runtimeCommandNames = new Set<string>(RUNTIME_SHELL_COMMANDS);
    const searchDirs = (ctx.env.get("PATH") ?? "/usr/bin:/bin").split(":").filter((dir) => dir.length > 0);
    let stdout = "";
    let allFound = true;

    for (const program of parsed.programs) {
      let foundForProgram = false;
      if (runtimeCommandNames.has(program)) {
        const projectedPath = join(resolveRuntimeShellBinDir(rootWorkspacePath), program);
        if (await ctx.fs.exists(projectedPath)) {
          foundForProgram = true;
          if (!parsed.silent) {
            stdout += `${projectedPath}\n`;
          }
          if (!parsed.showAll) {
            continue;
          }
        }
      }

      for (const dir of searchDirs) {
        const candidatePath = ctx.fs.resolvePath(dir, program);
        if (!(await ctx.fs.exists(candidatePath))) {
          continue;
        }
        foundForProgram = true;
        if (!parsed.silent) {
          stdout += `${candidatePath}\n`;
        }
        if (!parsed.showAll) {
          break;
        }
      }

      if (!foundForProgram) {
        allFound = false;
      }
    }

    return {
      stdout,
      stderr: "",
      exitCode: allFound ? 0 : 1,
    };
  });

/**
 * Root-workspace is the only shell surface that carries avatar-private runtime CLI/env by default.
 */
export const buildRootWorkspaceShellEnvironment = (input: {
  rootWorkspacePath: string;
  homeDir: string;
  apiBaseUrl: string;
  managedSeatAuthorityUrl?: string;
  privateKey: string;
  principalId?: string;
  env?: Record<string, string>;
}): Record<string, string> => {
  return {
    ...(input.env ?? {}),
    HOME: input.rootWorkspacePath,
    [RUNTIME_API_BASE_URL_ENV]: input.apiBaseUrl,
    [RUNTIME_MANAGED_SEAT_AUTHORITY_URL_ENV]: input.managedSeatAuthorityUrl ?? "",
    [RUNTIME_HOME_DIR_ENV]: input.homeDir,
    [RUNTIME_PRINCIPAL_ID_ENV]: input.principalId ?? "",
    [RUNTIME_PRIVATE_KEY_ENV]: input.privateKey,
    [RUNTIME_ROOT_WORKSPACE_ENV]: input.rootWorkspacePath,
  };
};

/**
 * Public-workspace shells are collaboration surfaces. They keep caller-provided env only.
 */
export const buildPublicWorkspaceShellEnvironment = (input: {
  env?: Record<string, string>;
}): Record<string, string> => ({
  ...(input.env ?? {}),
});

/**
 * Shared terminals follow public-workspace collaboration semantics instead of root-workspace semantics.
 */
export const buildSharedTerminalEnvironment = (input: {
  env?: Record<string, string>;
}): Record<string, string> => ({
  ...(input.env ?? {}),
});
