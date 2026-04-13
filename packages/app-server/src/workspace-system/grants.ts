import {
  compileOverlayRuleRecords,
  hasOverlayRuleRootAccess,
  normalizeOverlayRulePattern,
  normalizeOverlayRuleSubjectPath,
  resolveOverlayRuleMode,
  resolveOverlayRuleModeFromAbsolutePath,
  sortOverlayRuleRecords,
  type OverlayRuleMode,
  type OverlayRuleRecordLike,
} from "@agenter/just-bash-overlay-rule-fs";

import type { WorkspaceGrantRecord } from "./types";

export const compileWorkspaceGrantRules = (grants: readonly WorkspaceGrantRecord[]) => compileOverlayRuleRecords(grants);

export const hasWorkspaceGrantRootAccess = (grants: readonly WorkspaceGrantRecord[]) => hasOverlayRuleRootAccess(grants);

export const normalizeWorkspaceGrantPattern = (pattern: string) => normalizeOverlayRulePattern(pattern);

export const normalizeWorkspaceGrantSubjectPath = (path: string) => normalizeOverlayRuleSubjectPath(path);

export const resolveWorkspaceGrantMode = (
  subjectPath: string,
  grants: readonly WorkspaceGrantRecord[],
  options?: { partial?: boolean },
): OverlayRuleMode | "none" => resolveOverlayRuleMode(subjectPath, grants, options);

export const resolveWorkspaceGrantModeFromAbsolutePath = (input: {
  workspaceRoot: string;
  absolutePath: string;
  grants: readonly WorkspaceGrantRecord[];
  partial?: boolean;
}): OverlayRuleMode | "none" =>
  resolveOverlayRuleModeFromAbsolutePath({
    root: input.workspaceRoot,
    absolutePath: input.absolutePath,
    rules: input.grants,
    partial: input.partial,
  });

export const sortWorkspaceGrantRecords = <T extends Pick<OverlayRuleRecordLike, "ruleIndex" | "createdAt" | "grantId">>(
  grants: readonly T[],
): T[] => sortOverlayRuleRecords(grants);
