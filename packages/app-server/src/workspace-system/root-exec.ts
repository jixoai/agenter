import { mkdirSync } from "node:fs";
import { relative, resolve } from "node:path";

import { OverlayRuleFs } from "@agenter/just-bash-overlay-rule-fs";
import { Bash, InMemoryFs, MountableFs, OverlayFs, ReadWriteFs, defineCommand } from "just-bash";

import { getOneShotShellProcessViolation } from "./one-shot-shell-guard";
import { createTruthfulRootWorkspaceFetch } from "./root-fetch";
import type { WorkspaceGrantRecord } from "./types";

export interface RootWorkspaceMountInput {
  path: string;
  mode: "ro" | "rw";
  grants?: WorkspaceGrantRecord[];
  hiddenPaths?: string[];
}

export interface RootWorkspaceShellWorldOptions {
  rootWorkspacePath: string;
  customCommands?: Array<ReturnType<typeof defineCommand>>;
}

export interface RootWorkspaceShellExecInput {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  mounts?: RootWorkspaceMountInput[];
}

export interface RootWorkspaceBashExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  cwd: string;
}

type DynamicRootWorkspaceMountKind = "granted" | "ro" | "rw";

interface DynamicRootWorkspaceMountState {
  kind: DynamicRootWorkspaceMountKind;
  fingerprint: string;
  fs: OverlayRuleFs | OverlayFs | ReadWriteFs;
}

const ensureMountParentDirs = (fs: InMemoryFs, absolutePath: string): void => {
  const segments = resolve(absolutePath).split("/").filter(Boolean);
  let current = "";
  for (const segment of segments.slice(0, -1)) {
    current = `${current}/${segment}`;
    fs.mkdirSync(current, { recursive: true });
  }
};

const mergeRootWorkspaceMount = (
  current: RootWorkspaceMountInput | undefined,
  next: RootWorkspaceMountInput,
): RootWorkspaceMountInput => ({
  path: resolve(next.path),
  mode: current?.mode === "rw" || next.mode === "rw" ? "rw" : "ro",
  grants: next.grants ?? current?.grants,
  hiddenPaths: next.hiddenPaths ?? current?.hiddenPaths,
});

const isNestedMountPath = (outerPath: string, innerPath: string): boolean => {
  const rel = relative(resolve(outerPath), resolve(innerPath));
  return rel.length > 0 && rel !== "." && !rel.startsWith("..");
};

const findNestedMountConflict = (
  mounts: readonly RootWorkspaceMountInput[],
): { outerPath: string; innerPath: string } | null => {
  for (let index = 0; index < mounts.length; index += 1) {
    const left = mounts[index];
    if (!left) {
      continue;
    }
    for (let otherIndex = index + 1; otherIndex < mounts.length; otherIndex += 1) {
      const right = mounts[otherIndex];
      if (!right) {
        continue;
      }
      if (isNestedMountPath(left.path, right.path)) {
        return {
          outerPath: resolve(left.path),
          innerPath: resolve(right.path),
        };
      }
      if (isNestedMountPath(right.path, left.path)) {
        return {
          outerPath: resolve(right.path),
          innerPath: resolve(left.path),
        };
      }
    }
  }
  return null;
};

const normalizeRootWorkspaceMounts = (
  rootWorkspacePath: string,
  mounts: readonly RootWorkspaceMountInput[],
): RootWorkspaceMountInput[] => {
  const uniqueMounts = new Map<string, RootWorkspaceMountInput>();
  const resolvedRootWorkspacePath = resolve(rootWorkspacePath);
  uniqueMounts.set(resolvedRootWorkspacePath, {
    path: resolvedRootWorkspacePath,
    mode: "rw",
  });
  for (const mount of mounts) {
    const resolvedPath = resolve(mount.path);
    uniqueMounts.set(resolvedPath, mergeRootWorkspaceMount(uniqueMounts.get(resolvedPath), mount));
  }
  const normalizedMounts = [...uniqueMounts.values()];
  const nestedConflict = findNestedMountConflict(normalizedMounts);
  if (nestedConflict) {
    throw new Error(
      `root workspace mount overlap: '${nestedConflict.innerPath}' is nested inside '${nestedConflict.outerPath}'`,
    );
  }
  return normalizedMounts;
};

const resolveDynamicMountKind = (mount: RootWorkspaceMountInput): DynamicRootWorkspaceMountKind => {
  if (mount.grants) {
    return "granted";
  }
  return mount.mode;
};

const buildDynamicMountFingerprint = (mount: RootWorkspaceMountInput): string =>
  JSON.stringify({
    path: resolve(mount.path),
    mode: mount.mode,
    grants: mount.grants ?? null,
    hiddenPaths: mount.hiddenPaths ?? null,
  });

