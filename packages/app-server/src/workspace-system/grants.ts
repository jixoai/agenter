import { isAbsolute, relative, resolve } from "node:path";

import { Minimatch } from "minimatch";

import type { WorkspaceGrantMode, WorkspaceGrantRecord } from "./types";

const MATCH_OPTIONS = {
  dot: true,
  nocomment: true,
  nonegate: true,
  nocase: false,
} as const;

interface CompiledWorkspaceGrantRule {
  grant: Pick<WorkspaceGrantRecord, "grantId" | "pattern" | "mode" | "ruleIndex" | "createdAt">;
  magic: boolean;
  matcher: Minimatch;
}

const collapseWorkspaceGrantSegments = (value: string): string[] => {
  const segments = value
    .replace(/\\/gu, "/")
    .trim()
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".");
  if (segments.some((segment) => segment === "..")) {
    throw new Error(`workspace grant path escapes root: ${value}`);
  }
  return segments;
};

const toMatcherSubject = (path: string): string => (path === "/" ? "" : path.slice(1));

export const sortWorkspaceGrantRecords = <T extends Pick<WorkspaceGrantRecord, "ruleIndex" | "createdAt" | "grantId">>(
  grants: readonly T[],
): T[] =>
  [...grants].sort(
    (left, right) =>
      left.ruleIndex - right.ruleIndex ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.grantId.localeCompare(right.grantId),
  );

export const normalizeWorkspaceGrantPattern = (value: string): string => {
  const trimmed = value.replace(/\\/gu, "/").trim();
  if (!trimmed || trimmed === ".") {
    return "/";
  }
  if (trimmed.startsWith("!")) {
    throw new Error(`workspace grant negation is not supported: ${value}`);
  }
  const segments = collapseWorkspaceGrantSegments(trimmed);
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
};

export const normalizeWorkspaceGrantSubjectPath = (value: string): string => {
  const trimmed = value.replace(/\\/gu, "/").trim();
  if (!trimmed || trimmed === ".") {
    return "/";
  }
  const segments = collapseWorkspaceGrantSegments(trimmed);
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
};

const compileWorkspaceGrantRule = (
  grant: Pick<WorkspaceGrantRecord, "grantId" | "pattern" | "mode" | "ruleIndex" | "createdAt">,
): CompiledWorkspaceGrantRule => {
  const pattern = normalizeWorkspaceGrantPattern(grant.pattern);
  return {
    grant: {
      ...grant,
      pattern,
    },
    matcher: new Minimatch(toMatcherSubject(pattern), MATCH_OPTIONS),
    magic: new Minimatch(toMatcherSubject(pattern), MATCH_OPTIONS).hasMagic(),
  };
};

const matchesDirectoryPattern = (subjectPath: string, pattern: string, partial: boolean): boolean => {
  if (pattern === "/") {
    return true;
  }
  if (subjectPath === pattern || subjectPath.startsWith(`${pattern}/`)) {
    return true;
  }
  return partial ? subjectPath === "/" || pattern.startsWith(`${subjectPath}/`) : false;
};

const matchesWorkspaceGrantRule = (
  subjectPath: string,
  rule: CompiledWorkspaceGrantRule,
  partial: boolean,
): boolean => {
  if (!rule.magic) {
    return matchesDirectoryPattern(subjectPath, rule.grant.pattern, partial);
  }
  if (partial && subjectPath === "/") {
    return true;
  }
  return rule.matcher.match(toMatcherSubject(subjectPath), partial);
};

export const compileWorkspaceGrantRules = (
  grants: readonly Pick<WorkspaceGrantRecord, "grantId" | "pattern" | "mode" | "ruleIndex" | "createdAt">[],
): CompiledWorkspaceGrantRule[] => sortWorkspaceGrantRecords(grants).map(compileWorkspaceGrantRule);

export const resolveWorkspaceGrantMode = (
  subjectPath: string,
  grants: readonly Pick<WorkspaceGrantRecord, "grantId" | "pattern" | "mode" | "ruleIndex" | "createdAt">[],
  options: { partial?: boolean } = {},
): WorkspaceGrantMode | "none" => {
  const normalizedPath = normalizeWorkspaceGrantSubjectPath(subjectPath);
  let mode: WorkspaceGrantMode | "none" = "none";
  for (const rule of compileWorkspaceGrantRules(grants)) {
    if (matchesWorkspaceGrantRule(normalizedPath, rule, options.partial ?? false)) {
      mode = rule.grant.mode;
    }
  }
  return mode;
};

export const resolveWorkspaceGrantModeFromAbsolutePath = (input: {
  workspaceRoot: string;
  absolutePath: string;
  grants: readonly Pick<WorkspaceGrantRecord, "grantId" | "pattern" | "mode" | "ruleIndex" | "createdAt">[];
  partial?: boolean;
}): WorkspaceGrantMode | "none" => {
  const workspaceRoot = resolve(input.workspaceRoot);
  const absolutePath = resolve(input.absolutePath);
  const relation = relative(workspaceRoot, absolutePath);
  if (relation.startsWith("..") || isAbsolute(relation)) {
    return "none";
  }
  return resolveWorkspaceGrantMode(relation.length === 0 ? "/" : relation, input.grants, { partial: input.partial });
};

export const hasWorkspaceGrantRootAccess = (
  grants: readonly Pick<WorkspaceGrantRecord, "grantId" | "pattern" | "mode" | "ruleIndex" | "createdAt">[],
): boolean => resolveWorkspaceGrantMode("/", grants) !== "none";
