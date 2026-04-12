import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import {
  normalizeRuntimeSkillName,
  parseRuntimeSkillFrontmatter,
  pickRuntimeSkillBodySummary,
} from "./runtime-skill-markdown";

export interface RuntimeBuiltinSkillCatalogEntry {
  name: string;
  summary: string;
  sourcePath: string;
  packageName: string;
  packagePath: string;
  template: string;
}

const toPosixPath = (value: string): string => value.replaceAll("\\", "/");

const collectSkillFiles = (root: string, depth = 0): string[] => {
  if (!existsSync(root) || depth > 4) {
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

const resolveOwningPackage = (
  repoRoot: string,
  filePath: string,
): {
  packageName: string;
  packageRoot: string;
} => {
  let cursor = dirname(filePath);
  const resolvedRepoRoot = resolve(repoRoot);
  while (cursor.startsWith(resolvedRepoRoot)) {
    const packageJsonPath = join(cursor, "package.json");
    if (existsSync(packageJsonPath)) {
      const raw = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
        name?: string;
      };
      return {
        packageName: raw.name?.trim() || basename(cursor),
        packageRoot: cursor,
      };
    }
    const parent = dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }
  throw new Error(`unable to resolve owning package for skill source: ${filePath}`);
};

export const collectPackageOwnedRuntimeSkillFiles = (repoRoot: string): string[] => {
  const packagesRoot = resolve(repoRoot, "packages");
  if (!existsSync(packagesRoot)) {
    return [];
  }
  const output: string[] = [];
  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    output.push(...collectSkillFiles(join(packagesRoot, entry.name, "skills")));
  }
  return output.sort((left, right) => left.localeCompare(right));
};

export const buildRuntimeBuiltinSkillCatalog = (repoRoot: string): RuntimeBuiltinSkillCatalogEntry[] =>
  collectPackageOwnedRuntimeSkillFiles(repoRoot)
    .map((filePath) => {
      const content = readFileSync(filePath, "utf8");
      const frontmatter = parseRuntimeSkillFrontmatter(content);
      const { packageName, packageRoot } = resolveOwningPackage(repoRoot, filePath);
      const fallbackName = basename(dirname(filePath));
      const name = normalizeRuntimeSkillName(frontmatter.name ?? fallbackName);
      if (!name) {
        throw new Error(`runtime skill source is missing a name: ${filePath}`);
      }
      return {
        name,
        summary: frontmatter.description?.trim() || pickRuntimeSkillBodySummary(content),
        sourcePath: toPosixPath(relative(repoRoot, filePath)),
        packageName,
        packagePath: toPosixPath(relative(repoRoot, packageRoot)),
        template: content.endsWith("\n") ? content : `${content}\n`,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

export const renderRuntimeBuiltinSkillCatalogModule = (
  catalog: readonly RuntimeBuiltinSkillCatalogEntry[],
): string => `// AUTO-GENERATED FILE. DO NOT EDIT.
// Run \`bun run build:skills\` from packages/app-server to rebuild.

import type { RuntimeBuiltinSkillCatalogEntry } from "../runtime-skill-catalog-builder";

export const runtimeBuiltinSkillCatalog = ${JSON.stringify(catalog, null, 2)} as const satisfies readonly RuntimeBuiltinSkillCatalogEntry[];
`;
