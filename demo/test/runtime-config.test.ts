import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parseRuntimeConfig } from "../src/app/runtime-config";

const isolateSources = ["--settings-source=/tmp/agenter-settings-not-exists.json"];

test("parseRuntimeConfig supports --cwd value form", async () => {
  const config = await parseRuntimeConfig([...isolateSources, "--cwd", "../workspace"], "/tmp/demo");
  expect(config.agentCwd).toBe("/tmp/workspace");
});

test("parseRuntimeConfig supports --cwd= form", async () => {
  const config = await parseRuntimeConfig([...isolateSources, "--cwd=/var/project"], "/tmp/demo");
  expect(config.agentCwd).toBe("/var/project");
});

test("parseRuntimeConfig falls back to baseDir", async () => {
  const config = await parseRuntimeConfig(isolateSources, "/tmp/demo");
  expect(config.agentCwd).toBe("/tmp/demo");
  expect(config.terminal.command.length).toBeGreaterThan(0);
  expect(config.terminal.terminalId).toContain("-main");
});

test("parseRuntimeConfig parses --cmd with args", async () => {
  const config = await parseRuntimeConfig(
    [...isolateSources, "--cmd=codex --dangerously-skip-permissions"],
    "/tmp/demo",
  );
  expect(config.terminal.command).toEqual(["codex", "--dangerously-skip-permissions"]);
  expect(config.terminal.terminalId).toBe("codex-main");
});

test("parseRuntimeConfig parses --terminal-id and submit gap", async () => {
  const config = await parseRuntimeConfig(
    [...isolateSources, "--cmd", "iflow", "--terminal-id", "agent-worker", "--submit-gap-ms=120"],
    "/tmp/demo",
  );
  expect(config.terminal.command).toEqual(["iflow"]);
  expect(config.terminal.terminalId).toBe("agent-worker");
  expect(config.terminal.submitGapMs).toBe(120);
});

test("parseRuntimeConfig parses JSON style command array", async () => {
  const config = await parseRuntimeConfig([...isolateSources, '--cmd=["claude-code","--json"]'], "/tmp/demo");
  expect(config.terminal.command).toEqual(["claude-code", "--json"]);
});

test("parseRuntimeConfig parses --ati-output-dir", async () => {
  const config = await parseRuntimeConfig([...isolateSources, "--ati-output-dir", "../ati-out"], "/tmp/demo");
  expect(config.terminal.outputRoot).toBe("/tmp/ati-out");
});

test("parseRuntimeConfig parses --git-log mode and bare flag", async () => {
  const withMode = await parseRuntimeConfig([...isolateSources, "--git-log=verbose"], "/tmp/demo");
  expect(withMode.terminal.gitLog).toBe("verbose");
  const bare = await parseRuntimeConfig([...isolateSources, "--git-log"], "/tmp/demo");
  expect(bare.terminal.gitLog).toBe("normal");
});

test("parseRuntimeConfig exposes default provider config", async () => {
  const config = await parseRuntimeConfig(isolateSources, "/tmp/demo");
  expect(config.ai.providerId).toBe("default");
  expect(config.ai.apiStandard).toBe("openai-chat");
  expect(config.ai.vendor).toBe("deepseek");
  expect(config.ai.model).toBe("deepseek-chat");
  expect(config.ai.baseUrl).toBe("https://api.deepseek.com/v1");
});

test("parseRuntimeConfig infers prompt root from settings source directory", async () => {
  const root = join("/tmp", `agenter-settings-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "settings.json"),
    JSON.stringify({
      terminal: {
        command: ["codex"],
      },
    }),
    "utf8",
  );
  const config = await parseRuntimeConfig([`--settings-source=${root}`], "/tmp/demo");
  expect(config.prompt.rootDir).toBe(root);
});

test("parseRuntimeConfig supports terminal presets + feature bootTerminals", async () => {
  const root = join("/tmp", `agenter-presets-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "settings.json"),
    JSON.stringify({
      terminal: {
        presets: {
          iflow: {
            command: ["iflow"],
            helpSource: "https://example.com/iflow-help.md",
          },
          codex: {
            command: ["codex", "--full-auto"],
          },
        },
      },
      features: {
        terminal: {
          bootTerminals: [
            { id: "iflow", focus: true, autoRun: true },
            { id: "codex", autoRun: false },
          ],
        },
      },
    }),
    "utf8",
  );
  const config = await parseRuntimeConfig([`--settings-source=${root}`], "/tmp/demo");
  expect(config.primaryTerminalId).toBe("iflow");
  expect(config.focusedTerminalIds).toEqual(["iflow"]);
  expect(config.bootTerminals).toEqual([
    { terminalId: "iflow", focus: true, autoRun: true },
    { terminalId: "codex", focus: false, autoRun: false },
  ]);
  expect(config.terminals.iflow.command).toEqual(["iflow"]);
  expect(config.terminals.iflow.helpSource).toBe("https://example.com/iflow-help.md");
  expect(config.terminals.codex.command).toEqual(["codex", "--full-auto"]);
});

test("parseRuntimeConfig falls back to en when lang is invalid", async () => {
  const root = join("/tmp", `agenter-lang-invalid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "settings.json"),
    JSON.stringify({
      lang: "x-unknown",
    }),
    "utf8",
  );
  const config = await parseRuntimeConfig([`--settings-source=${root}`], "/tmp/demo");
  expect(config.lang).toBe("en");
});

test("parseRuntimeConfig keeps supported lang", async () => {
  const root = join("/tmp", `agenter-lang-zh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "settings.json"),
    JSON.stringify({
      lang: "zh-Hans",
    }),
    "utf8",
  );
  const config = await parseRuntimeConfig([`--settings-source=${root}`], "/tmp/demo");
  expect(config.lang).toBe("zh-Hans");
});

test("parseRuntimeConfig supports string + object bootTerminals", async () => {
  const root = join("/tmp", `agenter-observe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "settings.json"),
    JSON.stringify({
      terminal: {
        presets: {
          iflow: { command: ["iflow"] },
          codex: { command: ["codex"] },
        },
      },
      features: {
        terminal: {
          bootTerminals: ["iflow", { id: "codex", autoRun: false, focus: true }],
        },
      },
    }),
    "utf8",
  );
  const config = await parseRuntimeConfig([`--settings-source=${root}`], "/tmp/demo");
  expect(config.focusedTerminalIds).toEqual(["codex"]);
  expect(config.bootTerminals).toEqual([
    { terminalId: "iflow", focus: false, autoRun: true },
    { terminalId: "codex", focus: true, autoRun: false },
  ]);
});
