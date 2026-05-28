import type { TerminalRenderRichLine } from "@agenter/termless-core";
import { createTestRenderer } from "@opentui/core/testing";
import { afterEach, describe, expect, test } from "bun:test";

import { OpenComposeTerminalViewRenderable } from "../src/opencompose/terminal-frame/terminal-view-renderable";

let activeRenderer: Awaited<ReturnType<typeof createTestRenderer>> | null = null;

afterEach(() => {
  activeRenderer?.renderer.destroy();
  activeRenderer = null;
});

const createLine = (text: string): TerminalRenderRichLine => ({
  spans: text.length > 0 ? [{ text }] : [],
});

describe("Feature: shell-next terminal semantic selection ownership", () => {
  test("Scenario: Given backend word selection becomes visible during a semantic double click When the click sequence completes Then shell-next does not clear it on release", async () => {
    activeRenderer = await createTestRenderer({ width: 40, height: 4, useMouse: true });
    const semanticPoints: Array<{ ownerId: string; row: number; col: number }> = [];
    const clearRequests: Array<{ ownerId: string; row: number; col: number }> = [];
    let view: OpenComposeTerminalViewRenderable;
    view = new OpenComposeTerminalViewRenderable(activeRenderer.renderer, {
      id: "terminal-view-double-click",
      position: "absolute",
      top: 0,
      left: 0,
      width: 40,
      height: 2,
      lines: [createLine("$ echo alpha beta gamma"), createLine("shell prompt")],
      onSelectWordAt: (point) => {
        semanticPoints.push(point);
        view.updateProjection({
          selectionOverlays: [
            {
              ownerId: point.ownerId,
              ownership: "backend-native",
              rows: [{ row: point.row, startCol: point.col, endCol: point.col + 5 }],
            },
          ],
        });
        return true;
      },
      onClearSelection: (point) => {
        clearRequests.push(point);
        return true;
      },
    });
    activeRenderer.renderer.root.add(view);
    await activeRenderer.renderOnce();

    await activeRenderer.mockMouse.doubleClick(9, 0);
    await activeRenderer.renderOnce();

    expect(semanticPoints).toEqual([{ ownerId: "terminal", row: 0, col: 9 }]);
    expect(clearRequests).toEqual([]);
    expect(view.hasSelection()).toBe(true);
  });

  test("Scenario: Given backend line selection becomes visible during a semantic triple click When the click sequence completes Then shell-next does not clear it on release", async () => {
    activeRenderer = await createTestRenderer({ width: 40, height: 4, useMouse: true });
    const semanticPoints: Array<{ ownerId: string; row: number; col: number }> = [];
    const clearRequests: Array<{ ownerId: string; row: number; col: number }> = [];
    let view: OpenComposeTerminalViewRenderable;
    view = new OpenComposeTerminalViewRenderable(activeRenderer.renderer, {
      id: "terminal-view-triple-click",
      position: "absolute",
      top: 0,
      left: 0,
      width: 40,
      height: 2,
      lines: [createLine("$ echo alpha beta gamma"), createLine("shell prompt")],
      onSelectLineAt: (point) => {
        semanticPoints.push(point);
        view.updateProjection({
          selectionOverlays: [
            {
              ownerId: point.ownerId,
              ownership: "backend-native",
              rows: [{ row: point.row, startCol: 0, endCol: 12 }],
            },
          ],
        });
        return true;
      },
      onClearSelection: (point) => {
        clearRequests.push(point);
        return true;
      },
    });
    activeRenderer.renderer.root.add(view);
    await activeRenderer.renderOnce();

    await activeRenderer.mockMouse.click(5, 1);
    await activeRenderer.mockMouse.click(5, 1);
    await activeRenderer.mockMouse.click(5, 1);
    await activeRenderer.renderOnce();

    expect(semanticPoints).toEqual([{ ownerId: "terminal", row: 1, col: 5 }]);
    expect(clearRequests).toEqual([]);
    expect(view.hasSelection()).toBe(true);
  });
});
