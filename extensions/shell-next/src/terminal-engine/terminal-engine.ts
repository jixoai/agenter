import type { KeyEvent } from "@opentui/core";

import { encodeShellNextTerminalKey } from "../input/terminal-key";
import type { TerminalFrameSnapshot, TerminalProtocolPaneSource } from "../renderable-mux/pane-source";
import { createShellNextTerminalInteractionController } from "./interaction-controller";
import { runShellNextTerminalInputTransaction } from "./input-transaction";

export class ShellNextTerminalEngine {
  #selectionAnchor: { ownerId: string; row: number; col: number } | null = null;

  handleKey(source: TerminalProtocolPaneSource, key: KeyEvent): boolean {
    if (this.#handleInteractionKey(source, key)) {
      return true;
    }
    const encoded = encodeShellNextTerminalKey(key);
    if (!encoded) {
      return false;
    }
    return this.sendInput(source, encoded);
  }

  sendInput(
    source: Pick<TerminalProtocolPaneSource, "writeInput" | "clearSelection" | "followCursor">,
    chunk: string,
    options?: { preserveSelectionAnchor?: boolean },
  ): boolean {
    return runShellNextTerminalInputTransaction({
      source,
      chunk,
      selectionState: { anchor: this.#selectionAnchor },
      onSelectionAnchorChange: (anchor) => {
        this.#selectionAnchor = anchor;
      },
      options,
    });
  }

  sendPasteText(
    source: Pick<TerminalProtocolPaneSource, "writeInput" | "clearSelection" | "followCursor">,
    text: string,
  ): boolean {
    if (text.length === 0) {
      return false;
    }
    return this.sendInput(source, text);
  }

  #handleInteractionKey(source: TerminalProtocolPaneSource, key: KeyEvent): boolean {
    const frame = source.readFrame();
    if (!frame.cursor || !source.selectRange) {
      return false;
    }
    const controller = createShellNextTerminalInteractionController({
      view: this.#readInteractionView(frame),
      selectionState: { anchor: this.#selectionAnchor },
      onSelectionAnchorChange: (anchor) => {
        this.#selectionAnchor = anchor;
      },
      bridge: {
        selectRange: (range) => source.selectRange?.(range) ?? false,
        sendInput: (chunk, options) => this.sendInput(source, chunk, options),
      },
    });
    return controller.handleKey(key);
  }

  #readInteractionView(frame: TerminalFrameSnapshot) {
    const cursor = frame.cursor ?? { x: 0, y: 0, visible: false };
    const viewportStart = Math.max(0, Math.trunc(frame.viewportStart ?? 0));
    return {
      cursorAbsRow: viewportStart + Math.max(0, Math.trunc(cursor.y)),
      cursorCol: Math.max(0, Math.trunc(cursor.x)),
      viewportStart,
      plainLines: frame.lines,
    };
  }
}
