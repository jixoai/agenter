import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { mdxToMd } from "../src";

test("supports custom tag transform", async () => {
  const result = await mdxToMd('<Memory topic="api" />', {
    defaultTagPolicy: "remove",
    tagTransforms: {
      Memory: ({ attributes }) => `> Memory topic: ${String(attributes.topic ?? "unknown")}`,
    },
  });

  expect(result.markdown).toBe("> Memory topic: api");
});

test("custom transform reads file with allow list", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mdx2md-"));
  const filePath = join(dir, "note.md");
  writeFileSync(filePath, "hello-safe-file\n", "utf8");

  const result = await mdxToMd('<ReadFile path="note.md" />', {
    cwd: dir,
    security: {
      allowFileDirs: [dir],
    },
    tagTransforms: {
      ReadFile: async ({ attributes, resources }) => {
        const path = String(attributes.path ?? "");
        return resources.readFileText(path);
      },
    },
  });

  expect(result.markdown).toContain("hello-safe-file");
});

test("custom transform blocks file outside allow list", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mdx2md-"));
  const outsideDir = mkdtempSync(join(tmpdir(), "mdx2md-outside-"));
  const outsideFile = join(outsideDir, "forbidden.md");
  writeFileSync(outsideFile, "forbidden\n", "utf8");

  const run = mdxToMd('<ReadFile path="../mdx2md-outside-file/forbidden.md" />', {
    cwd: dir,
    security: {
      allowFileDirs: [dir],
    },
    tagTransforms: {
      ReadFile: async ({ resources }) => resources.readFileText(outsideFile),
    },
  });

  await expect(run).rejects.toThrow("security blocked file access");
});
