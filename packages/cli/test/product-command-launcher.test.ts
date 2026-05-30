import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  applyProductCommandsToYargs,
  buildProductLaunchEnv,
  buildProductProcessCommand,
  isBuiltInCommand,
  isLauncherMetadataOnlyCommand,
  isProductMetadataOnlyArgv,
  readCommandToken,
  resolveProductCommandInvocation,
  resolveProductLaunchTarget,
} from "../src/product-command-launcher";
import { listProductCommandDescriptors, resolveProductCommandDescriptor } from "../src/product-command-registry";
import { launchProductCommandForTest, type ProductCommandLaunchDependencies } from "../src/run-cli";
import yargs from "yargs";

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-product-launcher-"));
  tempDirs.push(dir);
  return dir;
};

const createProductLayout = (input: {
  rootKind?: "packages" | "extensions";
  packageSegment: string;
  packageName: string;
  binName: string;
  binPath: string;
}): string => {
  const root = createTempDir();
  const cliSourceDir = join(root, "packages", "cli", "src");
  const packageDir = join(root, input.rootKind ?? "packages", input.packageSegment);
  mkdirSync(cliSourceDir, { recursive: true });
  mkdirSync(join(packageDir, "src", "bin"), { recursive: true });
  writeFileSync(
    join(packageDir, "package.json"),
    JSON.stringify({
      name: input.packageName,
      bin: {
        [input.binName]: input.binPath,
      },
    }),
  );
  writeFileSync(join(packageDir, input.binPath), "console.log('ok')\n");
  return cliSourceDir;
};

const createShellLayout = (): string =>
  createProductLayout({
    rootKind: "extensions",
    packageSegment: "shell",
    packageName: "agenter-ext-shell",
    binName: "agenter-shell",
    binPath: "./src/bin/agenter-shell.ts",
  });

