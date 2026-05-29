import { createTerminalHostInputController, type TerminalHostInputTarget } from "@agenter/termless-backend-utils";
import { createBackendInteractionAdapter, type TerminalRenderRichLine } from "@agenter/termless-core";
import { createTestRenderer } from "@opentui/core/testing";
import { afterEach, describe, expect, test } from "bun:test";

import { OpenComposeTerminalFrameRenderable } from "../src/opencompose/terminal-frame/terminal-frame-renderable";
import { OpenComposeTerminalViewRenderable } from "../src/opencompose/terminal-frame/terminal-view-renderable";

let activeRenderer: Awaited<ReturnType<typeof createTestRenderer>> | null = null;

afterEach(() => {
  activeRenderer?.renderer.destroy();
  activeRenderer = null;
});

const createLine = (text: string): TerminalRenderRichLine => ({
  spans: text.length > 0 ? [{ text }] : [],
});

const createInputTarget = (lines: string[]): TerminalHostInputTarget & { copySelection(ownerId?: string): string } => {
  const interaction = createBackendInteractionAdapter({
    ownerId: "terminal",
    readable: {
      getLine(row) {
        return Array.from(lines[row] ?? "").map((char) => ({
          char,
          fg: null,
          bg: null,
          bold: false,
          dim: false,
          italic: false,
          underline: false,
          underlineColor: null,
          strikethrough: false,
          inverse: false,
          blink: false,
          hidden: false,
          wide: Bun.stringWidth(char) > 1,
          continuation: false,
          hyperlink: null,
        }));
      },
      getScrollback() {
        return {
          viewportOffset: 0,
          totalLines: lines.length,
          screenLines: lines.length,
        };
      },
    },
  });
  return {
    ...interaction,
    readKeyboardInteractionView() {
      return null;
    },
    writeInput() {
      return false;
    },
  };
};

