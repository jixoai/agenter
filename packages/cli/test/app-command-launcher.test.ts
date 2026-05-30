import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  applyAppCommandsToYargs,
  buildAppLaunchEnv,
  buildAppProcessCommand,
  isAppMetadataOnlyArgv,
  isBuiltInCommand,
  isLauncherMetadataOnlyCommand,
  readCommandToken,
  resolveAppCommandInvocation,
  resolveAppLaunchTarget,
  selectCompatibleAppPackageVersion,
} from "../src/app-command-launcher";
import { listAppCommandDescriptors, resolveAppCommandDescriptor } from "../src/app-command-registry";
import { launchAppCommandForTest, type AppCommandLaunchDependencies } from "../src/run-cli";
import yargs from "yargs";

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-app-launcher-"));
  tempDirs.push(dir);
  return dir;
};

const createAppLayout = (input: {
  rootKind?: "packages" | "apps" | "extensions";
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
  createAppLayout({
    rootKind: "apps",
    packageSegment: "shell",
    packageName: "agenter-app-shell",
    binName: "agenter-shell",
    binPath: "./src/bin/agenter-shell.ts",
  });

describe("Feature: app command launcher", () => {
  test("Scenario: Given shell argv When resolving app invocation Then the registry stays descriptor-driven and preserves app argv", () => {
    const routed = resolveAppCommandInvocation(["shell", "@default", "--session=2", "--host", "127.0.0.2", "--port", "4600"]);
    expect(routed?.descriptor.packageName).toBe("agenter-app-shell");
    expect(routed?.descriptor.bin.mainExport).toBe("runShell");
    expect(routed?.appArgv).toEqual(["@default", "--session=2"]);
    expect(routed?.launcherOptions.host).toBe("127.0.0.2");
    expect(routed?.launcherOptions.port).toBe(4600);
  });

  test("Scenario: Given studio argv When resolving app invocation Then Studio is descriptor-driven and keeps app-owned flags outside core", () => {
    const routed = resolveAppCommandInvocation(["studio", "--dev", "--web-port", "4173", "--host", "127.0.0.2", "--port", "4600"]);
    expect(routed?.descriptor.packageName).toBe("agenter-app-studio");
    expect(routed?.descriptor.bin.mainExport).toBe("runStudio");
    expect(routed?.appArgv).toEqual(["--dev", "--web-port", "4173"]);
    expect(routed?.launcherOptions.host).toBe("127.0.0.2");
    expect(routed?.launcherOptions.port).toBe(4600);
  });

  test("Scenario: Given removed shell2 argv When resolving app invocation Then the launcher rejects the old incubation command", () => {
    expect(resolveAppCommandInvocation(["shell2", "renderer-grid-demo"])).toBeNull();
    expect(resolveAppCommandDescriptor("shell2")).toBeNull();
  });

  test("Scenario: Given a local app shell package When resolving the launch target Then workspace wins before installed or remote fallback", () => {
    const descriptor = resolveAppCommandDescriptor("shell");
    if (!descriptor) {
      throw new Error("missing shell descriptor");
    }
    const target = resolveAppLaunchTarget(descriptor, { cliSourceDir: createShellLayout() });
    expect(target.source).toBe("workspace");
    if (target.source !== "workspace") {
      return;
    }
    expect(target.binPath.endsWith("apps/shell/src/bin/agenter-shell.ts")).toBe(true);
    expect(target.mainPath.endsWith("apps/shell/src/index.ts")).toBe(true);
  });

  test("Scenario: Given a local workspace Studio app When resolving the launch target Then workspace wins before installed or remote fallback", () => {
    const descriptor = resolveAppCommandDescriptor("studio");
    if (!descriptor) {
      throw new Error("missing studio descriptor");
    }
    const target = resolveAppLaunchTarget(descriptor, {
      cliSourceDir: createAppLayout({
        rootKind: "apps",
        packageSegment: "studio",
        packageName: "agenter-app-studio",
        binName: "agenter-studio",
        binPath: "./src/bin/agenter-studio.ts",
      }),
    });
    expect(target.source).toBe("workspace");
    if (target.source !== "workspace") {
      return;
    }
    expect(target.binPath.endsWith("apps/studio/src/bin/agenter-studio.ts")).toBe(true);
    expect(target.mainPath.endsWith("apps/studio/src/index.ts")).toBe(true);
  });

  test("Scenario: Given only the legacy extensions root has an app package When resolving the launch target Then active workspace resolution ignores it", () => {
    const descriptor = resolveAppCommandDescriptor("shell");
    if (!descriptor) {
      throw new Error("missing shell descriptor");
    }
    const target = resolveAppLaunchTarget(descriptor, {
      cliSourceDir: createAppLayout({
        rootKind: "extensions",
        packageSegment: "shell",
        packageName: "agenter-app-shell",
        binName: "agenter-shell",
        binPath: "./src/bin/agenter-shell.ts",
      }),
      resolveInstalledPackageJsonPath: () => {
        throw new Error("missing installed package");
      },
    });
    expect(target.source).toBe("remote");
  });

  test("Scenario: Given no local package and a resolvable installed package When resolving the launch target Then installed metadata provides the bin path", () => {
    const root = createTempDir();
    const cliSourceDir = join(root, "packages", "cli", "src");
    const installedDir = join(root, "node_modules", "agenter-app-shell");
    mkdirSync(cliSourceDir, { recursive: true });
    mkdirSync(join(installedDir, "src", "bin"), { recursive: true });
    writeFileSync(
      join(installedDir, "package.json"),
      JSON.stringify({
        name: "agenter-app-shell",
        bin: {
          "agenter-shell": "./src/bin/agenter-shell.ts",
        },
      }),
    );
    writeFileSync(join(installedDir, "src", "bin", "agenter-shell.ts"), "console.log('installed')\n");
    const descriptor = resolveAppCommandDescriptor("shell");
    if (!descriptor) {
      throw new Error("missing shell descriptor");
    }
    const target = resolveAppLaunchTarget(descriptor, {
      cliSourceDir,
      resolveInstalledPackageJsonPath: () => join(installedDir, "package.json"),
    });
    expect(target.source).toBe("installed");
    if (target.source !== "installed") {
      return;
    }
    expect(target.binPath.endsWith("node_modules/agenter-app-shell/src/bin/agenter-shell.ts")).toBe(true);
    expect(target.mainPath.endsWith("node_modules/agenter-app-shell/src/index.ts")).toBe(true);
  });

  test("Scenario: Given no resolvable local or installed package When building the remote fallback command Then the configured runner is honored without changing the controlled package name", () => {
    const descriptor = resolveAppCommandDescriptor("shell");
    if (!descriptor) {
      throw new Error("missing shell descriptor");
    }
    const target = resolveAppLaunchTarget(descriptor, {
      cliSourceDir: createTempDir(),
      resolveInstalledPackageJsonPath: () => {
        throw new Error("missing");
      },
    });
    expect(target.source).toBe("remote");
    const command = buildAppProcessCommand(target, descriptor, ["@default", "--session=2"], {
      AGENTER_APP_PACKAGE_RUNNER: "mock-runner",
    });
    expect(command).toEqual([
      "mock-runner",
      "--package",
      "agenter-app-shell",
      "agenter-shell",
      "@default",
      "--session=2",
    ]);
  });

  test("Scenario: Given a compatible remote package version When building the remote fallback command Then the selected package specifier is explicit", () => {
    const descriptor = resolveAppCommandDescriptor("shell");
    if (!descriptor) {
      throw new Error("missing shell descriptor");
    }
    const target = resolveAppLaunchTarget(descriptor, {
      cliSourceDir: createTempDir(),
      hostVersion: "1.0.7",
      resolveInstalledPackageJsonPath: () => {
        throw new Error("missing");
      },
      resolveRemotePackageVersionCandidates: () => [
        { version: "2.0.2", peerDependencies: { agenter: ">=1.0.0 <1.1.0" } },
        { version: "2.0.3", peerDependencies: { agenter: ">=1.0.0 <1.1.0" } },
        { version: "3.0.0", peerDependencies: { agenter: ">=2.0.0 <3.0.0" } },
      ],
    });
    expect(target.source).toBe("remote");
    const command = buildAppProcessCommand(target, descriptor, ["@default"], {
      AGENTER_APP_PACKAGE_RUNNER: "mock-runner",
    });
    expect(command).toEqual([
      "mock-runner",
      "--package",
      "agenter-app-shell@2.0.3",
      "agenter-shell",
      "@default",
    ]);
  });

  test("Scenario: Given app package candidates When selecting for a host Then the highest peer-compatible version wins", () => {
    expect(
      selectCompatibleAppPackageVersion({
        hostVersion: "1.0.7",
        candidates: [
          { version: "1.4.0", peerDependencies: { agenter: "^0.0.6" } },
          { version: "2.0.0", peerDependencies: { agenter: ">=1.0.0 <1.1.0" } },
          { version: "2.1.0", peerDependencies: { agenter: ">=1.0.0 <1.1.0" } },
          { version: "3.0.0", peerDependencies: { agenter: ">=2.0.0 <3.0.0" } },
        ],
      }),
    ).toBe("2.1.0");
  });

  test("Scenario: Given old host app candidates When selecting for an old host Then incompatible newer app lines are ignored", () => {
    expect(
      selectCompatibleAppPackageVersion({
        hostVersion: "0.0.6",
        candidates: [
          { version: "1.5.0", peerDependencies: { agenter: ">=0.0.0 <0.1.0" } },
          { version: "2.0.0", peerDependencies: { agenter: ">=1.0.0 <1.1.0" } },
        ],
      }),
    ).toBe("1.5.0");
  });

  test("Scenario: Given catalog-discovered candidates When selecting for a host Then keywords never replace peer dependency compatibility", () => {
    expect(
      selectCompatibleAppPackageVersion({
        hostVersion: "1.0.7",
        candidates: [
          { version: "9.0.0", discovery: { keywords: ["agenter-app"] } },
          { version: "1.8.0", peerDependencies: { agenter: ">=0.0.0 <0.1.0" } },
          { version: "2.0.0", peerDependencies: { agenter: ">=1.0.0 <1.1.0" } },
        ],
      }),
    ).toBe("2.0.0");
  });

  test("Scenario: Given launcher-owned daemon context When building app env Then the child process receives explicit source and daemon metadata", () => {
    const descriptor = resolveAppCommandDescriptor("shell");
    if (!descriptor) {
      throw new Error("missing shell descriptor");
    }
    const env = buildAppLaunchEnv({
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
    expect(env.AGENTER_APP_COMMAND).toBe("shell");
    expect(env.AGENTER_APP_PACKAGE).toBe("agenter-app-shell");
    expect(env.AGENTER_APP_SOURCE).toBe("workspace");
  });

  test("Scenario: Given launcher-owned daemon context When building Studio env Then the child process receives explicit source and daemon metadata", () => {
    const descriptor = resolveAppCommandDescriptor("studio");
    if (!descriptor) {
      throw new Error("missing studio descriptor");
    }
    const env = buildAppLaunchEnv({
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
    expect(env.AGENTER_APP_COMMAND).toBe("studio");
    expect(env.AGENTER_APP_PACKAGE).toBe("agenter-app-studio");
    expect(env.AGENTER_APP_SOURCE).toBe("workspace");
  });

  test("Scenario: Given the launcher discovers a reused daemon authority When building app env Then the child process receives the resolved authority instead of the default request port", () => {
    const descriptor = resolveAppCommandDescriptor("shell");
    if (!descriptor) {
      throw new Error("missing shell descriptor");
    }
    const env = buildAppLaunchEnv({
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
    expect(readCommandToken(["unknown-app"])).toBe("unknown-app");
    expect(isBuiltInCommand("doctor")).toBe(true);
    expect(isBuiltInCommand("web")).toBe(false);
    expect(isBuiltInCommand("unknown-app")).toBe(false);
    expect(isLauncherMetadataOnlyCommand("--help")).toBe(true);
    expect(isLauncherMetadataOnlyCommand("--version")).toBe(true);
    expect(resolveAppCommandInvocation(["unknown-app"])).toBeNull();
  });

  test("Scenario: Given the top-level CLI help is rendered When app descriptors are applied Then shell and studio appear as orthogonal app commands", async () => {
    const output = await applyAppCommandsToYargs(yargs([]).scriptName("agenter").exitProcess(false)).getHelp();

    expect(String(output)).toContain("shell");
    expect(String(output)).toContain("run Shell terminal workspace");
    expect(String(output)).toContain("studio");
    expect(String(output)).toContain("run Studio web UI");
  });

  test("Scenario: Given app metadata-only argv When classifying launcher bootstrap needs Then help and version requests stay out of daemon/runtime side effects", () => {
    expect(isAppMetadataOnlyArgv(["--help"])).toBe(true);
    expect(isAppMetadataOnlyArgv(["@default", "--version"])).toBe(true);
    expect(isAppMetadataOnlyArgv(["@default", "--session=2"])).toBe(false);
  });

  test("Scenario: Given launcher source is inspected When checking for app-specific runtime branches Then shell grammar and toolbar semantics stay outside core", () => {
    const sourceFiles = [
      join(import.meta.dir, "..", "src", "app-command-registry.ts"),
      join(import.meta.dir, "..", "src", "app-command-launcher.ts"),
      join(import.meta.dir, "..", "src", "run-cli.ts"),
    ];
    const forbiddenTokens = ["shell-assistant", "--session", "managed/takeover", "toolbar"];
    for (const filePath of sourceFiles) {
      const source = readFileSync(filePath, "utf8");
      for (const token of forbiddenTokens) {
        expect(source).not.toContain(token);
      }
    }
    expect(listAppCommandDescriptors().map((descriptor) => descriptor.command)).toEqual(["shell", "studio"]);
  });

  test("Scenario: Given a local app declares an in-process entry When inspecting the launch path Then the launcher can preserve same-process data-plane laws before falling back to child stdio", () => {
    const runCliSource = readFileSync(join(import.meta.dir, "..", "src", "run-cli.ts"), "utf8");
    expect(runCliSource).toContain("runLocalAppInProcess");
    expect(runCliSource).toContain("mainExport");
    expect(runCliSource).toContain('stdin: "inherit"');
    expect(runCliSource).toContain('stdout: "inherit"');
    expect(runCliSource).toContain('stderr: "inherit"');
    expect(runCliSource).toContain("process.exitCode = exitCode");
  });

  test("Scenario: Given workspace Shell has a main export When launching metadata-only shell Then it runs in-process and does not spawn a app child", async () => {
    let daemonChecks = 0;
    let spawned = 0;
    const dependencies: AppCommandLaunchDependencies = {
      async resolveDaemonAuthority() {
        daemonChecks += 1;
        throw new Error("metadata-only app launch must not check daemon health");
      },
      async discoverReusableDaemonAuthority() {
        throw new Error("metadata-only app launch must not discover daemon authority");
      },
      async ensureManagedDaemonAuthority() {
        throw new Error("metadata-only app launch must not ensure managed daemon authority");
      },
      spawnApp() {
        spawned += 1;
        throw new Error("workspace app with mainExport must run in-process before child spawn fallback");
      },
    };

    const handled = await launchAppCommandForTest(["shell", "--version"], dependencies);

    expect(handled).toBe(true);
    expect(daemonChecks).toBe(0);
    expect(spawned).toBe(0);
  });

  test("Scenario: Given app launch ensures managed daemon authority When no auth authority is explicit Then the daemon gets a launcher-owned auth-service root", async () => {
    const home = createTempDir();
    const ensuredAuthorities: Array<Parameters<AppCommandLaunchDependencies["ensureManagedDaemonAuthority"]>> = [];
    const previousHome = process.env.HOME;
    process.env.HOME = home;
    try {
      const dependencies: AppCommandLaunchDependencies = {
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
        spawnApp() {
          throw new Error("app must not spawn after captured daemon startup");
        },
      };

      await expect(launchAppCommandForTest(["shell", "--web=0"], dependencies)).rejects.toThrow(
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

  test("Scenario: Given a reachable daemon belongs to another launcher When launching a app Then the app is not started against the wrong server", async () => {
    const dependencies: AppCommandLaunchDependencies = {
      async resolveDaemonAuthority() {
        throw new Error("daemon launcher mismatch");
      },
      async discoverReusableDaemonAuthority() {
        return null;
      },
      async ensureManagedDaemonAuthority() {
        throw new Error("incompatible daemon must not be replaced implicitly");
      },
      spawnApp() {
        throw new Error("app must not start against an incompatible daemon");
      },
    };

    await expect(launchAppCommandForTest(["shell", "--web=0"], dependencies)).rejects.toThrow(
      "daemon launcher mismatch",
    );
  });
});

afterAll(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});
