import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export interface WorkspacePathSearchItem {
  label: string;
  path: string;
  isDirectory: boolean;
  ignored?: boolean;
}

interface WorkspacePathIndexEntry extends WorkspacePathSearchItem {
  lowerPath: string;
  lowerBase: string;
  depth: number;
}

interface WorkspacePathCacheEntry {
  builtAt: number;
  entries: WorkspacePathIndexEntry[];
}

interface GitWorkspaceContext {
  repoRoot: string;
  scopePath: string;
  scopePrefix: string;
}

const INDEX_TTL_MS = 30_000;

const normalizeRelativePath = (value: string): string => value.split(sep).join("/");

const parseNullSeparatedLines = (stdout: string): string[] =>
  stdout
    .split("\0")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => normalizeRelativePath(line));

const isInsideRoot = (root: string, target: string): boolean => {
  const relation = relative(root, target);
  return relation === "" || (!relation.startsWith("..") && !isAbsolute(relation));
};

const makeIndexEntry = (path: string, isDirectory: boolean): WorkspacePathIndexEntry => {
  const normalizedPath = isDirectory && !path.endsWith("/") ? `${path}/` : path;
  const plainPath = normalizedPath.endsWith("/") ? normalizedPath.slice(0, -1) : normalizedPath;
  const baseName = plainPath.includes("/") ? plainPath.slice(plainPath.lastIndexOf("/") + 1) : plainPath;
  const depth = plainPath.length === 0 ? 0 : plainPath.split("/").length;
  return {
    label: normalizedPath,
    path: normalizedPath,
    isDirectory,
    lowerPath: normalizedPath.toLowerCase(),
    lowerBase: baseName.toLowerCase(),
    depth,
  };
};

const uniqueBy = <TValue, TKey>(items: TValue[], keyOf: (item: TValue) => TKey): TValue[] => {
  const seen = new Set<TKey>();
  const unique: TValue[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }
  return unique;
};

const fuzzySubsequenceScore = (text: string, query: string): number | null => {
  let score = 0;
  let queryIndex = 0;
  let consecutive = 0;
  for (let index = 0; index < text.length && queryIndex < query.length; index += 1) {
    if (text[index] !== query[queryIndex]) {
      consecutive = 0;
      continue;
    }
    score += consecutive > 0 ? 1 : 4;
    queryIndex += 1;
    consecutive += 1;
  }
  return queryIndex === query.length ? score : null;
};

const compareSearchItems = (
  left: { score: number; item: WorkspacePathIndexEntry },
  right: { score: number; item: WorkspacePathIndexEntry },
): number => {
  if (left.score !== right.score) {
    return left.score - right.score;
  }
  if (left.item.isDirectory !== right.item.isDirectory) {
    return left.item.isDirectory ? -1 : 1;
  }
  if (left.item.depth !== right.item.depth) {
    return left.item.depth - right.item.depth;
  }
  return left.item.path.localeCompare(right.item.path);
};

const scorePathEntry = (entry: WorkspacePathIndexEntry, query: string): number | null => {
  const normalizedQuery = query.toLowerCase();
  const lastQuerySegment = normalizedQuery.split("/").filter(Boolean).pop() ?? normalizedQuery;
  if (normalizedQuery.length === 0) {
    return entry.depth;
  }
  if (entry.lowerPath === normalizedQuery) {
    return 0;
  }
  if (entry.lowerPath.startsWith(normalizedQuery)) {
    return 5 + entry.depth;
  }
  if (lastQuerySegment.length > 0 && entry.lowerBase.startsWith(lastQuerySegment)) {
    const pathIndex = entry.lowerPath.indexOf(lastQuerySegment);
    return 14 + Math.max(pathIndex, 0) + entry.depth;
  }
  const containsIndex = entry.lowerPath.indexOf(normalizedQuery);
  if (containsIndex >= 0) {
    return 28 + containsIndex + entry.depth;
  }
  const fuzzyScore = fuzzySubsequenceScore(entry.lowerPath, normalizedQuery);
  if (fuzzyScore === null) {
    return null;
  }
  return 80 + fuzzyScore + entry.depth;
};

const readCommandOutput = (command: string, args: string[], cwd: string): string =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