const createDynamicMountState = (mount: RootWorkspaceMountInput): DynamicRootWorkspaceMountState => {
  const kind = resolveDynamicMountKind(mount);
  const resolvedPath = resolve(mount.path);
  if (kind === "granted") {
    return {
      kind,
      fingerprint: buildDynamicMountFingerprint(mount),
      fs: new OverlayRuleFs({
        root: resolvedPath,
        config: {
          rules: mount.grants ?? [],
          hiddenPaths: mount.hiddenPaths,
        },
      }),
    };
  }
  if (kind === "rw") {
    return {
      kind,
      fingerprint: buildDynamicMountFingerprint(mount),
      fs: new ReadWriteFs({ root: resolvedPath }),
    };
  }
  return {
    kind,
    fingerprint: buildDynamicMountFingerprint(mount),
    fs: new OverlayFs({
      root: resolvedPath,
      mountPoint: "/",
      readOnly: true,
    }),
  };
};

const updateDynamicMountState = (current: DynamicRootWorkspaceMountState, next: RootWorkspaceMountInput): boolean => {
  const nextKind = resolveDynamicMountKind(next);
  const nextFingerprint = buildDynamicMountFingerprint(next);
  if (current.kind !== nextKind) {
    return false;
  }
  if (current.kind === "granted" && current.fs instanceof OverlayRuleFs) {
    if (current.fingerprint !== nextFingerprint) {
      current.fs.replaceConfig({
        rules: next.grants ?? [],
        hiddenPaths: next.hiddenPaths,
      });
      current.fingerprint = nextFingerprint;
    }
    return true;
  }
  current.fingerprint = nextFingerprint;
  return true;
};

/**
 * Durable root-workspace shell world.
 *
 * `just-bash` already isolates shell session state per `exec()`, so the runtime
 * should keep one world and refresh its dynamic authorities instead of
 * rebuilding the whole root shell on every `root_bash` call.
 */
export class RootWorkspaceShellWorld {
  private readonly rootWorkspacePath: string;
  private readonly baseFs = new InMemoryFs();
  private readonly mountableFs = new MountableFs({ base: this.baseFs });
  private readonly dynamicMounts = new Map<string, DynamicRootWorkspaceMountState>();
  private readonly bash: Bash;
  private executionQueue: Promise<void> = Promise.resolve();

  constructor(input: RootWorkspaceShellWorldOptions) {
    this.rootWorkspacePath = resolve(input.rootWorkspacePath);
    ensureMountParentDirs(this.baseFs, this.rootWorkspacePath);
    mkdirSync(this.rootWorkspacePath, { recursive: true });
    this.mountableFs.mount(this.rootWorkspacePath, new ReadWriteFs({ root: this.rootWorkspacePath }));
    this.bash = new Bash({
      fs: this.mountableFs,
      cwd: this.rootWorkspacePath,
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
  }

  async exec(input: RootWorkspaceShellExecInput): Promise<RootWorkspaceBashExecResult> {
    const cwd = input.cwd ? resolve(input.cwd) : this.rootWorkspacePath;
    const processViolation = getOneShotShellProcessViolation(input.command);
    if (processViolation) {
      return {
        stdout: "",
        stderr: `${processViolation}\n`,
        exitCode: 1,
        cwd,
      };
    }
    return await this.runExclusive(async () => {
      try {
        this.syncMounts(input.mounts ?? []);
        const result = await this.bash.exec(input.command, {
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
    });
  }

  private syncMounts(mounts: readonly RootWorkspaceMountInput[]): void {
    // Refresh the shared world in place: the host Bash instance stays durable,
    // while each exec sees the latest authority graph before shell state starts.
    const normalizedMounts = normalizeRootWorkspaceMounts(this.rootWorkspacePath, mounts);
    const nextDynamicMounts = new Map(
      normalizedMounts
        .filter((mount) => resolve(mount.path) !== this.rootWorkspacePath)
        .map((mount) => [resolve(mount.path), mount] as const),
    );

    for (const [path] of this.dynamicMounts) {
      if (!nextDynamicMounts.has(path)) {
        this.mountableFs.unmount(path);
        this.dynamicMounts.delete(path);
      }
    }

    for (const [path, mount] of nextDynamicMounts) {
      const current = this.dynamicMounts.get(path);
      if (current && updateDynamicMountState(current, mount)) {
        continue;
      }
      if (current) {
        this.mountableFs.unmount(path);
      }
      ensureMountParentDirs(this.baseFs, path);
      mkdirSync(path, { recursive: true });
      const nextState = createDynamicMountState(mount);
      this.mountableFs.mount(path, nextState.fs);
      this.dynamicMounts.set(path, nextState);
    }
  }

  private async runExclusive<TResult>(work: () => Promise<TResult>): Promise<TResult> {
    // The durable root world owns shared mutable mount/config state, so refresh
    // plus exec must stay serialized to avoid cross-call authority corruption.
    const run = this.executionQueue.then(work, work);
    this.executionQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return await run;
  }
}

export const createRootWorkspaceShellWorld = (input: RootWorkspaceShellWorldOptions): RootWorkspaceShellWorld =>
  new RootWorkspaceShellWorld(input);
