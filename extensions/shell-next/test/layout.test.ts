import { describe, expect, test } from "bun:test";

import {
  canSplitRect,
  createFourPaneLayout,
  createRootLayout,
  getOpenComposeMinimumSplitSize,
} from "../src/renderable-mux/layout";

describe("Feature: shell-next minimal four-pane layout", () => {
  test("Scenario: Given a root rectangle When creating four panes Then panes tile the surface without overlap", () => {
    const layout = createFourPaneLayout({ x: 0, y: 0, width: 80, height: 24 });

    expect(layout.children.map((child) => child.rect)).toEqual([
      { x: 0, y: 0, width: 40, height: 12 },
      { x: 40, y: 0, width: 40, height: 12 },
      { x: 0, y: 12, width: 40, height: 12 },
      { x: 40, y: 12, width: 40, height: 12 },
    ]);
  });

  test("Scenario: Given a point inside a pane When hit testing Then layout returns the owning child node", () => {
    const layout = createFourPaneLayout({ x: 0, y: 0, width: 80, height: 24 });

    expect(layout.hitTest(3, 3)?.id).toBe("pane-a");
    expect(layout.hitTest(43, 3)?.id).toBe("pane-b");
    expect(layout.hitTest(3, 15)?.id).toBe("pane-c");
    expect(layout.hitTest(43, 15)?.id).toBe("pane-d");
    expect(layout.hitTest(90, 90)).toBeNull();
  });

  test("Scenario: Given focus moves When reading children Then only the focused pane is marked", () => {
    const layout = createFourPaneLayout({ x: 0, y: 0, width: 80, height: 24 });

    expect(layout.focus("pane-c")).toBe(true);
    expect(layout.children.map((child) => [child.id, child.focused])).toEqual([
      ["pane-a", false],
      ["pane-b", false],
      ["pane-c", true],
      ["pane-d", false],
    ]);
  });
});

