import { accessSync, existsSync, constants as fsConstants, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { z } from "zod";

import {
  resolveWorkspaceAvatarAssetRoot,
  resolveWorkspacePublicAssetRoot,
  resolveWorkspaceToolCommandName,
} from "./paths";

export type WorkspaceToolScope = "public" | "private";

export interface WorkspaceToolHelpcenterMetadata {
  name: string;
  description: string;
  skillRef?: string;
}

export interface WorkspaceToolBinding {
  scope: WorkspaceToolScope;
  rootPath: string;
  fileName: string;
  absolutePath: string;
  commandName: string;
  shell: "bash" | "sh" | "python3" | "js-exec";
  helpcenter: {
    metadataPath: string | null;
    registered: boolean;
    name: string;
    description: string;
    skillRef?: string;
  };
}

export const WORKSPACE_TOOL_HELP_METADATA_SUFFIX = ".cli.json";

const workspaceToolHelpcenterMetadataSchema = z
  .object({
    name: z.string().trim().min(1),
    description: z.string().trim().min(1),
    skillRef: z.string().trim().min(1).optional(),
  })
  .strip();

const ensureReadableDirectory = (path: string): boolean => {
  try {
    accessSync(path, fsConstants.R_OK);
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const isWorkspaceToolMetadataFile = (fileName: string): boolean =>
  fileName.endsWith(WORKSPACE_TOOL_HELP_METADATA_SUFFIX);

const resolveToolRunner = (filePath: string): WorkspaceToolBinding["shell"] => {
  const firstLine = readFileSync(filePath, "utf8").split(/\r?\n/u, 1)[0] ?? "";
  if (firstLine.includes("python")) {
    return "python3";
  }
  if (firstLine.includes("node") || firstLine.includes("bun") || firstLine.includes("deno")) {
    return "js-exec";
  }
  if (firstLine.includes("sh")) {
    return "sh";
  }
  if (/\.(mjs|cjs|js|ts)$/u.test(filePath)) {
    return "js-exec";
  }
  if (/\.(py)$/u.test(filePath)) {
    return "python3";
  }
  return "bash";
};

const resolveWorkspaceToolMetadataPath = (rootPath: string, fileName: string): string =>
  join(rootPath, `${fileName}${WORKSPACE_TOOL_HELP_METADATA_SUFFIX}`);

const readWorkspaceToolHelpcenterMetadata = (metadataPath: string): WorkspaceToolHelpcenterMetadata | null => {
  if (!existsSync(metadataPath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(metadataPath, "utf8")) as unknown;
    return workspaceToolHelpcenterMetadataSchema.parse(parsed);
  } catch {
    return null;
  }
};

const buildWorkspaceToolFallbackDescription = (input: { commandName: string; fileName: string }): string =>
  `No helpcenter metadata registered for ${input.fileName}. Use \`${input.commandName} --help\` or inspect the tool source.`;

export const listWorkspaceToolBindings = (input: { workspacePath: string; avatar: string }): WorkspaceToolBinding[] => {
  const roots: Array<{ scope: WorkspaceToolScope; rootPath: string }> = [
    {
      scope: "public",
      rootPath: resolveWorkspacePublicAssetRoot(input.workspacePath, "tools"),
    },
    {
      scope: "private",
      rootPath: resolveWorkspaceAvatarAssetRoot(input.workspacePath, input.avatar, "tools"),
    },
  ];
  const bindings: WorkspaceToolBinding[] = [];
  for (const root of roots) {
    if (!ensureReadableDirectory(root.rootPath)) {
      continue;
    }
    for (const entry of readdirSync(root.rootPath, { withFileTypes: true })) {
      if (!entry.isFile() || isWorkspaceToolMetadataFile(entry.name)) {
        continue;
      }
      const absolutePath = resolve(join(root.rootPath, entry.name));
      const commandName = resolveWorkspaceToolCommandName(entry.name);
      const metadataPath = resolveWorkspaceToolMetadataPath(root.rootPath, entry.name);
      const metadata = readWorkspaceToolHelpcenterMetadata(metadataPath);
      bindings.push({
        scope: root.scope,
        rootPath: root.rootPath,
        fileName: entry.name,
        absolutePath,
        commandName,
        shell: resolveToolRunner(absolutePath),
        helpcenter: metadata
          ? {
              metadataPath,
              registered: true,
              name: metadata.name,
              description: metadata.description,
              skillRef: metadata.skillRef,
            }
          : {
              metadataPath: existsSync(metadataPath) ? metadataPath : null,
              registered: false,
              name: entry.name,
              description: buildWorkspaceToolFallbackDescription({
                commandName,
                fileName: entry.name,
              }),
            },
      });
    }
  }
  return bindings;
};