describe("Feature: product command launcher", () => {
  test("Scenario: Given shell argv When resolving product invocation Then the registry stays descriptor-driven and preserves product argv", () => {
    const routed = resolveProductCommandInvocation(["shell", "@default", "--session=2", "--host", "127.0.0.2", "--port", "4600"]);
    expect(routed?.descriptor.packageName).toBe("agenter-ext-shell");
    expect(routed?.descriptor.bin.mainExport).toBe("runShell");
    expect(routed?.productArgv).toEqual(["@default", "--session=2"]);
    expect(routed?.launcherOptions.host).toBe("127.0.0.2");
    expect(routed?.launcherOptions.port).toBe(4600);
  });

  test("Scenario: Given studio argv When resolving product invocation Then Studio is descriptor-driven and keeps product-owned flags outside core", () => {
    const routed = resolveProductCommandInvocation(["studio", "--dev", "--web-port", "4173", "--host", "127.0.0.2", "--port", "4600"]);
    expect(routed?.descriptor.packageName).toBe("agenter-ext-studio");
    expect(routed?.descriptor.bin.mainExport).toBe("runStudio");
    expect(routed?.productArgv).toEqual(["--dev", "--web-port", "4173"]);
    expect(routed?.launcherOptions.host).toBe("127.0.0.2");
    expect(routed?.launcherOptions.port).toBe(4600);
  });

  test("Scenario: Given removed shell2 argv When resolving product invocation Then the launcher rejects the old incubation command", () => {
    expect(resolveProductCommandInvocation(["shell2", "renderer-grid-demo"])).toBeNull();
    expect(resolveProductCommandDescriptor("shell2")).toBeNull();
  });

  test("Scenario: Given a local extension shell package When resolving the launch target Then workspace wins before installed or remote fallback", () => {
    const descriptor = resolveProductCommandDescriptor("shell");
    if (!descriptor) {
      throw new Error("missing shell descriptor");
    }
    const target = resolveProductLaunchTarget(descriptor, { cliSourceDir: createShellLayout() });
    expect(target.source).toBe("workspace");
    if (target.source !== "workspace") {
      return;
    }
    expect(target.binPath.endsWith("extensions/shell/src/bin/agenter-shell.ts")).toBe(true);
    expect(target.mainPath.endsWith("extensions/shell/src/index.ts")).toBe(true);
  });

  test("Scenario: Given a local workspace Studio package When resolving the launch target Then workspace wins before installed or remote fallback", () => {
    const descriptor = resolveProductCommandDescriptor("studio");
    if (!descriptor) {
      throw new Error("missing studio descriptor");
    }
    const target = resolveProductLaunchTarget(descriptor, {
      cliSourceDir: createProductLayout({
        rootKind: "extensions",
        packageSegment: "studio",
        packageName: "agenter-ext-studio",
        binName: "agenter-studio",
        binPath: "./src/bin/agenter-studio.ts",
      }),
    });
    expect(target.source).toBe("workspace");
    if (target.source !== "workspace") {
      return;
    }
    expect(target.binPath.endsWith("extensions/studio/src/bin/agenter-studio.ts")).toBe(true);
    expect(target.mainPath.endsWith("extensions/studio/src/index.ts")).toBe(true);
  });

  test("Scenario: Given no local package and a resolvable installed package When resolving the launch target Then installed metadata provides the bin path", () => {
    const root = createTempDir();
    const cliSourceDir = join(root, "packages", "cli", "src");
    const installedDir = join(root, "node_modules", "agenter-ext-shell");
    mkdirSync(cliSourceDir, { recursive: true });
    mkdirSync(join(installedDir, "src", "bin"), { recursive: true });
    writeFileSync(
      join(installedDir, "package.json"),
      JSON.stringify({
        name: "agenter-ext-shell",
        bin: {
          "agenter-shell": "./src/bin/agenter-shell.ts",
        },
      }),
    );
    writeFileSync(join(installedDir, "src", "bin", "agenter-shell.ts"), "console.log('installed')\n");
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
    expect(target.binPath.endsWith("node_modules/agenter-ext-shell/src/bin/agenter-shell.ts")).toBe(true);
    expect(target.mainPath.endsWith("node_modules/agenter-ext-shell/src/index.ts")).toBe(true);
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
      "agenter-ext-shell",
      "agenter-shell",
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
    expect(env.AGENTER_PRODUCT_PACKAGE).toBe("agenter-ext-shell");
    expect(env.AGENTER_PRODUCT_SOURCE).toBe("workspace");
  });

  test("Scenario: Given launcher-owned daemon context When building Studio env Then the child process receives explicit source and daemon metadata", () => {
    const descriptor = resolveProductCommandDescriptor("studio");
    if (!descriptor) {
      throw new Error("missing studio descriptor");
    }
    const env = buildProductLaunchEnv({
      descriptor,
      source: "workspace",
      launcherOptions: {
        host: "127.0.0.1",
        port: 4580,
      },
      baseEnv: {},
    });
    expect(env.AGENTER_DAEMON_HOST).toBe("127.0.0.1");
    expect(env.AGENTER_DAEMON_PORT).toBe("4580");
    expect(env.AGENTER_PRODUCT_COMMAND).toBe("studio");
    expect(env.AGENTER_PRODUCT_PACKAGE).toBe("agenter-ext-studio");
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
    expect(isBuiltInCommand("web")).toBe(false);
    expect(isBuiltInCommand("unknown-product")).toBe(false);
    expect(isLauncherMetadataOnlyCommand("--help")).toBe(true);
    expect(isLauncherMetadataOnlyCommand("--version")).toBe(true);
    expect(resolveProductCommandInvocation(["unknown-product"])).toBeNull();
  });

  test("Scenario: Given the top-level CLI help is rendered When product descriptors are applied Then shell and studio appear as orthogonal product commands", async () => {
    const output = await applyProductCommandsToYargs(yargs([]).scriptName("agenter").exitProcess(false)).getHelp();

    expect(String(output)).toContain("shell");
    expect(String(output)).toContain("run Shell terminal workspace");
    expect(String(output)).toContain("studio");
    expect(String(output)).toContain("run Studio web UI");
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
    expect(listProductCommandDescriptors().map((descriptor) => descriptor.command)).toEqual(["shell", "studio"]);
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

  test("Scenario: Given workspace Shell has a main export When launching metadata-only shell Then it runs in-process and does not spawn a product child", async () => {
    let daemonChecks = 0;
    let spawned = 0;
    const dependencies: ProductCommandLaunchDependencies = {
      async resolveDaemonAuthority() {
        daemonChecks += 1;
        throw new Error("metadata-only product launch must not check daemon health");
      },
      async discoverReusableDaemonAuthority() {
        throw new Error("metadata-only product launch must not discover daemon authority");
      },
      async ensureManagedDaemonAuthority() {
        throw new Error("metadata-only product launch must not ensure managed daemon authority");
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

  test("Scenario: Given product launch ensures managed daemon authority When no auth authority is explicit Then the daemon gets a launcher-owned auth-service root", async () => {
    const home = createTempDir();
    const ensuredAuthorities: Array<Parameters<ProductCommandLaunchDependencies["ensureManagedDaemonAuthority"]>> = [];
    const previousHome = process.env.HOME;
    process.env.HOME = home;
    try {
      const dependencies: ProductCommandLaunchDependencies = {
        async resolveDaemonAuthority() {
          return null;
        },
        async discoverReusableDaemonAuthority() {
          return null;
        },
        async ensureManagedDaemonAuthority(...input) {
          ensuredAuthorities.push(input);
          throw new Error("stop after daemon authority input capture");
        },
        spawnProduct() {
          throw new Error("product must not spawn after captured daemon startup");
        },
      };

      await expect(launchProductCommandForTest(["shell", "--web=0"], dependencies)).rejects.toThrow(
        "stop after daemon authority input capture",
      );

      expect(ensuredAuthorities).toHaveLength(1);
      expect(ensuredAuthorities[0]?.[0].authServiceDataDir).toBe(join(home, ".agenter", "launcher-auth-service"));
    } finally {
      if (typeof previousHome === "string") {
        process.env.HOME = previousHome;
      } else {
        delete process.env.HOME;
      }
    }
  });

  test("Scenario: Given a reachable daemon belongs to another launcher When launching a product Then the product is not started against the wrong server", async () => {
    const dependencies: ProductCommandLaunchDependencies = {
      async resolveDaemonAuthority() {
        throw new Error("daemon launcher mismatch");
      },
      async discoverReusableDaemonAuthority() {
        return null;
      },
      async ensureManagedDaemonAuthority() {
        throw new Error("incompatible daemon must not be replaced implicitly");
      },
      spawnProduct() {
        throw new Error("product must not start against an incompatible daemon");
      },
    };

    await expect(launchProductCommandForTest(["shell", "--web=0"], dependencies)).rejects.toThrow(
      "daemon launcher mismatch",
    );
  });
});

afterAll(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});
