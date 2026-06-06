import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const packageRoot = path.resolve(import.meta.dirname, "..");
const workspaceRoot = path.resolve(packageRoot, "../..");

const collectSourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const absolute = path.join(dir, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      return collectSourceFiles(absolute);
    }
    return /\.(?:ts|svelte)$/u.test(entry) ? [absolute] : [];
  });

describe("Feature: Web heartbeat view package boundary", () => {
  test("Scenario: Given package source When imports are scanned Then Studio is not imported", () => {
    const offenders = collectSourceFiles(path.join(packageRoot, "src")).filter((file) =>
      readFileSync(file, "utf8").includes("apps/studio"),
    );

    expect(offenders).toEqual([]);
  });

  test("Scenario: Given package and example source When imports are scanned Then first-phase code does not require Studio runtime state", () => {
    const sourceRoots = [path.join(packageRoot, "src"), path.join(packageRoot, "example/src")];
    const offenders = sourceRoots
      .flatMap((sourceRoot) => collectSourceFiles(sourceRoot))
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return source.includes("apps/studio") || source.includes("agenter-app-studio");
      })
      .map((file) => path.relative(workspaceRoot, file));

    expect(offenders).toEqual([]);
  });

  test("Scenario: Given package source When transport imports are scanned Then the presentational atom stays host neutral", () => {
    const offenders = collectSourceFiles(path.join(packageRoot, "src"))
      .filter((file) => readFileSync(file, "utf8").includes("@agenter/client-sdk"))
      .map((file) => path.relative(workspaceRoot, file));

    expect(offenders).toEqual([]);
  });
});
