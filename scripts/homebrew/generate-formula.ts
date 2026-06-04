#!/usr/bin/env bun
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs as parseNodeArgs } from "node:util";

import {
  homebrewProjectionTargets,
  readAgenterReleaseArchiveManifest,
  resolveReleaseArchiveRecord,
  type AgenterReleaseArchiveManifest,
} from "../release/agenter-release-archive-manifest";

export interface GenerateAgenterFormulaOptions {
  formulaName: string;
  homepage: string;
  license: string;
  manifestPath: string;
  outputDir: string;
}

const DEFAULT_FORMULA_NAME = "agenter";
const DEFAULT_HOMEPAGE = "https://github.com/jixoai/agenter";
const DEFAULT_LICENSE = "MIT";

const rubyClassName = (formulaName: string): string =>
  formulaName
    .split(/[^a-zA-Z0-9]+/u)
    .filter((segment) => segment.length > 0)
    .map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`)
    .join("");

const renderTargetBlock = (
  manifest: AgenterReleaseArchiveManifest,
  targetId: string,
  options: { archBlock: "on_arm" | "on_intel"; indent: string },
): string => {
  const target = homebrewProjectionTargets.find((candidate) => candidate.targetId === targetId);
  if (!target) {
    throw new Error(`homebrew formula renderer does not know target ${targetId}`);
  }
  const record = resolveReleaseArchiveRecord(manifest, target);
  return [
    `${options.indent}${options.archBlock} do`,
    `${options.indent}  url ${JSON.stringify(record.archiveUrl)}`,
    `${options.indent}  sha256 ${JSON.stringify(record.archiveSha256)}`,
    `${options.indent}end`,
  ].join("\n");
};

const resolveSharedHomebrewBinaryPath = (manifest: AgenterReleaseArchiveManifest): string => {
  const values = homebrewProjectionTargets.map(
    (target) => resolveReleaseArchiveRecord(manifest, target).homebrewBinaryPath,
  );
  const first = values[0];
  if (values.some((value) => value !== first)) {
    // Homebrew stays a projection over the canonical manifest, so the formula
    // only accepts one shared binary path across every projected host block.
    throw new Error("homebrew formula projection requires one shared binary path across projected targets");
  }
  return first;
};

export const renderAgenterFormula = (
  manifest: AgenterReleaseArchiveManifest,
  options: Pick<GenerateAgenterFormulaOptions, "formulaName" | "homepage" | "license">,
): string => {
  const className = rubyClassName(options.formulaName);
  const darwinArm64 = renderTargetBlock(manifest, "darwin-arm64", { archBlock: "on_arm", indent: "  " });
  const darwinX64 = renderTargetBlock(manifest, "darwin-x64", { archBlock: "on_intel", indent: "  " });
  const linuxArm64 = renderTargetBlock(manifest, "linux-arm64-gnu", { archBlock: "on_arm", indent: "  " });
  const linuxX64 = renderTargetBlock(manifest, "linux-x64-gnu", { archBlock: "on_intel", indent: "  " });
  const homebrewBinaryPath = resolveSharedHomebrewBinaryPath(manifest);

  return [
    "# This file is generated from the main-repo release archive manifest.",
    "# Homebrew runs on macOS and glibc Linux, so Windows and musl targets stay",
    "# in the canonical release manifest but outside the formula projection.",
    `class ${className} < Formula`,
    `  desc ${JSON.stringify("Agenter native CLI")}`,
    `  homepage ${JSON.stringify(options.homepage)}`,
    `  license ${JSON.stringify(options.license)}`,
    `  version ${JSON.stringify(manifest.version)}`,
    "",
    "  on_macos do",
    darwinArm64,
    "",
    darwinX64,
    "  end",
    "",
    "  on_linux do",
    linuxArm64,
    "",
    linuxX64,
    "  end",
    "",
    "  def install",
    `    bin.install ${JSON.stringify(homebrewBinaryPath)} => ${JSON.stringify(options.formulaName)}`,
    "  end",
    "",
    "  test do",
    `    assert_match version.to_s, shell_output(\"#{bin}/${options.formulaName} --version\")`,
    "  end",
    "end",
    "",
  ].join("\n");
};

export const generateAgenterFormula = async (options: GenerateAgenterFormulaOptions): Promise<string> => {
  const manifest = await readAgenterReleaseArchiveManifest(options.manifestPath);
  const formulaSource = renderAgenterFormula(manifest, options);
  const outputDir = resolve(options.outputDir);
  const formulaDir = join(outputDir, "Formula");
  await mkdir(formulaDir, { recursive: true });
  const formulaPath = join(formulaDir, `${options.formulaName}.rb`);
  await writeFile(formulaPath, formulaSource);
  return formulaPath;
};

export const parseArgs = (argv: readonly string[]): GenerateAgenterFormulaOptions => {
  const { values } = parseNodeArgs({
    args: [...argv],
    options: {
      "formula-name": { type: "string", default: DEFAULT_FORMULA_NAME },
      homepage: { type: "string", default: DEFAULT_HOMEPAGE },
      license: { type: "string", default: DEFAULT_LICENSE },
      manifest: { type: "string" },
      "output-dir": { type: "string" },
    },
  });
  if (!values.manifest) {
    throw new Error("generate-formula requires --manifest");
  }
  if (!values["output-dir"]) {
    throw new Error("generate-formula requires --output-dir");
  }
  return {
    formulaName: values["formula-name"],
    homepage: values.homepage,
    license: values.license,
    manifestPath: values.manifest,
    outputDir: values["output-dir"],
  };
};

if (import.meta.main) {
  const formulaPath = await generateAgenterFormula(parseArgs(Bun.argv.slice(2)));
  console.log(formulaPath);
}
