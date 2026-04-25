import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  RUNTIME_API_BASE_URL_ENV,
  RUNTIME_HOME_DIR_ENV,
  RUNTIME_PRINCIPAL_ID_ENV,
  RUNTIME_PRIVATE_KEY_ENV,
  RUNTIME_ROOT_WORKSPACE_ENV,
} from "./runtime-skills";

const RUNTIME_BIN_DIRNAME = ".runtime-bin";
const RUNTIME_SHELL_ENTRY_PATH = fileURLToPath(new URL("./runtime-shell-entry.ts", import.meta.url));
const RUNTIME_SHELL_COMMANDS = ["attention", "message", "workspace", "terminal", "skill", "tool"] as const;

const shellQuote = (value: string): string => {
  if (value.length === 0) {
    return "''";
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
};

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
        "set -euo pipefail",
        `exec ${shellQuote(process.execPath)} ${shellQuote(RUNTIME_SHELL_ENTRY_PATH)} ${shellQuote(commandName)} "$@"`,
        "",
      ].join("\n"),
    );
  }

  writeExecutable(
    join(binDir, "js-exec"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'if [ "$#" -lt 1 ]; then',
      '  printf "%s\\n" "js-exec requires <file> [-- <args>...]" >&2',
      "  exit 1",
      "fi",
      'script_path="$1"',
      "shift",
      'if [ "${1-}" = "--" ]; then',
      "  shift",
      "fi",
      `exec ${shellQuote(process.execPath)} "$script_path" "$@"`,
      "",
    ].join("\n"),
  );

  return binDir;
};

/**
 * Root-workspace is the only shell surface that carries avatar-private runtime CLI/env by default.
 */
export const buildRootWorkspaceShellEnvironment = (input: {
  rootWorkspacePath: string;
  homeDir: string;
  apiBaseUrl: string;
  privateKey: string;
  principalId?: string;
  env?: Record<string, string>;
}): Record<string, string> => {
  return {
    ...(input.env ?? {}),
    HOME: input.rootWorkspacePath,
    [RUNTIME_API_BASE_URL_ENV]: input.apiBaseUrl,
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
