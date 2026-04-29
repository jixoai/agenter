import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AuthServiceHandle, AuthServiceRuntimeDescriptor } from "../src";
import {
  readAuthServiceRuntimeDescriptor,
  resolveAuthServiceRuntimeDescriptorPath,
  startAuthServiceServer,
  writeAuthServiceRuntimeDescriptor,
} from "../src";

const handles: AuthServiceHandle[] = [];
const tempDirs: string[] = [];

const createDataDir = (): string => {
  const dataDir = mkdtempSync(join(tmpdir(), "auth-service-runtime-descriptor-"));
  tempDirs.push(dataDir);
  return dataDir;
};

const trackHandle = (handle: AuthServiceHandle): AuthServiceHandle => {
  handles.push(handle);
  return handle;
};

const untrackHandle = (handle: AuthServiceHandle): void => {
  const handleIndex = handles.indexOf(handle);
  if (handleIndex >= 0) {
    handles.splice(handleIndex, 1);
  }
};

afterEach(async () => {
  while (handles.length > 0) {
    await handles.pop()?.stop();
  }
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() ?? "", { recursive: true, force: true });
  }
});

describe("Feature: auth-service runtime descriptor lifecycle", () => {
  test("Scenario: Given a running auth-service When it starts serving one authority root Then it writes a reusable descriptor and removes it on owned shutdown", async () => {
    const dataDir = createDataDir();
    const descriptorPath = resolveAuthServiceRuntimeDescriptorPath(dataDir);
    const handle = trackHandle(
      await startAuthServiceServer({
        dataDir,
        host: "127.0.0.1",
        port: 0,
      }),
    );

    const descriptor = readAuthServiceRuntimeDescriptor(dataDir);
    expect(descriptor).not.toBeNull();
    expect(descriptor).toMatchObject({
      pid: process.pid,
      endpoint: `http://${handle.host}:${handle.port}`,
      dataDir,
      rootAuthKeyPath: join(dataDir, "root-auth.key"),
    } satisfies Partial<AuthServiceRuntimeDescriptor>);
    expect(Number.isNaN(Date.parse(descriptor?.updatedAt ?? ""))).toBe(false);
    expect(existsSync(descriptorPath)).toBe(true);

    await handle.stop();
    untrackHandle(handle);

    expect(readAuthServiceRuntimeDescriptor(dataDir)).toBeNull();
    expect(existsSync(descriptorPath)).toBe(false);
  });

  test("Scenario: Given a different runtime owns the descriptor file When this auth-service stops Then it leaves the foreign descriptor untouched", async () => {
    const dataDir = createDataDir();
    const handle = trackHandle(
      await startAuthServiceServer({
        dataDir,
        host: "127.0.0.1",
        port: 0,
      }),
    );
    const foreignDescriptor: AuthServiceRuntimeDescriptor = {
      pid: process.pid + 1000,
      endpoint: "http://127.0.0.1:7999",
      dataDir,
      rootAuthKeyPath: join(dataDir, "foreign-root-auth.key"),
      updatedAt: new Date().toISOString(),
    };

    writeAuthServiceRuntimeDescriptor(foreignDescriptor);

    await handle.stop();
    untrackHandle(handle);

    expect(readAuthServiceRuntimeDescriptor(dataDir)).toEqual(foreignDescriptor);
  });
});
