import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type TrpcServerHandle } from "../src/trpc-server";
import {
  clearOwnedDaemonRuntimeDescriptor,
  readDaemonRuntimeDescriptor,
  resolveDaemonLogDir,
  resolveDaemonLogPath,
  resolveDaemonRuntimeDescriptorPath,
  writeDaemonRuntimeDescriptor,
} from "../src/daemon-runtime-descriptor";
import { startTrpcServer } from "../src/trpc-server";

const tempDirs: string[] = [];
const handles: TrpcServerHandle[] = [];

const createRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "agenter-daemon-runtime-descriptor-"));
  tempDirs.push(root);
  return root;
};

afterEach(async () => {
  while (handles.length > 0) {
    await handles.pop()?.stop();
  }
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() ?? "", { recursive: true, force: true });
  }
});

describe("Feature: daemon runtime descriptor lifecycle", () => {
  test("Scenario: Given a running daemon When it serves one runtime home root Then it writes a reusable descriptor and removes it on owned shutdown", async () => {
    const root = createRoot();
    const homeDir = join(root, "home");
    const descriptorPath = resolveDaemonRuntimeDescriptorPath(homeDir);
    const handle = await startTrpcServer({
      host: "127.0.0.1",
      port: 0,
      workspaceCwd: join(root, "workspace"),
      globalSessionRoot: join(root, "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir,
    });
    handles.push(handle);

    const descriptor = readDaemonRuntimeDescriptor(homeDir);
    expect(descriptor).not.toBeNull();
    expect(descriptor).toMatchObject({
      pid: process.pid,
      host: handle.host,
      port: handle.port,
      endpoint: `http://${handle.host}:${handle.port}`,
      homeDir,
    });
    expect(Number.isNaN(Date.parse(descriptor?.updatedAt ?? ""))).toBe(false);
    expect(existsSync(descriptorPath)).toBe(true);

    await handle.stop();
    handles.pop();

    expect(readDaemonRuntimeDescriptor(homeDir)).toBeNull();
    expect(existsSync(descriptorPath)).toBe(false);
  });

  test("Scenario: Given a different runtime owns the daemon descriptor file When this daemon clears its owned descriptor Then the foreign descriptor remains untouched", () => {
    const root = createRoot();
    const homeDir = join(root, "home");
    const foreignDescriptor = {
      pid: process.pid + 1000,
      host: "127.0.0.1",
      port: 7999,
      endpoint: "http://127.0.0.1:7999",
      homeDir,
      updatedAt: new Date().toISOString(),
    } as const;

    writeDaemonRuntimeDescriptor(foreignDescriptor);

    clearOwnedDaemonRuntimeDescriptor({
      pid: process.pid,
      host: "127.0.0.1",
      port: 4580,
      endpoint: "http://127.0.0.1:4580",
      homeDir,
    });

    expect(readDaemonRuntimeDescriptor(homeDir)).toEqual(foreignDescriptor);
  });

  test("Scenario: Given a background daemon launch When resolving its log path Then diagnostics stay under the runtime home root", () => {
    const root = createRoot();
    const homeDir = join(root, "home");
    const startedAt = new Date("2026-05-25T04:03:02.001Z");

    expect(resolveDaemonLogDir(homeDir)).toBe(join(homeDir, ".agenter", "logs", "daemon"));
    expect(resolveDaemonLogPath(homeDir, { host: "127.0.0.1", port: 4580 }, startedAt)).toBe(
      join(homeDir, ".agenter", "logs", "daemon", "2026-05-25T04-03-02-001Z-127.0.0.1-4580.log"),
    );
    expect(resolveDaemonLogPath(homeDir, { host: "::1", port: 4580 }, startedAt)).toBe(
      join(homeDir, ".agenter", "logs", "daemon", "2026-05-25T04-03-02-001Z-__1-4580.log"),
    );
  });
});
