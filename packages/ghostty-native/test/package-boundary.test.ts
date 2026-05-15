import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const packageRoot = join(import.meta.dir, "..");

describe("Feature: ghostty-native package boundary", () => {
  test("Scenario: Given the workspace ghostty-native mirror When inspecting its package and build files Then it stays TS-first and owns a minimal ghostty-vt build graph", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      name: string;
      exports?: Record<string, string>;
      files?: string[];
      scripts?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const buildScript = readFileSync(join(packageRoot, "build", "build.sh"), "utf8");
    const nativeBuild = readFileSync(join(packageRoot, "native", "build.zig"), "utf8");
    const nativeManifest = readFileSync(join(packageRoot, "native", "build.zig.zon"), "utf8");
    const entrySource = readFileSync(join(packageRoot, "src", "index.ts"), "utf8");
    const backendSource = readFileSync(join(packageRoot, "src", "backend.ts"), "utf8");

    expect(pkg.name).toBe("@termless/ghostty-native");
    expect(pkg.exports).toEqual({ ".": "./src/index.ts" });
    expect(pkg.files).toEqual(["README.md", "src", "build", "native", "vendor"]);
    expect(pkg.scripts).toEqual({
      "build:ghostty-native": "bash build/build.sh",
      typecheck: "bunx tsc -p tsconfig.typecheck.json --noEmit",
    });
    expect(pkg.peerDependencies).toEqual({ "@termless/core": "*" });

    expect(entrySource).toContain('from "@termless/core"');
    expect(backendSource).toContain('from "@termless/core"');
    expect(backendSource).toContain("createRequire");
    expect(buildScript).toContain("/tmp/zig-0.15.2/zig");
    expect(buildScript).toContain("ghostty-vt minimal dependency graph");
    expect(nativeBuild).toContain('root_source_file = b.path(".ghostty-src/src/lib_vt.zig")');
    expect(nativeBuild).toContain('build_options.addOption(bool, "simd", false)');
    expect(nativeBuild).toContain('terminal_options.add(b, ghostty_module)');
    expect(nativeManifest).toContain('.path = "../vendor/napigen"');
    expect(nativeManifest).toContain('.path = "../vendor/uucode"');
  });
});
