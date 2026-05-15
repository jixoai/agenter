import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildProductLaunchEnv,
  buildProductProcessCommand,
  isBuiltInCommand,
  isProductMetadataOnlyArgv,
  readCommandToken,
  resolveProductCommandInvocation,
  resolveProductLaunchTarget,
} from "../src/product-command-launcher";
import { listProductCommandDescriptors, resolveProductCommandDescriptor } from "../src/product-command-registry";
import { launchProductCommandForTest, type ProductCommandLaunchDependencies } from "../src/run-cli";

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-product-launcher-"));
  tempDirs.push(dir);
  return dir;
};

const createCliLayout = (): string => {
  const root = createTempDir();
  const cliSourceDir = join(root, "packages", "cli", "src");
  const packageDir = join(root, "packages", "cli-shell");
  mkdirSync(cliSourceDir, { recursive: true });
  mkdirSync(join(packageDir, "src", "bin"), { recursive: true });
  writeFileSync(
    join(packageDir, "package.json"),
    JSON.stringify({
      name: "@agenter/cli-shell",
      bin: {
        "agenter-cli-shell": "./src/bin/agenter-cli-shell.ts",
      },
    }),
  );
  writeFileSync(join(packageDir, "src", "bin", "agenter-cli-shell.ts"), "console.log('ok')\n");
  return cliSourceDir;
};

