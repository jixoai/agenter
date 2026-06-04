import { describe, expect, test } from "bun:test";

import { readPublishedPackageWithRetry, selectPackageDirsForVerification } from "./verify-published";
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

  test("Scenario: Given a rerun report contains no newly published packages When verification scope is resolved Then the verifier keeps scope at the current attempt write set instead of widening to historical packages", () => {
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

    expect(selectPackageDirsForVerification(report, ["bundle/@jixo/ghostty-native", "bundle/agenter"])).toEqual([]);
  });

  test("Scenario: Given npm registry propagation lags a newly published package When release verification reads package metadata Then bounded E404 retries wait for the visible version instead of failing immediately", async () => {
    const calls: string[] = [];
    const sleeps: number[] = [];
    let attempts = 0;

    const payload = await readPublishedPackageWithRetry("agenter", "0.0.12", {
      retryDelaysMs: [10, 20],
      runView: async () => {
        calls.push("runView");
        attempts += 1;
        if (attempts < 3) {
          throw new Error("npm view failed for agenter@0.0.12: npm error code E404\nnpm error 404 No match found for version 0.0.12");
        }
        return { version: "0.0.12" };
      },
      sleep: async (delayMs) => {
        sleeps.push(delayMs);
      },
    });

    expect(payload.version).toBe("0.0.12");
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([10, 20]);
  });

  test("Scenario: Given npm view fails for a non-propagation reason When release verification reads package metadata Then the verifier fails immediately instead of masking the publish error", async () => {
    const sleeps: number[] = [];

    await expect(
      readPublishedPackageWithRetry("agenter", "0.0.12", {
        retryDelaysMs: [10, 20],
        runView: async () => {
          throw new Error("npm view failed for agenter@0.0.12: npm error code E403");
        },
        sleep: async (delayMs) => {
          sleeps.push(delayMs);
        },
      }),
    ).rejects.toThrow("npm error code E403");
    expect(sleeps).toEqual([]);
  });
});