describe("Feature: shell-next tmux-like layout mutations", () => {
  test("Scenario: Given a focused pane When splitting right Then the new pane is focused and receives sibling geometry", () => {
    const layout = createRootLayout({ x: 0, y: 0, width: 80, height: 24 }, [
      { id: "pane-a", sourceKind: "terminal-protocol" },
    ]);

    expect(layout.split("pane-a", "right", { id: "pane-b", sourceKind: "opentui-renderable" })).toBe(true);

    expect(layout.children.map((child) => [child.id, child.rect, child.focused])).toEqual([
      ["pane-a", { x: 0, y: 0, width: 40, height: 24 }, false],
      ["pane-b", { x: 40, y: 0, width: 40, height: 24 }, true],
    ]);
  });

  test("Scenario: Given a focused pane When splitting above Then the new pane is inserted before the existing pane", () => {
    const layout = createRootLayout({ x: 0, y: 0, width: 20, height: 12 }, [
      { id: "pane-a", sourceKind: "terminal-protocol" },
    ]);

    expect(layout.split("pane-a", "above", { id: "pane-top", sourceKind: "opentui-renderable" })).toBe(true);

    expect(layout.children.map((child) => [child.id, child.rect])).toEqual([
      ["pane-top", { x: 0, y: 0, width: 20, height: 6 }],
      ["pane-a", { x: 0, y: 6, width: 20, height: 6 }],
    ]);
  });

  test("Scenario: Given multiple panes When closing a pane Then the remaining sibling expands into the host rectangle", () => {
    const layout = createRootLayout({ x: 0, y: 0, width: 80, height: 24 }, [
      { id: "pane-a", sourceKind: "terminal-protocol" },
    ]);
    layout.split("pane-a", "right", { id: "pane-b", sourceKind: "terminal-protocol" });

    expect(layout.close("pane-b")).toBe(true);

    expect(layout.children.map((child) => [child.id, child.rect])).toEqual([
      ["pane-a", { x: 0, y: 0, width: 80, height: 24 }],
    ]);
  });

  test("Scenario: Given two horizontal panes When resizing the right edge Then the focused pane grows and the sibling shrinks", () => {
    const layout = createRootLayout({ x: 0, y: 0, width: 80, height: 24 }, [
      { id: "pane-a", sourceKind: "terminal-protocol" },
    ]);
    layout.split("pane-a", "right", { id: "pane-b", sourceKind: "terminal-protocol" });
    layout.focus("pane-a");

    expect(layout.resizePane("pane-a", "right", 10)).toBe(true);

    expect(layout.children.map((child) => [child.id, child.rect.width])).toEqual([
      ["pane-a", 50],
      ["pane-b", 30],
    ]);
  });

  test("Scenario: Given four panes When moving focus by geometry Then adjacent focus does not depend on child order alone", () => {
    const layout = createFourPaneLayout({ x: 0, y: 0, width: 80, height: 24 });

    expect(layout.focus("pane-a")).toBe(true);
    expect(layout.focusAdjacent("right")).toBe(true);
    expect(layout.children.find((child) => child.focused)?.id).toBe("pane-b");
    expect(layout.focusAdjacent("down")).toBe(true);
    expect(layout.children.find((child) => child.focused)?.id).toBe("pane-d");
  });

  test("Scenario: Given a renderer pane When moving it left of a terminal pane Then layout preserves pane identity and recomputes geometry", () => {
    const layout = createRootLayout({ x: 0, y: 0, width: 80, height: 24 }, [
      { id: "terminal", sourceKind: "terminal-protocol" },
    ]);
    layout.split("terminal", "right", { id: "chat", sourceKind: "opentui-renderable" });

    expect(layout.movePane("chat", "terminal", "left")).toBe(true);

    expect(layout.children.map((child) => [child.id, child.rect.x, child.rect.width, child.focused])).toEqual([
      ["chat", 0, 40, true],
      ["terminal", 40, 40, false],
    ]);
  });

  test("Scenario: Given the host resizes When reading pane geometry Then layout recomputes stable rectangles", () => {
    const layout = createFourPaneLayout({ x: 0, y: 0, width: 80, height: 24 });

    layout.resize({ x: 0, y: 0, width: 100, height: 40 });

    expect(layout.children.map((child) => child.rect)).toEqual([
      { x: 0, y: 0, width: 50, height: 20 },
      { x: 50, y: 0, width: 50, height: 20 },
      { x: 0, y: 20, width: 50, height: 20 },
      { x: 50, y: 20, width: 50, height: 20 },
    ]);
  });
});

describe("Feature: shell-next tmux minimum-size parity", () => {
  test("Scenario: Given tmux split rules When checking split minimum Then shell-next requires two cells plus a separator", () => {
    expect(getOpenComposeMinimumSplitSize(2)).toBe(3);
    expect(getOpenComposeMinimumSplitSize(3)).toBe(5);
  });

  test("Scenario: Given a pane smaller than tmux split minimum When splitting Then layout rejects the operation", () => {
    const layout = createRootLayout({ x: 0, y: 0, width: 2, height: 12 }, [
      { id: "pane-a", sourceKind: "terminal-protocol" },
    ]);

    expect(canSplitRect(layout.children[0].rect, "right")).toBe(false);
    expect(layout.split("pane-a", "right", { id: "pane-b", sourceKind: "terminal-protocol" })).toBe(false);
  });

  test("Scenario: Given a pane meeting tmux split minimum When splitting Then layout accepts the operation", () => {
    const layout = createRootLayout({ x: 0, y: 0, width: 3, height: 12 }, [
      { id: "pane-a", sourceKind: "terminal-protocol" },
    ]);

    expect(canSplitRect(layout.children[0].rect, "right")).toBe(true);
    expect(layout.split("pane-a", "right", { id: "pane-b", sourceKind: "terminal-protocol" })).toBe(true);
  });
});
