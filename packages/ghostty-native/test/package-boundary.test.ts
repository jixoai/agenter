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
      optionalDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const buildScript = readFileSync(join(packageRoot, "build", "build.sh"), "utf8");
    const nativeBuild = readFileSync(join(packageRoot, "native", "build.zig"), "utf8");
    const nativeManifest = readFileSync(join(packageRoot, "native", "build.zig.zon"), "utf8");
    const entrySource = readFileSync(join(packageRoot, "src", "index.ts"), "utf8");
    const backendSource = readFileSync(join(packageRoot, "src", "backend.ts"), "utf8");

    expect(pkg.name).toBe("@jixo/ghostty-native");
    expect(pkg.exports).toEqual({ ".": "./src/index.ts" });
    expect(pkg.files).toEqual(["README.md", "src"]);
    expect(pkg.scripts).toEqual({
      "build:ghostty-native": "bash build/build.sh",
      typecheck: "bunx tsc -p tsconfig.typecheck.json --noEmit",
    });
    expect(pkg.peerDependencies).toEqual({ "@termless/core": "*" });
    expect(pkg.optionalDependencies).toEqual({
      "@jixo/ghostty-native-darwin-arm64": "workspace:*",
      "@jixo/ghostty-native-darwin-x64": "workspace:*",
      "@jixo/ghostty-native-linux-arm64-gnu": "workspace:*",
      "@jixo/ghostty-native-linux-x64-gnu": "workspace:*",
      "@jixo/ghostty-native-win32-arm64-msvc": "workspace:*",
      "@jixo/ghostty-native-win32-x64-msvc": "workspace:*",
    });

    expect(entrySource).toContain('from "@termless/core"');
    expect(backendSource).toContain('from "@termless/core"');
    expect(entrySource).toContain("resolveGhosttyNativePlatformPackageName");
    expect(backendSource).toContain("createRequire");
    expect(backendSource).toContain("@jixo/ghostty-native-linux-x64-gnu");
    expect(backendSource).toContain("unsupported ghostty-native platform");
    expect(backendSource).toContain("platform package unavailable");
    expect(backendSource).toContain("../native/zig-out/lib/termless-ghostty-native.node");
    expect(buildScript).toContain('ZIG_VERSION="0.15.2"');
    expect(buildScript).toContain("https://ziglang.org/download/$ZIG_VERSION/");
    expect(buildScript).toContain('RELEASE_ZIG_ROOT="/tmp/zig-$ZIG_VERSION"');
    expect(buildScript).toContain("ghostty-vt minimal dependency graph");
    expect(buildScript).toContain('if [[ "$ZIG_EXT" == ".zip" ]]; then');
    expect(buildScript).toContain("Expand-Archive -LiteralPath");
    expect(buildScript).toContain('ARCHIVE_PATH_WIN="$(cygpath -w "$ARCHIVE_PATH")"');
    expect(nativeBuild).toContain('root_source_file = b.path(".ghostty-src/src/lib_vt.zig")');
    expect(nativeBuild).toContain('build_options.addOption(bool, "simd", false)');
    expect(nativeBuild).toContain('terminal_options.add(b, ghostty_module)');
    expect(nativeManifest).toContain('.path = "../vendor/napigen"');
    expect(nativeManifest).toContain('.path = "../vendor/uucode"');
  });
});
