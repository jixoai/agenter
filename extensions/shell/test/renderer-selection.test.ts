import { BoxRenderable, TextRenderable } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";
import { afterEach, describe, expect, test } from "bun:test";

import { createShellRendererSelectionBehavior } from "../src/renderable-mux/renderer-selection";

type TestSetup = Awaited<ReturnType<typeof createTestRenderer>>;

let setup: TestSetup | null = null;

afterEach(() => {
  setup?.renderer.destroy();
  setup = null;
});

const startSelectionHarness = async (): Promise<{
  setup: TestSetup;
  text: TextRenderable;
}> => {
  setup = await createTestRenderer({ width: 40, height: 6, useMouse: true });
  const root = new BoxRenderable(setup.renderer, {
    id: "renderer-selection-root",
    position: "absolute",
    left: 0,
    top: 0,
    width: 40,
    height: 6,
    focusable: true,
  });
  const text = new TextRenderable(setup.renderer, {
    id: "renderer-selection-text",
    position: "absolute",
    left: 1,
    top: 1,
    width: 30,
    height: 1,
    content: "hello room world",
    selectable: true,
    selectionBg: "#86efac",
    selectionFg: "#052e16",
  });
  const behavior = createShellRendererSelectionBehavior({
    renderer: setup.renderer,
    resolveTargets: () => [{ renderable: text }],
  });
  root.onMouseDown = (event) => {
    behavior.handleMouseDown(event);
  };
  root.onMouseUp = (event) => {
    behavior.handleMouseUp(event);
  };
  root.add(text);
  setup.renderer.root.add(root);
  await setup.renderOnce();
  return { setup, text };
};

describe("Feature: shell renderer semantic selection plugin", () => {
  test("Scenario: Given a renderer pane installs the explicit semantic selection plugin When the user double-clicks a word Then the plugin selects the whole word", async () => {
    const { setup, text } = await startSelectionHarness();

    await setup.mockMouse.doubleClick(text.screenX + 1, text.screenY);
    await setup.renderOnce();

    expect(setup.renderer.getSelection()?.getSelectedText()).toBe("hello");
  });

  test("Scenario: Given a renderer pane installs the explicit semantic selection plugin When the user triple-clicks a row Then the plugin selects the whole line", async () => {
    const { setup, text } = await startSelectionHarness();

    await setup.mockMouse.click(text.screenX + 1, text.screenY);
    await setup.mockMouse.click(text.screenX + 1, text.screenY);
    await setup.mockMouse.click(text.screenX + 1, text.screenY);
    await setup.renderOnce();

    expect(setup.renderer.getSelection()?.getSelectedText()).toBe("hello room world");
  });
});
