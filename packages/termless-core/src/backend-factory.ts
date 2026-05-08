import { buildBackend, isReady } from "@termless/core";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { createXtermBackend } from "./termless-xtermjs.js";
import type { TerminalBackend } from "./termless-types.js";

export type TerminalBackendKind = "xterm" | "ghostty-native";

export const TERMINAL_BACKEND_KINDS = ["xterm", "ghostty-native"] as const satisfies readonly TerminalBackendKind[];
export const DEFAULT_TERMINAL_BACKEND = "xterm" as const satisfies TerminalBackendKind;

export interface CreateTerminalBackendInput {
  backend?: TerminalBackendKind;
  cols: number;
  rows: number;
  scrollbackLimit: number;
}

export const isTerminalBackendKind = (value: unknown): value is TerminalBackendKind =>
  typeof value === "string" && TERMINAL_BACKEND_KINDS.includes(value as TerminalBackendKind);

export const assertTerminalBackendKind = (value: unknown): TerminalBackendKind => {
  if (!isTerminalBackendKind(value)) {
    throw new Error(`unsupported terminal backend: ${String(value)}`);
  }
  return value;
};

const toOfficialBackendName = (backend: TerminalBackendKind): "xtermjs" | "ghostty-native" =>
  backend === "xterm" ? "xtermjs" : "ghostty-native";

interface GhosttyNativeModule {
  createGhosttyNativeBackend(opts?: Partial<{ cols: number; rows: number; scrollbackLimit: number }>): TerminalBackend;
}

const require = createRequire(import.meta.url);

const loadGhosttyNativeModule = (): GhosttyNativeModule => {
  return require("@termless/ghostty-native") as GhosttyNativeModule;
};

const resolveInstalledPackageRoot = (packageName: string): string | null => {
  try {
    const resolvedEntry = require.resolve(packageName);
    let dir = dirname(resolvedEntry);
    for (let depth = 0; depth < 10; depth += 1) {
      const packageJsonPath = join(dir, "package.json");
      if (existsSync(packageJsonPath)) {
        try {
          const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: string };
          if (pkg.name === packageName) {
            return dir;
          }
        } catch {
          // Ignore malformed package.json and keep walking upward.
        }
      }
      const parentDir = dirname(dir);
      if (parentDir === dir) {
        break;
      }
      dir = parentDir;
    }
  } catch {
    return null;
  }
  return null;
};

const hasGhosttyNativeArtifact = (packageRoot: string): boolean =>
  existsSync(join(packageRoot, "termless-ghostty-native.node")) ||
  existsSync(join(packageRoot, "native", "zig-out", "lib", "termless-ghostty-native.node"));

const ensureGhosttyNativeWorkspaceBuild = (): void => {
  const packageRoot = resolveInstalledPackageRoot("@termless/ghostty-native");
  if (!packageRoot || hasGhosttyNativeArtifact(packageRoot)) {
    return;
  }
  const buildScript = join(packageRoot, "build", "build.sh");
  if (!existsSync(buildScript)) {
    return;
  }
  execFileSync("bash", [buildScript], {
    cwd: packageRoot,
    stdio: "inherit",
  });
};

const ensureOfficialBackendReady = (backend: TerminalBackendKind): void => {
  const officialBackendName = toOfficialBackendName(backend);
  if (!isReady(officialBackendName)) {
    buildBackend(officialBackendName);
  }
  if (backend === "ghostty-native") {
    ensureGhosttyNativeWorkspaceBuild();
  }
};

const createOfficialTerminalBackend = (
  backend: TerminalBackendKind,
  input: Omit<CreateTerminalBackendInput, "backend">,
): TerminalBackend => {
  try {
    ensureOfficialBackendReady(backend);
    if (backend === "xterm") {
      return createXtermBackend({
        cols: input.cols,
        rows: input.rows,
        scrollbackLimit: input.scrollbackLimit,
      });
    }
    return loadGhosttyNativeModule().createGhosttyNativeBackend({
      cols: input.cols,
      rows: input.rows,
      scrollbackLimit: input.scrollbackLimit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`terminal backend unavailable: ${backend}: ${message}`);
  }
};

export const createTerminalBackend = (input: CreateTerminalBackendInput): TerminalBackend => {
  const backend = input.backend ?? DEFAULT_TERMINAL_BACKEND;
  switch (backend) {
    case "xterm":
      return createOfficialTerminalBackend(backend, input);
    case "ghostty-native":
      return createOfficialTerminalBackend(backend, input);
    default:
      throw new Error(`unsupported terminal backend: ${backend satisfies never}`);
  }
};
