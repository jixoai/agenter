import { MouseButton, type MouseEvent } from "@opentui/core";
import { describe, expect, test } from "bun:test";

import { ShellNextButtonPressController } from "../src/renderable-mux/button-press-controller";

const createMouseEvent = (x: number, y: number, button = MouseButton.LEFT): MouseEvent => {
  let defaultPrevented = false;
  return {
    x,
    y,
    button,
    preventDefault() {
      defaultPrevented = true;
    },
    get defaultPrevented() {
      return defaultPrevented;
    },
  } as unknown as MouseEvent;
};

describe("Feature: shell-next shared Button click commitment", () => {
  test("Scenario: Given one button is pressed When mouseup completes on that same button Then the action fires once, but mousedown alone does not fire it", () => {
    const actions: string[] = [];
    const controller = new ShellNextButtonPressController({
      resolveAction: (event) => {
        const x = Math.trunc(event.x);
        const y = Math.trunc(event.y);
        if (y === 2 && x >= 10 && x < 16) {
          return "help";
        }
        if (y === 2 && x >= 17 && x < 23) {
          return "chat";
        }
        return null;
      },
      onClick: (action) => {
        actions.push(action);
      },
    });

    controller.handleMouseDown(createMouseEvent(11, 2));
    expect(actions).toEqual([]);

    controller.handleMouseUp(createMouseEvent(11, 2));
    expect(actions).toEqual(["help"]);

    controller.handleMouseDown(createMouseEvent(11, 2));
    controller.handleMouseUp(createMouseEvent(30, 2));
    expect(actions).toEqual(["help"]);
  });
});
