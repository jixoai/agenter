import { describe, expect, test } from "bun:test";

import {
  ghosttyNativeTargets,
  resolveGhosttyNativePackageTarget,
  resolveGhosttyNativeTarget,
} from "./artifacts";

describe("Feature: ghostty-native binary artifact topology", () => {
  test("Scenario: Given phase-1 platform packages When targets are enumerated Then each host maps one-to-one to a package-owned binary slot", () => {
    expect(ghosttyNativeTargets).toHaveLength(6);
    expect(ghosttyNativeTargets.map((target) => target.packageName)).toEqual([
      "@jixo/ghostty-native-darwin-arm64",
      "@jixo/ghostty-native-darwin-x64",
      "@jixo/ghostty-native-linux-arm64-gnu",
      "@jixo/ghostty-native-linux-x64-gnu",
      "@jixo/ghostty-native-win32-arm64-msvc",
      "@jixo/ghostty-native-win32-x64-msvc",
    ]);
  });

  test("Scenario: Given platform packages When artifact paths are generated Then staged binaries land inside package-owned paths", () => {
    const darwin = resolveGhosttyNativeTarget("darwin", "arm64");
    const linux = resolveGhosttyNativeTarget("linux", "x64");
    const windows = resolveGhosttyNativeTarget("win32", "x64");

    expect(darwin.artifactPath).toBe("packages/ghostty-native-darwin-arm64/termless-ghostty-native.node");
    expect(linux.artifactPath).toBe("packages/ghostty-native-linux-x64-gnu/termless-ghostty-native.node");
    expect(windows.artifactPath).toBe("packages/ghostty-native-win32-x64-msvc/termless-ghostty-native.node");
  });

  test("Scenario: Given an unsupported host When target resolution runs Then the error is explicit", () => {
    expect(() => resolveGhosttyNativeTarget("freebsd", "x64")).toThrow("unsupported ghostty-native platform");
    expect(() => resolveGhosttyNativeTarget("linux", "riscv64")).toThrow("unsupported ghostty-native architecture");
  });

  test("Scenario: Given CI stages foreign artifacts When package target is explicit Then host platform is irrelevant", () => {
    const target = resolveGhosttyNativePackageTarget("win32", "arm64");

    expect(target.artifactPath).toBe("packages/ghostty-native-win32-arm64-msvc/termless-ghostty-native.node");
  });
});