const resolveGitWorkspaceContext = (workspacePath: string): GitWorkspaceContext | null => {
  try {
    const repoRoot = resolve(
      readCommandOutput("git", ["-C", workspacePath, "rev-parse", "--show-toplevel"], workspacePath).trim(),
    );
    if (!isInsideRoot(repoRoot, workspacePath)) {
      return null;
    }
    const scopePath = normalizeRelativePath(relative(repoRoot, workspacePath)).replace(/^\.\/?/, "");
    return {
      repoRoot,
      scopePath,
      scopePrefix: scopePath.length > 0 ? `${scopePath}/` : "",
    };
  } catch {
    return null;
  }
};

const loadWorkspaceFilePathsWithGit = (workspacePath: string): string[] => {
  const gitContext = resolveGitWorkspaceContext(workspacePath);
  if (!gitContext) {
    throw new Error("workspace is not inside a git worktree");
  }

  const args = ["-C", gitContext.repoRoot, "ls-files", "--cached", "--others", "--exclude-standard", "-z"];
  if (gitContext.scopePath.length > 0) {
    args.push("--", gitContext.scopePath);
  }

  return parseNullSeparatedLines(readCommandOutput("git", args, gitContext.repoRoot))
    .map((filePath) => {
      if (gitContext.scopePrefix.length === 0) {
        return filePath;
      }
      return filePath.startsWith(gitContext.scopePrefix) ? filePath.slice(gitContext.scopePrefix.length) : filePath;
    })
    .filter((filePath) => filePath.length > 0 && !filePath.startsWith("../"));
};

const loadWorkspaceFilePathsWithRg = (workspacePath: string): string[] =>
  parseNullSeparatedLines(readCommandOutput("rg", ["--files", "--hidden", "--no-require-git", "-0"], workspacePath));

const loadWorkspaceFilePathsByWalk = (workspacePath: string): string[] => {
  const queue = [workspacePath];
  const files: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === ".git") {
        continue;
      }
      const absolutePath = join(current, entry.name);
      if (!isInsideRoot(workspacePath, absolutePath)) {
        continue;
      }
      if (entry.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      files.push(normalizeRelativePath(relative(workspacePath, absolutePath)));
    }
  }
  return files;
};

const loadWorkspaceFilePaths = (workspacePath: string): string[] => {
  try {
    return loadWorkspaceFilePathsWithGit(workspacePath);
  } catch {
    try {
      return loadWorkspaceFilePathsWithRg(workspacePath);
    } catch {
      return loadWorkspaceFilePathsByWalk(workspacePath);
    }
  }
};

const loadWorkspacePathIndex = (workspacePath: string): WorkspacePathIndexEntry[] => {
  const filePaths = uniqueBy(loadWorkspaceFilePaths(workspacePath), (item) => item).sort((left, right) =>
    left.localeCompare(right),
  );

  const directorySet = new Set<string>();
  for (const filePath of filePaths) {
    let parent = dirname(filePath);
    while (parent !== "." && parent.length > 0) {
      directorySet.add(normalizeRelativePath(parent));
      parent = dirname(parent);
    }
  }

  const directoryEntries = Array.from(directorySet)
    .sort((left, right) => left.localeCompare(right))
    .map((path) => makeIndexEntry(path, true));
  const fileEntries = filePaths.map((path) => makeIndexEntry(path, false));
  return [...directoryEntries, ...fileEntries];
};

const resolveDirectAddressContext = (query: string): { parentPath: string; leafQuery: string } => {
  if (query.endsWith("/")) {
    return {
      parentPath: query.slice(0, -1),
      leafQuery: "",
    };
  }
  const boundary = query.lastIndexOf("/");
  if (boundary < 0) {
    return {
      parentPath: "",
      leafQuery: query,
    };
  }
  return {
    parentPath: query.slice(0, boundary),
    leafQuery: query.slice(boundary + 1),
  };
};

const compareDirectAddressEntries = (left: WorkspacePathIndexEntry, right: WorkspacePathIndexEntry): number => {
  if (left.isDirectory !== right.isDirectory) {
    return left.isDirectory ? -1 : 1;
  }
  return left.path.localeCompare(right.path);
};

