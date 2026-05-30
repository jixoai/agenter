import type { GlobalTerminalEntry } from "@agenter/client-sdk";
import { describe, expect, test } from "bun:test";

import {
  buildCliShellNavigationAvatarItems,
  buildCliShellNavigationModel,
  buildCliShellNavigationShellItems,
  defaultCliShellSettings,
} from "../src";
import { FakeCliShellStore } from "./fake-cli-shell-store";

const shellTerminal = (
  shellName: string,
  input?: {
    updatedAt?: number;
  processPhase?: GlobalTerminalEntry["processPhase"];
  archivedAt?: number | null;
  productId?: string;
  ownerSystem?: string;
  resourceKey?: string;
  },
): GlobalTerminalEntry => ({
  terminalId: shellName,
  processKind: "shell",
  backend: "ghostty-native",
  command: ["zsh", "-i"],
  launchCwd: "/repo",
  workspace: null,
  status: "IDLE",
  processPhase: input?.processPhase ?? "running",
  seq: 1,
  snapshot: {
    seq: 1,
    timestamp: 1,
    cols: 80,
    rows: 24,
    lines: Array.from({ length: 24 }, () => ""),
    cursor: { x: 0, y: 0 },
    scrollback: {
      viewportOffset: 0,
      totalLines: 24,
      screenLines: 24,
    },
  },
  focused: false,
  configuredTitle: shellName,
  shortcuts: undefined,
  rendererPreference: "auto",
  theme: "default-dark",
  cursor: "block",
  font: {
    family: "monospace",
    sizePx: 13,
    lineHeight: 1.4,
    letterSpacing: 0,
    weight: "400",
    weightBold: "700",
    ligatures: false,
  },
  transportUrl: `ws://127.0.0.1/pty/${shellName}`,
  currentAdminId: null,
  approvalTimeoutMs: 90_000,
  pendingRequestCount: 0,
  createdAt: 1,
  updatedAt: input?.updatedAt ?? 1,
  archivedAt: input?.archivedAt ?? null,
  access: {
    role: "admin",
    accessToken: `tok:${shellName}`,
    participantId: "system:trusted-terminal-bootstrap",
    currentAdmin: true,
  },
  actors: [],
  metadata: {
    productId: input?.productId ?? "cli-shell",
    resourceKey: input?.resourceKey ?? shellName,
    ownerSystem: input?.ownerSystem ?? "terminal-system",
  },
});

