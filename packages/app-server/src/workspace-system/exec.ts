import { mkdirSync } from "node:fs";
import { relative, resolve } from "node:path";

import { OverlayRuleFs } from "@agenter/just-bash-overlay-rule-fs";
import { Bash, defineCommand, InMemoryFs, MountableFs } from "just-bash";

import { createWorkspaceHelpcenterCommand } from "../cli-command-catalog";
import { buildRuntimeToolExecCommand } from "../runtime-tool-exec";
import { normalizeWorkspaceGrantPattern } from "./grants";
import { getOneShotShellProcessViolation } from "./one-shot-shell-guard";
import { resolveWorkspaceAvatarAssetRoot, resolveWorkspacePublicAssetRoot } from "./paths";
import { listWorkspaceHiddenPrivatePaths } from "./private-isolation";
import { listWorkspaceToolBindings } from "./tool-bindings";
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

const WORKSPACE_SYSTEM_GRANT_KINDS: WorkspaceAssetKind[] = ["skills", "memory", "tools", "archive"];

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
  const hiddenPaths = listWorkspaceHiddenPrivatePaths({
    workspacePath: input.workspacePath,
    avatar: input.avatar,
  });
  const createOverlay = () =>
    new OverlayRuleFs({
      root: input.workspacePath,
      config: {
        rules: input.grants,
        extraRules: systemGrantPatterns,
        hiddenPaths,
      },
    });
  fs.mount(input.workspacePath, createOverlay());
  fs.mount("/workspace", createOverlay());
  return fs;
};

export const executeWorkspaceBash = async (input: WorkspaceBashExecInput): Promise<WorkspaceBashExecResult> => {
  const workspacePath = resolve(input.workspacePath);
  const cwd = input.cwd ? resolve(input.cwd) : workspacePath;
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
  const toolBindings = listWorkspaceToolBindings({
    workspacePath,
    avatar: input.avatar,
  });
  const bash = new Bash({
    fs,
    cwd,
    python: toolBindings.some((binding) => binding.shell === "python3"),
    javascript: toolBindings.some((binding) => binding.shell === "js-exec"),
    customCommands: [
      ...toolBindings.map((binding) =>
        defineCommand(binding.commandName, async (args, ctx) => {
          const exec = ctx.exec;
          if (!exec) {
            return { stdout: "", stderr: `tool execution unavailable for ${binding.commandName}\n`, exitCode: 1 };
          }
          return await exec(
            buildRuntimeToolExecCommand({
              runner: binding.shell,
              filePath: binding.absolutePath,
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
      createWorkspaceHelpcenterCommand({
        workspacePath,
        avatar: input.avatar,
      }),
    ],
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
