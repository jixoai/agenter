import { describe, expect, test } from "bun:test";

import {
  TERMINAL_MOUSE_TRACKING_NONE,
  createBackendInteractionAdapter,
  type Cell,
  type TerminalMouseTrackingState,
} from "@agenter/termless-core";
import { createTerminalHostInputController, type TerminalHostInputTarget } from "../src/terminal-host-input.js";

const emptyCell = (char: string): Cell => ({
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
});

const createKeyboardTarget = (input: {
  line: string;
  cursorCol: number;
  mouseTracking?: TerminalMouseTrackingState;
}): {
  target: TerminalHostInputTarget & { copySelection(ownerId?: string): string };
  writes: Array<string | Uint8Array>;
  readonly followCursorCalls: number;
} => {
  const readable = {
    getLine(row: number) {
      return Array.from(row === 0 ? input.line : "").map(emptyCell);
    },
    getScrollback() {
      return {
        viewportOffset: 0,
        totalLines: 1,
        screenLines: 1,
      };
    },
  };
  const interaction = createBackendInteractionAdapter({
    ownerId: "terminal",
    readable,
    followCursor: () => true,
  });
  const writes: Array<string | Uint8Array> = [];
  let followCursorCalls = 0;
  const target: TerminalHostInputTarget & { copySelection(ownerId?: string): string } = {
    ...interaction,
    readKeyboardInteractionView() {
      return {
        cursorAbsRow: 0,
        cursorCol: input.cursorCol,
        viewportStart: 0,
        plainLines: [input.line],
      };
    },
    writeInput(chunk) {
      writes.push(chunk);
      return true;
    },
    readMouseTrackingState() {
      return input.mouseTracking ?? TERMINAL_MOUSE_TRACKING_NONE;
    },
    followCursor() {
      followCursorCalls += 1;
      return true;
    },
  };
  return {
    target,
    writes,
    get followCursorCalls() {
      return followCursorCalls;
    },
  };
};

