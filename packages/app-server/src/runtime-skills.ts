import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runtimeBuiltinSkillCatalog } from "./generated/runtime-skill-catalog.generated";
import type { RuntimeBuiltinSkillCatalogEntry } from "./runtime-skill-catalog-builder";
import { RUNTIME_SKILL_CONFIG_BASENAME } from "./runtime-skill-config";
import {
  normalizeRuntimeSkillName,
  parseRuntimeSkillFrontmatter,
  pickRuntimeSkillBodySummary,
} from "./runtime-skill-markdown";
import { renderRuntimeToolExamples } from "./runtime-tool-descriptors";

export const RUNTIME_API_BASE_URL_ENV = "AGENTER_ATTENTION_API_BASE_URL";
export const RUNTIME_MANAGED_SEAT_AUTHORITY_URL_ENV = "AGENTER_MANAGED_SEAT_AUTHORITY_URL";
export const RUNTIME_HOME_DIR_ENV = "AGENTER_HOME_DIR";
export const RUNTIME_PRINCIPAL_ID_ENV = "AGENTER_AVATAR_PRINCIPAL_ID";
export const RUNTIME_PRIVATE_KEY_ENV = "AGENTER_AVATAR_PRIVATE_KEY";
export const RUNTIME_ROOT_WORKSPACE_ENV = "AGENTER_ROOT_WORKSPACE";

const DEFAULT_REPO_ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const RUNTIME_TOOL_NAMESPACES = new Set(["attention", "message", "workspace", "terminal", "skill"] as const);
const EXAMPLE_SLOT_PATTERN = /^(\s*)\{\{examples:([a-z]+)\.([a-z]+)\}\}\s*$/u;

export interface RuntimeSkillRoot {
  kind: "shared" | "global" | "avatar";
  path: string;
}

export type RuntimeSkillWritableRootKind = RuntimeSkillRoot["kind"];
export type RuntimeSkillRootKind = RuntimeSkillWritableRootKind | "builtin";

export interface RuntimeSkillRecord {
  name: string;
  summary: string;
  path: string;
  skillDir: string;
  configPath: string;
  configExists: boolean;
  root: string;
  rootKind: RuntimeSkillRootKind;
  writable: boolean;
  packageName?: string;
  content?: string;
}

export interface RuntimeSkillLookupInput {
  homeDir?: string;
  rootWorkspacePath?: string;
  skillHomeRoots?: readonly string[];
  resolveSkillHomeRoots?: () => readonly string[];
  writableSkillHomeRoot?: string;
  principalId?: string;
  repoRoot?: string;
}

/**
 * Visible runtime skills resolve from the broadest shared layer to the most
 * specific avatar-private root. The order is durable because both the CLI and
 * the Skills workbench rely on the same override law.
 */
const RUNTIME_SKILL_VISIBLE_LAYER_ORDER = ["shared", "builtin", "global", "avatar"] as const;

const normalizeRuntimeSkillSourceRoot = (path: string): string => {
  if (!isAbsolute(path)) {
    throw new Error(`runtime skill source root must be absolute: ${path}`);
  }
  return resolve(path);
};

const hasEnvSkillHomeAuthority = (
  input: Pick<RuntimeSkillLookupInput, "skillHomeRoots" | "resolveSkillHomeRoots">,
): boolean => input.skillHomeRoots !== undefined || input.resolveSkillHomeRoots !== undefined;

const readRuntimeSkillHomeRoots = (
  input: Pick<RuntimeSkillLookupInput, "skillHomeRoots" | "resolveSkillHomeRoots">,
): readonly string[] => input.skillHomeRoots ?? input.resolveSkillHomeRoots?.() ?? [];

const collectSkillFiles = (root: string, depth = 0): string[] => {
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
  const directSkill = join(root, "SKILL.md");
  if (existsSync(directSkill)) {
    return [directSkill];
  }
  const output: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    output.push(...collectSkillFiles(join(root, entry.name), depth + 1));
  }
  return output;
};

const toRuntimeSkillRecord = (
  input: {
    name: string;
    summary: string;
    path: string;
    root: string;
    rootKind: RuntimeSkillRootKind;
    writable: boolean;
    packageName?: string;
    content?: string;
  },
): RuntimeSkillRecord => {
  const skillDir = resolve(dirname(input.path));
  const configPath = resolve(skillDir, RUNTIME_SKILL_CONFIG_BASENAME);
  return {
    ...input,
    path: resolve(input.path),
    skillDir,
    configPath,
    configExists: existsSync(configPath),
  };
};

