import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const packageRoot = join(import.meta.dir, "..");

describe("Feature: tui-bak package boundary", () => {
  test("Scenario: Given the archived agenter tui-bak package When inspecting the renderer boundary Then it still records the old OpenTUI renderer contract", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      name?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const runner = readFileSync(join(packageRoot, "src", "run-tui.ts"), "utf8");

    expect(pkg.name).toBe("@agenter/tui-bak");
    expect(pkg.dependencies).toEqual({
      "@agenter/client-sdk": "workspace:*",
      "@opentui/core": "0.3.0",
    });
    expect(pkg.dependencies).not.toHaveProperty("@opentui/react");
    expect(pkg.dependencies).not.toHaveProperty("react");
    expect(pkg.devDependencies).toEqual({
      "@types/bun": "latest",
      typescript: "latest",
    });
    expect(runner).toContain('from "@opentui/core"');
    expect(runner).not.toContain("@opentui/react");
    expect(runner).not.toContain("createRoot(");
    expect(runner).not.toContain("React.createElement");
  });
});
