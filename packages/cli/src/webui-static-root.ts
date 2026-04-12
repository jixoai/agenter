import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const WEBUI_ENTRY_FILENAMES = ["index.html", "200.html"] as const;

export interface CanonicalWebUiAssetRoot {
  kind: "workspace-build" | "packaged-assets";
  staticDir: string;
}

const findWebUiEntryDocumentPath = (staticDir: string): string | null => {
  for (const filename of WEBUI_ENTRY_FILENAMES) {
    const filePath = join(staticDir, filename);
    if (existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
};

const missingWebUiAssetsError = (staticDir: string, remediation: string): Error =>
  new Error(
    `webui assets not found at ${staticDir}. expected one of ${WEBUI_ENTRY_FILENAMES.join(", ")}. ${remediation}`,
  );

export const assertWebUiStaticDir = (staticDir: string, remediation: string): string => {
  const entryPath = findWebUiEntryDocumentPath(staticDir);
  if (!entryPath) {
    throw missingWebUiAssetsError(staticDir, remediation);
  }
  return entryPath;
};

export const resolveWebUiEntryDocumentPath = (staticDir: string): string | null =>
  findWebUiEntryDocumentPath(staticDir);

export const resolveCanonicalWebUiAssetRoot = (cliSourceDir: string): CanonicalWebUiAssetRoot => {
  const workspaceWebUiDir = resolve(cliSourceDir, "../../webui");
  const workspacePackageJson = join(workspaceWebUiDir, "package.json");
  if (existsSync(workspacePackageJson)) {
    const workspaceBuildDir = join(workspaceWebUiDir, "build");
    assertWebUiStaticDir(
      workspaceBuildDir,
      "run `bun run build:webui` before `agenter web`. `packages/cli/assets/webui` is packaging-only in a workspace checkout.",
    );
    return {
      kind: "workspace-build",
      staticDir: workspaceBuildDir,
    };
  }

  const packagedAssetDir = resolve(cliSourceDir, "../assets/webui");
  assertWebUiStaticDir(
    packagedAssetDir,
    "rebuild or reinstall the packaged CLI so the bundled WebUI assets are present.",
  );
  return {
    kind: "packaged-assets",
    staticDir: packagedAssetDir,
  };
};

export const readStaticDocumentTitle = (staticDir: string): string | null => {
  const entryPath = findWebUiEntryDocumentPath(staticDir);
  if (!entryPath) {
    return null;
  }
  const html = readFileSync(entryPath, "utf8");
  const match = html.match(/<title>([^<]+)<\/title>/i);
  return match ? match[1] : null;
};
