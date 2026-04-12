import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_REPO_ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const BUILTIN_RUNTIME_TOOLS_SOURCE = "packages/app-server/tools";

export interface BuiltinRuntimeToolDescriptor {
  fileName: string;
  description: string;
  inputSchema: Record<string, unknown>;
  canonicalHelpLines: string[];
  notes: string[];
}

const BUILTIN_RUNTIME_TOOL_DESCRIPTORS: Record<string, BuiltinRuntimeToolDescriptor> = {};

const collectToolFiles = (root: string, depth = 0): string[] => {
  if (!existsSync(root) || depth > 4) {
    return [];
  }
  let stats;
  try {
    stats = statSync(root);
  } catch {
    return [];
  }
  if (!stats.isDirectory()) {
    return [];
  }
  const output: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const nextPath = join(root, entry.name);
    if (entry.isDirectory()) {
      output.push(...collectToolFiles(nextPath, depth + 1));
      continue;
    }
    if (entry.isFile()) {
      output.push(nextPath);
    }
  }
  return output;
};

const copyToolFile = (sourcePath: string, sourceRoot: string, targetRoot: string): void => {
  const relativePath = relative(sourceRoot, sourcePath);
  const targetPath = join(targetRoot, relativePath);
  mkdirSync(dirname(targetPath), { recursive: true });
  copyFileSync(sourcePath, targetPath);
};

export interface RuntimeBuiltinToolLookupInput {
  rootWorkspacePath: string;
  homeDir?: string;
  repoRoot?: string;
}

export const getBuiltinRuntimeToolDescriptor = (fileName: string): BuiltinRuntimeToolDescriptor | null =>
  BUILTIN_RUNTIME_TOOL_DESCRIPTORS[fileName] ?? null;

export const renderBuiltinRuntimeToolHelp = (descriptor: BuiltinRuntimeToolDescriptor): string =>
  [
    descriptor.fileName,
    "",
    `Description: ${descriptor.description}`,
    "",
    "Input JSON schema:",
    JSON.stringify(descriptor.inputSchema, null, 2),
    "",
    "Canonical forms:",
    `- ${descriptor.canonicalHelpLines[0] ?? ""}`,
    ...descriptor.canonicalHelpLines.slice(1),
    "",
    ...descriptor.notes,
    "",
  ].join("\n");

export const getRuntimeToolRoot = (input: RuntimeBuiltinToolLookupInput): string =>
  resolve(input.rootWorkspacePath || join(input.homeDir ?? homedir(), ".agenter", "avatars", "unknown"), "tools");

export const materializeBuiltinRuntimeTools = (input: RuntimeBuiltinToolLookupInput): string[] => {
  const repoRoot = resolve(input.repoRoot ?? DEFAULT_REPO_ROOT);
  const sourceRoot = resolve(repoRoot, BUILTIN_RUNTIME_TOOLS_SOURCE);
  const targetRoot = getRuntimeToolRoot(input);
  mkdirSync(targetRoot, { recursive: true });
  const files = collectToolFiles(sourceRoot);
  for (const filePath of files) {
    copyToolFile(filePath, sourceRoot, targetRoot);
  }
  return files.map((filePath) => relative(sourceRoot, filePath)).sort((left, right) => left.localeCompare(right));
};

export const listRuntimeToolFiles = (input: RuntimeBuiltinToolLookupInput): string[] => {
  materializeBuiltinRuntimeTools(input);
  const toolRoot = getRuntimeToolRoot(input);
  return collectToolFiles(toolRoot)
    .map((filePath) => relative(toolRoot, filePath))
    .sort((left, right) => left.localeCompare(right));
};
