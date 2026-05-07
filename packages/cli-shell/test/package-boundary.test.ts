import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const packageRoot = join(import.meta.dir, "..");

describe("Feature: cli-shell package boundary", () => {
  test("Scenario: Given the external cli-shell package When inspecting its dependencies Then it consumes daemon-facing contracts without importing core runtime internals", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const source = readFileSync(join(packageRoot, "src", "index.ts"), "utf8");

    expect(pkg.dependencies).toEqual({
      "@agenter/client-sdk": "workspace:*",
      "@agenter/product-extension-runtime": "workspace:*",
    });
    expect(source).toContain('from "@agenter/client-sdk"');
    expect(source).toContain('from "@agenter/product-extension-runtime"');
    expect(source).not.toContain("@agenter/app-server");
    expect(source).not.toContain("../app-server");
    expect(source).not.toContain("session-runtime");
    expect(source).not.toContain("app-kernel");
  });
});
