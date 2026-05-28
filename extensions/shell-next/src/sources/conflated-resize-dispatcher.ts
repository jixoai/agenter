import type { TerminalPaneSize } from "../renderable-mux/pane-source";

export interface ConflatedResizeDispatcherInput {
  readonly delayMs: number;
  readonly deliver: (size: TerminalPaneSize) => void | Promise<void>;
}

const normalizeSize = (size: TerminalPaneSize): TerminalPaneSize => ({
  cols: Math.max(1, Math.trunc(size.cols)),
  rows: Math.max(1, Math.trunc(size.rows)),
});

const sameSize = (left: TerminalPaneSize | null, right: TerminalPaneSize): boolean =>
  left !== null && left.cols === right.cols && left.rows === right.rows;

export class ConflatedResizeDispatcher {
  readonly #delayMs: number;
  readonly #deliver: (size: TerminalPaneSize) => void | Promise<void>;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #pending: TerminalPaneSize | null = null;
  #lastDelivered: TerminalPaneSize | null = null;
  #inFlight = false;
  #disposed = false;

  constructor(input: ConflatedResizeDispatcherInput) {
    this.#delayMs = Math.max(0, Math.trunc(input.delayMs));
    this.#deliver = input.deliver;
  }

  resize(size: TerminalPaneSize): void {
    if (this.#disposed) {
      return;
    }
    const next = normalizeSize(size);
    if (sameSize(this.#lastDelivered, next)) {
      this.#pending = null;
      if (this.#timer) {
        clearTimeout(this.#timer);
        this.#timer = null;
      }
      return;
    }
    this.#pending = next;
    this.#schedule();
  }

  dispose(): void {
    this.#disposed = true;
    this.#pending = null;
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }

  #schedule(): void {
    if (this.#disposed || this.#timer || this.#inFlight) {
      return;
    }
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.#flush();
    }, this.#delayMs);
  }

  async #flush(): Promise<void> {
    if (this.#disposed || this.#inFlight) {
      return;
    }
    const pending = this.#pending;
    this.#pending = null;
    if (!pending || sameSize(this.#lastDelivered, pending)) {
      return;
    }
    this.#inFlight = true;
    try {
      await this.#deliver(pending);
      this.#lastDelivered = pending;
    } finally {
      this.#inFlight = false;
    }
    if (this.#pending && !sameSize(this.#lastDelivered, this.#pending)) {
      this.#schedule();
    }
  }
}
