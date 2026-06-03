import { existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const BUNDLED_ASSETS_ROOT_ENV = "AGENTER_BUNDLED_ASSETS_ROOT";

export interface BundledAssetsResolutionOptions {
  env?: NodeJS.ProcessEnv;
  execPath?: string;
}

const readBundledAssetsRootEnv = (env: NodeJS.ProcessEnv): string | null => {
  const raw = env[BUNDLED_ASSETS_ROOT_ENV]?.trim();
  return raw && raw.length > 0 ? resolve(raw) : null;
};

const resolveExecutableAssetRoots = (execPath: string): readonly string[] => {
  const execDir = dirname(realpathSync(execPath));
  return [join(execDir, "assets"), join(execDir, "..", "assets")];
};

// File truth law: published binaries must discover their package-owned assets
// from the package/runtime layout itself. Env override stays first for wrappers,
// but executable-adjacent assets are the fallback truth for native archives.
export const resolveBundledAssetsRoot = (options: BundledAssetsResolutionOptions = {}): string | null => {
  const env = options.env ?? process.env;
  const envRoot = readBundledAssetsRootEnv(env);
  if (envRoot) {
    return envRoot;
  }
  const execPath = options.execPath ?? process.execPath;
  if (!execPath || !existsSync(execPath)) {
    return null;
  }
  for (const candidate of resolveExecutableAssetRoots(execPath)) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

export const resolveBundledAssetPath = (
  segments: readonly string[],
  options: BundledAssetsResolutionOptions = {},
): string | undefined => {
  const root = resolveBundledAssetsRoot(options);
  if (!root) {
    return undefined;
  }
  const path = join(root, ...segments);
  return existsSync(path) ? path : undefined;
};
