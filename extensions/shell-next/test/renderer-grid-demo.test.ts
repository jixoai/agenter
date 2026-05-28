import { afterEach, describe, expect, test } from "bun:test";
import { createTestRenderer, type TestRenderer } from "@opentui/core/testing";

import { FourPaneRendererGridDemo } from "../src/demos/renderer-grid-demo";

type TestSetup = Awaited<ReturnType<typeof createTestRenderer>>;

let setup: TestSetup | null = null;
let activeDemo: FourPaneRendererGridDemo | null = null;

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
  activeDemo?.destroy();
  activeDemo = null;
  setup?.renderer.destroy();
  setup = null;
});

const startDemo = async (): Promise<TestSetup> => {
  setup = await createTestRenderer({ width: 60, height: 16, useMouse: true });
  const demo = new FourPaneRendererGridDemo({
    renderer: setup.renderer as TestRenderer,
    selectionText: "selectable text for demo",
  });
  activeDemo = demo;
  demo.start();
  await setup.renderOnce();
  return setup;
};

describe("Feature: shell-next four-pane OpenTUI renderer mixing demo", () => {
  test("Scenario: Given the demo starts When rendered Then four pane renderables are mounted in one root renderer", async () => {
    const demo = await startDemo();

    expect(demo.captureCharFrame()).toContain("Pane A / renderer source");
    expect(demo.captureCharFrame()).toContain("Pane B / selectable text");
    expect(demo.captureCharFrame()).toContain("Pane C / click target");
    expect(demo.captureCharFrame()).toContain("Pane D / mixed surface");
  });

  test("Scenario: Given four panes are visible When a pane is clicked Then focus moves through layout ownership", async () => {
    const demo = await startDemo();

    await demo.mockMouse.click(35, 10);
    await demo.renderOnce();

    expect(demo.renderer.currentFocusedRenderable?.id).toBe("pane-d-root");
    expect(demo.captureCharFrame()).toContain("FOCUSED Pane D");
  });

  test("Scenario: Given selectable text is inside a pane When the user drags text Then OpenTUI reports pane-scoped selection", async () => {
    const demo = await startDemo();

    await demo.mockMouse.drag(2, 4, 24, 4);
    await demo.renderOnce();

    expect(demo.renderer.hasSelection).toBe(true);
    expect(demo.renderer.getSelectionContainer()?.id).toBe("pane-a-root");
  });

  test("Scenario: Given generic renderer panes do not install the semantic selection plugin When the user double-clicks selectable text Then pane composition does not implicitly select a whole word", async () => {
    const demo = await startDemo();
    const text = findTextPosition(demo.captureCharFrame(), "selectable text for demo");
    expect(text).not.toBeNull();

    await demo.mockMouse.doubleClick((text?.x ?? 0) + 1, text?.y ?? 0);
    await demo.renderOnce();

    expect(demo.renderer.getSelection()?.getSelectedText() ?? "").toBe("");
  });

  test("Scenario: Given generic renderer panes do not install the semantic selection plugin When the user triple-clicks selectable text Then pane composition does not implicitly select a whole line", async () => {
    const demo = await startDemo();
    const text = findTextPosition(demo.captureCharFrame(), "selectable text for demo");
    expect(text).not.toBeNull();

    await demo.mockMouse.click((text?.x ?? 0) + 1, text?.y ?? 0);
    await demo.mockMouse.click((text?.x ?? 0) + 1, text?.y ?? 0);
    await demo.mockMouse.click((text?.x ?? 0) + 1, text?.y ?? 0);
    await demo.renderOnce();

    expect(demo.renderer.getSelection()?.getSelectedText() ?? "").toBe("");
  });
});
