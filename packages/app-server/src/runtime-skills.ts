import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runtimeBuiltinSkillCatalog } from "./generated/runtime-skill-catalog.generated";
import type { RuntimeBuiltinSkillCatalogEntry } from "./runtime-skill-catalog-builder";
import {
  normalizeRuntimeSkillName,
  parseRuntimeSkillFrontmatter,
  pickRuntimeSkillBodySummary,
} from "./runtime-skill-markdown";
import { renderRuntimeToolExamples } from "./runtime-tool-descriptors";

export const RUNTIME_API_BASE_URL_ENV = "AGENTER_ATTENTION_API_BASE_URL";
export const RUNTIME_HOME_DIR_ENV = "AGENTER_HOME_DIR";
export const RUNTIME_PRINCIPAL_ID_ENV = "AGENTER_AVATAR_PRINCIPAL_ID";
export const RUNTIME_PRIVATE_KEY_ENV = "AGENTER_AVATAR_PRIVATE_KEY";
export const RUNTIME_ROOT_WORKSPACE_ENV = "AGENTER_ROOT_WORKSPACE";

const DEFAULT_REPO_ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const BUILTIN_RUNTIME_SKILL_CACHE_DIRNAME = ".runtime-skills";
const RUNTIME_TOOL_NAMESPACES = new Set(["attention", "message", "workspace", "terminal"] as const);
const EXAMPLE_SLOT_PATTERN = /^(\s*)\{\{examples:([a-z]+)\.([a-z]+)\}\}\s*$/u;

export interface RuntimeSkillRoot {
  kind: "shared" | "global" | "avatar";
  path: string;
}

export interface RuntimeSkillRecord {
  name: string;
  summary: string;
  path: string;
  root: string;
  rootKind: RuntimeSkillRoot["kind"] | "builtin";
  packageName?: string;
  content?: string;
}

export interface RuntimeSkillLookupInput {
  homeDir?: string;
  rootWorkspacePath: string;
  principalId?: string;
  repoRoot?: string;
}

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

const readSkillRecord = (filePath: string, root: RuntimeSkillRoot): RuntimeSkillRecord | null => {
  try {
    const content = readFileSync(filePath, "utf8");
    const frontmatter = parseRuntimeSkillFrontmatter(content);
    const fallbackName = basename(relative(root.path, filePath).replace(/\/SKILL\.md$/u, ""));
    const name = normalizeRuntimeSkillName(frontmatter.name ?? fallbackName);
    if (!name) {
      return null;
    }
    return {
      name,
      summary: frontmatter.description?.trim() || pickRuntimeSkillBodySummary(content),
      path: resolve(filePath),
      root: resolve(root.path),
      rootKind: root.kind,
    };
  } catch {
    return null;
  }
};

export const resolveRuntimeSkillRoots = (input: {
  homeDir?: string;
  rootWorkspacePath: string;
}): RuntimeSkillRoot[] => {
  const homeDir = input.homeDir ?? homedir();
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

export const listRuntimeSkillMountRoots = (input: RuntimeSkillLookupInput): string[] => {
  const roots = new Set<string>();
  for (const root of resolveRuntimeSkillRoots(input)) {
    roots.add(resolve(root.path));
  }
  return [...roots].sort((left, right) => left.localeCompare(right));
};

const copyRuntimeSkillAncillaryFiles = (sourceDir: string, targetDir: string): void => {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.name === "SKILL.md") {
      continue;
    }
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyRuntimeSkillAncillaryFiles(sourcePath, targetPath);
      continue;
    }
    if (entry.isFile()) {
      mkdirSync(dirname(targetPath), { recursive: true });
      copyFileSync(sourcePath, targetPath);
    }
  }
};

const asRuntimeToolNamespace = (value: string): "attention" | "message" | "workspace" | "terminal" | null =>
  RUNTIME_TOOL_NAMESPACES.has(value as "attention" | "message" | "workspace" | "terminal")
    ? (value as "attention" | "message" | "workspace" | "terminal")
    : null;

const renderBuiltinRuntimeSkillContent = (
  entry: RuntimeBuiltinSkillCatalogEntry,
  input: RuntimeSkillLookupInput,
): string => {
  const principalId = input.principalId ?? "unknown-principal";
  return entry.template
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
          .replaceAll("{{runtime.root_workspace_path}}", input.rootWorkspacePath)
          .replaceAll("{{runtime.principal_id}}", principalId),
      ];
    })
    .join("\n");
};

const listBuiltinRuntimeSkills = (input: RuntimeSkillLookupInput): RuntimeSkillRecord[] => {
  const repoRoot = resolve(input.repoRoot ?? DEFAULT_REPO_ROOT);
  return runtimeBuiltinSkillCatalog.map((entry) => {
    const renderedSkill = renderBuiltinRuntimeSkillContent(entry, input);
    const sourcePath = resolve(repoRoot, entry.sourcePath);
    const sourceDir = dirname(sourcePath);
    const cacheRoot = resolve(input.rootWorkspacePath, BUILTIN_RUNTIME_SKILL_CACHE_DIRNAME, entry.name);
    mkdirSync(cacheRoot, { recursive: true });
    writeFileSync(join(cacheRoot, "SKILL.md"), renderedSkill, "utf8");
    copyRuntimeSkillAncillaryFiles(sourceDir, cacheRoot);
    return {
      name: entry.name,
      summary: entry.summary,
      path: join(cacheRoot, "SKILL.md"),
      root: cacheRoot,
      rootKind: "builtin",
      packageName: entry.packageName,
      content: renderedSkill,
    };
  });
};

export const listRuntimeSkills = (input: RuntimeSkillLookupInput): RuntimeSkillRecord[] => {
  const roots = resolveRuntimeSkillRoots(input);
  const skills = new Map<string, RuntimeSkillRecord>();
  for (const skill of listBuiltinRuntimeSkills(input)) {
    skills.set(skill.name, skill);
  }
  for (const root of roots) {
    for (const filePath of collectSkillFiles(root.path)) {
      const record = readSkillRecord(filePath, root);
      if (!record) {
        continue;
      }
      skills.set(record.name, record);
    }
  }
  return [...skills.values()].sort((left, right) => left.name.localeCompare(right.name));
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

export const readRuntimeSkillContent = (skill: RuntimeSkillRecord | string): string =>
  typeof skill === "string" ? readFileSync(skill, "utf8") : skill.content ?? readFileSync(skill.path, "utf8");

export const buildRuntimeSkillsList = (skills: readonly RuntimeSkillRecord[]): string => {
  const lines = [
    "## skills.list",
    "",
    "Use `ccski info <skill>` to expand a skill when you need detailed instructions.",
    "`ccski info` shows the real filesystem path to that skill's `SKILL.md`.",
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
