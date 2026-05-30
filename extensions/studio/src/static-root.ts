import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const STUDIO_ENTRY_FILENAMES = ["index.html", "200.html"] as const;
const BUNDLED_ASSETS_ROOT_ENV = "AGENTER_BUNDLED_ASSETS_ROOT";

export interface StudioStaticRoot {
  kind: "package-build";
  staticDir: string;
}

const findStudioEntryDocumentPath = (staticDir: string): string | null => {
  for (const filename of STUDIO_ENTRY_FILENAMES) {
    const filePath = join(staticDir, filename);
    if (existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
};

const missingStudioAssetsError = (staticDir: string, remediation: string): Error =>
  new Error(
    `studio assets not found at ${staticDir}. expected one of ${STUDIO_ENTRY_FILENAMES.join(", ")}. ${remediation}`,
  );

export const assertStudioStaticDir = (staticDir: string, remediation: string): string => {
  const entryPath = findStudioEntryDocumentPath(staticDir);
  if (!entryPath) {
    throw missingStudioAssetsError(staticDir, remediation);
  }
  return entryPath;
};

export const resolveStudioEntryDocumentPath = (staticDir: string): string | null =>
  findStudioEntryDocumentPath(staticDir);

export const resolveStudioStaticRoot = (packageSourceDir = import.meta.dir): StudioStaticRoot => {
  const bundledRoot = process.env[BUNDLED_ASSETS_ROOT_ENV]?.trim();
  const buildDir = bundledRoot ? resolve(bundledRoot, "studio", "build") : resolve(packageSourceDir, "..", "build");
  assertStudioStaticDir(buildDir, "run `bun run --filter 'agenter-ext-studio' build` before `agenter studio`.");
  return {
    kind: "package-build",
    staticDir: buildDir,
  };
};

export const readStudioStaticDocumentTitle = (staticDir: string): string | null => {
  const entryPath = findStudioEntryDocumentPath(staticDir);
  if (!entryPath) {
    return null;
  }
  const html = readFileSync(entryPath, "utf8");
  const match = html.match(/<title>([^<]+)<\/title>/i);
  return match ? match[1] : null;
};
