import { resolveGlobalAvatarCanonicalRoot } from "@agenter/avatar";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const resolveUsageAnalyticsRootFromAvatarRoot = (avatarRoot: string): string => resolve(avatarRoot, "analytics");

export const resolveUsageAnalyticsDbPathFromAvatarRoot = (avatarRoot: string): string =>
  join(resolveUsageAnalyticsRootFromAvatarRoot(avatarRoot), "usage.db");

export const resolveUsageAnalyticsDbPath = (principalId: string, homeDir = homedir()): string =>
  resolveUsageAnalyticsDbPathFromAvatarRoot(resolveGlobalAvatarCanonicalRoot(principalId, homeDir));