const readSkillRecord = (filePath: string, root: RuntimeSkillRoot): RuntimeSkillRecord | null => {
  try {
    const content = readFileSync(filePath, "utf8");
    const frontmatter = parseRuntimeSkillFrontmatter(content);
    const fallbackName = basename(relative(root.path, filePath).replace(/\/SKILL\.md$/u, ""));
    const name = normalizeRuntimeSkillName(frontmatter.name ?? fallbackName);
    if (!name) {
      return null;
    }
    return toRuntimeSkillRecord({
      name,
      summary: frontmatter.description?.trim() || pickRuntimeSkillBodySummary(content),
      path: resolve(filePath),
      root: resolve(root.path),
      rootKind: root.kind,
      writable: true,
    });
  } catch {
    return null;
  }
};

export const resolveRuntimeSkillRoots = (input: {
  homeDir?: string;
  rootWorkspacePath?: string;
  skillHomeRoots?: readonly string[];
  resolveSkillHomeRoots?: () => readonly string[];
}): RuntimeSkillRoot[] => {
  if (hasEnvSkillHomeAuthority(input)) {
    return [...readRuntimeSkillHomeRoots(input)].map((path) => ({
      kind: "avatar",
      path: normalizeRuntimeSkillSourceRoot(path),
    }));
  }
  const homeDir = input.homeDir ?? homedir();
  if (!input.rootWorkspacePath) {
    throw new Error("rootWorkspacePath is required when SKILLS_HOME roots are not provided");
  }
  return [
    {
      kind: "shared",
      path: join(homeDir, ".agents", "skills"),
    },
    {
      kind: "global",
      path: join(homeDir, ".agenter", "skills"),
    },
    {
      kind: "avatar",
      path: join(input.rootWorkspacePath, "skills"),
    },
  ];
};

const resolveRuntimeSkillRootsByKind = (
  input: RuntimeSkillLookupInput,
  kind: RuntimeSkillWritableRootKind,
): RuntimeSkillRoot[] => resolveRuntimeSkillRoots(input).filter((root) => root.kind === kind);

export const resolveRuntimeSkillRootByKind = (
  input: RuntimeSkillLookupInput,
  kind: RuntimeSkillWritableRootKind,
): RuntimeSkillRoot => {
  if (kind === "avatar" && input.writableSkillHomeRoot) {
    return {
      kind: "avatar",
      path: normalizeRuntimeSkillSourceRoot(input.writableSkillHomeRoot),
    };
  }
  const match = resolveRuntimeSkillRootsByKind(input, kind).at(-1);
  if (!match) {
    throw new Error(`runtime skill root not found for kind: ${kind}`);
  }
  return match;
};

const listBuiltinRuntimeSkillMountRoots = (input: Pick<RuntimeSkillLookupInput, "repoRoot">): string[] => {
  const repoRoot = resolve(input.repoRoot ?? DEFAULT_REPO_ROOT);
  const roots = new Set<string>();
  for (const entry of runtimeBuiltinSkillCatalog) {
    roots.add(resolve(repoRoot, dirname(entry.sourcePath)));
  }
  return [...roots].sort((left, right) => left.localeCompare(right));
};

export const listRuntimeSkillMountRoots = (input: RuntimeSkillLookupInput): string[] => {
  const roots = new Set<string>();
  for (const root of resolveRuntimeSkillRoots(input)) {
    roots.add(resolve(root.path));
  }
  for (const root of listBuiltinRuntimeSkillMountRoots(input)) {
    roots.add(root);
  }
  return [...roots].sort((left, right) => left.localeCompare(right));
};

const asRuntimeToolNamespace = (
  value: string,
): "attention" | "message" | "workspace" | "terminal" | "skill" | null =>
  RUNTIME_TOOL_NAMESPACES.has(value as "attention" | "message" | "workspace" | "terminal" | "skill")
    ? (value as "attention" | "message" | "workspace" | "terminal" | "skill")
    : null;

const renderBuiltinRuntimeSkillContent = (
  template: string,
  input: RuntimeSkillLookupInput,
): string => {
  const principalId = input.principalId ?? "unknown-principal";
  const rootWorkspacePath =
    input.rootWorkspacePath ?? readRuntimeSkillHomeRoots(input).at(-1) ?? input.homeDir ?? homedir();
  return template
    .split(/\r?\n/u)
    .flatMap((line) => {
      const match = line.match(EXAMPLE_SLOT_PATTERN);
      if (match) {
        const [, indent, namespaceText, subcommand] = match;
        const namespace = asRuntimeToolNamespace(namespaceText);
        if (!namespace) {
          return [line];
        }
        return renderRuntimeToolExamples(namespace, subcommand).map((item) => `${indent}${item}`);
      }
      return [
        line
          .replaceAll("{{runtime.root_path}}", rootWorkspacePath)
          .replaceAll("{{runtime.principal_id}}", principalId),
      ];
    })
    .join("\n");
};

