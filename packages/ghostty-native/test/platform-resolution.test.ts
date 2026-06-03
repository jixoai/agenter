import { describe, expect, test } from "bun:test";

import {
  GHOSTTY_NATIVE_SUPPORTED_TARGETS,
  assertSupportedGhosttyNativePlatformPackage,
  resolveGhosttyNativePlatformPackageName,
} from "../src";

describe("Feature: ghostty-native platform package resolution", () => {
  test("Scenario: Given a supported phase-1 host When runtime resolution maps the umbrella package Then the matching platform package stays explicit", () => {
    expect(GHOSTTY_NATIVE_SUPPORTED_TARGETS).toEqual([
      "darwin/arm64",
      "darwin/x64",
      "linux/arm64",
      "linux/x64",
      "win32/arm64",
      "win32/x64",
    ]);
    expect(resolveGhosttyNativePlatformPackageName("darwin", "arm64")).toBe("@jixo/ghostty-native-darwin-arm64");
    expect(resolveGhosttyNativePlatformPackageName("darwin", "x64")).toBe("@jixo/ghostty-native-darwin-x64");
    expect(resolveGhosttyNativePlatformPackageName("linux", "arm64")).toBe("@jixo/ghostty-native-linux-arm64-gnu");
    expect(resolveGhosttyNativePlatformPackageName("linux", "x64")).toBe("@jixo/ghostty-native-linux-x64-gnu");
    expect(resolveGhosttyNativePlatformPackageName("win32", "arm64")).toBe("@jixo/ghostty-native-win32-arm64-msvc");
    expect(resolveGhosttyNativePlatformPackageName("win32", "x64")).toBe("@jixo/ghostty-native-win32-x64-msvc");
    expect(assertSupportedGhosttyNativePlatformPackage("linux", "x64")).toBe("@jixo/ghostty-native-linux-x64-gnu");
  });

  test("Scenario: Given an unsupported host requests ghostty-native When runtime resolution checks the target Then the error is explicit instead of silently building", () => {
    expect(resolveGhosttyNativePlatformPackageName("linux", "riscv64")).toBeNull();
    expect(() => assertSupportedGhosttyNativePlatformPackage("linux", "riscv64")).toThrow(
      "unsupported ghostty-native platform: linux/riscv64",
    );
  });
});
