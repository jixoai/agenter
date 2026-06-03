import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  classifyDistTagResult,
  classifyRegistryResult,
  createPackageManifest,
  defaultPackageDir,
  parseArgs,
  redact,
  trustMatches,
} from "./bootstrap-package";
import { readManifest, validateManifest } from "./bootstrap-package/manifest";

describe("Feature: npm package bootstrap release law", () => {
  test("Scenario: Given a ghostty platform package When args are parsed Then defaults preserve the publish-before-trust flow", () => {
    const options = parseArgs([
      "--package",
      "@jixo/ghostty-native-darwin-arm64",
      "--kind",
      "platform",
      "--publish-if-missing",
      "--configure-trust",
    ]);

    expect(options.packageName).toBe("@jixo/ghostty-native-darwin-arm64");
    expect(options.dir).toBe("packages/ghostty-native-darwin-arm64");
    expect(options.kind).toBe("platform");
    expect(options.dryRun).toBe(true);
    expect(options.publishAuth).toBe("token");
    expect(options.trustAuth).toBe("legacy-env");
    expect(options.repo).toBe("jixoai/agenter");
    expect(options.file).toBe("release.yml");
    expect(options.environment).toBe("npm-release");
  });

  test("Scenario: Given package kinds When manifests are generated Then platform artifacts stay package-owned without product-specific script glue", () => {
    const platform = createPackageManifest("@jixo/ghostty-native-darwin-arm64", "0.0.0", "platform");

    expect(platform.files).toEqual(["termless-ghostty-native.node", "README.md"]);
    expect(platform.repository).toEqual({ type: "git", url: "https://github.com/jixoai/agenter" });
    expect(platform.publishConfig).toEqual({ access: "public" });
  });

  test("Scenario: Given npm view output When registry state is classified Then 404 is separate from hard errors", () => {
    expect(classifyRegistryResult({ exitCode: 0, stdout: '"0.0.0"', stderr: "" })).toEqual({
      type: "exists",
      version: "0.0.0",
    });
    expect(classifyRegistryResult({ exitCode: 1, stdout: "", stderr: "npm error code E404" })).toEqual({
      type: "missing",
    });
    expect(classifyRegistryResult({ exitCode: 1, stdout: "", stderr: "npm error code E403" })).toEqual({
      type: "error",
      message: "npm error code E403",
    });
  });

  test("Scenario: Given npm dist-tags output When latest exists Then publication can continue before packument cache settles", () => {
    expect(classifyDistTagResult({ exitCode: 0, stdout: "latest: 0.1.0", stderr: "" })).toEqual({
      type: "exists",
      version: "0.1.0",
    });
    expect(classifyDistTagResult({ exitCode: 0, stdout: "", stderr: "" })).toEqual({ type: "missing" });
  });

  test("Scenario: Given a trusted publisher response When claims match Then trust can be skipped", () => {
    const raw = JSON.stringify({
      type: "github",
      file: "release.yml",
      repository: "jixoai/agenter",
      environment: "npm-release",
      permissions: ["createPackage", "createStagedPackage"],
    });

    expect(trustMatches(raw, { repo: "jixoai/agenter", file: "release.yml", environment: "npm-release" })).toBe(true);
    expect(trustMatches(raw, { repo: "jixoai/agenter", file: "other.yml", environment: "npm-release" })).toBe(false);
  });

  test("Scenario: Given command output contains secrets When redacted Then no token password or OTP leaks", () => {
    const output = "token npm_abc123 password hunter2 otp 123456 authId=97b62083-645c-4ebf-93bd-1b77296cdbcf";

    expect(redact(output, ["hunter2"])).toBe(
      "token npm_<redacted> password <secret> otp <OTP> authId=<redacted>",
    );
  });

  test("Scenario: Given a scoped package name When no dir is provided Then workspace path is derived", () => {
    expect(defaultPackageDir("@jixo/ghostty-native-linux-x64-gnu")).toBe("packages/ghostty-native-linux-x64-gnu");
    expect(defaultPackageDir("agenter")).toBe("packages/agenter");
  });

  test("Scenario: Given staged ghostty platform packages When bootstrap validates them Then file truth matches the publish law", async () => {
    const packageNames = [
      "@jixo/ghostty-native-darwin-arm64",
      "@jixo/ghostty-native-darwin-x64",
      "@jixo/ghostty-native-linux-arm64-gnu",
      "@jixo/ghostty-native-linux-x64-gnu",
      "@jixo/ghostty-native-win32-arm64-msvc",
      "@jixo/ghostty-native-win32-x64-msvc",
    ];

    for (const packageName of packageNames) {
      const manifest = await readManifest(resolve(defaultPackageDir(packageName)));
      expect(() => validateManifest(manifest, packageName)).not.toThrow();
    }
  });

  test("Scenario: Given legacy-env auth publishes a missing package When npm publish runs Then OTP is attached to the publish request as well", () => {
    const workflowSource = readFileSync(resolve("scripts/npm/bootstrap-package/workflow.ts"), "utf8");

    expect(workflowSource).toContain("const publishAuthWithOtp = await authWithOtp(publishAuth);");
    expect(workflowSource).toContain("publishAuthWithOtp.env");
    expect(workflowSource).toContain("publishAuthWithOtp.secrets");
  });
});