const readBuiltinSkillTemplate = (
  entry: RuntimeBuiltinSkillCatalogEntry,
  repoRoot: string,
): { template: string; sourcePath: string } => {
  const sourcePath = resolve(repoRoot, entry.sourcePath);
  if (existsSync(sourcePath)) {
    return {
      template: readFileSync(sourcePath, "utf8"),
      sourcePath,
    };
  }
  return {
    template: entry.template,
    sourcePath,
  };
};

const listBuiltinRuntimeSkills = (input: RuntimeSkillLookupInput): RuntimeSkillRecord[] => {
  const repoRoot = resolve(input.repoRoot ?? DEFAULT_REPO_ROOT);
  return runtimeBuiltinSkillCatalog.map((entry) => {
    const { template, sourcePath } = readBuiltinSkillTemplate(entry, repoRoot);
    const frontmatter = parseRuntimeSkillFrontmatter(template);
    return toRuntimeSkillRecord({
      name: entry.name,
      summary: frontmatter.description?.trim() || entry.summary,
      path: sourcePath,
      root: dirname(sourcePath),
      rootKind: "builtin",
      writable: false,
      packageName: entry.packageName,
      content: renderBuiltinRuntimeSkillContent(template, input),
    });
  });
};

export const listRuntimeSkillsInRoot = (root: RuntimeSkillRoot): RuntimeSkillRecord[] => {
  const skills: RuntimeSkillRecord[] = [];
  for (const filePath of collectSkillFiles(root.path)) {
    const record = readSkillRecord(filePath, root);
    if (record) {
      skills.push(record);
    }
  }
  return skills.sort((left, right) => left.name.localeCompare(right.name) || left.path.localeCompare(right.path));
};

const listRuntimeSkillsByVisibleLayerOrder = (input: RuntimeSkillLookupInput): RuntimeSkillRecord[] => {
  if (hasEnvSkillHomeAuthority(input)) {
    return [
      ...listBuiltinRuntimeSkills(input),
      ...resolveRuntimeSkillRoots(input).flatMap((root) => listRuntimeSkillsInRoot(root)),
    ];
  }
  const runtimeRoots = new Map(resolveRuntimeSkillRoots(input).map((root) => [root.kind, root] as const));
  const skills: RuntimeSkillRecord[] = [];

  for (const layer of RUNTIME_SKILL_VISIBLE_LAYER_ORDER) {
    if (layer === "builtin") {
      skills.push(...listBuiltinRuntimeSkills(input));
      continue;
    }
    const root = runtimeRoots.get(layer);
    if (!root) {
      continue;
    }
    skills.push(...listRuntimeSkillsInRoot(root));
  }

  return skills;
};

export const listRuntimeSkillsByRootKind = (
  input: RuntimeSkillLookupInput,
  rootKind: RuntimeSkillRootKind,
): RuntimeSkillRecord[] => {
  if (rootKind === "builtin") {
    return listBuiltinRuntimeSkills(input);
  }
  return resolveRuntimeSkillRootsByKind(input, rootKind).flatMap((root) => listRuntimeSkillsInRoot(root));
};

export const listRuntimeSkills = (input: RuntimeSkillLookupInput): RuntimeSkillRecord[] => {
  const visible = new Map<string, RuntimeSkillRecord>();
  for (const skill of listRuntimeSkillsByVisibleLayerOrder(input)) {
    visible.set(skill.name, skill);
  }
  return [...visible.values()].sort((left, right) => left.name.localeCompare(right.name));
};

export const findRuntimeSkill = (
  input: RuntimeSkillLookupInput & {
    query: string;
  },
): RuntimeSkillRecord[] => {
  const query = input.query.trim().toLowerCase();
  if (!query) {
    return listRuntimeSkills(input);
  }
  return listRuntimeSkills(input).filter(
    (skill) =>
      skill.name.includes(query) ||
      skill.summary.toLowerCase().includes(query) ||
      skill.path.toLowerCase().includes(query),
  );
};

export const getRuntimeSkillByName = (
  input: RuntimeSkillLookupInput & {
    name: string;
    rootKind?: RuntimeSkillRootKind;
  },
): RuntimeSkillRecord | null => {
  const normalizedName = normalizeRuntimeSkillName(input.name);
  if (!normalizedName) {
    return null;
  }
  if (!input.rootKind) {
    return listRuntimeSkills(input).find((skill) => skill.name === normalizedName) ?? null;
  }
  const visibleByKind = new Map<string, RuntimeSkillRecord>();
  for (const skill of listRuntimeSkillsByVisibleLayerOrder(input)) {
    if (skill.rootKind === input.rootKind) {
      visibleByKind.set(skill.name, skill);
    }
  }
  return visibleByKind.get(normalizedName) ?? null;
};

export const readRuntimeSkillContent = (skill: RuntimeSkillRecord | string): string =>
  typeof skill === "string" ? readFileSync(skill, "utf8") : skill.content ?? readFileSync(skill.path, "utf8");

