#!/usr/bin/env bun
import { chmod, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  createAgenterCliNativeArtifactPath,
  resolveAgenterCliTargetById,
  resolveCurrentAgenterCliTarget,
  type AgenterCliTarget,
} from "./agenter-cli-artifacts";

const repoRoot = resolve(import.meta.dir, "../..");
const CLI_ENTRY = join(repoRoot, "packages/cli/src/bin/agenter.ts");

export interface BuildAgenterCliOptions {
  output?: string;
  root?: string;
  stagePackage?: boolean;
  targetId?: string;
}

export const resolveBuildAgenterCliTarget = (options: Pick<BuildAgenterCliOptions, "targetId">): AgenterCliTarget =>
  options.targetId ? resolveAgenterCliTargetById(options.targetId) : resolveCurrentAgenterCliTarget();

export const resolveBuildAgenterCliOutputPath = (
  target: AgenterCliTarget,
  options: Required<Pick<BuildAgenterCliOptions, "root" | "stagePackage">> & Pick<BuildAgenterCliOptions, "output">,
): string => {
  if (options.output) {
    return resolve(options.output);
  }
  if (options.stagePackage) {
    return join(options.root, target.artifactPath);
  }
  return resolve(createAgenterCliNativeArtifactPath(join(options.root, "native-artifacts"), target));
};

export const buildAgenterCliCompileCommand = (target: AgenterCliTarget, outputPath: string): string[] => [
  "bun",
  "build",
  CLI_ENTRY,
  "--compile",
  "--target",
  target.bunTarget,
  "--outfile",
  outputPath,
];

const run = async (cmd: string[]): Promise<void> => {
  const proc = Bun.spawn({
    cmd,
    cwd: repoRoot,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} failed with exit code ${exitCode}`);
  }
};

export const buildAgenterCliBinary = async (
  options: BuildAgenterCliOptions = {},
): Promise<{ target: AgenterCliTarget; outputPath: string }> => {
  const root = resolve(options.root ?? process.cwd());
  const stagePackage = options.stagePackage ?? false;
  const target = resolveBuildAgenterCliTarget(options);
  const outputPath = resolveBuildAgenterCliOutputPath(target, {
    output: options.output,
    root,
    stagePackage,
  });
  await mkdir(dirname(outputPath), { recursive: true });
  await run(buildAgenterCliCompileCommand(target, outputPath));
  if (target.packageOs !== "win32") {
    await chmod(outputPath, 0o755);
  }
  return { target, outputPath };
};

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    output: { type: "string" },
    root: { type: "string", default: process.cwd() },
    "stage-package": { type: "boolean", default: false },
    "target-id": { type: "string" },
  },
});

if (import.meta.main) {
  const result = await buildAgenterCliBinary({
    output: values.output,
    root: values.root,
    stagePackage: values["stage-package"],
    targetId: values["target-id"],
  });
  console.log(`built agenter native CLI (${result.target.targetId}): ${result.outputPath}`);
}
