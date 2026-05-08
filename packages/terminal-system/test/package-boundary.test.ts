import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const packageRoot = join(import.meta.dir, "..");

describe("Feature: terminal-system package boundary", () => {
  test("Scenario: Given terminal-system backend wiring When inspecting package boundaries Then it consumes shared adapters without owning a private backend package", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const xtermBridgeSource = readFileSync(join(packageRoot, "src", "xterm-bridge.ts"), "utf8");

    expect(pkg.dependencies).toEqual({
      "@agenter/managed-seat-invitation-handshake": "workspace:*",
      "@agenter/termless-core": "workspace:*",
      "@agenter/terminal-transport-protocol": "workspace:*",
      "@agenter/principal-crypto": "workspace:*",
      "@opentui/core": "latest",
      "@opentui/react": "latest",
      react: "^19.0.0",
      yargs: "^17.7.2",
    });
    expect(xtermBridgeSource).toContain('from "@agenter/termless-core"');
    expect(xtermBridgeSource).not.toContain("@agenter/termless-xterm-backend");
  });
});
