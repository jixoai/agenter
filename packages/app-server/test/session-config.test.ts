import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { resolveSessionConfig } from "../src/session-config";

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

describe("Feature: session config provider resolution", () => {
  test("Scenario: Given user kimi provider and project default deepseek When resolving session config Then the runtime uses kimi", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-session-config-"));
    const homeDir = join(baseDir, "home");
    const projectRoot = join(baseDir, "project");

    await writeJson(join(homeDir, ".agenter", "settings.json"), {
      ai: {
        activeProvider: "kimi",
        providers: {
          kimi: {
            kind: "anthropic",
            apiKey: "test-kimi-key",
            model: "kimi-k2.5",
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
            apiKeyEnv: "DEEPSEEK_API_KEY",
            model: "deepseek-chat",
            baseUrl: "https://api.deepseek.com/v1",
          },
        },
      },
    });

    const config = await resolveSessionConfig(projectRoot, { homeDir });

    expect(config.ai.providerId).toBe("kimi");
    expect(config.ai.apiStandard).toBe("anthropic");
    expect(config.ai.vendor).toBe("kimi");
    expect(config.ai.profile).toBe("compatible");
    expect(config.ai.model).toBe("kimi-for-coding");
    expect(config.ai.apiKey).toBe("test-kimi-key");

    expect(config.ai.baseUrl).toBe("https://api.kimi.com/coding");
  });

  test("Scenario: Given explicit empty boot terminals When resolving session config Then runtime keeps manual terminal start", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-session-config-"));
    const homeDir = join(baseDir, "home");
    const projectRoot = join(baseDir, "project");

    await writeJson(join(projectRoot, ".agenter", "settings.json"), {
      terminal: {
        presets: {
          iflow: {
            command: ["iflow"],
          },
        },
      },
      features: {
        terminal: {
          bootTerminals: [],
        },
      },
    });

    const config = await resolveSessionConfig(projectRoot, { homeDir });

    expect(config.primaryTerminalId).toBe("iflow");
    expect(config.bootTerminals).toEqual([]);
    expect(config.focusedTerminalIds).toEqual(["iflow"]);
  });

  test("Scenario: Given no task source settings When resolving session config Then runtime keeps task-system dormant by default", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-session-config-"));
    const homeDir = join(baseDir, "home");
    const projectRoot = join(baseDir, "project");

    const config = await resolveSessionConfig(projectRoot, { homeDir });

    expect(config.tasks.sources).toEqual([]);
  });

  test("Scenario: Given ai runtime knobs live at ai root When resolving session config Then runtime uses ai root values without requiring provider mutations", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-session-config-"));
    const homeDir = join(baseDir, "home");
    const projectRoot = join(baseDir, "project");

    await writeJson(join(homeDir, ".agenter", "avatar", "default", "settings.json"), {
      ai: {
        temperature: 0.6,
        topK: 32,
        maxToken: 16384,
        thinking: {
          enabled: true,
          budgetTokens: 2048,
        },
      },
    });

    await writeJson(join(homeDir, ".agenter", "settings.json"), {
      avatar: "default",
      ai: {
        activeProvider: "default",
        providers: {
          default: {
            kind: "deepseek",
            apiKeyEnv: "DEEPSEEK_API_KEY",
            model: "deepseek-chat",
            baseUrl: "https://api.deepseek.com/v1",
          },
        },
      },
    });

    const config = await resolveSessionConfig(projectRoot, { homeDir, avatar: "default" });

    expect(config.ai.temperature).toBe(0.6);
    expect(config.ai.topK).toBe(32);
    expect(config.ai.maxToken).toBe(16384);
    expect(config.ai.thinking).toEqual({
      enabled: true,
      budgetTokens: 2048,
    });
  });
});
