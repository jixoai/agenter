import { TextAttributes } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";
import { afterEach, describe, expect, test } from "bun:test";

import {
  buildShellNextStatusbarCenter,
  buildShellNextStatusbarLeft,
  buildShellNextStatusbarText,
  ShellNextStatusbarRenderable,
  type ShellNextStatusbarState,
} from "../src/renderable-mux/statusbar";

const heartbeatState: ShellNextStatusbarState = {
  runtime: { label: "Idle" },
  attention: { focused: 21, background: 2, muted: 2 },
  aiContext: { usedTokens: 700, maxTokens: 100000 },
};

let activeStatusbar: ShellNextStatusbarRenderable | null = null;
let activeRenderer: Awaited<ReturnType<typeof createTestRenderer>> | null = null;

const findSpan = (text: string) =>
  activeRenderer
    ?.captureSpans()
    .lines.flatMap((line) => line.spans)
    .find((span) => span.text.includes(text));

const readTextAttributesAt = (position: { x: number; y: number }, text: string): number => {
  const line = activeRenderer?.captureSpans().lines[position.y];
  let cursor = 0;
  let attributes = 0;
  for (const span of line?.spans ?? []) {
    const spanStart = cursor;
    const spanEnd = spanStart + span.width;
    const targetStart = position.x;
    const targetEnd = position.x + Bun.stringWidth(text);
    if (spanEnd > targetStart && spanStart < targetEnd) {
      attributes |= span.attributes;
    }
    cursor = spanEnd;
  }
  return attributes;
};

const findTextPosition = (frame: string, text: string): { x: number; y: number } | null => {
  const rows = frame.split("\n");
  for (let y = 0; y < rows.length; y += 1) {
    const x = rows[y].indexOf(text);
    if (x >= 0) {
      return { x, y };
    }
  }
  return null;
};

afterEach(() => {
  activeStatusbar?.destroy();
  activeStatusbar = null;
  activeRenderer?.renderer.destroy();
  activeRenderer = null;
});

