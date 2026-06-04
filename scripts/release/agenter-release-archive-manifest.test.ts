import { describe, expect, test } from "bun:test";

import {
  createAgenterReleaseArchiveManifest,
  createAgenterReleaseArchiveUrl,
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
      releaseTag: "v0.0.10",
      version: "0.0.10",
      archives: [
        {
          archiveBinaryPath: "agenter",
          archiveFileName: "agenter-darwin-arm64.tar.gz",
          archiveSha256: "abc123",
          archiveUrl: "https://example.invalid/agenter-darwin-arm64.tar.gz",
          homebrewBinaryPath: "agenter",
          packageName: "@jixoai/cli-darwin-arm64",
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

  test("Scenario: Given the canonical release law is rendered When the manifest is created Then every target gets the fixed archive naming and projection metadata", () => {
    const manifest = createAgenterReleaseArchiveManifest({
      releaseTag: "v0.0.10",
      version: "0.0.10",
      archiveSha256ByTargetId: {
        "darwin-arm64": "sha-darwin-arm64",
        "darwin-x64": "sha-darwin-x64",
        "linux-arm64-gnu": "sha-linux-arm64-gnu",
        "linux-arm64-musl": "sha-linux-arm64-musl",
        "linux-x64-gnu": "sha-linux-x64-gnu",
        "linux-x64-musl": "sha-linux-x64-musl",
        "win32-arm64": "sha-win32-arm64",
        "win32-x64": "sha-win32-x64",
      },
    });

    expect(manifest.archives).toHaveLength(8);
    expect(resolveReleaseArchiveRecord(manifest, { targetId: "darwin-arm64" })).toMatchObject({
      archiveFileName: "agenter-darwin-arm64.tar.gz",
      archiveBinaryPath: "agenter",
      archiveUrl: "https://github.com/jixoai/agenter/releases/download/v0.0.10/agenter-darwin-arm64.tar.gz",
      homebrewBinaryPath: "agenter",
      packageName: "@jixoai/cli-darwin-arm64",
      packageBinaryPath: "bin/agenter",
    });
    expect(resolveReleaseArchiveRecord(manifest, { targetId: "win32-x64" })).toMatchObject({
      archiveFileName: "agenter-win32-x64.zip",
      archiveBinaryPath: "agenter.exe",
      archiveUrl: "https://github.com/jixoai/agenter/releases/download/v0.0.10/agenter-win32-x64.zip",
      homebrewBinaryPath: "agenter.exe",
      packageName: "@jixoai/cli-win32-x64",
      packageBinaryPath: "bin/agenter.exe",
    });
  });

  test("Scenario: Given the release URL is derived When owner or repo overrides are supplied Then the canonical archive location stays explicit", () => {
    expect(
      createAgenterReleaseArchiveUrl({
        archiveFileName: "agenter-darwin-arm64.tar.gz",
        owner: "acme",
        repo: "alt-agenter",
        releaseTag: "v1.2.3",
      }),
    ).toBe("https://github.com/acme/alt-agenter/releases/download/v1.2.3/agenter-darwin-arm64.tar.gz");
  });
});
