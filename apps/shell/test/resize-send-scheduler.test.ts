import { describe, expect, test } from "bun:test";

import type { TerminalPaneSize } from "../src/renderable-mux/pane-source";
import { ShellResizeSendScheduler } from "../src/terminal-projection/resize-send-scheduler";

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("Feature: shell pane-level resize send scheduling", () => {
  test("Scenario: Given multiple geometry changes inside the 200ms debounce window When the window stays open Then no backend resize is sent early", async () => {
    const delivered: TerminalPaneSize[] = [];
    const scheduler = new ShellResizeSendScheduler({
      delayMs: 200,
      send: (size) => {
        delivered.push(size);
      },
    });

    scheduler.schedule({ cols: 60, rows: 20 });
    await wait(50);
    scheduler.schedule({ cols: 62, rows: 20 });
    await wait(50);
    scheduler.schedule({ cols: 64, rows: 20 });
    await wait(50);

    expect(delivered).toEqual([]);

    await wait(160);

    expect(delivered).toEqual([{ cols: 64, rows: 20 }]);
    scheduler.dispose();
  });

  test("Scenario: Given the same geometry repeats When scheduling Then pane-level debounce does not resend it", async () => {
    const delivered: TerminalPaneSize[] = [];
    const scheduler = new ShellResizeSendScheduler({
      delayMs: 1,
      send: (size) => {
        delivered.push(size);
      },
    });

    scheduler.schedule({ cols: 70, rows: 22 });
    await wait(5);
    scheduler.schedule({ cols: 70, rows: 22 });
    await wait(5);

    expect(delivered).toEqual([{ cols: 70, rows: 22 }]);
    scheduler.dispose();
  });
});
