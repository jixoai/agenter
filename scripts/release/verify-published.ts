import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { releasePublishOrder, type ReleasePackageJson } from "./release-manifest";
import { releasePublishReportPath, type ReleasePublishReport } from "./publish-bundles";

type NpmViewPayload = Partial<
  Pick<ReleasePackageJson, "version" | "bin" | "dependencies" | "optionalDependencies" | "peerDependencies">
>;

const repoRoot = resolve(import.meta.dir, "../..");
const verifyPublishedRetryDelaysMs = [2_000, 4_000, 8_000, 16_000] as const;

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
  // The publish report is the attempt-scoped truth. Verification only follows
  // package writes performed by this attempt and must not widen itself back to
  // historical packages on reruns where every package is already published.
  return report.packages
    .filter((entry) => entry.status === "published")
    .map((entry) => entry.packageDir);
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

export const assertOptionalDependenciesCompatibleWithRegistryProjection = (
  packageName: string,
  expected: Record<string, string> | undefined,
  actual: Record<string, string> | undefined,
): void => {
  const normalizedExpected = normalizeRecord(expected);
  const normalizedActual = normalizeRecord(actual);
  if (normalizedExpected !== undefined && normalizedActual === undefined) {
    // npm view is a registry projection, not the package-file truth. Some
    // published packages, such as historical ghostty-native releases, do not
    // surface optionalDependencies in that projection even though the local
    // release bundle package.json includes them.
    console.warn(`npm registry omitted optionalDependencies for ${packageName}; skipping exact optionalDependencies verification`);
    return;
  }
  assertRecordEquals(`${packageName} optionalDependencies`, expected, actual);
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

const isRetryableNpmViewError = (error: unknown): error is Error => {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.includes("npm error code E404") || error.message.includes("No match found for version");
};

type ReadPublishedPackageOptions = {
  readonly retryDelaysMs?: readonly number[];
  readonly runView?: typeof runNpmView;
  readonly sleep?: (delayMs: number) => Promise<void>;
};

export const readPublishedPackageWithRetry = async (
  name: string,
  version: string,
  options: ReadPublishedPackageOptions = {},
): Promise<NpmViewPayload> => {
  const retryDelaysMs = options.retryDelaysMs ?? verifyPublishedRetryDelaysMs;
  const runView = options.runView ?? runNpmView;
  const sleep = options.sleep ?? Bun.sleep;

  for (const [attemptIndex, retryDelayMs] of retryDelaysMs.entries()) {
    try {
      return await runView(name, version);
    } catch (error) {
      if (!isRetryableNpmViewError(error)) {
        throw error;
      }
      console.warn(
        `npm view for ${name}@${version} is not visible yet; retrying in ${retryDelayMs}ms (${attemptIndex + 1}/${retryDelaysMs.length})`,
      );
      await sleep(retryDelayMs);
    }
  }

  return await runView(name, version);
};

const verifyPackage = async (packageDir: string): Promise<void> => {
  const absolutePackageDir = join(repoRoot, packageDir);
  const packageJsonPath = join(absolutePackageDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`release bundle is missing package.json: ${packageDir}; run release:build-bundles first`);
  }

  const expected = await readPackageJson(absolutePackageDir);
  const actual = await readPublishedPackageWithRetry(expected.name, expected.version);
  if (actual.version !== expected.version) {
    throw new Error(
      `${expected.name} version mismatch: expected ${expected.version}, got ${actual.version ?? "<missing>"}`,
    );
  }
  assertRecordEquals(`${expected.name} bin`, expected.bin, actual.bin);
  assertRecordEquals(`${expected.name} dependencies`, expected.dependencies, actual.dependencies);
  assertOptionalDependenciesCompatibleWithRegistryProjection(
    expected.name,
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
