import { describe, expect, test } from "bun:test";

import { resolveAgenterCliTargetById } from "../binaries/agenter-cli-artifacts";
import {
  assertPackedFilesEqual,
  expectedAgenterPlatformPackedFiles,
  expectedAgenterWrapperPackedFiles,
} from "./verify-agenter-cli-packages";

describe("Feature: agenter native CLI package verification", () => {
  test("Scenario: Given the public agenter wrapper is packed When the verifier derives expected files Then the fixed wrapper surface is explicit", () => {
    expect(expectedAgenterWrapperPackedFiles()).toEqual([
      "bin/agenter.exe",
      "CHANGELOG.md",
      "cli-wrapper.cjs",
      "install.cjs",
      "native-platform.cjs",
      "package.json",
      "SPEC.md",
    ]);
  });

  test("Scenario: Given one platform package is packed When expected files are derived Then only the target-owned binary surface is accepted", () => {
    const target = resolveAgenterCliTargetById("win32-x64");

    expect(expectedAgenterPlatformPackedFiles(target)).toEqual(["bin/agenter.exe", "package.json", "README.md"]);
  });

  test("Scenario: Given a package pack result drifts When verification runs Then the mismatch is explicit", () => {
    expect(() =>
      assertPackedFilesEqual(
        "agenter wrapper",
        [{ path: "package.json" }, { path: "README.md" }],
        expectedAgenterWrapperPackedFiles(),
      ),
    ).toThrow("agenter wrapper packed files mismatch");
  });
});
