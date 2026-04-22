import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InputInbox } from "../src/input-inbox";

const roots: string[] = [];

const createRoot = (): string => {
  const root = join(tmpdir(), `agenter-input-inbox-${crypto.randomUUID()}`);
  roots.push(root);
  mkdirSync(root, { recursive: true });
  return root;
};

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Feature: input inbox polling", () => {
  test("Scenario: Given raw and mixed pending files When scan runs Then the inbox dispatches authoritative suffix modes only", async () => {
    const root = createRoot();
    const inputDir = join(root, "input");
    const pendingDir = join(inputDir, "pending");
    mkdirSync(pendingDir, { recursive: true });

    writeFileSync(join(pendingDir, "001.raw.txt"), "echo raw\\r", "utf8");
    writeFileSync(join(pendingDir, "002.mixed.txt"), "<raw>echo mixed</raw><key data=\"enter\"/>", "utf8");
    writeFileSync(join(pendingDir, "003.txt"), "ignored", "utf8");

    const seen: Array<{ file: string; input: string; mode: "raw" | "mixed" }> = [];
    const inbox = new InputInbox({
      inputDir,
      pollMs: 10,
      onInput: async (input, sourceFile, mode) => {
        seen.push({ file: sourceFile, input, mode });
      },
    });

    inbox.start();
    await Bun.sleep(80);
    inbox.stop();

    expect(seen).toEqual([
      { file: "001.raw.txt", input: "echo raw\\r", mode: "raw" },
      { file: "002.mixed.txt", input: '<raw>echo mixed</raw><key data="enter"/>', mode: "mixed" },
    ]);
  });

  test("Scenario: Given inbox directories disappear while polling When scan runs Then ENOENT is ignored without crashing the process", async () => {
    const root = createRoot();
    const inputDir = join(root, "input");
    const seenErrors: Error[] = [];

    const inbox = new InputInbox({
      inputDir,
      pollMs: 10,
      onInput: async () => {},
      onError: (error) => {
        seenErrors.push(error);
      },
    });

    inbox.start();
    rmSync(inputDir, { recursive: true, force: true });
    await Bun.sleep(30);
    inbox.stop();

    expect(seenErrors).toHaveLength(0);
  });
});
