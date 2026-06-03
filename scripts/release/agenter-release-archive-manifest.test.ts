import { describe, expect, test } from "bun:test";

import {
  createReleaseArchiveIndex,
  homebrewProjectionTargets,
  resolveReleaseArchiveRecord,
  type AgenterReleaseArchiveManifest,
} from "./agenter-release-archive-manifest";

describe("Feature: agenter release archive manifest contract", () => {
  test("Scenario: Given Homebrew consumes the release archive truth When projection targets are enumerated Then unsupported runtime surfaces stay explicit", () => {
    expect(homebrewProjectionTargets.map((target) => target.targetId)).toEqual([
      "darwin-arm64",
      "darwin-x64",
      "linux-arm64-gnu",
      "linux-x64-gnu",
    ]);
  });

  test("Scenario: Given a manifest is indexed When one target is resolved Then the archive mapping stays explicit and machine-readable", () => {
    const manifest: AgenterReleaseArchiveManifest = {
      releaseTag: "v0.0.8",
      version: "0.0.8",
      archives: [
        {
          archiveFileName: "agenter-darwin-arm64.tar.gz",
          archiveSha256: "abc123",
          archiveUrl: "https://example.invalid/agenter-darwin-arm64.tar.gz",
          homebrewBinaryPath: "agenter",
          packageBinaryPath: "bin/agenter",
          targetId: "darwin-arm64",
        },
      ],
    };

    expect(createReleaseArchiveIndex(manifest).get("darwin-arm64")?.archiveSha256).toBe("abc123");
    expect(resolveReleaseArchiveRecord(manifest, { targetId: "darwin-arm64" }).archiveFileName).toBe(
      "agenter-darwin-arm64.tar.gz",
    );
    expect(() => resolveReleaseArchiveRecord(manifest, { targetId: "linux-x64-gnu" })).toThrow(
      "release archive manifest is missing target linux-x64-gnu",
    );
  });
});