export const upsertRuntimeSkillFile = (
  input: RuntimeSkillLookupInput & {
    name: string;
    content: string;
    rootKind?: RuntimeSkillWritableRootKind;
  },
): RuntimeSkillRecord => {
  const normalizedName = normalizeRuntimeSkillName(input.name);
  if (!normalizedName) {
    throw new Error(`invalid skill name: ${input.name}`);
  }
  const frontmatter = parseRuntimeSkillFrontmatter(input.content);
  const frontmatterName = frontmatter.name ? normalizeRuntimeSkillName(frontmatter.name) : normalizedName;
  if (!frontmatterName || frontmatterName !== normalizedName) {
    throw new Error(`skill content name does not match requested name: ${input.name}`);
  }

  const root = resolveRuntimeSkillRootByKind(input, input.rootKind ?? "avatar");
  const skillDir = join(root.path, normalizedName);
  const skillPath = join(skillDir, "SKILL.md");
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(skillPath, input.content.endsWith("\n") ? input.content : `${input.content}\n`, "utf8");

  const record = readSkillRecord(skillPath, root);
  if (!record) {
    throw new Error(`failed to read runtime skill after write: ${skillPath}`);
  }
  return record;
};

const findRuntimeSkillRecordInRoot = (
  root: RuntimeSkillRoot,
  name: string,
): RuntimeSkillRecord | null => {
  const normalizedName = normalizeRuntimeSkillName(name);
  if (!normalizedName) {
    return null;
  }
  for (const filePath of collectSkillFiles(root.path)) {
    const record = readSkillRecord(filePath, root);
    if (record?.name === normalizedName) {
      return record;
    }
  }
  return null;
};

const resolveRuntimeSkillDeletionDir = (root: RuntimeSkillRoot, record: RuntimeSkillRecord): string | null => {
  const rootPath = resolve(root.path);
  const skillDir = resolve(record.skillDir);
  const relation = relative(rootPath, skillDir);
  if (!relation || relation === "." || relation.startsWith("..")) {
    return null;
  }
  if (resolve(record.path) !== resolve(join(skillDir, "SKILL.md"))) {
    return null;
  }
  return skillDir;
};

export const removeRuntimeSkillFile = (
  input: RuntimeSkillLookupInput & {
    name: string;
    rootKind?: RuntimeSkillWritableRootKind;
  },
): { removed: boolean; path: string | null; rootKind: RuntimeSkillWritableRootKind | null } => {
  const normalizedName = normalizeRuntimeSkillName(input.name);
  if (!normalizedName) {
    return {
      removed: false,
      path: null,
      rootKind: input.rootKind ?? null,
    };
  }

  const roots =
    input.rootKind !== undefined
      ? [...resolveRuntimeSkillRootsByKind(input, input.rootKind)].reverse()
      : resolveRuntimeSkillRoots(input)
          .filter((root) => root.kind !== "shared" || !hasEnvSkillHomeAuthority(input))
          .reverse();

  for (const root of roots) {
    const record = findRuntimeSkillRecordInRoot(root, normalizedName);
    if (!record) {
      continue;
    }
    const deletionDir = resolveRuntimeSkillDeletionDir(root, record);
    if (!deletionDir) {
      continue;
    }
    rmSync(deletionDir, { recursive: true, force: true });
    return {
      removed: true,
      path: record.path,
      rootKind: root.kind,
    };
  }

  return {
    removed: false,
    path: null,
    rootKind: input.rootKind ?? null,
  };
};

export const buildRuntimeSkillsList = (
  skills: readonly Pick<RuntimeSkillRecord, "name" | "summary" | "path">[],
): string => {
  const lines = [
    "## skills.list",
    "",
    "Use `skill info <skill>` to expand a skill when you need detailed instructions.",
    "`skill info` shows the real filesystem path to that skill's `SKILL.md`.",
    "File-backed skills follow the current workspace `SKILLS_HOME` source order; later sources override earlier ones.",
    "If the skill lists sibling `references/*.md` files, inspect only the specific files you need via shell instead of loading the whole references tree.",
    "",
  ];
  if (skills.length === 0) {
    lines.push("- none");
    return lines.join("\n");
  }
  for (const skill of skills) {
    lines.push(`- ${skill.name}: ${skill.summary} (${skill.path})`);
  }
  return lines.join("\n");
};

export const buildRuntimeSkillsOutline = (
  skills: readonly Pick<RuntimeSkillRecord, "name" | "summary">[],
): string => {
  const lines = [
    "## skills.outline",
    "",
    "Use `skill info <skill>` to expand a skill when you need detailed instructions.",
    "",
  ];
  if (skills.length === 0) {
    lines.push("- none");
    return lines.join("\n");
  }
  for (const skill of skills) {
    lines.push(`- ${skill.name}: ${skill.summary}`);
  }
  return lines.join("\n");
};
