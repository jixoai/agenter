#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

interface ValidateArgs {
  target?: string;
}

interface AppManifest {
  appId?: unknown;
  command?: unknown;
  bin?: unknown;
  descriptor?: unknown;
}

interface PackageJsonShape {
  name?: unknown;
  bin?: unknown;
  keywords?: unknown;
  peerDependencies?: unknown;
  agenter?: {
    app?: AppManifest;
  };
}

const parseArgs = (argv: readonly string[]): ValidateArgs => {
  const args: ValidateArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--target") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--target requires a value");
      }
      args.target = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${token}`);
    }
  }
  return args;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJson = async (path: string): Promise<PackageJsonShape> =>
  JSON.parse(await readFile(path, "utf8")) as PackageJsonShape;

const requireString = (value: unknown, label: string, errors: string[]): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  errors.push(`${label} is required`);
  return null;
};

const validate = async (target: string): Promise<void> => {
  const errors: string[] = [];
  const packageJsonPath = join(target, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`missing package.json in ${target}`);
  }
  const pkg = await readJson(packageJsonPath);
  const packageName = requireString(pkg.name, "package name", errors);

  const peerDependencies = isRecord(pkg.peerDependencies) ? pkg.peerDependencies : null;
  const agenterRange = peerDependencies ? peerDependencies.agenter : undefined;
  requireString(agenterRange, "peerDependencies.agenter", errors);

  const manifest = pkg.agenter?.app;
  if (!isRecord(manifest)) {
    errors.push("agenter.app manifest is required");
  }
  const appId = requireString(manifest?.appId, "agenter.app.appId", errors);
  const command = requireString(manifest?.command, "agenter.app.command", errors);
  const binName = requireString(manifest?.bin, "agenter.app.bin", errors);
  const descriptorPath = requireString(manifest?.descriptor, "agenter.app.descriptor", errors);

  const bin = isRecord(pkg.bin) ? pkg.bin : null;
  if (binName && typeof bin?.[binName] !== "string") {
    errors.push(`bin.${binName} is required`);
  }
  if (descriptorPath && !existsSync(join(target, descriptorPath))) {
    errors.push(`descriptor file is missing: ${descriptorPath}`);
  }
  if (descriptorPath && existsSync(join(target, descriptorPath))) {
    const descriptorSource = await readFile(join(target, descriptorPath), "utf8");
    for (const [label, value] of [
      ["appId", appId],
      ["command", command],
      ["packageName", packageName],
    ] as const) {
      if (value && !descriptorSource.includes(`${label}: ${JSON.stringify(value)}`)) {
        errors.push(`descriptor does not declare ${label}: ${value}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
};

try {
  const args = parseArgs(process.argv.slice(2));
  const target = resolve(args.target?.trim() || process.cwd());
  await validate(target);
  console.log(`valid Agenter app package: ${target}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