describe("Feature: termless backend host input utilities", () => {
  test("Scenario: Given a plain shell drag When pointer ownership stays in the backend Then drag selection finalizes explicitly", () => {
    const controller = createTerminalHostInputController();
    const target = createKeyboardTarget({ line: "$ echo alpha beta gamma", cursorCol: 0 }).target;

    const down = controller.handlePointerDown(target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 2 },
      viewportPoint: { ownerId: "terminal", row: 0, col: 2 },
      timestampMs: 100,
    });
    const drag = controller.handlePointerDrag(target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 12 },
      viewportPoint: { ownerId: "terminal", row: 0, col: 12 },
      timestampMs: 110,
    });
    const up = controller.handlePointerUp(target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 12 },
      viewportPoint: { ownerId: "terminal", row: 0, col: 12 },
      timestampMs: 120,
    });

    expect(down).toEqual({ handled: false, preventDefault: false, effect: "none" });
    expect(drag).toEqual({ handled: true, preventDefault: true, effect: "selection" });
    expect(up).toEqual({ handled: true, preventDefault: true, effect: "selection-finalized" });
    expect(target.copySelection("terminal")).toBe("echo alpha");
  });

  test("Scenario: Given a mouse-aware TUI requests SGR drag tracking When host pointer events arrive Then PTY bytes are written and selection is skipped", () => {
    const controller = createTerminalHostInputController();
    const targetState = createKeyboardTarget({
      line: "$ echo alpha beta gamma",
      cursorCol: 0,
      mouseTracking: { protocol: "drag", encoding: "sgr" },
    });

    const down = controller.handlePointerDown(targetState.target, {
      button: "left",
      point: { ownerId: "terminal", row: 20, col: 4 },
      viewportPoint: { ownerId: "terminal", row: 2, col: 4 },
      timestampMs: 100,
    });
    const drag = controller.handlePointerDrag(targetState.target, {
      button: "left",
      point: { ownerId: "terminal", row: 21, col: 6 },
      viewportPoint: { ownerId: "terminal", row: 3, col: 6 },
      timestampMs: 110,
    });
    const up = controller.handlePointerUp(targetState.target, {
      button: "left",
      point: { ownerId: "terminal", row: 21, col: 6 },
      viewportPoint: { ownerId: "terminal", row: 3, col: 6 },
      timestampMs: 120,
    });

    expect(down).toEqual({ handled: true, preventDefault: true, effect: "pty-mouse" });
    expect(drag).toEqual({ handled: true, preventDefault: true, effect: "pty-mouse" });
    expect(up).toEqual({ handled: true, preventDefault: true, effect: "pty-mouse" });
    expect(targetState.writes).toEqual(["\x1b[<0;5;3M", "\x1b[<32;7;4M", "\x1b[<0;7;4m"]);
    expect(targetState.target.getSelectionOverlay("terminal")).toBeNull();
  });

  test("Scenario: Given default encoded mouse tracking When a wheel event arrives Then backend utilities write xterm default mouse bytes", () => {
    const controller = createTerminalHostInputController();
    const targetState = createKeyboardTarget({
      line: "$ echo alpha beta gamma",
      cursorCol: 0,
      mouseTracking: { protocol: "vt200", encoding: "default" },
    });

    const result = controller.handlePointerScroll(targetState.target, {
      button: "wheel-down",
      point: { ownerId: "terminal", row: 10, col: 0 },
      viewportPoint: { ownerId: "terminal", row: 0, col: 0 },
      timestampMs: 100,
    });

    expect(result).toEqual({ handled: true, preventDefault: true, effect: "pty-mouse" });
    expect(targetState.writes).toEqual(["\x1b[Ma!!"]);
  });

  test("Scenario: Given active PTY mouse tracking When Shift drag is delivered by the host Then the operator escape hatch still selects text", () => {
    const controller = createTerminalHostInputController();
    const targetState = createKeyboardTarget({
      line: "$ echo alpha beta gamma",
      cursorCol: 0,
      mouseTracking: { protocol: "any", encoding: "sgr" },
    });

    controller.handlePointerDown(targetState.target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 2 },
      viewportPoint: { ownerId: "terminal", row: 0, col: 2 },
      modifiers: { shift: true },
      timestampMs: 100,
    });
    const drag = controller.handlePointerDrag(targetState.target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 12 },
      viewportPoint: { ownerId: "terminal", row: 0, col: 12 },
      modifiers: { shift: true },
      timestampMs: 110,
    });
    const up = controller.handlePointerUp(targetState.target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 12 },
      viewportPoint: { ownerId: "terminal", row: 0, col: 12 },
      modifiers: { shift: true },
      timestampMs: 120,
    });

    expect(drag.effect).toBe("selection");
    expect(up.effect).toBe("selection-finalized");
    expect(targetState.writes).toEqual([]);
    expect(targetState.target.copySelection("terminal")).toBe("echo alpha");
  });

  test("Scenario: Given a semantic double click When the backend selects a word Then mouseup does not clear the backend-owned selection", () => {
    const controller = createTerminalHostInputController();
    const target = createKeyboardTarget({ line: "$ echo alpha beta gamma", cursorCol: 0 }).target;

    controller.handlePointerDown(target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 9 },
      timestampMs: 100,
    });
    controller.handlePointerUp(target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 9 },
      timestampMs: 120,
    });
    controller.handlePointerDown(target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 9 },
      timestampMs: 180,
    });
    controller.handlePointerUp(target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 9 },
      timestampMs: 200,
    });

    expect(target.copySelection("terminal")).toBe("alpha");
    expect(target.getSelectionOverlay("terminal")?.rows).toEqual([{ row: 0, startCol: 7, endCol: 12 }]);
  });

  test("Scenario: Given Shift plus arrow When keyboard ownership is handled in the lower controller Then the selection and cursor input are both forwarded from one place", () => {
    const controller = createTerminalHostInputController();
    const targetState = createKeyboardTarget({
      line: "$ echo alpha beta gamma",
      cursorCol: 9,
    });
    const { target, writes } = targetState;

    const handled = controller.handleKey(target, {
      name: "left",
      sequence: "",
      raw: "",
      ctrl: false,
      meta: false,
      option: false,
      shift: true,
    });

    expect(handled).toBe(true);
    expect(target.copySelection("terminal")).toBe("l");
    expect(writes).toEqual(["\u001b[D"]);
    expect(targetState.followCursorCalls).toBe(1);
  });

  test("Scenario: Given Option and Shift plus Option arrow keys When the lower controller handles word navigation Then plain movement and word selection stay source-owned", () => {
    const controller = createTerminalHostInputController();
    const move = createKeyboardTarget({
      line: "$ echo alpha beta gamma",
      cursorCol: 7,
    });
    const select = createKeyboardTarget({
      line: "$ echo alpha beta gamma",
      cursorCol: 7,
    });

    const moved = controller.handleKey(move.target, {
      name: "right",
      sequence: "",
      raw: "",
      ctrl: false,
      meta: false,
      option: true,
      shift: false,
    });
    const selected = controller.handleKey(select.target, {
      name: "right",
      sequence: "",
      raw: "",
      ctrl: false,
      meta: false,
      option: true,
      shift: true,
    });

    expect(moved).toBe(true);
    expect(move.writes).toEqual(["\u001b[C\u001b[C\u001b[C\u001b[C\u001b[C"]);
    expect(move.target.copySelection("terminal")).toBe("");
    expect(selected).toBe(true);
    expect(select.writes).toEqual(["\u001b[C\u001b[C\u001b[C\u001b[C\u001b[C"]);
    expect(select.target.copySelection("terminal")).toBe("alpha");
  });

  test("Scenario: Given keyboard utilities are disabled When key and paste events arrive Then they do not mutate backend input state", () => {
    const controller = createTerminalHostInputController({ keyboard: false });
    const targetState = createKeyboardTarget({
      line: "$ echo alpha beta gamma",
      cursorCol: 9,
    });
    const { target, writes } = targetState;
    target.selectRange({
      ownerId: "terminal",
      startRow: 0,
      startCol: 7,
      endRow: 0,
      endCol: 12,
    });

    const handledKey = controller.handleKey(target, {
      name: "a",
      sequence: "a",
      raw: "a",
      ctrl: false,
      meta: false,
      option: false,
      shift: false,
    });
    const handledPaste = controller.pasteText(target, "pasted");

    expect(handledKey).toBe(false);
    expect(handledPaste).toBe(false);
    expect(writes).toEqual([]);
    expect(target.copySelection("terminal")).toBe("alpha");
    expect(targetState.followCursorCalls).toBe(0);
  });

  test("Scenario: Given word navigation is disabled When Option arrow is pressed Then the utility falls through without synthesized movement", () => {
    const controller = createTerminalHostInputController({ keyboard: { wordNavigation: false } });
    const targetState = createKeyboardTarget({
      line: "$ echo alpha beta gamma",
      cursorCol: 7,
    });

    const handled = controller.handleKey(targetState.target, {
      name: "right",
      sequence: "",
      raw: "",
      ctrl: false,
      meta: false,
      option: true,
      shift: false,
    });

    expect(handled).toBe(false);
    expect(targetState.writes).toEqual([]);
    expect(targetState.followCursorCalls).toBe(0);
  });

  test("Scenario: Given semantic pointer selection is disabled When a double click arrives Then word selection is not called", () => {
    const controller = createTerminalHostInputController({ pointer: { semanticSelection: false } });
    const target = createKeyboardTarget({ line: "$ echo alpha beta gamma", cursorCol: 0 }).target;

    controller.handlePointerDown(target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 9 },
      timestampMs: 100,
    });
    controller.handlePointerUp(target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 9 },
      timestampMs: 120,
    });
    const down = controller.handlePointerDown(target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 9 },
      timestampMs: 180,
    });
    const up = controller.handlePointerUp(target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 9 },
      timestampMs: 200,
    });

    expect(down).toEqual({ handled: false, preventDefault: false, effect: "none" });
    expect(up).toEqual({ handled: false, preventDefault: false, effect: "none" });
    expect(target.copySelection("terminal")).toBe("");
    expect(target.getSelectionOverlay("terminal")).toBeNull();
  });

  test("Scenario: Given drag selection is disabled but semantic selection is enabled When dragging and double clicking Then only semantic selection mutates backend state", () => {
    const controller = createTerminalHostInputController({
      pointer: { dragSelection: false, semanticSelection: true },
    });
    const target = createKeyboardTarget({ line: "$ echo alpha beta gamma", cursorCol: 0 }).target;

    controller.handlePointerDown(target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 2 },
      timestampMs: 100,
    });
    const drag = controller.handlePointerDrag(target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 12 },
      timestampMs: 110,
    });
    controller.handlePointerUp(target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 12 },
      timestampMs: 120,
    });

    controller.handlePointerDown(target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 9 },
      timestampMs: 700,
    });
    controller.handlePointerUp(target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 9 },
      timestampMs: 720,
    });
    const semantic = controller.handlePointerDown(target, {
      button: "left",
      point: { ownerId: "terminal", row: 0, col: 9 },
      timestampMs: 760,
    });

    expect(drag).toEqual({ handled: false, preventDefault: false, effect: "none" });
    expect(semantic).toEqual({ handled: true, preventDefault: true, effect: "selection" });
    expect(target.copySelection("terminal")).toBe("alpha");
  });

  test("Scenario: Given input transaction steps are disabled When plain input is accepted Then write still happens without clear-selection or follow-cursor", () => {
    const controller = createTerminalHostInputController({
      keyboard: { clearSelectionOnInput: false, followCursorOnInput: false },
    });
    const targetState = createKeyboardTarget({
      line: "$ echo alpha beta gamma",
      cursorCol: 9,
    });
    const { target, writes } = targetState;
    target.selectRange({
      ownerId: "terminal",
      startRow: 0,
      startCol: 7,
      endRow: 0,
      endCol: 12,
    });

    const handled = controller.handleKey(target, {
      name: "a",
      sequence: "a",
      raw: "a",
      ctrl: false,
      meta: false,
      option: false,
      shift: false,
    });

    expect(handled).toBe(true);
    expect(writes).toEqual(["a"]);
    expect(target.copySelection("terminal")).toBe("alpha");
    expect(targetState.followCursorCalls).toBe(0);
  });
});
