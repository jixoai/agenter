import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "bun:test";

import { FilePromptStore, loadPromptDocsByLang } from "@agenter/app-server";

const mkDir = () => {
  const dir = join(process.cwd(), "demo", ".tmp-prompts", `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  mkdirSync(join(dir, "internal"), { recursive: true });
  return dir;
};

test("prompt store loads AGENTER + internal files", async () => {
  const dir = mkDir();
  const agenterPath = join(dir, "AGENTER.mdx");
  const systemPath = join(dir, "internal", "AGENTER_SYSTEM.mdx");
  const templatePath = join(dir, "internal", "SYSTEM_TEMPLATE.mdx");
  const contractPath = join(dir, "internal", "RESPONSE_CONTRACT.mdx");

  writeFileSync(agenterPath, "user-overlay-v1", "utf8");
  writeFileSync(systemPath, "system-v1", "utf8");
  writeFileSync(
    templatePath,
    '<Slot name="AGENTER_SYSTEM" />\n---\n<Slot name="AGENTER" />\n---\n<Slot name="RESPONSE_CONTRACT" />',
    "utf8",
  );
  writeFileSync(contractPath, 'line-a\n<Policy mode="value" key="allowToolWait" />\nline-b', "utf8");

  const store = new FilePromptStore({
    rootDir: dir,
  });
  const first = await store.reload();
  expect(first.docs.AGENTER.content).toBe("user-overlay-v1");
  expect(first.docs.AGENTER_SYSTEM.content).toBe("system-v1");
  expect(first.docs.SYSTEM_TEMPLATE.syntax).toBe("mdx");
  expect(first.docs.SYSTEM_TEMPLATE.content).toContain('<Slot name="AGENTER_SYSTEM" />');
  expect(first.docs.RESPONSE_CONTRACT.syntax).toBe("mdx");
  expect(first.docs.RESPONSE_CONTRACT.content).toContain("allowToolWait");
  expect(store.getDoc("AGENTER").content).toBe("user-overlay-v1");

  await Bun.sleep(2);
  writeFileSync(systemPath, "system-v2", "utf8");
  const second = await store.reload();
  expect(second.docs.AGENTER_SYSTEM.content).toBe("system-v2");
  expect(second.loadedAt).toBeGreaterThan(first.loadedAt);
});

test("prompt store allows empty AGENTER.mdx", async () => {
  const dir = mkDir();
  writeFileSync(join(dir, "AGENTER.mdx"), "", "utf8");
  writeFileSync(join(dir, "internal", "AGENTER_SYSTEM.mdx"), "internal-system", "utf8");

  const store = new FilePromptStore({ rootDir: dir });
  const bundle = await store.reload();
  expect(bundle.docs.AGENTER.content).toBe("");
  expect(bundle.docs.AGENTER_SYSTEM.content).toBe("internal-system");
  expect(bundle.docs.RESPONSE_CONTRACT.content.length).toBeGreaterThan(0);
});

test("language prompts fallback to en when lang is unknown", async () => {
  const docs = await loadPromptDocsByLang({ lang: "unknown-lang" });
  expect(docs.AGENTER_SYSTEM.content).toContain("You are agenter-ai.");
});

test("prompt store uses zh-Hans language pack when configured", async () => {
  const store = new FilePromptStore({ lang: "zh-Hans" });
  const snapshot = await store.reload();
  expect(snapshot.docs.AGENTER_SYSTEM.content).toContain("你是 agenter-ai。");
});
