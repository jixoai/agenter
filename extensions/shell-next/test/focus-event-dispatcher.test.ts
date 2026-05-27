import type { KeyEvent } from "@opentui/core";
import { describe, expect, test } from "bun:test";

import { ShellNextFocusEventDispatcher } from "../src/app/focus-event-dispatcher";

const createKeyEvent = (name: string): KeyEvent => {
  let defaultPrevented = false;
  return {
    name,
    sequence: name,
    raw: name,
    ctrl: false,
    meta: false,
    shift: false,
    alt: false,
    option: false,
    number: false,
    eventType: "keypress",
    source: "keyboard",
    path: [],
    code: name,
    key: name,
    preventDefault: () => {
      defaultPrevented = true;
    },
    get defaultPrevented() {
      return defaultPrevented;
    },
  } as unknown as KeyEvent;
};

describe("Feature: shell-next focusable key node tree", () => {
  test("Scenario: Given a focused child node When dispatching a key Then capture target and bubble follow the focus path", () => {
    const dispatcher = new ShellNextFocusEventDispatcher();
    const calls: string[] = [];
    dispatcher.register({
      id: "root",
      scope: "global",
      active: () => true,
      onKeyCapture: () => {
        calls.push("root:capture");
      },
      onKeyBubble: () => {
        calls.push("root:bubble");
      },
    });
    dispatcher.register({
      id: "pane",
      parentId: "root",
      scope: "pane",
      active: () => true,
      onKeyCapture: () => {
        calls.push("pane:capture");
      },
      onKeyBubble: () => {
        calls.push("pane:bubble");
      },
    });
    dispatcher.register({
      id: "content",
      parentId: "pane",
      scope: "pane",
      active: () => true,
      focused: () => true,
      onKey: (_key, context) => {
        calls.push(`${context.nodeId}:target:${context.path.map((node) => node.id).join(">")}`);
      },
    });

    expect(dispatcher.dispatch(createKeyEvent("x"))).toBe(false);

    expect(calls).toEqual([
      "root:capture",
      "pane:capture",
      "content:target:root>pane>content",
      "pane:bubble",
      "root:bubble",
    ]);
  });

  test("Scenario: Given capture handles a key When dispatching Then target and bubble nodes do not also consume it", () => {
    const dispatcher = new ShellNextFocusEventDispatcher();
    const calls: string[] = [];
    dispatcher.register({
      id: "root",
      scope: "global",
      active: () => true,
      onKeyCapture: () => {
        calls.push("root:capture");
        return true;
      },
      onKeyBubble: () => {
        calls.push("root:bubble");
      },
    });
    dispatcher.register({
      id: "dialog",
      parentId: "root",
      scope: "top-layer",
      active: () => true,
      focused: () => true,
      onKey: () => {
        calls.push("dialog:target");
        return true;
      },
    });

    const key = createKeyEvent("escape");
    expect(dispatcher.dispatch(key)).toBe(true);

    expect(calls).toEqual(["root:capture"]);
    expect(key.defaultPrevented).toBe(true);
  });
});
