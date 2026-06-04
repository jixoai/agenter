import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  agenterCliTargets,
  createAgenterCliNativeArtifactPath,
  resolveAgenterCliTargetById,
  resolveCurrentAgenterCliTarget,
} from "./agenter-cli-artifacts";
import {
  buildAgenterCliBinaries,
  buildAgenterCliBinary,
  buildAgenterCliCompileCommand,
  resolveBuildAgenterCliOutputPath,
  resolveBuildAgenterCliTargets,
} from "./build-agenter-cli";

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-native-cli-build-"));
  tempDirs.push(dir);
  return dir;
};

const findFreePort = async (): Promise<number> =>
  await new Promise<number>((resolveReady, rejectReady) => {
    const server = createServer();
    server.once("error", rejectReady);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => rejectReady(new Error("failed to allocate port")));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) {
          rejectReady(error);
          return;
        }
        resolveReady(port);
      });
    });
  });

const waitFor = async (predicate: () => boolean | Promise<boolean>, timeoutMs = 20_000): Promise<void> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolveLater) => setTimeout(resolveLater, 100));
  }
  throw new Error("timeout waiting for condition");
};

const waitForHealth = async (host: string, port: number, timeoutMs = 20_000): Promise<void> => {
  await waitFor(async () => {
    try {
      const response = await fetch(`http://${host}:${port}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }, timeoutMs);
};

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() ?? "", { recursive: true, force: true });
  }
});

describe("Feature: agenter native CLI build staging", () => {
  test("Scenario: Given maintainers need a local binary proof path When root scripts are inspected Then host-only smoke stays one command away", () => {
    const packageJson = JSON.parse(readFileSync(resolve(import.meta.dir, "../..", "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["release:build-native-cli:host-smoke"]).toBe(
      "bun run scripts/binaries/build-agenter-cli.ts --stage-package",
    );
    expect(packageJson.scripts?.["release:build-native-cli:all-targets"]).toBe(
      "bun run scripts/binaries/build-agenter-cli.ts --all-targets",
    );
  });

  test("Scenario: Given a target is resolved for package staging When the output path is derived Then the compiled binary lands inside the target-owned bin slot", () => {
    const root = "/repo";
    const target = resolveAgenterCliTargetById("linux-x64-musl");

    expect(resolveBuildAgenterCliOutputPath(target, { root, stagePackage: true })).toBe(
      "/repo/packages/agenter-cli-linux-x64-musl/bin/agenter",
    );
    expect(resolveBuildAgenterCliOutputPath(target, { root, stagePackage: false })).toBe(
      resolve(createAgenterCliNativeArtifactPath("/repo/native-artifacts", target)),
    );
  });

  test("Scenario: Given release archives need canonical build inputs When build targets are resolved Then the full target matrix is returned without ad hoc per-script drift", () => {
    expect(resolveBuildAgenterCliTargets({ allTargets: true }).map((target) => target.targetId)).toEqual(
      agenterCliTargets.map((target) => target.targetId),
    );
    expect(() => resolveBuildAgenterCliTargets({ allTargets: true, targetId: "darwin-arm64" })).toThrow(
      "build-agenter-cli cannot combine --all-targets with --target-id",
    );
    expect(() => resolveBuildAgenterCliTargets({ allTargets: true, output: "/tmp/agenter" })).toThrow(
      "build-agenter-cli cannot combine --all-targets with --output",
    );
  });

  test("Scenario: Given a target is compiled When the build command is generated Then Bun compile stays aligned with the target matrix truth", () => {
    const target = resolveAgenterCliTargetById("win32-arm64");
    const outputPath = "native-artifacts/agenter-cli-win32-arm64/agenter.exe";

    expect(buildAgenterCliCompileCommand(target, outputPath)).toEqual([
      "bun",
      "build",
      resolve(import.meta.dir, "../..", "packages/cli/src/bin/agenter.ts"),
      "--compile",
      "--target",
      "bun-windows-arm64",
      "--outfile",
      outputPath,
    ]);
  });

  test("Scenario: Given all-target release build runs When the build loop executes Then every result lands under native-artifacts for canonical archive packaging", async () => {
    const outputRoot = createTempDir();
    const results = await buildAgenterCliBinaries({
      allTargets: true,
      root: outputRoot,
    });

    expect(results).toHaveLength(agenterCliTargets.length);
    expect(results.map((result) => result.target.targetId)).toEqual(agenterCliTargets.map((target) => target.targetId));
    expect(results.every((result) => existsSync(result.outputPath))).toBe(true);
    expect(
      results.map((result) => result.outputPath).every((outputPath) => outputPath.includes("/native-artifacts/agenter-cli-")),
    ).toBe(true);
  }, 240_000);

  test("Scenario: Given host-only smoke build runs When the current host target is compiled Then a real executable is emitted without touching package staging", async () => {
    const outputRoot = createTempDir();
    const target = resolveCurrentAgenterCliTarget();
    const outputPath = join(outputRoot, target.binaryName);

    const result = await buildAgenterCliBinary({
      output: outputPath,
      targetId: target.targetId,
    });

    expect(result.target.targetId).toBe(target.targetId);
    expect(result.outputPath).toBe(resolve(outputPath));
    expect(existsSync(result.outputPath)).toBe(true);
  }, 120_000);

  test("Scenario: Given a compiled native CLI When asking for version Then the binary projects the public agenter release identity", async () => {
    const outputRoot = createTempDir();
    const target = resolveCurrentAgenterCliTarget();
    const outputPath = join(outputRoot, target.binaryName);
    const agenterPackageJson = JSON.parse(readFileSync(resolve(import.meta.dir, "../..", "packages/agenter/package.json"), "utf8")) as {
      version: string;
    };

    await buildAgenterCliBinary({
      output: outputPath,
      targetId: target.targetId,
    });

    const proc = Bun.spawn({
      cmd: [outputPath, "--version"],
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout.trim()).toBe(agenterPackageJson.version);
  }, 120_000);

  test("Scenario: Given a compiled native CLI daemon When inspecting health Then package launcher identity follows the public agenter release", async () => {
    const outputRoot = createTempDir();
    const homeDir = createTempDir();
    const target = resolveCurrentAgenterCliTarget();
    const outputPath = join(outputRoot, target.binaryName);
    const agenterPackageJson = JSON.parse(readFileSync(resolve(import.meta.dir, "../..", "packages/agenter/package.json"), "utf8")) as {
      name: string;
      version: string;
    };
    const host = "127.0.0.1";
    const port = await findFreePort();

    await buildAgenterCliBinary({
      output: outputPath,
      targetId: target.targetId,
    });

    const startProc = Bun.spawn({
      cmd: [outputPath, "daemon", "start", "--host", host, "--port", String(port)],
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        HOME: homeDir,
      },
    });
    const [startStdout, startStderr, startExitCode] = await Promise.all([
      new Response(startProc.stdout).text(),
      new Response(startProc.stderr).text(),
      startProc.exited,
    ]);
    expect(startExitCode).toBe(0);
    expect(startStderr).toBe("");
    expect(startStdout).toContain(`agenter daemon started in background on ${host}:${port}`);

    await waitForHealth(host, port);
    const healthPayload = (await (await fetch(`http://${host}:${port}/health`)).json()) as {
      launcher: {
        entrypoint: string;
        packageName: string;
        packageVersion: string;
        sourceKind: string;
      };
    };
    expect(healthPayload.launcher).toEqual({
      entrypoint: `${agenterPackageJson.name}@${agenterPackageJson.version}`,
      packageName: agenterPackageJson.name,
      packageVersion: agenterPackageJson.version,
      sourceKind: "package",
    });

    const stopProc = Bun.spawn({
      cmd: [outputPath, "daemon", "stop", "--host", host, "--port", String(port)],
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        HOME: homeDir,
      },
    });
    const [stopStdout, stopStderr, stopExitCode] = await Promise.all([
      new Response(stopProc.stdout).text(),
      new Response(stopProc.stderr).text(),
      stopProc.exited,
    ]);
    expect(stopExitCode).toBe(0);
    expect(stopStderr).toBe("");
    expect(stopStdout).toContain(`stopped agenter daemon on ${host}:${port}`);
  }, 120_000);
});
