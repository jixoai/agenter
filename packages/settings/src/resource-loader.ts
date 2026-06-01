import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface ResourceLoaderContext {
  projectRoot: string;
  cwd: string;
  homeDir: string;
}

export interface ResolvedResource {
  original: string;
  uri: string;
  scheme: string;
  path?: string;
}

export type ResourceAliasResolver = (ctx: ResourceLoaderContext) => string;

export interface ResourceProtocolHandler {
  readText: (resource: ResolvedResource) => Promise<string>;
}

const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;

const isUriLike = (value: string): boolean => SCHEME_PATTERN.test(value);
const isDirectoryLike = (path: string): boolean => !path.endsWith(".json");
const resourceLoaderRequire = createRequire(import.meta.url);
const stripLeadingSlash = (value: string): string => value.replace(/^\/+/u, "");
const stripQueryAndHash = (value: string): string => value.replace(/[?#].*$/u, "");

const isPathLike = (token: string): boolean =>
  token === "~" || token.startsWith("~/") || token.startsWith("/") || token.startsWith("./") || token.startsWith("../");

const toFilePath = (input: string, context: ResourceLoaderContext): string => {
  const expanded =
    input === "~" ? context.homeDir : input.startsWith("~/") ? join(context.homeDir, input.slice(2)) : input;
  if (isAbsolute(expanded)) {
    return normalize(expanded);
  }
  return normalize(resolve(context.cwd, expanded));
};

const resolveFileUri = (path: string): string => pathToFileURL(path).toString();

interface PackageJsonResourceShape {
  name?: unknown;
  exports?: unknown;
  agenter?: {
    app?: {
      appId?: unknown;
    };
  };
}

interface ParsedNpmResource {
  packageName: string;
  relativePath: string;
}

interface ParsedAppResource {
  appId: string;
  relativePath: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readPackageJson = (packageJsonPath: string): PackageJsonResourceShape | null => {
  try {
    return JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJsonResourceShape;
  } catch {
    return null;
  }
};

const isPathInside = (path: string, root: string): boolean => {
  const resolvedPath = resolve(path);
  const resolvedRoot = resolve(root);
  const relativePath = relative(resolvedRoot, resolvedPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
};

const safePackageRelativePath = (value: string): string => {
  const normalized = normalize(stripLeadingSlash(stripQueryAndHash(value)).trim());
  if (normalized === "" || normalized === ".") {
    return "";
  }
  if (normalized === ".." || normalized.startsWith(`..${sep}`) || isAbsolute(normalized)) {
    throw new Error(`package resource path escapes package root: ${value}`);
  }
  return normalized.split(sep).join("/");
};

const parseNpmResource = (input: string): ParsedNpmResource => {
  const spec = stripQueryAndHash(input.slice("npm:".length)).trim().replace(/^\/+/u, "");
  const parts = spec.split("/").filter((part) => part.length > 0);
  if (parts.length === 0) {
    throw new Error(`npm resource missing package name: ${input}`);
  }
  if (parts[0]?.startsWith("@")) {
    if (parts.length < 2) {
      throw new Error(`scoped npm resource missing package segment: ${input}`);
    }
    return {
      packageName: `${parts[0]}/${parts[1]}`,
      relativePath: safePackageRelativePath(parts.slice(2).join("/")),
    };
  }
  return {
    packageName: parts[0] ?? "",
    relativePath: safePackageRelativePath(parts.slice(1).join("/")),
  };
};

const parseAppResource = (input: string): ParsedAppResource => {
  const spec = stripQueryAndHash(input.slice("app:".length)).trim().replace(/^\/+/u, "");
  const parts = spec.split("/").filter((part) => part.length > 0);
  const appId = parts[0]?.trim() ?? "";
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(appId)) {
    throw new Error(`app resource missing valid app id: ${input}`);
  }
  return {
    appId,
    relativePath: safePackageRelativePath(parts.slice(1).join("/")),
  };
};

const collectWorkspaceSearchRoots = (context: ResourceLoaderContext): readonly string[] => {
  const roots = new Set<string>();
  for (const candidate of [context.projectRoot, context.cwd, process.cwd(), findNearestWorkspaceRoot(dirname(fileURLToPath(import.meta.url)))]) {
    if (candidate && existsSync(candidate)) {
      roots.add(resolve(candidate));
    }
  }
  return [...roots];
};

const findNearestWorkspaceRoot = (start: string): string | null => {
  let current = resolve(start);
  while (true) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
};

const listWorkspacePackageDirs = (root: string): readonly string[] => {
  const dirs: string[] = [];
  const pushIfPackage = (path: string): void => {
    if (existsSync(join(path, "package.json"))) {
      dirs.push(path);
    }
  };
  pushIfPackage(root);
  for (const group of ["apps", "packages"] as const) {
    const groupRoot = join(root, group);
    if (!existsSync(groupRoot)) {
      continue;
    }
    for (const entry of readdirSync(groupRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        pushIfPackage(join(groupRoot, entry.name));
      }
    }
  }
  return dirs;
};

const findWorkspacePackageRoot = (
  context: ResourceLoaderContext,
  predicate: (pkg: PackageJsonResourceShape) => boolean,
): { packageRoot: string; packageJson: PackageJsonResourceShape } | null => {
  for (const root of collectWorkspaceSearchRoots(context)) {
    for (const packageRoot of listWorkspacePackageDirs(root)) {
      const packageJson = readPackageJson(join(packageRoot, "package.json"));
      if (packageJson && predicate(packageJson)) {
        return { packageRoot, packageJson };
      }
    }
  }
  return null;
};

const findNearestPackageJson = (start: string, packageName: string): string | null => {
  let current = resolve(start);
  while (true) {
    const packageJsonPath = join(current, "package.json");
    const packageJson = existsSync(packageJsonPath) ? readPackageJson(packageJsonPath) : null;
    if (packageJson?.name === packageName) {
      return packageJsonPath;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
};

type NodeRequireLike = ReturnType<typeof createRequire>;

const createContextRequires = (context: ResourceLoaderContext): readonly NodeRequireLike[] => {
  const requires: NodeRequireLike[] = [resourceLoaderRequire];
  for (const root of collectWorkspaceSearchRoots(context)) {
    requires.push(createRequire(join(root, "__agenter_resource_loader__.cjs")));
  }
  return requires;
};

const findInstalledPackageRoot = (
  packageName: string,
  context: ResourceLoaderContext,
): { packageRoot: string; packageJson: PackageJsonResourceShape } | null => {
  for (const requireFromRoot of createContextRequires(context)) {
    try {
      const packageJsonPath = requireFromRoot.resolve(`${packageName}/package.json`);
      const packageJson = readPackageJson(packageJsonPath);
      if (packageJson?.name === packageName) {
        return { packageRoot: dirname(packageJsonPath), packageJson };
      }
    } catch {
      // Package exports may hide package.json; fall back to resolving the package entry.
    }
    try {
      const entryPath = requireFromRoot.resolve(packageName);
      const packageJsonPath = findNearestPackageJson(dirname(entryPath), packageName);
      if (!packageJsonPath) {
        continue;
      }
      const packageJson = readPackageJson(packageJsonPath);
      if (packageJson?.name === packageName) {
        return { packageRoot: dirname(packageJsonPath), packageJson };
      }
    } catch {
      // Try the next resolver root.
    }
  }
  return null;
};

const pickConditionalExportTarget = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const picked = pickConditionalExportTarget(entry);
      if (picked) {
        return picked;
      }
    }
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }
  for (const condition of ["bun", "import", "node", "default", "require"] as const) {
    const picked = pickConditionalExportTarget(value[condition]);
    if (picked) {
      return picked;
    }
  }
  return null;
};

const matchExportPattern = (key: string, subpath: string): string | null => {
  const starIndex = key.indexOf("*");
  if (starIndex < 0) {
    return null;
  }
  const prefix = key.slice(0, starIndex);
  const suffix = key.slice(starIndex + 1);
  if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) {
    return null;
  }
  return subpath.slice(prefix.length, subpath.length - suffix.length);
};

const applyExportPattern = (target: string, match: string): string => target.replace("*", match);

const resolveExportTarget = (packageJson: PackageJsonResourceShape, subpath: string): string | null => {
  const exportsField = packageJson.exports;
  if (typeof exportsField === "string") {
    return subpath === "." ? exportsField : null;
  }
  if (!isRecord(exportsField)) {
    return null;
  }
  const exact = pickConditionalExportTarget(exportsField[subpath]);
  if (exact) {
    return exact;
  }
  for (const [key, value] of Object.entries(exportsField)) {
    const match = matchExportPattern(key, subpath);
    if (match === null) {
      continue;
    }
    const target = pickConditionalExportTarget(value);
    if (target) {
      return applyExportPattern(target, match);
    }
  }
  return null;
};

const materializePackagePath = (packageRoot: string, target: string): string => {
  const targetPath = target.startsWith("./") ? target.slice(2) : target;
  const absolutePath = resolve(packageRoot, targetPath);
  if (!isPathInside(absolutePath, packageRoot)) {
    throw new Error(`package resource escapes package root: ${target}`);
  }
  return absolutePath;
};

const resolvePackageResourcePath = (input: {
  context: ResourceLoaderContext;
  packageName: string;
  relativePath: string;
}): string => {
  const resolvedPackage =
    findWorkspacePackageRoot(input.context, (pkg) => pkg.name === input.packageName) ??
    findInstalledPackageRoot(input.packageName, input.context);
  if (!resolvedPackage) {
    throw new Error(`npm package not found: ${input.packageName}`);
  }
  const subpath = input.relativePath.length > 0 ? `./${input.relativePath}` : ".";
  const exportTarget = resolveExportTarget(resolvedPackage.packageJson, subpath);
  if (exportTarget) {
    const exportedPath = materializePackagePath(resolvedPackage.packageRoot, exportTarget);
    if (existsSync(exportedPath) && statSync(exportedPath).isFile()) {
      return exportedPath;
    }
  }
  const fallbackPath = materializePackagePath(resolvedPackage.packageRoot, input.relativePath);
  if (!existsSync(fallbackPath)) {
    throw new Error(`npm resource not found: npm:${input.packageName}/${input.relativePath}`);
  }
  return fallbackPath;
};

const readAppManifestAppId = (packageJson: PackageJsonResourceShape): string | null =>
  typeof packageJson.agenter?.app?.appId === "string" ? packageJson.agenter.app.appId.trim() : null;

const resolveAppPackageName = (context: ResourceLoaderContext, appId: string): string => {
  const workspaceMatch = findWorkspacePackageRoot(context, (pkg) => readAppManifestAppId(pkg) === appId);
  if (workspaceMatch && typeof workspaceMatch.packageJson.name === "string") {
    return workspaceMatch.packageJson.name;
  }
  const conventionalPackageName = `agenter-app-${appId}`;
  const installedMatch = findInstalledPackageRoot(conventionalPackageName, context);
  if (!installedMatch) {
    throw new Error(`app resource package not found for app:${appId}`);
  }
  const manifestAppId = readAppManifestAppId(installedMatch.packageJson);
  if (manifestAppId !== appId) {
    throw new Error(`app package ${conventionalPackageName} does not declare agenter.app.appId=${appId}`);
  }
  return conventionalPackageName;
};

const defaultFileHandler: ResourceProtocolHandler = {
  readText: async (resource) => {
    if (!resource.path) {
      throw new Error(`file resource missing path: ${resource.uri}`);
    }
    return Bun.file(resource.path).text();
  },
};

const defaultHttpHandler: ResourceProtocolHandler = {
  readText: async (resource) => {
    const response = await fetch(resource.uri);
    if (!response.ok) {
      throw new Error(`request failed (${response.status}) for ${resource.uri}`);
    }
    return response.text();
  },
};

export interface ResourceLoaderOptions {
  context: {
    projectRoot: string;
    cwd?: string;
    homeDir?: string;
  };
}

/**
 * ResourceLoader is the single resolver/reader for settings and prompt resources.
 * It supports aliases (user/project/local), file-like paths, and URI protocols.
 */
export class ResourceLoader {
  private readonly context: ResourceLoaderContext;
  private readonly aliases = new Map<string, ResourceAliasResolver>();
  private readonly protocols = new Map<string, ResourceProtocolHandler>();

  constructor(options: ResourceLoaderOptions) {
    this.context = {
      projectRoot: options.context.projectRoot,
      cwd: options.context.cwd ?? options.context.projectRoot,
      homeDir: options.context.homeDir ?? homedir(),
    };
    this.registerBuiltinAliases();
    this.registerProtocol("file", defaultFileHandler);
    this.registerProtocol("http", defaultHttpHandler);
    this.registerProtocol("https", defaultHttpHandler);
  }

  registerAlias(name: string, resolver: ResourceAliasResolver): void {
    this.aliases.set(name, resolver);
  }

  registerProtocol(scheme: string, handler: ResourceProtocolHandler): void {
    this.protocols.set(scheme.toLowerCase(), handler);
  }

  resolve(input: string, options?: { forSettings?: boolean }): ResolvedResource {
    const token = input.trim();
    if (!token) {
      throw new Error("empty resource token");
    }

    const aliasTarget = this.aliases.get(token)?.(this.context);
    const source = aliasTarget ?? token;

    if (source.startsWith("app:")) {
      const parsed = parseAppResource(source);
      const packageName = resolveAppPackageName(this.context, parsed.appId);
      const path = resolvePackageResourcePath({
        context: this.context,
        packageName,
        relativePath: parsed.relativePath,
      });
      return {
        original: input,
        uri: resolveFileUri(path),
        scheme: "file",
        path,
      };
    }

    if (source.startsWith("npm:")) {
      const parsed = parseNpmResource(source);
      const path = resolvePackageResourcePath({
        context: this.context,
        packageName: parsed.packageName,
        relativePath: parsed.relativePath,
      });
      return {
        original: input,
        uri: resolveFileUri(path),
        scheme: "file",
        path,
      };
    }

    if (source.startsWith("file://")) {
      const url = new URL(source);
      let path = normalize(fileURLToPath(url));
      if (options?.forSettings && isDirectoryLike(path)) {
        path = join(path, "settings.json");
      }
      return {
        original: input,
        uri: resolveFileUri(path),
        scheme: "file",
        path,
      };
    }

    if (isUriLike(source)) {
      const scheme = source.slice(0, source.indexOf(":")).toLowerCase();
      return {
        original: input,
        uri: source,
        scheme,
      };
    }

    const filePath = toFilePath(source, this.context);
    const path = options?.forSettings && isDirectoryLike(filePath) ? join(filePath, "settings.json") : filePath;
    return {
      original: input,
      uri: resolveFileUri(path),
      scheme: "file",
      path,
    };
  }

  async readText(input: string | ResolvedResource, options?: { forSettings?: boolean }): Promise<string> {
    const resource = typeof input === "string" ? this.resolve(input, options) : input;
    const handler = this.protocols.get(resource.scheme.toLowerCase());
    if (!handler) {
      throw new Error(`unsupported resource scheme: ${resource.scheme}`);
    }
    return handler.readText(resource);
  }

  private registerBuiltinAliases(): void {
    this.registerAlias("user", (ctx) => join(ctx.homeDir, ".agenter", "settings.json"));
    this.registerAlias("project", (ctx) => join(ctx.projectRoot, ".agenter", "settings.json"));
    this.registerAlias("local", (ctx) => join(ctx.projectRoot, ".agenter", "settings.local.json"));
  }
}
