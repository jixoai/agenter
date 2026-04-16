import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { loadSettings } from "../src/load-settings";
import { ResourceLoader } from "../src/resource-loader";
import { settingsSource } from "../src/source";

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

describe("@agenter/settings", () => {
  test("loadSettings applies avatar(settingsAlias) before each settings layer", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-settings-avatar-"));
    const homeDir = join(baseDir, "home");
    const projectRoot = join(baseDir, "project");

    await writeJson(join(homeDir, ".agenter", "avatar", "alice", "settings.json"), {
      ai: {
        providers: {
          default: {
            apiStandard: "openai-chat",
            vendor: "openrouter",
            model: "user-avatar-model",
            baseUrl: "https://example.com/user",
          },
        },
      },
    });

    await writeJson(join(homeDir, ".agenter", "settings.json"), {
      avatar: "alice",
      ai: {
        providers: {
          default: {
            apiStandard: "openai-chat",
            vendor: "openrouter",
            model: "user-settings-model",
            baseUrl: "https://example.com/user-settings",
          },
        },
      },
    });

    await writeJson(join(projectRoot, ".agenter", "avatar", "alice", "settings.json"), {
      ai: {
        providers: {
          default: {
            apiStandard: "openai-chat",
            vendor: "openrouter",
            model: "project-avatar-model",
            baseUrl: "https://example.com/project-avatar",
          },
        },
      },
    });

    await writeJson(join(projectRoot, ".agenter", "settings.json"), {
      ai: {
        providers: {
          default: {
            apiStandard: "openai-chat",
            vendor: "openrouter",
            model: "project-settings-model",
            baseUrl: "https://example.com/project-settings",
          },
        },
      },
      sessionStoreTarget: "workspace",
    });

    const loaded = await loadSettings({
      projectRoot,
      cwd: projectRoot,
      homeDir,
    });

    expect(loaded.settings.avatar).toBe("alice");
    expect(loaded.settings.ai?.providers?.default?.model).toBe("project-settings-model");
    expect(loaded.settings.sessionStoreTarget).toBe("workspace");
    expect(
      loaded.graph.layers.some(
        (layer) =>
          layer.kind === "avatar" &&
          layer.sourceId === "user:avatar" &&
          layer.path === join(homeDir, ".agenter", "avatar", "alice", "settings.json"),
      ),
    ).toBe(true);
    expect(
      loaded.graph.layers.some(
        (layer) =>
          layer.kind === "avatar" &&
          layer.sourceId === "project:avatar" &&
          layer.path === join(projectRoot, ".agenter", "avatar", "alice", "settings.json"),
      ),
    ).toBe(true);
  });

  test("loadSettings merges layered sources and normalizes file paths", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-settings-"));
    const homeDir = join(baseDir, "home");
    const projectRoot = join(baseDir, "project");

    await writeJson(join(homeDir, ".agenter", "settings.json"), {
      lang: "zh-Hans",
      prompt: {
        agenterPath: "~/.agenter/AGENTER.mdx",
      },
      terminal: {
        helpSources: {
          iflow: "~/.agenter/man/iflow.md",
        },
      },
    });

    await writeJson(join(projectRoot, ".agenter", "settings.json"), {
      terminal: {
        presets: {
          iflow: {
            command: ["iflow"],
            cwd: "./tmp-workspace",
            helpSource: "./.agenter/man/iflow.md",
          },
        },
      },
    });

    await writeJson(join(projectRoot, ".agenter", "settings.local.json"), {
      tasks: {
        sources: [
          { name: "team", path: "~/.agenter/custom-tasks" },
          { name: "repo", path: "./.agenter/project-tasks" },
        ],
      },
      ai: {
        activeProvider: "proj",
        providers: {
          proj: {
            kind: "openai-compatible",
            model: "deepseek-reasoner",
            apiKeyEnv: "DEEPSEEK_API_KEY",
            baseUrl: "https://api.deepseek.com/v1",
          },
        },
      },
    });

    const loaded = await loadSettings({
      projectRoot,
      cwd: projectRoot,
      homeDir,
    });

    expect(loaded.settings.lang).toBe("zh-Hans");
    expect(loaded.settings.ai?.activeProvider).toBe("proj");
    expect(loaded.settings.ai?.providers?.proj?.model).toBe("deepseek-reasoner");
    expect(loaded.settings.ai?.providers?.proj?.apiStandard).toBe("openai-chat");
    expect(loaded.settings.ai?.providers?.proj?.vendor).toBe("deepseek");
    expect(loaded.settings.ai?.providers?.proj?.profile).toBe("compatible");
    expect(loaded.settings.prompt?.agenterPath).toBe(join(homeDir, ".agenter", "AGENTER.mdx"));
    expect(loaded.settings.terminal?.helpSources?.iflow).toBe(join(homeDir, ".agenter", "man", "iflow.md"));
    expect(loaded.settings.terminal?.presets?.iflow?.cwd).toBe(resolve(projectRoot, "./tmp-workspace"));
    expect(loaded.settings.terminal?.presets?.iflow?.helpSource).toBe(resolve(projectRoot, "./.agenter/man/iflow.md"));
    expect(loaded.settings.tasks?.sources).toEqual([
      { name: "team", path: join(homeDir, ".agenter", "custom-tasks") },
      { name: "repo", path: resolve(projectRoot, "./.agenter/project-tasks") },
    ]);

    expect(loaded.meta.sources).toHaveLength(3);
    expect(loaded.meta.sources.every((entry) => entry.exists)).toBeTrue();
  });

  test("loadSettings keeps canonical providers untouched", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-settings-canonical-"));
    const projectRoot = join(baseDir, "project");

    await writeJson(join(projectRoot, ".agenter", "settings.json"), {
      ai: {
        activeProvider: "kimi",
        providers: {
          kimi: {
            apiStandard: "anthropic",
            vendor: "kimi",
            profile: "official",
            extensions: ["file-upload"],
            model: "kimi-k2",
            baseUrl: "https://api.moonshot.ai/anthropic",
            headers: {
              "x-tenant": "alpha",
            },
          },
        },
      },
    });

    const loaded = await loadSettings({
      projectRoot,
      cwd: projectRoot,
    });

    expect(loaded.settings.ai?.providers?.kimi).toMatchObject({
      apiStandard: "anthropic",
      vendor: "kimi",
      profile: "official",
      extensions: ["file-upload"],
      model: "kimi-k2",
      baseUrl: "https://api.moonshot.ai/anthropic",
      headers: {
        "x-tenant": "alpha",
      },
    });
  });

  test("loadSettings infers compatible anthropic vendor from legacy kind baseUrl", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-settings-legacy-kimi-"));
    const projectRoot = join(baseDir, "project");

    await writeJson(join(projectRoot, ".agenter", "settings.json"), {
      ai: {
        activeProvider: "kimi",
        providers: {
          kimi: {
            kind: "anthropic",
            model: "kimi-k2.5",
            apiKey: "test-kimi-key",
            baseUrl: "https://api.kimi.com/coding/",
          },
        },
      },
    });

    const loaded = await loadSettings({
      projectRoot,
      cwd: projectRoot,
    });

    expect(loaded.settings.ai?.providers?.kimi).toMatchObject({
      apiStandard: "anthropic",
      vendor: "kimi",
      profile: "compatible",
      model: "kimi-for-coding",
      apiKey: "test-kimi-key",
      baseUrl: "https://api.kimi.com/coding",
    });
  });

  test("loadSettings keeps user activeProvider over project default while allowing local override", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-settings-active-provider-"));
    const homeDir = join(baseDir, "home");
    const projectRoot = join(baseDir, "project");

    await writeJson(join(homeDir, ".agenter", "settings.json"), {
      ai: {
        activeProvider: "kimi",
        providers: {
          kimi: {
            kind: "anthropic",
            model: "kimi-k2.5",
            apiKey: "test-kimi-key",
            baseUrl: "https://api.kimi.com/coding/",
          },
        },
      },
    });

    await writeJson(join(projectRoot, ".agenter", "settings.json"), {
      ai: {
        activeProvider: "default",
        providers: {
          default: {
            kind: "deepseek",
            model: "deepseek-chat",
            apiKeyEnv: "DEEPSEEK_API_KEY",
            baseUrl: "https://api.deepseek.com/v1",
          },
        },
      },
    });

    const loaded = await loadSettings({
      projectRoot,
      cwd: projectRoot,
      homeDir,
    });

    expect(loaded.settings.ai?.activeProvider).toBe("kimi");
    expect(loaded.settings.ai?.providers?.default?.vendor).toBe("deepseek");
    expect(loaded.settings.ai?.providers?.kimi?.vendor).toBe("kimi");

    await writeJson(join(projectRoot, ".agenter", "settings.local.json"), {
      ai: {
        activeProvider: "local-kimi",
        providers: {
          "local-kimi": {
            kind: "anthropic",
            model: "kimi-k2.5",
            apiKey: "local-kimi-key",
            baseUrl: "https://api.kimi.com/coding/",
          },
        },
      },
    });

    const localOverride = await loadSettings({
      projectRoot,
      cwd: projectRoot,
      homeDir,
    });

    expect(localOverride.settings.ai?.activeProvider).toBe("local-kimi");
    expect(localOverride.settings.ai?.providers?.["local-kimi"]?.vendor).toBe("kimi");
  });

  test("loadSettings emits cascade provenance and schema graph", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-settings-graph-"));
    const homeDir = join(baseDir, "home");
    const projectRoot = join(baseDir, "project");

    await writeJson(join(homeDir, ".agenter", "settings.json"), {
      ai: {
        activeProvider: "kimi",
        providers: {
          kimi: {
            kind: "anthropic",
            model: "kimi-k2.5",
            apiKey: "test-kimi-key",
            baseUrl: "https://api.kimi.com/coding/",
          },
        },
      },
    });

    await writeJson(join(projectRoot, ".agenter", "settings.json"), {
      lang: "ja",
      ai: {
        activeProvider: "default",
        providers: {
          default: {
            kind: "deepseek",
            model: "deepseek-chat",
            apiKeyEnv: "DEEPSEEK_API_KEY",
            baseUrl: "https://api.deepseek.com/v1",
          },
        },
      },
      tasks: {
        sources: [{ name: "repo", path: "./task-space" }],
      },
    });

    const loaded = await loadSettings({
      projectRoot,
      cwd: projectRoot,
      homeDir,
    });

    expect(loaded.graph.schema.type).toBe("object");
    expect(loaded.graph.layers.length).toBeGreaterThan(0);
    expect(loaded.graph.effective.content.trim().length).toBeGreaterThan(0);

    const langTrace = loaded.graph.provenance["/lang"];
    expect(langTrace).toBeDefined();
    expect(langTrace?.origins.some((origin) => origin.kind === "file" && origin.sourceId === "project")).toBe(true);

    const activeProviderTrace = loaded.graph.provenance["/ai/activeProvider"];
    expect(activeProviderTrace).toBeDefined();
    expect(
      activeProviderTrace?.origins.some(
        (origin) => origin.kind === "derived" && origin.sourceId === "derived:ai-selection",
      ),
    ).toBe(true);

    const taskPathTrace = loaded.graph.provenance["/tasks/sources/0/path"];
    expect(taskPathTrace).toBeDefined();
    expect(
      taskPathTrace?.origins.some(
        (origin) => origin.kind === "derived" && origin.sourceId === "derived:path-normalization",
      ),
    ).toBe(true);
    expect(loaded.settings.tasks?.sources?.[0]?.path).toBe(resolve(projectRoot, "./task-space"));
  });

  test("resource loader resolves builtins, paths and custom protocol", async () => {
    const loader = new ResourceLoader({
      context: {
        projectRoot: "/repo/project",
        cwd: "/repo/project/demo",
        homeDir: "/home/tester",
      },
    });

    loader.registerAlias("remote", () => "mem://remote/settings.json");
    loader.registerProtocol("mem", {
      readText: async () => '{"lang":"en"}',
    });

    const descriptors = settingsSource(["user", "project", "local", "./config", "remote"], {
      projectRoot: "/repo/project",
      cwd: "/repo/project/demo",
      homeDir: "/home/tester",
      loader,
    });
    const byId = Object.fromEntries(descriptors.map((entry) => [entry.id, entry]));

    expect(byId.user.path).toBe("/home/tester/.agenter/settings.json");
    expect(byId.project.path).toBe("/repo/project/.agenter/settings.json");
    expect(byId.local.path).toBe("/repo/project/.agenter/settings.local.json");
    expect(byId["./config"].path).toBe("/repo/project/demo/config/settings.json");
    expect(byId.remote.uri).toBe("mem://remote/settings.json");

    const text = await loader.readText("remote");
    expect(text).toBe('{"lang":"en"}');
  });
});
