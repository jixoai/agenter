import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const packageRoot = join(import.meta.dir, "..");

describe("Feature: demo package boundary", () => {
  test("Scenario: Given the demo workspace package When inspecting TUI dependencies Then it stays OpenTUI core only", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const entry = readFileSync(join(packageRoot, "src", "app", "core-demo-app.ts"), "utf8");

    expect(pkg.dependencies).toEqual({
      "@agenter/app-server": "workspace:*",
      "@agenter/settings": "workspace:*",
      "@agenter/terminal-system": "workspace:*",
      "@opentui/core": "latest",
      "@tanstack/ai": "^0.6.1",
      "@xterm/headless": "latest",
      zod: "^4.0.0",
    });
    expect(pkg.dependencies).not.toHaveProperty("@opentui/react");
    expect(pkg.dependencies).not.toHaveProperty("react");
    expect(pkg.devDependencies).toEqual({
      "@types/bun": "latest",
      typescript: "latest",
    });
    expect(entry).toContain('from "@opentui/core"');
    expect(entry).not.toContain("@opentui/react");
    expect(entry).not.toContain("createRoot(");
    expect(entry).not.toContain("React.createElement");
    expect(existsSync(join(packageRoot, "bun.lock"))).toBe(false);
    expect(existsSync(join(packageRoot, "src", "index.tsx"))).toBe(false);
    expect(existsSync(join(packageRoot, "src", "index.terminal-devtools.tsx"))).toBe(false);
    expect(existsSync(join(packageRoot, "src", "index.iflow-devtools.tsx"))).toBe(false);
  });
});