describe("Feature: product command launcher", () => {
  test("Scenario: Given shell argv When resolving product invocation Then the registry stays descriptor-driven and preserves product argv", () => {
    const routed = resolveProductCommandInvocation(["shell", "@default", "--session=2", "--host", "127.0.0.2", "--port", "4600"]);
    expect(routed?.descriptor.packageName).toBe("@agenter/cli-shell");
    expect(routed?.descriptor.bin.mainExport).toBe("runCliShell");
    expect(routed?.productArgv).toEqual(["@default", "--session=2"]);
    expect(routed?.launcherOptions.host).toBe("127.0.0.2");
    expect(routed?.launcherOptions.port).toBe(4600);
  });

  test("Scenario: Given a local workspace cli-shell package When resolving the launch target Then workspace wins before installed or remote fallback", () => {
    const descriptor = resolveProductCommandDescriptor("shell");
    if (!descriptor) {
      throw new Error("missing shell descriptor");
    }
    const target = resolveProductLaunchTarget(descriptor, { cliSourceDir: createCliLayout() });
    expect(target.source).toBe("workspace");
    if (target.source !== "workspace") {
      return;
    }
    expect(target.binPath.endsWith("packages/cli-shell/src/bin/agenter-cli-shell.ts")).toBe(true);
    expect(target.mainPath.endsWith("packages/cli-shell/src/index.ts")).toBe(true);
  });

  test("Scenario: Given no local package and a resolvable installed package When resolving the launch target Then installed metadata provides the bin path", () => {
    const root = createTempDir();
    const cliSourceDir = join(root, "packages", "cli", "src");
    const installedDir = join(root, "node_modules", "@agenter", "cli-shell");
    mkdirSync(cliSourceDir, { recursive: true });
    mkdirSync(join(installedDir, "src", "bin"), { recursive: true });
    writeFileSync(
      join(installedDir, "package.json"),
      JSON.stringify({
        name: "@agenter/cli-shell",
        bin: {
          "agenter-cli-shell": "./src/bin/agenter-cli-shell.ts",
        },
      }),
    );
    writeFileSync(join(installedDir, "src", "bin", "agenter-cli-shell.ts"), "console.log('installed')\n");
    const descriptor = resolveProductCommandDescriptor("shell");
    if (!descriptor) {
      throw new Error("missing shell descriptor");
    }
    const target = resolveProductLaunchTarget(descriptor, {
      cliSourceDir,
      resolveInstalledPackageJsonPath: () => join(installedDir, "package.json"),
    });
    expect(target.source).toBe("installed");
    if (target.source !== "installed") {
      return;
    }
    expect(target.binPath.endsWith("node_modules/@agenter/cli-shell/src/bin/agenter-cli-shell.ts")).toBe(true);
    expect(target.mainPath.endsWith("node_modules/@agenter/cli-shell/src/index.ts")).toBe(true);
  });

  test("Scenario: Given no resolvable local or installed package When building the remote fallback command Then the configured runner is honored without changing the controlled package name", () => {
    const descriptor = resolveProductCommandDescriptor("shell");
    if (!descriptor) {
      throw new Error("missing shell descriptor");
    }
    const target = resolveProductLaunchTarget(descriptor, {
      cliSourceDir: createTempDir(),
      resolveInstalledPackageJsonPath: () => {
        throw new Error("missing");
      },
    });
    expect(target.source).toBe("remote");
    const command = buildProductProcessCommand(target, descriptor, ["@default", "--session=2"], {
      AGENTER_PRODUCT_PACKAGE_RUNNER: "mock-runner",
    });
    expect(command).toEqual([
      "mock-runner",
      "--package",
      "@agenter/cli-shell",
      "agenter-cli-shell",
      "@default",
      "--session=2",
    ]);
  });

  test("Scenario: Given launcher-owned daemon context When building product env Then the child process receives explicit source and daemon metadata", () => {
    const descriptor = resolveProductCommandDescriptor("shell");
    if (!descriptor) {
      throw new Error("missing shell descriptor");
    }
    const env = buildProductLaunchEnv({
      descriptor,
      source: "workspace",
      launcherOptions: {
        host: "127.0.0.1",
        port: 4580,
        authServiceEndpoint: "http://127.0.0.1:4591",
      },
      baseEnv: {},
    });
    expect(env.AGENTER_DAEMON_HOST).toBe("127.0.0.1");
    expect(env.AGENTER_DAEMON_PORT).toBe("4580");
    expect(env.AGENTER_AUTH_SERVICE_ENDPOINT).toBe("http://127.0.0.1:4591");
    expect(env.AGENTER_PRODUCT_COMMAND).toBe("shell");
    expect(env.AGENTER_PRODUCT_PACKAGE).toBe("@agenter/cli-shell");
    expect(env.AGENTER_PRODUCT_SOURCE).toBe("workspace");
  });

  test("Scenario: Given the launcher discovers a reused daemon authority When building product env Then the child process receives the resolved authority instead of the default request port", () => {
    const descriptor = resolveProductCommandDescriptor("shell");
    if (!descriptor) {
      throw new Error("missing shell descriptor");
    }
    const env = buildProductLaunchEnv({
      descriptor,
      source: "workspace",
      launcherOptions: {
        host: "127.0.0.1",
        port: 47231,
      },
      baseEnv: {},
    });
    expect(env.AGENTER_DAEMON_HOST).toBe("127.0.0.1");
    expect(env.AGENTER_DAEMON_PORT).toBe("47231");
  });

  test("Scenario: Given unsupported input When classifying the command token Then built-ins remain separate and arbitrary package execution is rejected", () => {
    expect(readCommandToken(["unknown-product"])).toBe("unknown-product");
    expect(isBuiltInCommand("doctor")).toBe(true);
    expect(isBuiltInCommand("unknown-product")).toBe(false);
    expect(resolveProductCommandInvocation(["unknown-product"])).toBeNull();
  });

  test("Scenario: Given product metadata-only argv When classifying launcher bootstrap needs Then help and version requests stay out of daemon/runtime side effects", () => {
    expect(isProductMetadataOnlyArgv(["--help"])).toBe(true);
    expect(isProductMetadataOnlyArgv(["@default", "--version"])).toBe(true);
    expect(isProductMetadataOnlyArgv(["@default", "--session=2"])).toBe(false);
  });

  test("Scenario: Given launcher source is inspected When checking for product-specific runtime branches Then shell grammar and toolbar semantics stay outside core", () => {
    const sourceFiles = [
      join(import.meta.dir, "..", "src", "product-command-registry.ts"),
      join(import.meta.dir, "..", "src", "product-command-launcher.ts"),
      join(import.meta.dir, "..", "src", "run-cli.ts"),
    ];
    const forbiddenTokens = ["shell-assistant", "--session", "managed/takeover", "toolbar"];
    for (const filePath of sourceFiles) {
      const source = readFileSync(filePath, "utf8");
      for (const token of forbiddenTokens) {
        expect(source).not.toContain(token);
      }
    }
    expect(listProductCommandDescriptors().map((descriptor) => descriptor.command)).toContain("shell");
  });

  test("Scenario: Given a local product declares an in-process entry When inspecting the launch path Then the launcher can preserve same-process data-plane laws before falling back to child stdio", () => {
    const runCliSource = readFileSync(join(import.meta.dir, "..", "src", "run-cli.ts"), "utf8");
    expect(runCliSource).toContain("runLocalProductInProcess");
    expect(runCliSource).toContain("mainExport");
    expect(runCliSource).toContain('stdin: "inherit"');
    expect(runCliSource).toContain('stdout: "inherit"');
    expect(runCliSource).toContain('stderr: "inherit"');
    expect(runCliSource).toContain("process.exitCode = exitCode");
  });

  test("Scenario: Given workspace cli-shell has a main export When launching metadata-only shell Then it runs in-process and does not spawn a product child", async () => {
    let daemonChecks = 0;
    let spawned = 0;
    const dependencies: ProductCommandLaunchDependencies = {
      async isDaemonAlive() {
        daemonChecks += 1;
        throw new Error("metadata-only product launch must not check daemon health");
      },
      async discoverReusableDaemonAuthority() {
        throw new Error("metadata-only product launch must not discover daemon authority");
      },
      async startDaemon() {
        throw new Error("metadata-only product launch must not start daemon");
      },
      spawnProduct() {
        spawned += 1;
        throw new Error("workspace product with mainExport must run in-process before child spawn fallback");
      },
    };

    const handled = await launchProductCommandForTest(["shell", "--version"], dependencies);

    expect(handled).toBe(true);
    expect(daemonChecks).toBe(0);
    expect(spawned).toBe(0);
  });
});

afterAll(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});