describe("Feature: shell-next macro statusbar", () => {
  test("Scenario: Given macro runtime facts When rendering left summary Then AttentionItem content is not required", () => {
    expect(buildShellNextStatusbarLeft(heartbeatState)).toBe("Idle · 21 focused · 2 background · 2 muted");
  });

  test("Scenario: Given AI context facts When rendering center summary Then it uses explicit Context wording", () => {
    expect(buildShellNextStatusbarCenter(heartbeatState)).toBe("Context 0.7% used");
  });

  test("Scenario: Given a narrow terminal When composing statusbar Then right-side actions remain visible first", () => {
    const text = buildShellNextStatusbarText(
      {
        ...heartbeatState,
        actions: ["Help", "Chat"],
      },
      32,
    );

    expect(text.endsWith("[Help] [Chat]")).toBe(true);
    expect(text).toContain("Idle");
    expect(text.length).toBe(32);
  });

  test("Scenario: Given a very narrow terminal When composing statusbar Then left summary yields width to actions", () => {
    expect(buildShellNextStatusbarText({ ...heartbeatState, actions: ["Help", "Chat"] }, 13)).toBe("[Help] [Chat]");
  });

  test("Scenario: Given OpenTUI renderer When statusbar is mounted Then it projects the macro summary", async () => {
    activeRenderer = await createTestRenderer({ width: 60, height: 3 });
    activeStatusbar = new ShellNextStatusbarRenderable({
      renderer: activeRenderer.renderer,
      state: heartbeatState,
      x: 0,
      y: 2,
      width: 60,
    });
    for (const node of activeStatusbar.nodes) {
      activeRenderer.renderer.root.add(node);
    }
    await activeRenderer.renderOnce();

    expect(activeRenderer.captureCharFrame()).toContain("Idle");
    expect(activeRenderer.captureCharFrame()).toContain("Context 0.7% used");
    expect(activeRenderer.captureCharFrame()).toContain("[Help] [Chat]");
  });

  test("Scenario: Given statusbar actions When hovering Help Then only the Help button is bolded", async () => {
    activeRenderer = await createTestRenderer({ width: 60, height: 3, useMouse: true });
    activeStatusbar = new ShellNextStatusbarRenderable({
      renderer: activeRenderer.renderer,
      state: heartbeatState,
      x: 0,
      y: 2,
      width: 60,
    });
    for (const node of activeStatusbar.nodes) {
      activeRenderer.renderer.root.add(node);
    }
    await activeRenderer.renderOnce();

    const helpX = activeRenderer.captureCharFrame().split("\n")[2].indexOf("[Help]");
    await activeRenderer.mockMouse.moveTo(helpX, 2);
    await activeRenderer.renderOnce();

    const help = findTextPosition(activeRenderer.captureCharFrame(), "[Help]");
    const chat = findTextPosition(activeRenderer.captureCharFrame(), "[Chat]");
    expect(help).not.toBeNull();
    expect(chat).not.toBeNull();

    expect(readTextAttributesAt({ x: (help?.x ?? 0) + 1, y: help?.y ?? 0 }, "Help") & TextAttributes.BOLD).toBe(
      TextAttributes.BOLD,
    );
    expect(readTextAttributesAt({ x: (chat?.x ?? 0) + 1, y: chat?.y ?? 0 }, "Chat") & TextAttributes.BOLD).toBe(0);
    expect(findSpan("Help")?.fg).toEqual(findSpan("Chat")?.fg);
  });

  test("Scenario: Given a statusbar action is active When rendering Then the active button is underlined", async () => {
    activeRenderer = await createTestRenderer({ width: 60, height: 3, useMouse: true });
    activeStatusbar = new ShellNextStatusbarRenderable({
      renderer: activeRenderer.renderer,
      state: {
        ...heartbeatState,
        activeActions: ["chat"],
      },
      x: 0,
      y: 2,
      width: 60,
    });
    for (const node of activeStatusbar.nodes) {
      activeRenderer.renderer.root.add(node);
    }
    await activeRenderer.renderOnce();

    const chat = findTextPosition(activeRenderer.captureCharFrame(), "[Chat]");
    const help = findTextPosition(activeRenderer.captureCharFrame(), "[Help]");
    expect(chat).not.toBeNull();
    expect(help).not.toBeNull();

    expect(readTextAttributesAt({ x: (chat?.x ?? 0) + 1, y: chat?.y ?? 0 }, "Chat") & TextAttributes.UNDERLINE).toBe(
      TextAttributes.UNDERLINE,
    );
    expect(readTextAttributesAt({ x: (help?.x ?? 0) + 1, y: help?.y ?? 0 }, "Help") & TextAttributes.UNDERLINE).toBe(0);
  });

  test("Scenario: Given a statusbar action is active When rendering Then only the inner button content is underlined", async () => {
    activeRenderer = await createTestRenderer({ width: 60, height: 3, useMouse: true });
    activeStatusbar = new ShellNextStatusbarRenderable({
      renderer: activeRenderer.renderer,
      state: {
        ...heartbeatState,
        activeActions: ["help"],
      },
      x: 0,
      y: 2,
      width: 60,
    });
    for (const node of activeStatusbar.nodes) {
      activeRenderer.renderer.root.add(node);
    }
    await activeRenderer.renderOnce();

    const position = findTextPosition(activeRenderer.captureCharFrame(), "[Help]");
    expect(position).not.toBeNull();

    expect(readTextAttributesAt({ x: position?.x ?? 0, y: position?.y ?? 0 }, "[") & TextAttributes.UNDERLINE).toBe(0);
    expect(readTextAttributesAt({ x: (position?.x ?? 0) + 1, y: position?.y ?? 0 }, "Help") & TextAttributes.UNDERLINE).toBe(
      TextAttributes.UNDERLINE,
    );
    expect(readTextAttributesAt({ x: (position?.x ?? 0) + "[Help]".length - 1, y: position?.y ?? 0 }, "]") & TextAttributes.UNDERLINE).toBe(0);
  });
});