const loadDirectAddressEntries = (workspacePath: string, query: string): WorkspacePathIndexEntry[] => {
  const { parentPath, leafQuery } = resolveDirectAddressContext(query);
  const parentAbsolutePath = resolve(workspacePath, parentPath || ".");
  if (!isInsideRoot(workspacePath, parentAbsolutePath)) {
    return [];
  }

  try {
    if (!statSync(parentAbsolutePath).isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const normalizedLeafQuery = leafQuery.toLowerCase();
  return readdirSync(parentAbsolutePath, { withFileTypes: true })
    .filter((entry) => entry.name !== ".git")
    .filter((entry) => normalizedLeafQuery.length === 0 || entry.name.toLowerCase().startsWith(normalizedLeafQuery))
    .flatMap((entry) => {
      const absolutePath = join(parentAbsolutePath, entry.name);
      let isDirectory = entry.isDirectory();
      let isFile = entry.isFile();
      if (!isDirectory && !isFile && entry.isSymbolicLink()) {
        try {
          const targetStat = statSync(absolutePath);
          isDirectory = targetStat.isDirectory();
          isFile = targetStat.isFile();
        } catch {
          return [];
        }
      }
      if (!isDirectory && !isFile) {
        return [];
      }
      const relativePath = parentPath.length > 0 ? `${parentPath}/${entry.name}` : entry.name;
      return [makeIndexEntry(normalizeRelativePath(relativePath), isDirectory)];
    })
    .sort(compareDirectAddressEntries);
};

export class WorkspacePathSearchIndex {
  private readonly cache = new Map<string, WorkspacePathCacheEntry>();

  search(input: { cwd: string; query?: string; limit?: number }): WorkspacePathSearchItem[] {
    const workspacePath = resolve(input.cwd);
    const limit = Math.max(1, Math.min(input.limit ?? 20, 100));
    const normalizedQuery = (input.query ?? "").trim().replace(/^@/, "").replace(/\\/g, "/").toLowerCase();
    const entries = this.getEntries(workspacePath);
    const indexedPaths = new Set(entries.map((entry) => entry.path));
    const asPublicItems = (items: WorkspacePathIndexEntry[]): WorkspacePathSearchItem[] =>
      items.map((entry) => toPublicItem(entry, !indexedPaths.has(entry.path)));

    if (normalizedQuery.length === 0) {
      return asPublicItems(entries.filter((entry) => entry.depth <= 1).slice(0, limit));
    }

    const directAddressEntries = loadDirectAddressEntries(workspacePath, normalizedQuery);

    if (normalizedQuery.endsWith("/")) {
      const prefix = normalizedQuery;
      const indexedDirectChildren = entries.filter((entry) => {
        if (!entry.lowerPath.startsWith(prefix) || entry.lowerPath === prefix) {
          return false;
        }
        const remainder = entry.path.slice(prefix.length).replace(/\/$/, "");
        return remainder.length > 0 && !remainder.includes("/");
      });
      const directChildren = uniqueBy([...directAddressEntries, ...indexedDirectChildren], (entry) => entry.path).slice(
        0,
        limit,
      );
      if (directChildren.length > 0) {
        return asPublicItems(directChildren);
      }
    }

    const indexedMatches = entries
      .map((item) => ({ item, score: scorePathEntry(item, normalizedQuery) }))
      .filter((candidate): candidate is { item: WorkspacePathIndexEntry; score: number } => candidate.score !== null)
      .sort(compareSearchItems)
      .map(({ item }) => item);

    return asPublicItems(uniqueBy([...directAddressEntries, ...indexedMatches], (entry) => entry.path).slice(0, limit));
  }

  prewarm(cwd: string): void {
    this.getEntries(resolve(cwd));
  }

  invalidate(cwd?: string): void {
    if (!cwd) {
      this.cache.clear();
      return;
    }
    this.cache.delete(resolve(cwd));
  }

  private getEntries(workspacePath: string): WorkspacePathIndexEntry[] {
    const cached = this.cache.get(workspacePath);
    if (cached && Date.now() - cached.builtAt <= INDEX_TTL_MS) {
      return cached.entries;
    }
    if (!existsSync(workspacePath) || !statSync(workspacePath).isDirectory()) {
      return [];
    }
    const entries = loadWorkspacePathIndex(workspacePath);
    this.cache.set(workspacePath, {
      builtAt: Date.now(),
      entries,
    });
    return entries;
  }
}

const toPublicItem = (entry: WorkspacePathIndexEntry, ignored = false): WorkspacePathSearchItem => ({
  label: entry.label,
  path: entry.path,
  isDirectory: entry.isDirectory,
  ...(ignored ? { ignored: true } : {}),
});
