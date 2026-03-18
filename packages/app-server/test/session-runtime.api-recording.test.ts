import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SessionRuntime } from "../src/session-runtime";

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-session-runtime-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: api call recording reference counting", () => {
  test("Scenario: Given multiple subscribers When retain/release are called Then recording follows ref count", () => {
    const root = makeTempDir();
    const runtime = new SessionRuntime({
      sessionId: "session-a",
      cwd: root,
      sessionRoot: root,
      sessionName: "test",
      storeTarget: "global",
    });

    expect(runtime.isApiCallRecordingEnabled()).toBeFalse();

    const retained1 = runtime.retainApiCallRecording();
    expect(retained1.enabled).toBeTrue();
    expect(retained1.refCount).toBe(1);

    const retained2 = runtime.retainApiCallRecording();
    expect(retained2.enabled).toBeTrue();
    expect(retained2.refCount).toBe(2);

    const released1 = runtime.releaseApiCallRecording();
    expect(released1.enabled).toBeTrue();
    expect(released1.refCount).toBe(1);

    const released2 = runtime.releaseApiCallRecording();
    expect(released2.enabled).toBeFalse();
    expect(released2.refCount).toBe(0);

    const released3 = runtime.releaseApiCallRecording();
    expect(released3.enabled).toBeFalse();
    expect(released3.refCount).toBe(0);
  });
});
