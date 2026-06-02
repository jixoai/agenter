import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { ResourceLoader } from "@agenter/settings";

import { FilePromptStore } from "../src/prompt-store";

describe("Feature: prompt store URL Slot composition", () => {
  test("Scenario: Given prompt files use URL Slots When AGENTER.mdx is rendered Then public private super and file sources compose from configured prompt layers", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-prompt-store-"));
    const layerRoot = join(baseDir, "layer");
    const parentLayerRoot = join(baseDir, "parent-layer");
    const publicRoot = join(layerRoot, ".agenter");
    const parentPublicRoot = join(parentLayerRoot, ".agenter");
    const principalId = "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66";
    const privateRoot = join(publicRoot, "avatars", "by-principal", principalId);
    const parentPrivateRoot = join(parentPublicRoot, "avatars", "by-principal", principalId);
    const fileSlotPath = join(baseDir, "extra.md");

    await mkdir(privateRoot, { recursive: true });
    await mkdir(parentPrivateRoot, { recursive: true });
    await mkdir(publicRoot, { recursive: true });
    await writeFile(join(parentPrivateRoot, "AGENTER.mdx"), "parent-private", "utf8");
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
      promptLayers: [
        {
          publicRootDir: parentPublicRoot,
          privateRootDir: parentPrivateRoot,
        },
        {
          publicRootDir: publicRoot,
          privateRootDir: privateRoot,
        },
      ],
      agenterPath: join(privateRoot, "AGENTER.mdx"),
    });
    await store.reload();

    const rendered = await store.buildMd(store.getDoc("AGENTER"));

    expect(rendered).toContain("local-private");
    expect(rendered).toContain("parent-private");
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

  test("Scenario: Given AGENTER references global builtin prompt root When rendered Then global resolves daemon materialized builtins without super inheritance", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-prompt-store-builtin-super-"));
    const privateRoot = join(
      baseDir,
      "home",
      ".agenter",
      "avatars",
      "by-principal",
      "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66",
    );
    const builtinRoot = join(baseDir, "home", ".agenter", "builtin", "en");

    await mkdir(privateRoot, { recursive: true });
    await mkdir(builtinRoot, { recursive: true });
    await writeFile(join(builtinRoot, "AGENTER.mdx"), "builtin-runtime-guidance", "utf8");
    await writeFile(
      join(privateRoot, "AGENTER.mdx"),
      '<Slot src="global:builtin/$LANG/AGENTER.mdx" />\n\navatar-owned-guidance',
      "utf8",
    );

    const store = new FilePromptStore({
      lang: "en",
      rootDir: privateRoot,
      privateRootDir: privateRoot,
      globalRootDir: join(baseDir, "home", ".agenter"),
      agenterPath: join(privateRoot, "AGENTER.mdx"),
    });
    await store.reload();

    await expect(store.buildMd(store.getDoc("AGENTER"))).resolves.toContain("builtin-runtime-guidance");
  });

  test("Scenario: Given global Avatar AGENTER uses super without parent layer When rendered Then builtin prompts are not inherited implicitly", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-prompt-store-super-no-builtin-"));
    const privateRoot = join(
      baseDir,
      "home",
      ".agenter",
      "avatars",
      "by-principal",
      "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66",
    );
    const builtinRoot = join(baseDir, "home", ".agenter", "builtin", "en");

    await mkdir(privateRoot, { recursive: true });
    await mkdir(builtinRoot, { recursive: true });
    await writeFile(join(builtinRoot, "AGENTER.mdx"), "builtin-runtime-guidance", "utf8");
    await writeFile(
      join(privateRoot, "AGENTER.mdx"),
      '<Slot src="super:AGENTER.mdx" />\n\navatar-owned-guidance',
      "utf8",
    );

    const store = new FilePromptStore({
      lang: "en",
      rootDir: privateRoot,
      privateRootDir: privateRoot,
      globalRootDir: join(baseDir, "home", ".agenter"),
      agenterPath: join(privateRoot, "AGENTER.mdx"),
    });
    await store.reload();

    await expect(store.buildMd(store.getDoc("AGENTER"))).resolves.toBe("avatar-owned-guidance");
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

  test("Scenario: Given public Slot uses empty super When rendered Then it inherits the same relative file from the parent public layer", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-prompt-store-public-super-"));
    const publicRoot = join(baseDir, "workspace", ".agenter");
    const parentPublicRoot = join(baseDir, "parent", ".agenter");
    const privateRoot = join(publicRoot, "avatars", "by-principal", "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66");

    await mkdir(privateRoot, { recursive: true });
    await mkdir(publicRoot, { recursive: true });
    await mkdir(parentPublicRoot, { recursive: true });
    await writeFile(join(parentPublicRoot, "shared.mdx"), "parent-public-shared", "utf8");
    await writeFile(join(publicRoot, "shared.mdx"), '<Slot src="super:" />', "utf8");
    await writeFile(join(privateRoot, "AGENTER.mdx"), '<Slot src="public:shared.mdx" />', "utf8");

    const store = new FilePromptStore({
      rootDir: privateRoot,
      privateRootDir: privateRoot,
      publicRootDir: publicRoot,
      promptLayers: [
        {
          publicRootDir: parentPublicRoot,
        },
        {
          publicRootDir: publicRoot,
          privateRootDir: privateRoot,
        },
      ],
      agenterPath: join(privateRoot, "AGENTER.mdx"),
    });
    await store.reload();

    await expect(store.buildMd(store.getDoc("AGENTER"))).resolves.toBe("parent-public-shared");
  });

  test("Scenario: Given AGENTER uses an app Slot When rendered Then the package-owned app prompt composes through ResourceLoader", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-prompt-store-app-slot-"));
    const projectRoot = join(baseDir, "project");
    const packageRoot = join(projectRoot, "apps", "shell");
    const privateRoot = join(
      baseDir,
      "home",
      ".agenter",
      "avatars",
      "by-principal",
      "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66",
    );

    await mkdir(join(packageRoot, "prompts"), { recursive: true });
    await mkdir(privateRoot, { recursive: true });
    await writeFile(
      join(packageRoot, "package.json"),
      JSON.stringify(
        {
          name: "agenter-app-shell",
          type: "module",
          exports: {
            "./ShellAssistant.mdx": "./prompts/ShellAssistant.mdx",
          },
          agenter: {
            app: {
              appId: "shell",
              command: "shell",
              bin: "agenter-shell",
              descriptor: "./src/app.ts",
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      join(packageRoot, "prompts", "ShellAssistant.mdx"),
      '# Shell Assistant\n\nYou are <Slot name="AVATAR_NAME" />.\n\nUse shell-assistant-book.',
      "utf8",
    );
    await writeFile(join(privateRoot, "AGENTER.mdx"), '<Slot src="app:shell/ShellAssistant.mdx" />', "utf8");

    const store = new FilePromptStore({
      rootDir: privateRoot,
      privateRootDir: privateRoot,
      agenterPath: join(privateRoot, "AGENTER.mdx"),
      loader: new ResourceLoader({
        context: {
          projectRoot,
          cwd: projectRoot,
          homeDir: join(baseDir, "home"),
        },
      }),
    });
    await store.reload();

    const rendered = await store.buildMd(store.getDoc("AGENTER"), {
      slots: {
        AVATAR_NAME: "Bob",
      },
    });
    expect(rendered).toContain("You are Bob.");
    expect(rendered).toContain("shell-assistant-book");

    await writeFile(
      join(packageRoot, "prompts", "ShellAssistant.mdx"),
      '# Shell Assistant\n\nYou are <Slot name="AVATAR_NAME" />.\n\nUse upgraded package prompt.',
      "utf8",
    );

    const rerendered = await store.buildMd(store.getDoc("AGENTER"), {
      slots: {
        AVATAR_NAME: "Jane",
      },
    });
    expect(rerendered).toContain("You are Jane.");
    expect(rerendered).toContain("Use upgraded package prompt.");
  });

  test("Scenario: Given Slots use global app npm file and $LANG When AGENTER renders Then dependency nodes keep expanded URIs and resolved paths", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-prompt-store-resolution-"));
    const homeDir = join(baseDir, "home");
    const projectRoot = join(baseDir, "project");
    const packageRoot = join(projectRoot, "apps", "shell");
    const builtinRoot = join(homeDir, ".agenter", "builtin", "en");
    const privateRoot = join(
      homeDir,
      ".agenter",
      "avatars",
      "by-principal",
      "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66",
    );
    const avatarPromptPath = join(privateRoot, "AGENTER.mdx");
    const appPromptPath = join(packageRoot, "prompts", "ShellAssistant.mdx");
    const npmPromptPath = join(packageRoot, "extra.md");
    const filePromptPath = join(baseDir, "workspace-extra.md");

    await mkdir(join(packageRoot, "prompts"), { recursive: true });
    await mkdir(builtinRoot, { recursive: true });
    await mkdir(privateRoot, { recursive: true });
    await writeFile(join(builtinRoot, "AGENTER.mdx"), "builtin-runtime-guidance", "utf8");
    await writeFile(
      join(packageRoot, "package.json"),
      JSON.stringify(
        {
          name: "agenter-app-shell",
          type: "module",
          exports: {
            "./ShellAssistant.mdx": "./prompts/ShellAssistant.mdx",
          },
          agenter: {
            app: {
              appId: "shell",
              command: "shell",
              bin: "agenter-shell",
              descriptor: "./src/app.ts",
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(appPromptPath, "app-runtime-guidance", "utf8");
    await writeFile(npmPromptPath, "npm-runtime-guidance", "utf8");
    await writeFile(filePromptPath, "file-runtime-guidance", "utf8");
    await writeFile(
      avatarPromptPath,
      [
        '<Slot src="global:builtin/$LANG/AGENTER.mdx" />',
        '<Slot src="app:shell/ShellAssistant.mdx" />',
        '<Slot src="npm:agenter-app-shell/extra.md" />',
        `<Slot src="${pathToFileURL(filePromptPath).toString()}" />`,
      ].join("\n"),
      "utf8",
    );

    const store = new FilePromptStore({
      lang: "en",
      rootDir: privateRoot,
      privateRootDir: privateRoot,
      globalRootDir: join(homeDir, ".agenter"),
      agenterPath: avatarPromptPath,
      loader: new ResourceLoader({
        context: {
          projectRoot,
          cwd: projectRoot,
          homeDir,
        },
      }),
    });
    await store.reload();

    const render = await store.buildRender(store.getDoc("AGENTER"));

    expect(render.text).toContain("builtin-runtime-guidance");
    expect(render.text).toContain("app-runtime-guidance");
    expect(render.text).toContain("npm-runtime-guidance");
    expect(render.text).toContain("file-runtime-guidance");
    expect(render.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          originalUri: "global:builtin/$LANG/AGENTER.mdx",
          expandedUri: "global:builtin/en/AGENTER.mdx",
          resolvedPath: join(builtinRoot, "AGENTER.mdx"),
        }),
        expect.objectContaining({
          originalUri: "app:shell/ShellAssistant.mdx",
          expandedUri: "app:shell/ShellAssistant.mdx",
          resolvedPath: appPromptPath,
        }),
        expect.objectContaining({
          originalUri: "npm:agenter-app-shell/extra.md",
          expandedUri: "npm:agenter-app-shell/extra.md",
          resolvedPath: npmPromptPath,
        }),
        expect.objectContaining({
          originalUri: pathToFileURL(filePromptPath).toString(),
          expandedUri: pathToFileURL(filePromptPath).toString(),
          resolvedPath: filePromptPath,
        }),
      ]),
    );
  });

  test("Scenario: Given runtime prompt render uses avatar builtin and app files When rendered Then dependency evidence and live prompt inspection remain file-backed", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-prompt-store-runtime-"));
    const homeDir = join(baseDir, "home");
    const projectRoot = join(baseDir, "project");
    const packageRoot = join(projectRoot, "apps", "shell");
    const builtinRoot = join(homeDir, ".agenter", "builtin", "en");
    const privateRoot = join(
      homeDir,
      ".agenter",
      "avatars",
      "by-principal",
      "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66",
    );
    const avatarPromptPath = join(privateRoot, "AGENTER.mdx");
    const packagePromptPath = join(packageRoot, "prompts", "ShellAssistant.mdx");

    await mkdir(builtinRoot, { recursive: true });
    await mkdir(join(packageRoot, "prompts"), { recursive: true });
    await mkdir(privateRoot, { recursive: true });
    await writeFile(join(builtinRoot, "AGENTER_SYSTEM.mdx"), 'System runtime guidance for <Slot name="AVATAR_NAME" />.', "utf8");
    await writeFile(join(builtinRoot, "AGENTER.mdx"), "Builtin avatar runtime law.", "utf8");
    await writeFile(join(builtinRoot, "RESPONSE_CONTRACT.mdx"), "Respond with care.", "utf8");
    await writeFile(
      join(builtinRoot, "SYSTEM_TEMPLATE.mdx"),
      '<Slot name="AGENTER_SYSTEM" />\n\n<Slot name="AGENTER" />\n\n<Slot name="RESPONSE_CONTRACT" />',
      "utf8",
    );
    await writeFile(
      join(packageRoot, "package.json"),
      JSON.stringify(
        {
          name: "agenter-app-shell",
          type: "module",
          exports: {
            "./ShellAssistant.mdx": "./prompts/ShellAssistant.mdx",
          },
          agenter: {
            app: {
              appId: "shell",
              command: "shell",
              bin: "agenter-shell",
              descriptor: "./src/app.ts",
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(packagePromptPath, "Package shell guidance.", "utf8");
    await writeFile(
      avatarPromptPath,
      '<Slot src="global:builtin/$LANG/AGENTER.mdx" />\n\n<Slot src="app:shell/ShellAssistant.mdx" />',
      "utf8",
    );

    const store = new FilePromptStore({
      lang: "en",
      rootDir: privateRoot,
      privateRootDir: privateRoot,
      globalRootDir: join(homeDir, ".agenter"),
      agenterPath: avatarPromptPath,
      avatarNickname: "shell-assistant",
      loader: new ResourceLoader({
        context: {
          projectRoot,
          cwd: projectRoot,
          homeDir,
        },
      }),
    });
    await store.reload();

    const render = await store.renderRuntimePrompt({ avatarName: "shell-assistant" });
    const state = store.inspectRuntimePromptState();

    expect(render.systemPrompt).toContain("System runtime guidance for shell-assistant.");
    expect(render.systemPrompt).toContain("Builtin avatar runtime law.");
    expect(render.systemPrompt).toContain("Package shell guidance.");
    expect(render.canonicalPromptPath).toBe(avatarPromptPath);
    expect(render.ownershipPolicy).toBe("user-owned-seed-if-missing");
    expect(render.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerKind: "avatar",
          resolvedPath: avatarPromptPath,
        }),
        expect.objectContaining({
          ownerKind: "builtin",
          resolvedPath: join(builtinRoot, "AGENTER.mdx"),
        }),
        expect.objectContaining({
          ownerKind: "package",
          originalUri: "app:shell/ShellAssistant.mdx",
          resolvedPath: packagePromptPath,
        }),
      ]),
    );
    expect(state.current?.sourceIdentity).toBe(render.sourceIdentity);
    expect(state.current?.renderHash).toBe(render.renderHash);
    expect(state.current?.dependencies).toEqual(render.dependencies);
    expect(state.watcherStatuses.length).toBeGreaterThan(0);
  });

  test("Scenario: Given builtin prompt files were never materialized When runtime prompt inspection runs Then diagnostics expose missing managed roots instead of silently trusting bundled defaults", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-prompt-store-missing-builtin-"));
    const homeDir = join(baseDir, "home");
    const privateRoot = join(
      homeDir,
      ".agenter",
      "avatars",
      "by-principal",
      "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66",
    );
    const avatarPromptPath = join(privateRoot, "AGENTER.mdx");
    const builtinRoot = join(homeDir, ".agenter", "builtin", "en");

    await mkdir(privateRoot, { recursive: true });
    await mkdir(builtinRoot, { recursive: true });
    await writeFile(avatarPromptPath, '<Slot src="global:builtin/$LANG/AGENTER.mdx" />', "utf8");

    const store = new FilePromptStore({
      lang: "en",
      rootDir: privateRoot,
      privateRootDir: privateRoot,
      globalRootDir: join(homeDir, ".agenter"),
      agenterPath: avatarPromptPath,
      avatarNickname: "default",
    });
    await store.reload();

    const render = await store.renderRuntimePrompt({ avatarName: "default" });
    const state = store.inspectRuntimePromptState();

    expect(render.systemPrompt.length).toBeGreaterThan(0);
    expect(state.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "missing_builtin_prompt",
          resolvedPath: join(builtinRoot, "AGENTER.mdx"),
        }),
        expect.objectContaining({
          kind: "missing_builtin_prompt",
          resolvedPath: join(builtinRoot, "AGENTER_SYSTEM.mdx"),
        }),
        expect.objectContaining({
          kind: "missing_builtin_prompt",
          resolvedPath: join(builtinRoot, "RESPONSE_CONTRACT.mdx"),
        }),
        expect.objectContaining({
          kind: "missing_builtin_prompt",
          resolvedPath: join(builtinRoot, "SYSTEM_TEMPLATE.mdx"),
        }),
        expect.objectContaining({
          kind: "render_fallback",
          resolvedPath: join(builtinRoot, "AGENTER_SYSTEM.mdx"),
        }),
      ]),
    );
    expect(render.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resolvedPath: join(builtinRoot, "AGENTER.mdx"),
          freshnessIdentity: "missing",
        }),
      ]),
    );
  });
});
