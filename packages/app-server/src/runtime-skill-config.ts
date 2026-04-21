import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

import { Minimatch } from "minimatch";
import { z } from "zod";

import type { RuntimeSkillRecord } from "./runtime-skills";

export const RUNTIME_SKILL_CONFIG_BASENAME = "ccski.config.json";

const MATCH_OPTIONS = {
  dot: true,
  nocomment: true,
  nonegate: true,
  nocase: false,
} as const;

const runtimeSkillConfigSchema = z
  .object({
    files: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();

export type RuntimeSkillConfig = z.infer<typeof runtimeSkillConfigSchema>;

export interface RuntimeSkillWatchSpec {
  pattern: string;
  anchorPath: string;
  recursive: boolean;
}

export interface RuntimeSkillConfigState {
  configPath: string;
  configExists: boolean;
  config: RuntimeSkillConfig | null;
  configError: string | null;
  resolvedWatchTargets: string[];
  watchSpecs: RuntimeSkillWatchSpec[];
}

const MAGIC_PATTERN = /[*?[\]{}()!+@]/u;

const normalizeConfigPattern = (value: string): string => {
  const normalized = value.replace(/\\/gu, "/").trim().replace(/^\.\/+/u, "");
  if (normalized.length === 0) {
    throw new Error("config files entry must not be empty");
  }
  if (normalized.startsWith("!")) {
    throw new Error(`config files entry does not support negation: ${value}`);
  }
  if (isAbsolute(normalized)) {
    throw new Error(`config files entry must be relative: ${value}`);
  }
  const segments = normalized.split("/").filter((segment) => segment.length > 0 && segment !== ".");
  if (segments.some((segment) => segment === "..")) {
    throw new Error(`config files entry escapes skill root: ${value}`);
  }
  return segments.join("/");
};

const normalizeConfigFiles = (value: RuntimeSkillConfig): RuntimeSkillConfig => ({
  files:
    value.files
      ?.map((item) => normalizeConfigPattern(item))
      .filter((item, index, items) => items.indexOf(item) === index)
      .sort((left, right) => left.localeCompare(right)) ?? undefined,
});

const parseConfigJson = (raw: string): RuntimeSkillConfig => normalizeConfigFiles(runtimeSkillConfigSchema.parse(JSON.parse(raw)));

const hashContent = (value: string): string => createHash("sha1").update(value).digest("hex");

const readFileFingerprint = (path: string): string => hashContent(readFileSync(path));

const walkFiles = (root: string, depth = 0, maxDepth = Number.POSITIVE_INFINITY): string[] => {
  if (depth > maxDepth || !existsSync(root)) {
    return [];
  }
  const stats = statSync(root);
  if (!stats.isDirectory()) {
    return stats.isFile() ? [root] : [];
  }
  const output: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const nextPath = join(root, entry.name);
    if (entry.isDirectory()) {
      output.push(...walkFiles(nextPath, depth + 1, maxDepth));
      continue;
    }
    if (entry.isFile()) {
      output.push(nextPath);
    }
  }
  return output;
};

const buildWatchSpec = (skillDir: string, pattern: string): RuntimeSkillWatchSpec => {
  const segments = pattern.split("/");
  const anchorSegments: string[] = [];
  for (const segment of segments) {
    if (MAGIC_PATTERN.test(segment)) {
      break;
    }
    anchorSegments.push(segment);
  }
  return {
    pattern,
    anchorPath: resolve(skillDir, anchorSegments.length === 0 ? "." : anchorSegments.join("/")),
    recursive: pattern.includes("**"),
  };
};

const resolvePatternMatches = (skillDir: string, spec: RuntimeSkillWatchSpec): string[] => {
  const matcher = new Minimatch(spec.pattern, MATCH_OPTIONS);
  if (!existsSync(spec.anchorPath)) {
    return [];
  }
  const stats = statSync(spec.anchorPath);
  if (stats.isFile()) {
    const relation = relative(skillDir, spec.anchorPath).replace(/\\/gu, "/");
    return matcher.match(relation) ? [resolve(spec.anchorPath)] : [];
  }
  const anchorRelation = relative(skillDir, spec.anchorPath).replace(/\\/gu, "/");
  const relativePattern = anchorRelation ? spec.pattern.slice(anchorRelation.length + 1) : spec.pattern;
  const maxDepth = spec.recursive ? Number.POSITIVE_INFINITY : Math.max(1, relativePattern.split("/").length);
  return walkFiles(spec.anchorPath, 0, maxDepth)
    .map((path) => resolve(path))
    .filter((path) => matcher.match(relative(skillDir, path).replace(/\\/gu, "/")))
    .sort((left, right) => left.localeCompare(right));
};

const resolveDeclaredPatterns = (skill: Pick<RuntimeSkillRecord, "skillDir" | "path">, config: RuntimeSkillConfig | null) =>
  (config?.files ?? []).map((pattern) => {
    const absoluteCandidate = resolve(skill.skillDir, pattern);
    if (!pattern.includes("*") && existsSync(absoluteCandidate) && statSync(absoluteCandidate).isDirectory()) {
      return `${pattern.replace(/\/$/u, "")}/**`;
    }
    return pattern;
  });

export const getRuntimeSkillConfigPath = (skill: Pick<RuntimeSkillRecord, "configPath" | "skillDir">): string =>
  resolve(skill.configPath || join(skill.skillDir, RUNTIME_SKILL_CONFIG_BASENAME));

export const readRuntimeSkillConfigState = (
  skill: Pick<RuntimeSkillRecord, "path" | "skillDir" | "configPath"> & { content?: string },
): RuntimeSkillConfigState => {
  const configPath = getRuntimeSkillConfigPath(skill);
  const configExists = existsSync(configPath);
  let config: RuntimeSkillConfig | null = null;
  let configError: string | null = null;
  if (configExists) {
    try {
      config = parseConfigJson(readFileSync(configPath, "utf8"));
    } catch (error) {
      configError = error instanceof Error ? error.message : String(error);
    }
  }

  const declaredPatterns = resolveDeclaredPatterns(skill, config);
  const declaredMatches = declaredPatterns.flatMap((pattern) => resolvePatternMatches(skill.skillDir, buildWatchSpec(skill.skillDir, pattern)));
  const defaultTargets = [resolve(skill.path), configPath];
  const resolvedWatchTargets = [...new Set([...defaultTargets, ...declaredMatches])].sort((left, right) =>
    left.localeCompare(right),
  );

  return {
    configPath,
    configExists,
    config,
    configError,
    resolvedWatchTargets,
    watchSpecs: [
      {
        pattern: basename(skill.path),
        anchorPath: resolve(skill.skillDir),
        recursive: false,
      },
      {
        pattern: RUNTIME_SKILL_CONFIG_BASENAME,
        anchorPath: resolve(skill.skillDir),
        recursive: false,
      },
      ...declaredPatterns.map((pattern) => buildWatchSpec(skill.skillDir, pattern)),
    ],
  };
};

export const buildRuntimeSkillObservedFiles = (
  skill: Pick<RuntimeSkillRecord, "path" | "skillDir" | "configPath"> & { content?: string },
  state = readRuntimeSkillConfigState(skill),
): string[] => {
  const observed = new Set<string>();
  if (existsSync(skill.path)) {
    observed.add(resolve(skill.path));
  } else if (typeof skill.content === "string" && skill.content.length > 0) {
    observed.add(resolve(skill.path));
  }
  if (state.configExists) {
    observed.add(resolve(state.configPath));
  }
  for (const target of state.resolvedWatchTargets) {
    if (target === resolve(skill.path) || target === resolve(state.configPath)) {
      continue;
    }
    if (existsSync(target) && statSync(target).isFile()) {
      observed.add(resolve(target));
    }
  }
  return [...observed].sort((left, right) => left.localeCompare(right));
};

export const buildRuntimeSkillFileFingerprintMap = (
  skill: Pick<RuntimeSkillRecord, "path" | "skillDir" | "configPath"> & { content?: string },
  state = readRuntimeSkillConfigState(skill),
): Map<string, string> => {
  const fingerprints = new Map<string, string>();
  for (const path of buildRuntimeSkillObservedFiles(skill, state)) {
    if (existsSync(path)) {
      fingerprints.set(path, readFileFingerprint(path));
      continue;
    }
    if (path === resolve(skill.path) && typeof skill.content === "string") {
      fingerprints.set(path, hashContent(skill.content));
    }
  }
  return fingerprints;
};

export const writeRuntimeSkillConfigFile = (
  skill: Pick<RuntimeSkillRecord, "configPath" | "skillDir">,
  config: RuntimeSkillConfig,
): string => {
  const normalized = normalizeConfigFiles(config);
  const configPath = getRuntimeSkillConfigPath(skill);
  writeFileSync(configPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return configPath;
};

export const hasRuntimeSkillRecursiveWatchSpec = (state: RuntimeSkillConfigState): boolean =>
  state.watchSpecs.some((spec) => spec.recursive);

export const formatRuntimeSkillRelativeFiles = (
  skillDir: string,
  paths: readonly string[],
  maxItems = 3,
): string[] => {
  const clipped = paths
    .map((path) => relative(skillDir, path).replace(/\\/gu, "/"))
    .map((path) => (path.length === 0 ? basename(path) : path))
    .filter((path, index, items) => path.length > 0 && items.indexOf(path) === index)
    .sort((left, right) => left.localeCompare(right));
  if (clipped.length <= maxItems) {
    return clipped;
  }
  return [...clipped.slice(0, maxItems), `+${clipped.length - maxItems} more`];
};
