import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { resolveSessionConfig } from "../src/session-config";

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

describe("Feature: session config provider resolution", () => {
  test("Scenario: Given a session principal differs from a stale nickname alias When resolving prompt paths Then AGENTER.mdx comes from the principal root", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-session-config-"));
    const homeDir = join(baseDir, "home");
    const projectRoot = join(baseDir, "project");
    const sessionPrincipalId = "0x888bb66a5ec389d52df0c9ff3e19a61dec890a66";
    const stalePrincipalId = "0x683fe694c23b7f3af3f76cbb05ca009320e45af2";
    const sessionRoot = join(projectRoot, ".agenter", "avatars", "by-principal", sessionPrincipalId);
    const globalSessionRoot = join(homeDir, ".agenter", "avatars", "by-principal", sessionPrincipalId);
    const staleRoot = join(homeDir, ".agenter", "avatars", "by-principal", stalePrincipalId);
    const aliasRoot = join(homeDir, ".agenter", "avatars", "by-nickname");

    await mkdir(sessionRoot, { recursive: true });
    await mkdir(globalSessionRoot, { recursive: true });
    await mkdir(staleRoot, { recursive: true });
    await mkdir(aliasRoot, { recursive: true });
    await writeFile(join(sessionRoot, "AGENTER.mdx"), "# Session principal prompt\n", "utf8");
    await writeFile(join(globalSessionRoot, "AGENTER.mdx"), "# Global principal prompt\n", "utf8");
    await writeFile(join(staleRoot, "AGENTER.mdx"), "# Stale alias prompt\n", "utf8");
    await symlink(`../by-principal/${stalePrincipalId}`, join(aliasRoot, "shell-assistant"), "dir");
    await writeJson(join(projectRoot, ".agenter", "settings.json"), {
      avatar: "shell-assistant",
      prompt: {
        agenterPath: "./.agenter/AGENTER.mdx",
      },
    });
    await writeFile(join(projectRoot, ".agenter", "AGENTER.mdx"), "", "utf8");

    const config = await resolveSessionConfig(projectRoot, {
      avatar: "shell-assistant",
      avatarPrincipalId: sessionPrincipalId,
      homeDir,
    });

    expect(config.avatar.sources[0]?.path).toBe(globalSessionRoot);
    expect(config.prompt.rootDir).toBe(globalSessionRoot);
    expect(config.prompt.agenterPath).toBe(join(globalSessionRoot, "AGENTER.mdx"));
    expect(config.prompt.globalRootDir).toBe(join(homeDir, ".agenter"));
    expect(config.prompt.promptLayers).toEqual([
      {
        publicRootDir: join(homeDir, ".agenter"),
        privateRootDir: globalSessionRoot,
      },
    ]);
  });

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
    expect(config.ai.transportMaxRetries).toBe(2);
    expect(config.ai.thinking).toEqual({
      enabled: true,
      budgetTokens: 2048,
    });
    expect(config.loop.retryPolicy).toMatchObject({
      mode: "exponential",
      maxAttempts: null,
      initialBackoffMs: 600,
      multiplier: 2,
      maxBackoffMs: 5000,
      resetOnExternalInput: true,
      resetOnProgress: true,
    });
    expect(config.loop.compactPolicy).toMatchObject({
      threshold: {
        enabled: true,
        promptFraction: 0.75,
      },
      recovery: {
        attentionRetry: true,
        contextOverflow: true,
        externalContinuationLimit: true,
        timeout: false,
      },
    });
  });

  test("Scenario: Given provider transport retries and legacy compact threshold When resolving session config Then transport and runtime compact policy become separate contracts", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-session-config-"));
    const homeDir = join(baseDir, "home");
    const projectRoot = join(baseDir, "project");

    await writeJson(join(projectRoot, ".agenter", "settings.json"), {
      ai: {
        activeProvider: "default",
        providers: {
          default: {
            kind: "deepseek",
            apiKeyEnv: "DEEPSEEK_API_KEY",
            model: "deepseek-chat",
            baseUrl: "https://api.deepseek.com/v1",
            maxRetries: 4,
            compactThreshold: 0.9,
          },
        },
      },
      loop: {
        retryPolicy: {
          maxAttempts: 3,
          initialBackoffMs: 900,
          multiplier: 1.5,
          maxBackoffMs: 7000,
          resetOnExternalInput: false,
          resetOnProgress: true,
        },
      },
    });

    const config = await resolveSessionConfig(projectRoot, { homeDir });

    expect(config.ai.transportMaxRetries).toBe(4);
    expect(config.loop.retryPolicy).toMatchObject({
      maxAttempts: 3,
      initialBackoffMs: 900,
      multiplier: 1.5,
      maxBackoffMs: 7000,
      resetOnExternalInput: false,
      resetOnProgress: true,
    });
    expect(config.loop.compactPolicy.threshold).toEqual({
      enabled: true,
      promptFraction: 0.9,
    });
  });
});