describe("Feature: cli-shell startup navigation model", () => {
  test("Scenario: Given live and killed terminals When building Shell options Then only live cli-shell TerminalSystem bindings are listed", () => {
    const settings = defaultCliShellSettings();
    const result = buildCliShellNavigationShellItems(
      [
        shellTerminal("shell-1", { updatedAt: 10 }),
        shellTerminal("shell-2", { updatedAt: 20, processPhase: "killed" }),
        shellTerminal("shell-3", { updatedAt: 30, archivedAt: 1 }),
        shellTerminal("shell-4", { updatedAt: 40, productId: "studio" }),
        shellTerminal("shell-5", { updatedAt: 50, ownerSystem: "message-system" }),
      ],
      settings,
    );

    expect(result.items.map((item) => item.shellName)).toEqual(["shell-4", "shell-1"]);
    expect(result.defaultIndex).toBe(1);
  });

  test("Scenario: Given last selected Shell is live When building Shell options Then navigation defaults to that Shell even if another Shell was newer", () => {
    const settings = {
      ...defaultCliShellSettings(),
      startup: {
        lastShellName: "shell-1",
        lastAvatarNickname: null,
      },
    };
    const result = buildCliShellNavigationShellItems(
      [shellTerminal("shell-1", { updatedAt: 10 }), shellTerminal("shell-9", { updatedAt: 90 })],
      settings,
    );

    expect(result.items[result.defaultIndex]?.shellName).toBe("shell-1");
  });

  test("Scenario: Given no saved Shell is live When building Shell options Then navigation defaults to the most recently updated live Shell", () => {
    const settings = {
      ...defaultCliShellSettings(),
      startup: {
        lastShellName: "shell-100",
        lastAvatarNickname: null,
      },
    };
    const result = buildCliShellNavigationShellItems(
      [shellTerminal("shell-1", { updatedAt: 10 }), shellTerminal("shell-9", { updatedAt: 90 })],
      settings,
    );

    expect(result.items[result.defaultIndex]?.shellName).toBe("shell-9");
  });

  test("Scenario: Given live Shells already use low numbers When building Shell options Then the new Shell action picks the next shell-N", () => {
    const result = buildCliShellNavigationShellItems(
      [shellTerminal("shell-1"), shellTerminal("shell-3"), shellTerminal("shell-2")],
      defaultCliShellSettings(),
    );

    expect(result.items[0]).toMatchObject({
      kind: "new-shell",
      shellName: "shell-4",
    });
  });

  test("Scenario: Given killed cli-shell terminals remain in history When building Shell options Then new Shell skips historical resource keys", () => {
    const result = buildCliShellNavigationShellItems([shellTerminal("shell-3")], defaultCliShellSettings(), [
      shellTerminal("shell-1", { processPhase: "killed" }),
      shellTerminal("shell-2", { processPhase: "killed" }),
      shellTerminal("shell-3"),
    ]);

    expect(result.items[0]).toMatchObject({
      kind: "new-shell",
      shellName: "shell-4",
    });
  });

  test("Scenario: Given dirty platform-live rows When building Shell options Then only canonical running Shell roots are selectable", () => {
    const result = buildCliShellNavigationShellItems(
      [
        shellTerminal("not-started", {
          processPhase: "not_started",
          resourceKey: "shell-1",
          updatedAt: 100,
        }),
        shellTerminal("legacy-sub-binding", {
          resourceKey: "shell-3:terminal-1",
          updatedAt: 200,
        }),
        shellTerminal("verify-binding", {
          resourceKey: "shell-verify-shell-frame",
          updatedAt: 300,
        }),
        shellTerminal("canonical-running", {
          resourceKey: "shell-14",
          updatedAt: 400,
        }),
      ],
      defaultCliShellSettings(),
      [
        shellTerminal("not-started", {
          processPhase: "not_started",
          resourceKey: "shell-1",
        }),
        shellTerminal("legacy-sub-binding", {
          resourceKey: "shell-3:terminal-1",
        }),
        shellTerminal("verify-binding", {
          resourceKey: "shell-verify-shell-frame",
        }),
        shellTerminal("canonical-running", {
          resourceKey: "shell-14",
        }),
      ],
    );

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.shellName)).toEqual(["shell-2", "shell-14"]);
    expect(result.items[1]).toMatchObject({
      kind: "shell",
      shellName: "shell-14",
      terminalId: "canonical-running",
    });
  });

  test("Scenario: Given avatar catalog omits shell-assistant When building Avatar options Then the default Shell Assistant remains selectable", () => {
    const result = buildCliShellNavigationAvatarItems([]);

    expect(result.items.map((item) => (item.kind === "avatar" ? item.nickname : "new"))).toEqual([
      "new",
      "shell-assistant",
    ]);
    expect(result.defaultIndex).toBe(1);
  });

  test("Scenario: Given store live and index projections When building the full model Then Shell selection stays live while numbering sees history", async () => {
    const store = new FakeCliShellStore();
    store.terminals.push(shellTerminal("shell-8", { updatedAt: 8 }));
    store.terminalHistory.push(shellTerminal("shell-1", { processPhase: "killed" }));

    const model = await buildCliShellNavigationModel(store, defaultCliShellSettings());

    expect(model.shellItems.map((item) => item.shellName)).toEqual(["shell-2", "shell-8"]);
    expect(model.avatarItems.some((item) => item.kind === "avatar" && item.nickname === "shell-assistant")).toBe(true);
  });
});
