import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { FilePromptStore } from "../src/prompt-store";

describe("Feature: prompt store URL Slot composition", () => {
  test("Scenario: Given prompt files use URL Slots When AGENTER.mdx is rendered Then public private super and file sources compose from the configured roots", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-prompt-store-"));
    const layerRoot = join(baseDir, "layer");
    const homeRoot = join(baseDir, "home");
    const publicRoot = join(layerRoot, ".agenter");
    const globalPublicRoot = join(homeRoot, ".agenter");
    const principalId = "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66";
    const privateRoot = join(publicRoot, "avatars", "by-principal", principalId);
    const globalPrivateRoot = join(globalPublicRoot, "avatars", "by-principal", principalId);
    const fileSlotPath = join(baseDir, "extra.md");

    await mkdir(privateRoot, { recursive: true });
    await mkdir(globalPrivateRoot, { recursive: true });
    await mkdir(publicRoot, { recursive: true });
    await writeFile(join(globalPrivateRoot, "AGENTER.mdx"), "global-private", "utf8");
    await writeFile(join(publicRoot, "layer.md"), "layer-public", "utf8");
    await writeFile(join(privateRoot, "private.md"), "layer-private", "utf8");
    await writeFile(fileSlotPath, "file-slot", "utf8");
    await writeFile(
      join(privateRoot, "AGENTER.mdx"),
      [
        "local-private",
        '<Slot src="super:" />',
        '<Slot src="public:layer.md" />',
        '<Slot src="private:private.md" />',
        `<Slot src="${pathToFileURL(fileSlotPath).toString()}" />`,
      ].join("\n"),
      "utf8",
    );

    const store = new FilePromptStore({
      rootDir: privateRoot,
      privateRootDir: privateRoot,
      publicRootDir: publicRoot,
      globalPrivateRootDir: globalPrivateRoot,
      globalPublicRootDir: globalPublicRoot,
      agenterPath: join(privateRoot, "AGENTER.mdx"),
    });
    await store.reload();

    const rendered = await store.buildMd(store.getDoc("AGENTER"));

    expect(rendered).toContain("local-private");
    expect(rendered).toContain("global-private");
    expect(rendered).toContain("layer-public");
    expect(rendered).toContain("layer-private");
    expect(rendered).toContain("file-slot");
  });

  test("Scenario: Given a private Slot points at an empty file When AGENTER.mdx is rendered Then the empty file intentionally clears that Slot", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-prompt-store-empty-"));
    const publicRoot = join(baseDir, "workspace", ".agenter");
    const privateRoot = join(publicRoot, "avatars", "by-principal", "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66");

    await mkdir(privateRoot, { recursive: true });
    await writeFile(join(privateRoot, "clear.md"), "", "utf8");
    await writeFile(join(privateRoot, "AGENTER.mdx"), 'before<Slot src="private:clear.md" />after', "utf8");

    const store = new FilePromptStore({
      rootDir: privateRoot,
      privateRootDir: privateRoot,
      publicRootDir: publicRoot,
      agenterPath: join(privateRoot, "AGENTER.mdx"),
    });
    await store.reload();

    await expect(store.buildMd(store.getDoc("AGENTER"))).resolves.toBe("beforeafter");
  });

  test("Scenario: Given the AGENTER source itself is empty When prompt docs load Then the empty file remains the Avatar truth instead of falling back", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-prompt-store-empty-agenter-"));
    const publicRoot = join(baseDir, "workspace", ".agenter");
    const privateRoot = join(publicRoot, "avatars", "by-principal", "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66");

    await mkdir(privateRoot, { recursive: true });
    await writeFile(join(privateRoot, "AGENTER.mdx"), "", "utf8");

    const store = new FilePromptStore({
      rootDir: privateRoot,
      privateRootDir: privateRoot,
      publicRootDir: publicRoot,
      agenterPath: join(privateRoot, "AGENTER.mdx"),
    });
    await store.reload();

    expect(store.getDoc("AGENTER").content).toBe("");
    await expect(store.buildMd(store.getDoc("AGENTER"))).resolves.toBe("");
  });

  test("Scenario: Given public Slot uses empty super When rendered Then it inherits the same relative file from global public root", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-prompt-store-public-super-"));
    const publicRoot = join(baseDir, "workspace", ".agenter");
    const globalPublicRoot = join(baseDir, "home", ".agenter");
    const privateRoot = join(publicRoot, "avatars", "by-principal", "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66");

    await mkdir(privateRoot, { recursive: true });
    await mkdir(publicRoot, { recursive: true });
    await mkdir(globalPublicRoot, { recursive: true });
    await writeFile(join(globalPublicRoot, "shared.mdx"), "global-public-shared", "utf8");
    await writeFile(join(publicRoot, "shared.mdx"), '<Slot src="super:" />', "utf8");
    await writeFile(join(privateRoot, "AGENTER.mdx"), '<Slot src="public:shared.mdx" />', "utf8");

    const store = new FilePromptStore({
      rootDir: privateRoot,
      privateRootDir: privateRoot,
      publicRootDir: publicRoot,
      globalPublicRootDir: globalPublicRoot,
      agenterPath: join(privateRoot, "AGENTER.mdx"),
    });
    await store.reload();

    await expect(store.buildMd(store.getDoc("AGENTER"))).resolves.toBe("global-public-shared");
  });
});
