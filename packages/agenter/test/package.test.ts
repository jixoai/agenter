import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const packageRoot = join(import.meta.dir, "..");

describe("Feature: agenter publish package", () => {
  test("Scenario: Given the public agenter package When inspecting its release metadata Then npm users receive a bundled wrapper instead of private workspace dependencies", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      bin?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      files?: string[];
      name?: string;
      private?: boolean;
      scripts?: Record<string, string>;
    };
    const wrapperSource = readFileSync(join(packageRoot, "bin", "agenter.js"), "utf8");
    const sourceEntry = readFileSync(join(packageRoot, "src", "bin", "agenter.ts"), "utf8");

    expect(pkg.name).toBe("agenter");
    expect(pkg.private).toBeUndefined();
    expect(pkg.bin).toEqual({ agenter: "./bin/agenter.js" });
    expect(pkg.files).toEqual(["SPEC.md", "bin", "dist"]);
    expect(pkg.dependencies).toEqual({
      "@duckdb/node-api": "^1.5.1-r.1",
      "@opentui/core": "latest",
      "@opentui/react": "latest",
      react: "^19.0.0",
    });
    expect(pkg.devDependencies?.["@agenter/cli"]).toBe("workspace:*");
    expect(pkg.scripts?.build).toBe("bun run ./scripts/build.ts");
    expect(pkg.scripts?.prepack).toBe("bun run build");
    expect(wrapperSource).toContain("../dist/agenter.js");
    expect(wrapperSource).toContain("../src/bin/agenter.ts");
    expect(wrapperSource).toContain("existsSync(fileURLToPath(sourceEntry)) ? sourceEntry.href : distEntry.href");
    expect(sourceEntry).toContain('from "@agenter/cli"');
  });
});
