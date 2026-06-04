import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { releasePublishOrder } from "./release-manifest";

interface PackageJson {
  name: string;
  version: string;
}

export type ReleasePublishResultStatus = "published" | "skipped-existing";

export interface ReleasePublishResultEntry {
  packageDir: string;
  name: string;
  status: ReleasePublishResultStatus;
  version: string;
}

export interface ReleasePublishReport {
  generatedAt: string;
  packages: ReleasePublishResultEntry[];
}

export const releasePackagePublishOrder = releasePublishOrder;
export const releasePublishReportPath = "bundle/release-publish-report.json";

const repoRoot = resolve(import.meta.dir, "../..");

const readPackageJson = async (packageDir: string): Promise<PackageJson> =>
  (await Bun.file(join(packageDir, "package.json")).json()) as PackageJson;

const run = async (cmd: string[], cwd = repoRoot): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
  const proc = Bun.spawn({
    cmd,
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
};

export const isPackageVersionPublished = async (name: string, version: string): Promise<boolean> => {
  const result = await run(["npm", "view", `${name}@${version}`, "version", "--json"]);
  return result.exitCode === 0;
};

const writePublishReport = async (report: ReleasePublishReport): Promise<void> => {
  const outputPath = join(repoRoot, releasePublishReportPath);
  await mkdir(join(repoRoot, "bundle"), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
};

const publishPackage = async (packageDir: string, dryRun: boolean): Promise<ReleasePublishResultEntry> => {
  const absolutePackageDir = join(repoRoot, packageDir);
  const packageJsonPath = join(absolutePackageDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`release package is missing package.json: ${packageDir}`);
  }
  const pkg = await readPackageJson(absolutePackageDir);
  if (await isPackageVersionPublished(pkg.name, pkg.version)) {
    console.log(`skip ${pkg.name}@${pkg.version}: already published`);
    return {
      packageDir,
      name: pkg.name,
      status: "skipped-existing",
      version: pkg.version,
    };
  }
  const command = ["npm", "publish", "--access", "public", "--provenance"];
  if (dryRun) {
    command.push("--dry-run");
  }
  const proc = Bun.spawn({
    cmd: command,
    cwd: absolutePackageDir,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`${command.join(" ")} failed for ${pkg.name}@${pkg.version} with exit code ${exitCode}`);
  }
  return {
    packageDir,
    name: pkg.name,
    status: "published",
    version: pkg.version,
  };
};

export const publishReleaseBundles = async (input: { dryRun?: boolean } = {}): Promise<ReleasePublishReport> => {
  const packages: ReleasePublishResultEntry[] = [];
  for (const packageDir of releasePackagePublishOrder) {
    packages.push(await publishPackage(packageDir, input.dryRun ?? false));
  }
  const report = {
    generatedAt: new Date().toISOString(),
    packages,
  } satisfies ReleasePublishReport;
  await writePublishReport(report);
  return report;
};

if (import.meta.main) {
  await publishReleaseBundles({
    dryRun: process.argv.includes("--dry-run"),
  });
}
