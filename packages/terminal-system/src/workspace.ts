import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const BASE_DIR = join(tmpdir(), "agentic-terminal");

export interface WorkspaceOptions {
  outputRoot?: string;
  workspacePath?: string;
  resumePid?: number;
}

export const resolveOutputRoot = (outputRoot?: string): string => {
  if (!outputRoot || outputRoot.trim().length === 0) {
    return BASE_DIR;
  }
  if (isAbsolute(outputRoot)) {
    return outputRoot;
  }
  return resolve(process.cwd(), outputRoot);
};

const pad2 = (value: number): string => value.toString().padStart(2, "0");

const createUtcWorkspacePath = (rootDir: string, pid: number): string => {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = pad2(now.getUTCMonth() + 1);
  const day = pad2(now.getUTCDate());
  const hour = pad2(now.getUTCHours());
  const minute = pad2(now.getUTCMinutes());
  const dayDir = join(rootDir, year, month, day);
  mkdirSync(dayDir, { recursive: true });

  const baseName = `${hour}_${minute}-${pid}`;
  let candidate = join(dayDir, baseName);
  if (!existsSync(candidate)) {
    return candidate;
  }
  for (let index = 1; index < 100; index += 1) {
    const suffix = pad2(index);
    candidate = join(dayDir, `${baseName}-${suffix}`);
    if (!existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Failed to allocate workspace path under ${dayDir}`);
};

const isWorkspaceNameForPid = (name: string, pid: number): boolean => {
  if (name.startsWith(`${pid}-`)) {
    return true;
  }
  return new RegExp(`-${pid}(?:-[0-9]{2})?$`).test(name);
};

const collectWorkspaceCandidates = (rootDir: string, pid: number): string[] => {
  const out: string[] = [];
  const stack: string[] = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const next = join(current, entry.name);
      if (isWorkspaceNameForPid(entry.name, pid)) {
        out.push(next);
      }
      stack.push(next);
    }
  }
  return out;
};

const findByPid = (rootDir: string, pid: number): string | null => {
  if (!existsSync(rootDir)) {
    return null;
  }
  const candidates = collectWorkspaceCandidates(rootDir, pid).sort((a, b) => {
    const aStat = statSync(a).mtimeMs;
    const bStat = statSync(b).mtimeMs;
    if (aStat !== bStat) {
      return bStat - aStat;
    }
    return b.localeCompare(a);
  });
  if (candidates.length === 0) {
    return null;
  }
  return candidates[0];
};

export function createWorkspace(options?: WorkspaceOptions): string {
  const rootDir = resolveOutputRoot(options?.outputRoot);
  mkdirSync(rootDir, { recursive: true });

  if (options?.workspacePath) {
    if (!existsSync(options.workspacePath)) {
      throw new Error(`Workspace does not exist: ${options.workspacePath}`);
    }
    return options.workspacePath;
  }

  if (options?.resumePid !== undefined) {
    const found = findByPid(rootDir, options.resumePid);
    if (!found) {
      throw new Error(`No workspace found for pid=${options.resumePid}`);
    }
    return found;
  }

  const dir = createUtcWorkspacePath(rootDir, process.pid);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function destroyWorkspace(workspace: string, keepLogs: boolean): void {
  if (keepLogs) {
    return;
  }
  if (existsSync(workspace)) {
    rmSync(workspace, { recursive: true, force: true });
  }
}
