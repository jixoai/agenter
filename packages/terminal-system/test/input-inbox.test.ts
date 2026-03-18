import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
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
  test("Scenario: Given inbox directories disappear while polling When scan runs Then ENOENT is ignored without crashing the process", async () => {
    const root = createRoot();
    const inputDir = join(root, "input");
    const seenErrors: Error[] = [];

    const inbox = new InputInbox({
      inputDir,
      pollMs: 10,
      onMixedInput: async () => {},
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
