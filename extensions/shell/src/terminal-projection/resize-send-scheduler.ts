import type { TerminalPaneSize } from "../renderable-mux/pane-source";

export interface ShellResizeSendSchedulerInput {
  readonly delayMs: number;
  readonly send: (size: TerminalPaneSize) => void | Promise<void>;
}

const normalizeSize = (size: TerminalPaneSize): TerminalPaneSize => ({
  cols: Math.max(1, Math.trunc(size.cols)),
  rows: Math.max(1, Math.trunc(size.rows)),
});

const sameSize = (left: TerminalPaneSize | null, right: TerminalPaneSize): boolean =>
  left !== null && left.cols === right.cols && left.rows === right.rows;

export class ShellResizeSendScheduler {
  readonly #delayMs: number;
  readonly #send: (size: TerminalPaneSize) => void | Promise<void>;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #pending: TerminalPaneSize | null = null;
  #lastSent: TerminalPaneSize | null = null;
  #disposed = false;

  constructor(input: ShellResizeSendSchedulerInput) {
    this.#delayMs = Math.max(0, Math.trunc(input.delayMs));
    this.#send = input.send;
  }

  schedule(size: TerminalPaneSize): void {
    if (this.#disposed) {
      return;
    }
    const next = normalizeSize(size);
    if (sameSize(this.#lastSent, next)) {
      this.#pending = null;
      if (this.#timer) {
        clearTimeout(this.#timer);
        this.#timer = null;
      }
      return;
    }
    this.#pending = next;
    if (this.#timer) {
      clearTimeout(this.#timer);
    }
    this.#timer = setTimeout(() => {
      this.#timer = null;
      const pending = this.#pending;
      this.#pending = null;
      if (!pending || sameSize(this.#lastSent, pending)) {
        return;
      }
      this.#lastSent = pending;
      void this.#send(pending);
    }, this.#delayMs);
  }

  dispose(): void {
    this.#disposed = true;
    this.#pending = null;
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }
}
