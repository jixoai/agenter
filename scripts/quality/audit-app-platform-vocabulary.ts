#!/usr/bin/env bun
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "../..");

const activePaths = [
  "package.json",
  "pnpm-workspace.yaml",
  "packages/cli/src",
  "packages/cli/test/app-command-launcher.test.ts",
  "packages/app-runtime",
  "packages/client-sdk/src",
  "packages/client-sdk/test",
  "packages/app-server/src/app-kernel.ts",
  "packages/app-server/src/trpc/router.ts",
  "packages/app-server/test/app-runtime.test.ts",
  "apps/shell/src",
  "apps/shell/test",
  "scripts/release",
  "skills/create-agenter-app",
  "openspec/specs/app-command-launcher",
  "openspec/specs/app-runtime",
] as const;

const forbiddenPatterns = [
  /agenter-ext/u,
  /app-extension/u,
  /product-command-launcher/u,
  /product-extension-runtime/u,
  /ProductCommand/u,
  /ProductExtension/u,
  /AGENTER_PRODUCT/u,
  /product-command/u,
  /extensions\//u,
] as const;

const listFiles = (relativePath: string): string[] => {
  const absolutePath = join(repoRoot, relativePath);
  const stat = statSync(absolutePath);
  if (stat.isFile()) {
    return [absolutePath];
  }
  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const childRelativePath = join(relativePath, entry.name);
    if (entry.isDirectory()) {
      return listFiles(childRelativePath);
    }
    return entry.isFile() ? [join(repoRoot, childRelativePath)] : [];
  });
};

const relative = (absolutePath: string): string => absolutePath.slice(repoRoot.length + 1);

const failures: string[] = [];
for (const root of activePaths) {
  for (const filePath of listFiles(root)) {
    if (!/\.(?:json|md|ts|tsx|yaml|yml)$/u.test(filePath)) {
      continue;
    }
    const text = readFileSync(filePath, "utf8");
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(text) || pattern.test(relative(filePath))) {
        failures.push(`${relative(filePath)} matches ${pattern.source}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("active app-platform vocabulary audit passed");
}
