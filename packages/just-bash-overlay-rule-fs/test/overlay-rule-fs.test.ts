import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { OverlayRuleFs, type OverlayRuleRecordLike } from "../src";

const createRule = (
  pattern: string,
  mode: "ro" | "rw",
  ruleIndex: number,
): OverlayRuleRecordLike => ({
  grantId: `grant-${ruleIndex}`,
  pattern,
  mode,
  ruleIndex,
  createdAt: new Date(ruleIndex).toISOString(),
});

describe("Feature: overlay rule fs", () => {
  test("Scenario: Given ordered glob rules When a narrower later rule allows generated output Then the later rule wins", async () => {
    const root = await mkdtemp(join(tmpdir(), "overlay-rule-fs-"));
    await mkdir(join(root, "src", "generated"), { recursive: true });
    await mkdir(join(root, "src", "manual"), { recursive: true });

    const fs = new OverlayRuleFs({
      root,
      config: {
        rules: [createRule("/src/**", "ro", 0), createRule("/src/generated/**", "rw", 1)],
      },
    });

    await fs.writeFile("/src/generated/out.txt", "generated\n");
    expect(await fs.readFile("/src/generated/out.txt")).toBe("generated\n");
    await expect(fs.writeFile("/src/manual/out.txt", "manual\n")).rejects.toThrow("EACCES");
  });

  test("Scenario: Given denied sibling directories When listing the root Then only traversable children stay visible", async () => {
    const root = await mkdtemp(join(tmpdir(), "overlay-rule-fs-"));
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "docs"), { recursive: true });

    const fs = new OverlayRuleFs({
      root,
      config: {
        rules: [createRule("/src/**", "ro", 0)],
      },
    });

    expect(await fs.readdir("/")).toEqual(["src"]);
  });

  test("Scenario: Given hidden sibling private drawers When one avatar has broad root access Then the hidden drawer still stays invisible", async () => {
    const root = await mkdtemp(join(tmpdir(), "overlay-rule-fs-"));
    await mkdir(join(root, ".agenter", "avatars", "by-principal", "alice"), { recursive: true });
    await mkdir(join(root, ".agenter", "avatars", "by-principal", "bob"), { recursive: true });
    await writeFile(join(root, ".agenter", "avatars", "by-principal", "alice", "private.txt"), "alice\n");
    await writeFile(join(root, ".agenter", "avatars", "by-principal", "bob", "private.txt"), "bob\n");

    const fs = new OverlayRuleFs({
      root,
      config: {
        rules: [createRule("/", "rw", 0)],
        hiddenPaths: ["/.agenter/avatars/by-principal/bob"],
      },
    });

    expect(await fs.readFile("/.agenter/avatars/by-principal/alice/private.txt")).toBe("alice\n");
    await expect(fs.readFile("/.agenter/avatars/by-principal/bob/private.txt")).rejects.toThrow("EACCES");
  });

  test("Scenario: Given one mounted filesystem instance When the host updates rules Then later reads use the new rules", async () => {
    const root = await mkdtemp(join(tmpdir(), "overlay-rule-fs-"));
    await mkdir(join(root, "notes"), { recursive: true });
    await writeFile(join(root, "notes", "todo.md"), "ship it\n");

    const fs = new OverlayRuleFs({
      root,
      config: {
        rules: [],
      },
    });

    await expect(fs.readFile("/notes/todo.md")).rejects.toThrow("EACCES");
    fs.setRules([createRule("/notes/**", "ro", 0)]);
    expect(await fs.readFile("/notes/todo.md")).toBe("ship it\n");
  });
});
