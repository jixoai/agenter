import { afterEach, describe, expect, test } from "bun:test";
import { createTestRenderer, type TestRenderer } from "@opentui/core/testing";

import { FourPaneRendererGridDemo } from "../src/demos/renderer-grid-demo";

type TestSetup = Awaited<ReturnType<typeof createTestRenderer>>;

let setup: TestSetup | null = null;
let activeDemo: FourPaneRendererGridDemo | null = null;

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
});
