import type {
  RuntimeWorkspaceGrantEntry,
  WorkspaceCliCatalogEntry,
  WorkspaceCliCatalogGroup,
  WorkspaceWorkbenchTreeEntry,
  WorkspaceWorkbenchTreeOutput,
} from "@agenter/client-sdk";

export type WorkspaceMode = "explorer" | "rules" | "private" | "cli";

export interface WorkspaceRuleDraft {
  id: string;
  pattern: string;
  mode: "ro" | "rw";
  enabled: boolean;
}

export type WorkspaceTreePages = Record<string, WorkspaceWorkbenchTreeOutput>;

export interface WorkspaceTreeEntryRow {
  type: "entry";
  entry: WorkspaceWorkbenchTreeEntry;
  depth: number;
}

export interface WorkspaceTreeLoadMoreRow {
  type: "load-more";
  parentPath: string;
  remainingCount: number;
  depth: number;
}

export type WorkspaceTreeRow = WorkspaceTreeEntryRow | WorkspaceTreeLoadMoreRow;

const WORKSPACE_CLI_GROUP_DISPLAY_PRIORITY: Record<WorkspaceCliCatalogGroup["id"], number> = {
  "workspace-public-tools": 0,
  "workspace-private-tools": 1,
  "root-runtime-cli": 2,
  "just-bash-builtins": 3,
};

const normalizeRelativePath = (value: string | null | undefined): string => {
  const normalized = (value ?? "/").replace(/\\/gu, "/").trim();
  if (!normalized || normalized === ".") {
    return "/";
  }
  const prefixed = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return prefixed.replace(/\/+/gu, "/").replace(/\/$/u, "") || "/";
};

const normalizeSearchQuery = (value: string): string => value.trim().toLowerCase();

const entryMatchesQuery = (entry: WorkspaceWorkbenchTreeEntry, query: string): boolean => {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return true;
  }
  return [entry.name, entry.path, entry.previewKind, entry.accessMode ?? ""]
    .join("\n")
    .toLowerCase()
    .includes(normalizedQuery);
};

const ruleMatchesQuery = (rule: WorkspaceRuleDraft, query: string): boolean => {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return true;
  }
  return [rule.pattern, rule.mode, rule.enabled ? "enabled" : "disabled"]
    .join("\n")
    .toLowerCase()
    .includes(normalizedQuery);
};

const cliEntryMatchesQuery = (entry: WorkspaceCliCatalogEntry, query: string): boolean => {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return true;
  }
  return [entry.commandLabel, entry.displayName, entry.description, entry.detailHint ?? "", entry.toolFileName ?? ""]
    .join("\n")
    .toLowerCase()
    .includes(normalizedQuery);
};

const ancestorPaths = (path: string): string[] => {
  const normalized = normalizeRelativePath(path);
  if (normalized === "/") {
    return ["/"];
  }
  const segments = normalized.split("/").filter(Boolean);
  const paths = ["/"];
  for (let index = 0; index < segments.length; index += 1) {
    paths.push(`/${segments.slice(0, index + 1).join("/")}`);
  }
  return paths;
};

const resolveDepth = (path: string): number =>
  Math.max(0, normalizeRelativePath(path).split("/").filter(Boolean).length - 1);

export const normalizeWorkspaceMode = (value: string | null | undefined): WorkspaceMode => {
  if (value === "rules" || value === "private" || value === "cli") {
    return value;
  }
  return "explorer";
};

export const toGrantPattern = (value: string | null | undefined): string => normalizeRelativePath(value);

export const buildRuleDrafts = (grants: readonly RuntimeWorkspaceGrantEntry[]): WorkspaceRuleDraft[] =>
  grants.map((grant, index) => ({
    id: grant.grantId || `grant-${index}`,
    pattern: toGrantPattern(grant.pattern),
    mode: grant.mode,
    enabled: true,
  }));

export const serializeRuleDrafts = (
  drafts: readonly WorkspaceRuleDraft[],
): Array<{ pattern: string; mode: "ro" | "rw" }> =>
  drafts
    .filter((draft) => draft.enabled)
    .map((draft) => ({
      pattern: toGrantPattern(draft.pattern),
      mode: draft.mode,
    }));

