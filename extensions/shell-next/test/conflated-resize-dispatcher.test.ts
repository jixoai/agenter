import { describe, expect, test } from "bun:test";

import { ConflatedResizeDispatcher } from "../src/sources/conflated-resize-dispatcher";
import type { TerminalPaneSize } from "../src/renderable-mux/pane-source";

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const createDeferred = (): { readonly promise: Promise<void>; readonly resolve: () => void } => {
  let resolve: (() => void) | undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  if (!resolve) {
    throw new Error("deferred promise did not install a resolver");
  }
  return { promise, resolve };
};

describe("Feature: shell-next terminal source resize scheduling", () => {
  test("Scenario: Given backend resize is blocked When newer sizes arrive Then only newest pending size is delivered", async () => {
    const delivered: TerminalPaneSize[] = [];
    const firstBlocked = createDeferred();
    const dispatcher = new ConflatedResizeDispatcher({
      delayMs: 1,
      deliver: async (size) => {
        delivered.push(size);
        if (delivered.length === 1) {
          await firstBlocked.promise;
        }
      },
    });

    dispatcher.resize({ cols: 80, rows: 24 });
    await wait(5);
    dispatcher.resize({ cols: 81, rows: 24 });
    dispatcher.resize({ cols: 82, rows: 24 });
    dispatcher.resize({ cols: 83, rows: 24 });
    await wait(5);

    expect(delivered).toEqual([{ cols: 80, rows: 24 }]);

    firstBlocked.resolve();
    await wait(10);

    expect(delivered).toEqual([
      { cols: 80, rows: 24 },
      { cols: 83, rows: 24 },
    ]);
    dispatcher.dispose();
  });

  test("Scenario: Given one stable resize When debounce expires Then source dispatcher delivers it once", async () => {
    const delivered: TerminalPaneSize[] = [];
    const dispatcher = new ConflatedResizeDispatcher({
      delayMs: 1,
      deliver: (size) => {
        delivered.push(size);
      },
    });

    dispatcher.resize({ cols: 100, rows: 30 });
    await wait(5);
    dispatcher.resize({ cols: 100, rows: 30 });
    await wait(5);

    expect(delivered).toEqual([{ cols: 100, rows: 30 }]);
    dispatcher.dispose();
  });
});
