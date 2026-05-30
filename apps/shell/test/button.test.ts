import { RGBA, TextAttributes, type MouseEvent } from "@opentui/core";
import { describe, expect, test } from "bun:test";

import {
  buildShellButtonChunk,
  normalizeShellButtonLabel,
  resolveShellButtonAt,
  resolveShellButtonAttributes,
} from "../src/renderable-mux/button";

const createMouseEvent = (x: number, y: number): MouseEvent =>
  ({
    x,
    y,
  }) as MouseEvent;

describe("Feature: shell shared Button primitive", () => {
  test("Scenario: Given a raw label When normalized Then the visible button is bracketed once", () => {
    expect(normalizeShellButtonLabel("Help")).toBe("[Help]");
    expect(normalizeShellButtonLabel("[Chat]")).toBe("[Chat]");
  });

  test("Scenario: Given hover and active state When resolving style Then hover is bold-only and active is underline-only", () => {
    expect(resolveShellButtonAttributes({ hovered: true })).toBe(TextAttributes.BOLD);
    expect(resolveShellButtonAttributes({ active: true })).toBe(TextAttributes.UNDERLINE);
    expect(resolveShellButtonAttributes({ active: true, hovered: true })).toBe(
      TextAttributes.BOLD | TextAttributes.UNDERLINE,
    );
  });

  test("Scenario: Given a hovered button chunk When built Then foreground color is not changed by hover", () => {
    const fg = RGBA.fromHex("#f8fafc");
    const chunk = buildShellButtonChunk({
      fg,
      button: {
        id: "help",
        label: "Help",
        hovered: true,
      },
    });

    expect(chunk.text).toBe("[Help]");
    expect(chunk.fg).toEqual(fg);
    expect((chunk.attributes ?? 0) & TextAttributes.BOLD).toBe(TextAttributes.BOLD);
  });

  test("Scenario: Given button regions When resolving a click Then only visible cells hit", () => {
    const regions = [{ id: "help", x: 10, y: 2, width: 6 }];

    expect(resolveShellButtonAt(createMouseEvent(10, 2), regions)).toBe("help");
    expect(resolveShellButtonAt(createMouseEvent(15, 2), regions)).toBe("help");
    expect(resolveShellButtonAt(createMouseEvent(16, 2), regions)).toBeNull();
    expect(resolveShellButtonAt(createMouseEvent(10, 1), regions)).toBeNull();
  });
});