export const buildWorkspaceTreeRows = (input: {
  rootPath?: string;
  pages: WorkspaceTreePages;
  expandedPaths: ReadonlySet<string>;
  searchQuery: string;
}): WorkspaceTreeRow[] => {
  const rootPath = normalizeRelativePath(input.rootPath ?? "/");
  const rows: WorkspaceTreeRow[] = [];
  const visiblePaths = new Set<string>();
  const query = normalizeSearchQuery(input.searchQuery);

  if (query) {
    for (const page of Object.values(input.pages)) {
      for (const entry of page.items) {
        if (!entryMatchesQuery(entry, query)) {
          continue;
        }
        for (const path of ancestorPaths(entry.path)) {
          visiblePaths.add(path);
        }
      }
    }
  }

  const visit = (parentPath: string): void => {
    const page = input.pages[parentPath];
    if (!page) {
      return;
    }
    for (const entry of page.items) {
      if (query && !visiblePaths.has(entry.path)) {
        continue;
      }
      rows.push({
        type: "entry",
        entry,
        depth: resolveDepth(entry.path),
      });
      if (entry.kind === "directory" && input.expandedPaths.has(entry.path)) {
        visit(entry.path);
      }
    }
    if (page.nextOffset !== null && (!query || visiblePaths.has(parentPath))) {
      rows.push({
        type: "load-more",
        parentPath,
        remainingCount: Math.max(0, page.total - page.nextOffset),
        depth: parentPath === "/" ? 0 : resolveDepth(parentPath) + 1,
      });
    }
  };

  visit(rootPath);
  return rows;
};

export const collectWorkspaceTreeMatchPaths = (pages: WorkspaceTreePages, searchQuery: string): string[] => {
  const query = normalizeSearchQuery(searchQuery);
  if (!query) {
    return [];
  }
  return Object.values(pages)
    .flatMap((page) => page.items)
    .filter((entry) => entryMatchesQuery(entry, query))
    .map((entry) => entry.path);
};

export const collectWorkspaceRuleMatchIds = (rules: readonly WorkspaceRuleDraft[], searchQuery: string): string[] => {
  const query = normalizeSearchQuery(searchQuery);
  if (!query) {
    return [];
  }
  return rules.filter((rule) => ruleMatchesQuery(rule, query)).map((rule) => rule.id);
};

export const filterWorkspaceCliCatalogGroups = (
  groups: readonly WorkspaceCliCatalogGroup[],
  searchQuery: string,
): WorkspaceCliCatalogGroup[] => {
  const query = normalizeSearchQuery(searchQuery);
  if (!query) {
    return groups.map((group) => ({
      ...group,
      entries: [...group.entries],
    }));
  }
  return groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => cliEntryMatchesQuery(entry, query)),
    }))
    .filter((group) => group.entries.length > 0);
};

export const orderWorkspaceCliCatalogGroupsForDisplay = (
  groups: readonly WorkspaceCliCatalogGroup[],
): WorkspaceCliCatalogGroup[] =>
  [...groups]
    .sort((left, right) => {
      const leftPriority = WORKSPACE_CLI_GROUP_DISPLAY_PRIORITY[left.id] ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = WORKSPACE_CLI_GROUP_DISPLAY_PRIORITY[right.id] ?? Number.MAX_SAFE_INTEGER;
      return leftPriority - rightPriority || left.title.localeCompare(right.title);
    })
    .map((group) => ({
      ...group,
      entries: [...group.entries],
    }));

const isHumanFriendlyBuiltinDefault = (entry: WorkspaceCliCatalogEntry): boolean =>
  entry.groupId !== "just-bash-builtins" || /^[A-Za-z0-9]/u.test(entry.commandLabel);

export const resolveWorkspaceCliDefaultEntryId = (
  groups: readonly WorkspaceCliCatalogGroup[],
  currentEntryId?: string | null,
  options?: {
    allowRootRuntimeDefault?: boolean;
  },
): string | null => {
  if (currentEntryId) {
    const currentVisible = groups.some((group) => group.entries.some((entry) => entry.id === currentEntryId));
    if (currentVisible) {
      return currentEntryId;
    }
  }

  for (const group of groups) {
    if (group.id === "root-runtime-cli" && options?.allowRootRuntimeDefault === false) {
      continue;
    }
    const preferredEntry = group.entries.find((entry) => isHumanFriendlyBuiltinDefault(entry)) ?? group.entries[0];
    if (preferredEntry) {
      return preferredEntry.id;
    }
  }

  return null;
};

export const collectWorkspaceCliMatchIds = (
  groups: readonly WorkspaceCliCatalogGroup[],
  searchQuery: string,
): string[] => {
  const query = normalizeSearchQuery(searchQuery);
  if (!query) {
    return [];
  }
  return groups
    .flatMap((group) => group.entries)
    .filter((entry) => cliEntryMatchesQuery(entry, query))
    .map((entry) => entry.id);
};
