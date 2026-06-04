import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { releasePublishOrder, type ReleasePackageJson } from "./release-manifest";
import { releasePublishReportPath, type ReleasePublishReport } from "./publish-bundles";

type NpmViewPayload = Partial<
  Pick<ReleasePackageJson, "version" | "bin" | "dependencies" | "optionalDependencies" | "peerDependencies">
>;

const repoRoot = resolve(import.meta.dir, "../..");

const readPackageJson = async (packageDir: string): Promise<ReleasePackageJson> =>
  (await Bun.file(join(packageDir, "package.json")).json()) as ReleasePackageJson;

const readPublishReport = async (): Promise<ReleasePublishReport | undefined> => {
  const reportPath = join(repoRoot, releasePublishReportPath);
  if (!existsSync(reportPath)) {
    return undefined;
  }
  return (await Bun.file(reportPath).json()) as ReleasePublishReport;
};

export const selectPackageDirsForVerification = (
  report: ReleasePublishReport | undefined,
  packageDirs: readonly string[],
): readonly string[] => {
  if (!report) {
    return packageDirs;
  }
  const publishedPackageDirs = report.packages
    .filter((entry) => entry.status === "published")
    .map((entry) => entry.packageDir);
  return publishedPackageDirs.length > 0 ? publishedPackageDirs : packageDirs;
};

const normalizeRecord = (record: Record<string, string> | undefined): Record<string, string> | undefined => {
  if (!record || Object.keys(record).length === 0) {
    return undefined;
  }
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
};

const assertRecordEquals = (
  label: string,
  expected: Record<string, string> | undefined,
  actual: Record<string, string> | undefined,
): void => {
  const normalizedExpected = normalizeRecord(expected);
  const normalizedActual = normalizeRecord(actual);
  if (JSON.stringify(normalizedActual) !== JSON.stringify(normalizedExpected)) {
    throw new Error(
      `${label} mismatch\nexpected: ${JSON.stringify(normalizedExpected ?? {})}\nactual: ${JSON.stringify(normalizedActual ?? {})}`,
    );
  }
};

const runNpmView = async (name: string, version: string): Promise<NpmViewPayload> => {
  const proc = Bun.spawn({
    cmd: [
      "npm",
      "view",
      `${name}@${version}`,
      "--json",
    ],
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`npm view failed for ${name}@${version}: ${stderr.trim()}`);
  }
  const payload = JSON.parse(stdout) as NpmViewPayload | string;
  return typeof payload === "string" ? { version: payload } : payload;
};

const verifyPackage = async (packageDir: string): Promise<void> => {
  const absolutePackageDir = join(repoRoot, packageDir);
  const packageJsonPath = join(absolutePackageDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`release bundle is missing package.json: ${packageDir}; run release:build-bundles first`);
  }

  const expected = await readPackageJson(absolutePackageDir);
  const actual = await runNpmView(expected.name, expected.version);
  if (actual.version !== expected.version) {
    throw new Error(
      `${expected.name} version mismatch: expected ${expected.version}, got ${actual.version ?? "<missing>"}`,
    );
  }
  assertRecordEquals(`${expected.name} bin`, expected.bin, actual.bin);
  assertRecordEquals(`${expected.name} dependencies`, expected.dependencies, actual.dependencies);
  assertRecordEquals(
    `${expected.name} optionalDependencies`,
    expected.optionalDependencies,
    actual.optionalDependencies,
  );
  assertRecordEquals(`${expected.name} peerDependencies`, expected.peerDependencies, actual.peerDependencies);
  console.log(`verified ${expected.name}@${expected.version}`);
};

export const verifyPublishedReleaseBundles = async (): Promise<void> => {
  const report = await readPublishReport();
  for (const packageDir of selectPackageDirsForVerification(report, releasePublishOrder)) {
    await verifyPackage(packageDir);
  }
};

if (import.meta.main) {
  await verifyPublishedReleaseBundles();
}
