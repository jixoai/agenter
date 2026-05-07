import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const packageRoot = join(import.meta.dir, "..");

describe("Feature: cli-shell package boundary", () => {
  test("Scenario: Given the external cli-shell package When inspecting its dependencies Then it consumes daemon-facing contracts without importing core runtime internals", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const argvSource = readFileSync(join(packageRoot, "src", "argv.ts"), "utf8");
    const productSource = readFileSync(join(packageRoot, "src", "product.ts"), "utf8");
    const bootstrapSource = readFileSync(join(packageRoot, "src", "bootstrap.ts"), "utf8");
    const managedSource = readFileSync(join(packageRoot, "src", "managed.ts"), "utf8");
    const runCliShellSource = readFileSync(join(packageRoot, "src", "run-cli-shell.ts"), "utf8");

    expect(pkg.dependencies).toEqual({
      "@agenter/client-sdk": "workspace:*",
      "@agenter/product-extension-runtime": "workspace:*",
      "yargs": "^17.7.2",
    });
    expect(argvSource).toContain("AGENTER_DAEMON_HOST");
    expect(argvSource).toContain("AGENTER_DAEMON_PORT");
    expect(argvSource).toContain("AGENTER_AUTH_SERVICE_ENDPOINT");
    expect(productSource).toContain('from "@agenter/client-sdk"');
    expect(productSource).toContain('from "@agenter/product-extension-runtime"');
    expect(managedSource).toContain('from "@agenter/client-sdk"');
    expect(managedSource).toContain('from "@agenter/product-extension-runtime"');
    expect(managedSource).not.toContain("@agenter/app-server");
    expect(managedSource).not.toContain("session-runtime");
    expect(runCliShellSource).toContain("ws://${args.host}:${args.port}/trpc");
    expect(runCliShellSource).not.toContain("port-file");
    expect(runCliShellSource).not.toContain("daemon-port");
    expect(runCliShellSource).not.toContain(".agenter");
    expect(bootstrapSource).not.toContain("@agenter/app-server");
    expect(bootstrapSource).not.toContain("../app-server");
    expect(bootstrapSource).not.toContain("session-runtime");
    expect(bootstrapSource).not.toContain("app-kernel");
  });
});
