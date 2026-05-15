import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const packageRoot = join(import.meta.dir, "..");

describe("Feature: agenter publish package", () => {
  test("Scenario: Given the public agenter package When inspecting its release metadata Then the package stays Bun-first with a ts-first binary entry", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      bin?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      files?: string[];
      name?: string;
      private?: boolean;
      scripts?: Record<string, string>;
    };
    const sourceEntry = readFileSync(join(packageRoot, "src", "bin", "agenter.ts"), "utf8");

    expect(pkg.name).toBe("agenter");
    expect(pkg.private).toBeUndefined();
    expect(pkg.bin).toEqual({ agenter: "./src/bin/agenter.ts" });
    expect(pkg.files).toEqual(["SPEC.md", "src"]);
    expect(pkg.dependencies).toEqual({
      "@duckdb/node-api": "^1.5.1-r.1",
    });
    expect(pkg.devDependencies?.["@agenter/cli"]).toBe("workspace:*");
    expect(pkg.dependencies).not.toHaveProperty("@opentui/react");
    expect(pkg.dependencies).not.toHaveProperty("react");
    expect(pkg.scripts?.build).toBeUndefined();
    expect(pkg.scripts?.prepack).toBeUndefined();
    expect(sourceEntry).toContain('from "@agenter/cli"');
  });
});
