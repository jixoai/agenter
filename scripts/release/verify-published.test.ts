import { describe, expect, test } from "bun:test";

import { selectPackageDirsForVerification } from "./verify-published";
import type { ReleasePublishReport } from "./publish-bundles";

describe("Feature: published release verification scope", () => {
  test("Scenario: Given no publish report exists When verification scope is resolved Then every release package stays in scope", () => {
    expect(selectPackageDirsForVerification(undefined, ["bundle/agenter", "bundle/agenter-app-shell"])).toEqual([
      "bundle/agenter",
      "bundle/agenter-app-shell",
    ]);
  });

  test("Scenario: Given a release report marks historical packages as skipped-existing When verification scope is resolved Then only packages published in this run are re-verified", () => {
    const report = {
      generatedAt: "2026-06-04T00:00:00.000Z",
      packages: [
        {
          packageDir: "bundle/@jixo/ghostty-native",
          name: "@jixo/ghostty-native",
          status: "skipped-existing",
          version: "0.3.3",
        },
        {
          packageDir: "bundle/agenter",
          name: "agenter",
          status: "published",
          version: "0.0.11",
        },
      ],
    } satisfies ReleasePublishReport;

    expect(
      selectPackageDirsForVerification(report, ["bundle/@jixo/ghostty-native", "bundle/agenter", "bundle/agenter-app-shell"]),
    ).toEqual(["bundle/agenter"]);
  });

  test("Scenario: Given a report contains no newly published packages When verification scope is resolved Then the verifier falls back to the full release order", () => {
    const report = {
      generatedAt: "2026-06-04T00:00:00.000Z",
      packages: [
        {
          packageDir: "bundle/@jixo/ghostty-native",
          name: "@jixo/ghostty-native",
          status: "skipped-existing",
          version: "0.3.3",
        },
      ],
    } satisfies ReleasePublishReport;

    expect(selectPackageDirsForVerification(report, ["bundle/@jixo/ghostty-native", "bundle/agenter"])).toEqual([
      "bundle/@jixo/ghostty-native",
      "bundle/agenter",
    ]);
  });
});
