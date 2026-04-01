import { describe, expect, test } from "vitest";

import {
  applyQuickstartBootstrapConfigToSettings,
  normalizeQuickstartBootstrapConfig,
  parseQuickstartBootstrapConfig,
} from "../src/features/quickstart/quickstart-bootstrap-settings";

describe("Feature: quickstart bootstrap config persistence", () => {
  test("Scenario: Given effective workspace settings When bootstrap config is parsed Then room defaults and boot terminals stay normalized", () => {
    const parsed = parseQuickstartBootstrapConfig({
      features: {
        message: {
          chatMainDefaults: {
            title: "Main room",
            participants: [{ id: "avatar:jane", label: "jane" }],
            metadata: { builtIn: true },
            adminToken: "AdminToken_123456",
          },
        },
        terminal: {
          bootTerminals: [{ id: "iflow-main", focus: true, autoRun: true }],
        },
      },
      terminal: {
        terminalId: "iflow-main",
        presets: {
          "iflow-main": {
            command: ["bash", "-i"],
            cwd: "/repo/demo",
          },
        },
      },
    });

    expect(parsed.room.title).toBe("Main room");
    expect(parsed.room.participants).toHaveLength(1);
    expect(parsed.room.metadata).toEqual({ builtIn: true });
    expect(parsed.terminals).toEqual([
      {
        terminalId: "iflow-main",
        command: ["bash", "-i"],
        cwd: "/repo/demo",
        focus: true,
        autoRun: true,
      },
    ]);
  });

  test("Scenario: Given previous boot terminal entries When bootstrap config is applied Then stale boot presets are removed and new descriptors are written", () => {
    const nextConfig = normalizeQuickstartBootstrapConfig({
      room: {
        title: "Chat bootstrap",
        participants: [{ id: "avatar:jane" }],
        metadata: { scope: "quickstart" },
        adminToken: "",
      },
      terminals: [
        {
          terminalId: "iflow-main",
          command: ["bash", "-i"],
          cwd: "/repo/demo",
          focus: true,
          autoRun: true,
        },
      ],
    });

    const updated = applyQuickstartBootstrapConfigToSettings(
      {
        features: {
          terminal: {
            bootTerminals: [{ id: "legacy-terminal", focus: true, autoRun: true }],
          },
        },
        terminal: {
          presets: {
            "legacy-terminal": {
              command: ["zsh", "-i"],
            },
            keep: {
              command: ["node", "index.js"],
            },
          },
        },
      },
      nextConfig,
    );

    const terminal = updated.terminal as {
      terminalId: string;
      presets: Record<string, { command: string[]; cwd?: string }>;
    };
    const featureTerminal = (updated.features as { terminal: { bootTerminals: Array<{ id: string }> } }).terminal;
    expect(terminal.presets["legacy-terminal"]).toBeUndefined();
    expect(terminal.presets.keep).toEqual({ command: ["node", "index.js"] });
    expect(terminal.presets["iflow-main"]).toEqual({ command: ["bash", "-i"], cwd: "/repo/demo" });
    expect(featureTerminal.bootTerminals).toEqual([{ id: "iflow-main", focus: true, autoRun: true }]);
  });
});
