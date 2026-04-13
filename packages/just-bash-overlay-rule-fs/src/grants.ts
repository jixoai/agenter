import { isAbsolute, relative, resolve } from "node:path";

import { Minimatch } from "minimatch";

export type OverlayRuleMode = "ro" | "rw";

export interface OverlayRuleRecordLike {
  grantId: string;
  pattern: string;
  mode: OverlayRuleMode;
  ruleIndex: number;
  createdAt: string;
}

const MATCH_OPTIONS = {
  dot: true,
  nocomment: true,
  nonegate: true,
  nocase: false,
} as const;

interface CompiledOverlayRule<T extends OverlayRuleRecordLike> {
  rule: T & { pattern: string };
  magic: boolean;
  matcher: Minimatch;
}

const collapseRuleSegments = (value: string): string[] => {
  const segments = value
    .replace(/\\/gu, "/")
    .trim()
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".");
  if (segments.some((segment) => segment === "..")) {
    throw new Error(`overlay rule path escapes root: ${value}`);
  }
  return segments;
};

const toMatcherSubject = (path: string): string => (path === "/" ? "" : path.slice(1));

export const sortOverlayRuleRecords = <T extends Pick<OverlayRuleRecordLike, "ruleIndex" | "createdAt" | "grantId">>(
  rules: readonly T[],
): T[] =>
  [...rules].sort(
    (left, right) =>
      left.ruleIndex - right.ruleIndex ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.grantId.localeCompare(right.grantId),
  );

export const normalizeOverlayRulePattern = (value: string): string => {
  const trimmed = value.replace(/\\/gu, "/").trim();
  if (!trimmed || trimmed === ".") {
    return "/";
  }
  if (trimmed.startsWith("!")) {
    throw new Error(`overlay rule negation is not supported: ${value}`);
  }
  const segments = collapseRuleSegments(trimmed);
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
};

export const normalizeOverlayRuleSubjectPath = (value: string): string => {
  const trimmed = value.replace(/\\/gu, "/").trim();
  if (!trimmed || trimmed === ".") {
    return "/";
  }
  const segments = collapseRuleSegments(trimmed);
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
};

const compileOverlayRule = <T extends OverlayRuleRecordLike>(rule: T): CompiledOverlayRule<T> => {
  const pattern = normalizeOverlayRulePattern(rule.pattern);
  return {
    rule: {
      ...rule,
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

const matchesOverlayRule = <T extends OverlayRuleRecordLike>(
  subjectPath: string,
  compiled: CompiledOverlayRule<T>,
  partial: boolean,
): boolean => {
  if (!compiled.magic) {
    return matchesDirectoryPattern(subjectPath, compiled.rule.pattern, partial);
  }
  if (partial && subjectPath === "/") {
    return true;
  }
  return compiled.matcher.match(toMatcherSubject(subjectPath), partial);
};

export const compileOverlayRuleRecords = <T extends OverlayRuleRecordLike>(
  rules: readonly T[],
): CompiledOverlayRule<T>[] => sortOverlayRuleRecords(rules).map((rule) => compileOverlayRule(rule));

export const resolveOverlayRuleMode = <T extends OverlayRuleRecordLike>(
  subjectPath: string,
  rules: readonly T[],
  options: { partial?: boolean } = {},
): OverlayRuleMode | "none" => {
  const normalizedPath = normalizeOverlayRuleSubjectPath(subjectPath);
  let mode: OverlayRuleMode | "none" = "none";
  for (const rule of compileOverlayRuleRecords(rules)) {
    if (matchesOverlayRule(normalizedPath, rule, options.partial ?? false)) {
      mode = rule.rule.mode;
    }
  }
  return mode;
};

export const resolveOverlayRuleModeFromAbsolutePath = <T extends OverlayRuleRecordLike>(input: {
  root: string;
  absolutePath: string;
  rules: readonly T[];
  partial?: boolean;
}): OverlayRuleMode | "none" => {
  const root = resolve(input.root);
  const absolutePath = resolve(input.absolutePath);
  const relation = relative(root, absolutePath);
  if (relation.startsWith("..") || isAbsolute(relation)) {
    return "none";
  }
  return resolveOverlayRuleMode(relation.length === 0 ? "/" : relation, input.rules, { partial: input.partial });
};

export const hasOverlayRuleRootAccess = <T extends OverlayRuleRecordLike>(rules: readonly T[]): boolean =>
  resolveOverlayRuleMode("/", rules) !== "none";
