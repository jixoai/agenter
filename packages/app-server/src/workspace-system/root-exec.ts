import { accessSync, constants as fsConstants, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { Bash, InMemoryFs, MountableFs, OverlayFs, ReadWriteFs, defineCommand } from "just-bash";

import { getOneShotShellProcessViolation } from "./one-shot-shell-guard";
import { createTruthfulRootWorkspaceFetch } from "./root-fetch";

export interface RootWorkspaceMountInput {
  path: string;
  mode: "ro" | "rw";
}

export interface RootWorkspaceBashExecInput {
  rootWorkspacePath: string;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  mounts: RootWorkspaceMountInput[];
  customCommands?: Array<ReturnType<typeof defineCommand>>;
}

export interface RootWorkspaceBashExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  cwd: string;
}

const ensureMountParentDirs = (fs: InMemoryFs, absolutePath: string): void => {
  const segments = resolve(absolutePath).split("/").filter(Boolean);
  let current = "";
  for (const segment of segments.slice(0, -1)) {
    current = `${current}/${segment}`;
    fs.mkdirSync(current, { recursive: true });
  }
};

const ensureReadableDirectory = (path: string): boolean => {
  try {
    accessSync(path, fsConstants.R_OK);
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const createRootWorkspaceFs = (input: RootWorkspaceBashExecInput): MountableFs => {
  const base = new InMemoryFs();
  const fs = new MountableFs({ base });
  const uniqueMounts = new Map<string, RootWorkspaceMountInput>();
  uniqueMounts.set(resolve(input.rootWorkspacePath), {
    path: resolve(input.rootWorkspacePath),
    mode: "rw",
  });
  for (const mount of input.mounts) {
    uniqueMounts.set(resolve(mount.path), {
      path: resolve(mount.path),
      mode: mount.mode,
    });
  }
  for (const mount of uniqueMounts.values()) {
    ensureMountParentDirs(base, mount.path);
    mkdirSync(mount.path, { recursive: true });
    fs.mount(
      mount.path,
      mount.mode === "rw"
        ? new ReadWriteFs({ root: mount.path })
        : new OverlayFs({
            root: mount.path,
            readOnly: true,
          }),
    );
  }
  return fs;
};

export const executeRootWorkspaceBash = async (
  input: RootWorkspaceBashExecInput,
): Promise<RootWorkspaceBashExecResult> => {
  const cwd = input.cwd ? resolve(input.cwd) : resolve(input.rootWorkspacePath);
  const processViolation = getOneShotShellProcessViolation(input.command);
  if (processViolation) {
    return {
      stdout: "",
      stderr: `${processViolation}\n`,
      exitCode: 1,
      cwd,
    };
  }
  const bash = new Bash({
    fs: createRootWorkspaceFs(input),
    cwd,
    // just-bash's defense-in-depth layer currently breaks builtin curl under
    // Bun by blocking WeakRef during fetch internals. The primary sandbox here
    // remains the mounted filesystem + explicit command surface, so disable the
    // secondary guard until upstream fixes the runtime bug.
    defenseInDepth: false,
    // Bun's global fetch synthesizes dead-loopback failures into HTTP 502
    // responses, which breaks root-shell delivery verification. Keep the same
    // network authority, but route curl through a truthful transport wrapper.
    fetch: createTruthfulRootWorkspaceFetch(),
    python: true,
    javascript: true,
    customCommands: input.customCommands,
  });
  try {
    const result = await bash.exec(input.command, {
      cwd,
      env: input.env,
      stdin: input.stdin,
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      cwd,
    };
  } catch (error) {
    return {
      stdout: "",
      stderr: `${error instanceof Error ? error.message : String(error)}\n`,
      exitCode: 1,
      cwd,
    };
  }
};
