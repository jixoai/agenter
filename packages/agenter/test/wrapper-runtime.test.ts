import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const packageRoot = join(import.meta.dir, "..");
const require = createRequire(import.meta.url);

const { resolveWrapperBinary } = require(join(packageRoot, "cli-wrapper.cjs")) as {
  resolveWrapperBinary: (options?: Record<string, unknown>) => {
    binaryPath: string;
    pkg: string;
    platformKey: string;
    publicBinPath: string;
  };
};
const { installNativeBinary } = require(join(packageRoot, "install.cjs")) as {
  installNativeBinary: (options?: Record<string, unknown>) => {
    placed: boolean;
    resolution?: {
      binaryPath: string;
      platformKey: string;
      publicBinPath: string;
    };
    reason?: string;
  };
};

const createFakePlatformPackage = (root: string, packageName: string, binaryName: string, contents: string) => {
  const packageDir = join(root, "node_modules", ...packageName.split("/"));
  mkdirSync(join(packageDir, "bin"), { recursive: true });
  writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name: packageName }, null, 2));
  writeFileSync(join(packageDir, "bin", binaryName), contents);
  return packageDir;
};

describe("Feature: agenter wrapper runtime projection", () => {
  test("Scenario: Given install scripts are disabled When the operator invokes the documented fallback path Then it resolves the same host-native platform package explicitly", () => {
    const sandbox = mkdtempSync(join(tmpdir(), "agenter-wrapper-"));
    const packageName = "@agenter/cli-darwin-arm64";
    const platformPackageDir = createFakePlatformPackage(sandbox, packageName, "agenter", "native-darwin-arm64");
    const packageJson = {
      name: "agenter",
      optionalDependencies: {
        [packageName]: "0.0.10",
      },
    };

    const resolution = resolveWrapperBinary({
      packageRoot: sandbox,
      packageJson,
      runtime: { platform: "darwin", arch: "arm64" },
      resolvePackageJsonPath: (specifier: string) => {
        expect(specifier).toBe(`${packageName}/package.json`);
        return join(platformPackageDir, "package.json");
      },
    });

    expect(resolution.platformKey).toBe("darwin-arm64");
    expect(resolution.pkg).toBe(packageName);
    expect(resolution.binaryPath).toBe(join(platformPackageDir, "bin", "agenter"));
    expect(resolution.publicBinPath).toBe(join(sandbox, "bin", "agenter.exe"));
  });

  test("Scenario: Given a supported host install completes When postinstall projects the native package Then the fixed public bin path becomes the host-native executable", () => {
    const sandbox = mkdtempSync(join(tmpdir(), "agenter-install-"));
    const packageName = "@agenter/cli-darwin-arm64";
    const platformPackageDir = createFakePlatformPackage(sandbox, packageName, "agenter", "native-darwin-arm64");
    const packageJson = {
      name: "agenter",
      optionalDependencies: {
        [packageName]: "0.0.10",
      },
    };

    const result = installNativeBinary({
      packageRoot: sandbox,
      packageJson,
      runtime: { platform: "darwin", arch: "arm64" },
      resolvePackageJsonPath: (specifier: string) => {
        expect(specifier).toBe(`${packageName}/package.json`);
        return join(platformPackageDir, "package.json");
      },
    });

    expect(result.placed).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.resolution?.publicBinPath).toBe(join(sandbox, "bin", "agenter.exe"));
    expect(readFileSync(join(sandbox, "bin", "agenter.exe"), "utf8")).toBe("native-darwin-arm64");
    expect(statSync(join(sandbox, "bin", "agenter.exe")).mode & 0o111).not.toBe(0);
  });
});
