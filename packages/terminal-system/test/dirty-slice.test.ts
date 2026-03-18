import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "bun:test";

import { AgenticTerminal } from "../src/agentic-terminal";

const waitUntil = async (predicate: () => boolean, timeoutMs = 5000): Promise<void> => {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("timeout waiting condition");
    }
    await Bun.sleep(50);
  }
};

test("markDirty + sliceDirty(wait) advances mark hash", async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "ati-dirty-slice-"));
  const terminal = new AgenticTerminal(
    "node",
    ["-e", "process.stdin.on('data', d => process.stdout.write(String(d).toUpperCase()))"],
    {
      outputRoot,
      gitLog: "normal",
      cols: 80,
      rows: 20,
    },
  );

  terminal.start();
  await waitUntil(() => terminal.workspace.length > 0);
  await Bun.sleep(200);

  const mark = await terminal.markDirty();
  expect(mark.ok).toBe(true);
  expect(mark.hash).not.toBeNull();

  terminal.writeRaw("ping\n");
  const sliced = await terminal.sliceDirty({ wait: true, timeoutMs: 5000, pollMs: 100, remark: true });
  expect(sliced.ok).toBe(true);
  expect(sliced.changed).toBe(true);
  expect(sliced.fromHash).not.toBeNull();
  expect(sliced.toHash).not.toBeNull();
  expect(sliced.fromHash).not.toBe(sliced.toHash);
  expect(sliced.diff.length).toBeGreaterThan(0);

  const next = await terminal.sliceDirty({ remark: true });
  expect(next.ok).toBe(true);
  expect(next.fromHash).toBe(sliced.toHash);

  await terminal.destroy(true);
  rmSync(outputRoot, { recursive: true, force: true });
});
