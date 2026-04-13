import { accessSync, constants as fsConstants, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { Bash, defineCommand, InMemoryFs, MountableFs } from "just-bash";

import { buildRuntimeToolExecCommand } from "../runtime-tool-exec";
import { GrantedWorkspaceFs } from "./granted-fs";
import { normalizeWorkspaceGrantPattern } from "./grants";
import { getOneShotShellProcessViolation } from "./one-shot-shell-guard";
import {
  resolveWorkspaceAvatarAssetRoot,
  resolveWorkspacePublicAssetRoot,
  resolveWorkspaceToolCommandName,
} from "./paths";
import type { WorkspaceAssetKind, WorkspaceGrantRecord } from "./types";

export interface WorkspaceBashExecInput {
  workspacePath: string;
  avatar: string;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  grants: WorkspaceGrantRecord[];
}

export interface WorkspaceBashExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  cwd: string;
}

interface WorkspaceToolBinding {
  commandName: string;
  virtualPath: string;
  shell: "bash" | "sh" | "python3" | "js-exec";
}

const VIRTUAL_WORKSPACE_ROOT = "/workspace";
const WORKSPACE_SYSTEM_GRANT_KINDS: WorkspaceAssetKind[] = ["skills", "memory", "tools", "archive"];

const ensureReadableDirectory = (path: string): boolean => {
  try {
    accessSync(path, fsConstants.R_OK);
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const scanToolBindings = (input: { workspacePath: string; avatar: string }): WorkspaceToolBinding[] => {
  const roots = [
    resolveWorkspacePublicAssetRoot(input.workspacePath, "tools"),
    resolveWorkspaceAvatarAssetRoot(input.workspacePath, input.avatar, "tools"),
  ];
  const bindings: WorkspaceToolBinding[] = [];
  for (const root of roots) {
    if (!ensureReadableDirectory(root)) {
      continue;
    }
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }
      const filePath = join(root, entry.name);
      const firstLine = readFileSync(filePath, "utf8").split(/\r?\n/, 1)[0] ?? "";
      const shell = firstLine.includes("python")
        ? "python3"
        : firstLine.includes("node") || firstLine.includes("deno") || firstLine.includes("bun")
          ? "js-exec"
          : firstLine.includes("sh")
            ? "sh"
            : "bash";
      bindings.push({
        commandName: resolveWorkspaceToolCommandName(entry.name),
        virtualPath: join(VIRTUAL_WORKSPACE_ROOT, relative(input.workspacePath, filePath)),
        shell,
      });
    }
  }
  return bindings;
};

const createBashFs = (input: { workspacePath: string; avatar: string; grants: WorkspaceGrantRecord[] }) => {
  mkdirSync(input.workspacePath, { recursive: true });
  const systemGrantPatterns = WORKSPACE_SYSTEM_GRANT_KINDS.flatMap((kind) => {
    const roots = [
      resolveWorkspacePublicAssetRoot(input.workspacePath, kind),
      resolveWorkspaceAvatarAssetRoot(input.workspacePath, input.avatar, kind),
    ];
    return roots.flatMap((rootPath) => {
      const relation = relative(input.workspacePath, rootPath);
      if (relation.startsWith("..")) {
        return [];
      }
      return [
        {
          pattern: normalizeWorkspaceGrantPattern(relation),
          mode: "rw" as const,
        },
      ];
    });
  });
  const fs = new MountableFs({ base: new InMemoryFs() });
  fs.mount(
    VIRTUAL_WORKSPACE_ROOT,
    new GrantedWorkspaceFs({
      workspacePath: input.workspacePath,
      grants: input.grants,
      systemGrantPatterns,
    }),
  );
  return fs;
};

export const executeWorkspaceBash = async (input: WorkspaceBashExecInput): Promise<WorkspaceBashExecResult> => {
  const workspacePath = resolve(input.workspacePath);
  const cwd = input.cwd ?? VIRTUAL_WORKSPACE_ROOT;
  const processViolation = getOneShotShellProcessViolation(input.command);
  if (processViolation) {
    return {
      stdout: "",
      stderr: `${processViolation}\n`,
      exitCode: 1,
      cwd,
    };
  }
  const fs = createBashFs({
    workspacePath,
    avatar: input.avatar,
    grants: input.grants,
  });
  const toolBindings = scanToolBindings({
    workspacePath,
    avatar: input.avatar,
  });
  const bash = new Bash({
    fs,
    cwd,
    python: toolBindings.some((binding) => binding.shell === "python3"),
    javascript: toolBindings.some((binding) => binding.shell === "js-exec"),
    customCommands: toolBindings.map((binding) =>
      defineCommand(binding.commandName, async (args, ctx) => {
        const exec = ctx.exec;
        if (!exec) {
          return { stdout: "", stderr: `tool execution unavailable for ${binding.commandName}\n`, exitCode: 1 };
        }
        return await exec(
          buildRuntimeToolExecCommand({
            runner: binding.shell,
            filePath: binding.virtualPath,
            args,
          }),
          {
            cwd: ctx.cwd,
            env: Object.fromEntries(ctx.env.entries()),
            stdin: ctx.stdin,
            signal: ctx.signal,
          },
        );
      }),
    ),
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
    const message = error instanceof Error ? error.message : String(error);
    return {
      stdout: "",
      stderr: `${message}\n`,
      exitCode: 1,
      cwd,
    };
  }
};