describe("Feature: shell-next terminal semantic selection ownership", () => {
  test("Scenario: Given backend word selection becomes visible during a semantic double click When the click sequence completes Then shell-next does not clear it on release", async () => {
    activeRenderer = await createTestRenderer({ width: 40, height: 4, useMouse: true });
    const semanticPoints: Array<{ ownerId: string; row: number; col: number }> = [];
    const hostInput = createTerminalHostInputController();
    const lines = ["$ echo alpha beta gamma", "shell prompt"];
    const target = createInputTarget(lines);
    let view: OpenComposeTerminalViewRenderable;
    view = new OpenComposeTerminalViewRenderable(activeRenderer.renderer, {
      id: "terminal-view-double-click",
      position: "absolute",
      top: 0,
      left: 0,
      width: 40,
      height: 2,
      lines: lines.map(createLine),
      onPointerDown: (input) => {
        if (input.point) {
          semanticPoints.push(input.point);
        }
        const result = hostInput.handlePointerDown(target, input);
        view.updateProjection({
          selectionOverlays: target.getSelectionOverlay("terminal") ? [target.getSelectionOverlay("terminal")!] : [],
        });
        return result;
      },
      onPointerUp: (input) => hostInput.handlePointerUp(target, input),
    });
    activeRenderer.renderer.root.add(view);
    await activeRenderer.renderOnce();

    await activeRenderer.mockMouse.doubleClick(9, 0);
    await activeRenderer.renderOnce();

    expect(semanticPoints).toContainEqual({ ownerId: "terminal", row: 0, col: 9 });
    expect(view.hasSelection()).toBe(true);
    expect(target.copySelection("terminal")).toBe("alpha");
  });

  test("Scenario: Given backend line selection becomes visible during a semantic triple click When the click sequence completes Then shell-next does not clear it on release", async () => {
    activeRenderer = await createTestRenderer({ width: 40, height: 4, useMouse: true });
    const semanticPoints: Array<{ ownerId: string; row: number; col: number }> = [];
    const hostInput = createTerminalHostInputController();
    const lines = ["$ echo alpha beta gamma", "shell prompt"];
    const target = createInputTarget(lines);
    let view: OpenComposeTerminalViewRenderable;
    view = new OpenComposeTerminalViewRenderable(activeRenderer.renderer, {
      id: "terminal-view-triple-click",
      position: "absolute",
      top: 0,
      left: 0,
      width: 40,
      height: 2,
      lines: lines.map(createLine),
      onPointerDown: (input) => {
        if (input.point) {
          semanticPoints.push(input.point);
        }
        const result = hostInput.handlePointerDown(target, input);
        view.updateProjection({
          selectionOverlays: target.getSelectionOverlay("terminal") ? [target.getSelectionOverlay("terminal")!] : [],
        });
        return result;
      },
      onPointerUp: (input) => hostInput.handlePointerUp(target, input),
    });
    activeRenderer.renderer.root.add(view);
    await activeRenderer.renderOnce();

    await activeRenderer.mockMouse.click(5, 1);
    await activeRenderer.mockMouse.click(5, 1);
    await activeRenderer.mockMouse.click(5, 1);
    await activeRenderer.renderOnce();

    expect(semanticPoints).toContainEqual({ ownerId: "terminal", row: 1, col: 5 });
    expect(view.hasSelection()).toBe(true);
    expect(target.copySelection("terminal")).toBe("shell prompt");
  });

  test("Scenario: Given a scrolled terminal frame When a word is double clicked Then Shell-Next sends the absolute backend row to the selection controller", async () => {
    activeRenderer = await createTestRenderer({ width: 40, height: 4, useMouse: true });
    const hostInput = createTerminalHostInputController();
    const absoluteLines = Array.from({ length: 25 }, (_, index) =>
      index === 21 ? "$ echo alpha beta gamma" : `line ${index}`,
    );
    const semanticPoints: Array<{ ownerId: string; row: number; col: number }> = [];
    const target = createInputTarget(absoluteLines);
    const frame = new OpenComposeTerminalFrameRenderable(activeRenderer.renderer, {
      id: "terminal-frame-scrolled-double-click",
      position: "absolute",
      top: 0,
      left: 0,
      width: 40,
      height: 3,
      scrollbarVisible: false,
      state: {
        lines: absoluteLines.slice(20, 23).map(createLine),
        cursorCol: 0,
        cursorAbsRow: 21,
        cursorVisible: true,
        viewportStart: 20,
        scrollbackRows: absoluteLines.length,
      },
      bridge: {
        scrollViewport: () => false,
        setViewportStart: () => false,
        pointerDown: (input) => {
          if (input.point) {
            semanticPoints.push(input.point);
          }
          return hostInput.handlePointerDown(target, input);
        },
        pointerUp: (input) => hostInput.handlePointerUp(target, input),
      },
    });
    activeRenderer.renderer.root.add(frame);
    await activeRenderer.renderOnce();

    await activeRenderer.mockMouse.doubleClick(9, 1);
    await activeRenderer.renderOnce();

    expect(semanticPoints).toContainEqual({ ownerId: "terminal", row: 21, col: 9 });
    expect(target.copySelection("terminal")).toBe("alpha");
  });

  test("Scenario: Given a scrolled terminal frame When the operator drags across visible rows Then Shell-Next sends absolute backend rows", async () => {
    activeRenderer = await createTestRenderer({ width: 40, height: 5, useMouse: true });
    const hostInput = createTerminalHostInputController();
    const absoluteLines = Array.from({ length: 16 }, (_, index) => `line ${index} alpha beta`);
    const baseTarget = createInputTarget(absoluteLines);
    const selectionEvents: Array<{ type: "start" | "update" | "end"; row: number; col: number }> = [];
    const target: TerminalHostInputTarget & { copySelection(ownerId?: string): string } = {
      ...baseTarget,
      startSelection(point) {
        selectionEvents.push({ type: "start", row: point.row, col: point.col });
        return baseTarget.startSelection(point);
      },
      updateSelection(point) {
        selectionEvents.push({ type: "update", row: point.row, col: point.col });
        return baseTarget.updateSelection(point);
      },
      endSelection(point) {
        selectionEvents.push({ type: "end", row: point.row, col: point.col });
        return baseTarget.endSelection(point);
      },
    };
    const frame = new OpenComposeTerminalFrameRenderable(activeRenderer.renderer, {
      id: "terminal-frame-scrolled-drag",
      position: "absolute",
      top: 0,
      left: 0,
      width: 40,
      height: 3,
      scrollbarVisible: false,
      state: {
        lines: absoluteLines.slice(10, 13).map(createLine),
        cursorCol: 0,
        cursorAbsRow: 12,
        cursorVisible: true,
        viewportStart: 10,
        scrollbackRows: absoluteLines.length,
      },
      bridge: {
        scrollViewport: () => false,
        setViewportStart: () => false,
        pointerDown: (input) => hostInput.handlePointerDown(target, input),
        pointerDrag: (input) => hostInput.handlePointerDrag(target, input),
        pointerUp: (input) => hostInput.handlePointerUp(target, input),
      },
    });
    activeRenderer.renderer.root.add(frame);
    await activeRenderer.renderOnce();

    await activeRenderer.mockMouse.drag(2, 0, 10, 2);
    await activeRenderer.renderOnce();

    expect(selectionEvents).toContainEqual({ type: "start", row: 10, col: 2 });
    expect(selectionEvents).toContainEqual({ type: "update", row: 12, col: 10 });
    expect(selectionEvents).toContainEqual({ type: "end", row: 12, col: 10 });
  });
});
