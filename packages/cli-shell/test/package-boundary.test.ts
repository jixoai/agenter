import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const packageRoot = join(import.meta.dir, "..");

describe("Feature: cli-shell package boundary", () => {
  test("Scenario: Given the external cli-shell package When inspecting its dependencies Then it consumes daemon-facing contracts without importing core runtime internals", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      bin?: Record<string, string>;
      files?: string[];
      private?: boolean;
      publishConfig?: { access?: string };
      scripts?: Record<string, string>;
    };
    const binSource = readFileSync(join(packageRoot, "src", "bin", "agenter-cli-shell.ts"), "utf8");
    const argvSource = readFileSync(join(packageRoot, "src", "argv.ts"), "utf8");
    const productSource = readFileSync(join(packageRoot, "src", "product.ts"), "utf8");
    const bootstrapSource = readFileSync(join(packageRoot, "src", "bootstrap.ts"), "utf8");
    const managedSource = readFileSync(join(packageRoot, "src", "managed.ts"), "utf8");
    const tuiAppSource = readFileSync(join(packageRoot, "src", "tui", "app.tsx"), "utf8");
    const tuiRunnerSource = readFileSync(join(packageRoot, "src", "tui", "run-cli-shell-tui.tsx"), "utf8");
    const liveMirrorSource = readFileSync(join(packageRoot, "src", "tui", "live-terminal-mirror.ts"), "utf8");
    const runCliShellSource = readFileSync(join(packageRoot, "src", "run-cli-shell.ts"), "utf8");

    expect(pkg.dependencies).toEqual({
      "@agenter/client-sdk": "workspace:*",
      "@agenter/product-extension-runtime": "workspace:*",
      "@agenter/termless-core": "workspace:*",
      "@agenter/terminal-transport-protocol": "workspace:*",
      "@opentui/core": "latest",
      "@opentui/react": "latest",
      react: "^19.0.0",
      "string-width": "^7.2.0",
      "yargs": "^17.7.2",
    });
    expect(pkg.devDependencies?.["@agenter/client-sdk"]).toBeUndefined();
    expect(pkg.devDependencies?.["@agenter/product-extension-runtime"]).toBeUndefined();
    expect(pkg.private).toBeUndefined();
    expect(pkg.bin).toEqual({ "agenter-cli-shell": "./src/bin/agenter-cli-shell.ts" });
    expect(pkg.files).toEqual(["SPEC.md", "src"]);
    expect(pkg.publishConfig).toEqual({ access: "public" });
    expect(pkg.scripts?.build).toBeUndefined();
    expect(pkg.scripts?.prepack).toBeUndefined();
    expect(binSource).toContain('await runCliShell(process.argv)');
    expect(argvSource).toContain("AGENTER_DAEMON_HOST");
    expect(argvSource).toContain("AGENTER_DAEMON_PORT");
    expect(argvSource).toContain("AGENTER_AUTH_SERVICE_ENDPOINT");
    expect(productSource).toContain('from "@agenter/client-sdk"');
    expect(productSource).toContain('from "@agenter/product-extension-runtime"');
    expect(managedSource).toContain('from "@agenter/client-sdk"');
    expect(managedSource).toContain('from "@agenter/product-extension-runtime"');
    expect(managedSource).not.toContain("@agenter/app-server");
    expect(managedSource).not.toContain("session-runtime");
    expect(tuiAppSource).toContain('from "@opentui/react"');
    expect(tuiRunnerSource).toContain('from "@opentui/core"');
    expect(tuiRunnerSource).toContain('from "@opentui/react"');
    expect(liveMirrorSource).toContain('from "@agenter/terminal-transport-protocol"');
    expect(liveMirrorSource).toContain('from "@agenter/termless-core"');
    expect(liveMirrorSource).not.toContain("@agenter/termless-xterm-backend");
    expect(liveMirrorSource).not.toContain("@agenter/app-server");
    expect(liveMirrorSource).not.toContain("session-runtime");
    expect(tuiAppSource).not.toContain("@agenter/tui");
    expect(tuiRunnerSource).not.toContain("@agenter/tui");
    expect(runCliShellSource).toContain("ws://${args.host}:${args.port}/trpc");
    expect(runCliShellSource).toContain('await import("./tui/run-cli-shell-tui")');
    expect(runCliShellSource).not.toContain('import { startCliShellTui } from "./tui/run-cli-shell-tui"');
    expect(runCliShellSource).not.toContain("port-file");
    expect(runCliShellSource).not.toContain("daemon-port");
    expect(runCliShellSource).not.toContain(".agenter");
    expect(bootstrapSource).not.toContain("@agenter/app-server");
    expect(bootstrapSource).not.toContain("../app-server");
    expect(bootstrapSource).not.toContain("session-runtime");
    expect(bootstrapSource).not.toContain("app-kernel");
  });
});
