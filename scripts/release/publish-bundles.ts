import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { releasePublishOrder } from "./release-manifest";

interface PackageJson {
  name: string;
  version: string;
}

export const releasePackagePublishOrder = releasePublishOrder;

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

const publishPackage = async (packageDir: string, dryRun: boolean): Promise<void> => {
  const absolutePackageDir = join(repoRoot, packageDir);
  const packageJsonPath = join(absolutePackageDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`release package is missing package.json: ${packageDir}`);
  }
  const pkg = await readPackageJson(absolutePackageDir);
  if (await isPackageVersionPublished(pkg.name, pkg.version)) {
    console.log(`skip ${pkg.name}@${pkg.version}: already published`);
    return;
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
};

export const publishReleaseBundles = async (input: { dryRun?: boolean } = {}): Promise<void> => {
  for (const packageDir of releasePackagePublishOrder) {
    await publishPackage(packageDir, input.dryRun ?? false);
  }
};

if (import.meta.main) {
  await publishReleaseBundles({
    dryRun: process.argv.includes("--dry-run"),
  });
}
