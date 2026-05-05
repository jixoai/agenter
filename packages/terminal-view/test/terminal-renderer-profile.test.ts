import { describe, expect, test } from "vitest";

import {
  DEFAULT_TERMINAL_FONT,
  DEFAULT_TERMINAL_THEME,
  resolveTerminalAppearance,
  resolveTerminalFont,
  resolveTerminalRenderer,
} from "../src/terminal-renderer-profile";

describe("Feature: terminal renderer profile law", () => {
  test("Scenario: Given auto renderer preference When the viewport resolves it Then desktop defaults stay on ghostty-web and the reason remains explicit", () => {
    expect(resolveTerminalRenderer("auto")).toEqual({
      preference: "auto",
      resolvedRenderer: "ghostty-web",
      reason: "desktop-auto-prefers-ghostty-web-for-scale-safe-selection",
    });
  });

  test("Scenario: Given a partial terminal font override When shared appearance resolves Then missing fields still come from the durable default font profile", () => {
    const font = resolveTerminalFont({
      sizePx: 16,
      lineHeight: 1.35,
    });
    const appearance = resolveTerminalAppearance({
      theme: "default-light",
      cursor: "underline",
      font: {
        family: "'JetBrains Mono', monospace",
        sizePx: 15,
      },
    });

    expect(font).toEqual({
      family: DEFAULT_TERMINAL_FONT.family,
      sizePx: 16,
      lineHeight: 1.35,
      letterSpacing: DEFAULT_TERMINAL_FONT.letterSpacing,
      weight: DEFAULT_TERMINAL_FONT.weight,
      weightBold: DEFAULT_TERMINAL_FONT.weightBold,
      ligatures: DEFAULT_TERMINAL_FONT.ligatures,
    });
    expect(appearance.themeName).toBe("default-light");
    expect(appearance.cursorStyle).toBe("underline");
    expect(appearance.font).toEqual({
      family: "'JetBrains Mono', monospace",
      sizePx: 15,
      lineHeight: DEFAULT_TERMINAL_FONT.lineHeight,
      letterSpacing: DEFAULT_TERMINAL_FONT.letterSpacing,
      weight: DEFAULT_TERMINAL_FONT.weight,
      weightBold: DEFAULT_TERMINAL_FONT.weightBold,
      ligatures: DEFAULT_TERMINAL_FONT.ligatures,
    });
    expect(resolveTerminalAppearance().themeName).toBe(DEFAULT_TERMINAL_THEME);
    expect(DEFAULT_TERMINAL_FONT.family).toBe(
      "ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    );
    expect(DEFAULT_TERMINAL_FONT.sizePx).toBe(14);
    expect(DEFAULT_TERMINAL_FONT.lineHeight).toBe(1);
  });
});
