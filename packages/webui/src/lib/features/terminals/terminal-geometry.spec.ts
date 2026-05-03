import { describe, expect, test } from "vitest";

import {
  resolveTerminalGridFromFrame,
  resolveTerminalScreenMetrics,
  resolveTerminalWindowProjection,
} from "./terminal-geometry";

describe("Feature: terminal window geometry", () => {
  test("Scenario: Given cover mode has more room than the terminal frame When resolving projection Then the scale is capped at one instead of growing with the container", () => {
    expect(
      resolveTerminalWindowProjection({
        mode: "cover",
        frameWidth: 800,
        frameHeight: 420,
        availableWidth: 1440,
        availableHeight: 900,
        headerHeight: 44,
      }),
    ).toMatchObject({
      scale: 1,
      bodyWidth: 800,
      bodyHeight: 420,
      shellWidth: 800,
      shellHeight: 464,
      anchor: "start",
    });
  });

  test("Scenario: Given terminal content is inset inside a frame When resolving projection Then the window body tracks the content box instead of preserving a visible gutter", () => {
    expect(
      resolveTerminalWindowProjection({
        mode: "cover",
        frameWidth: 810,
        frameHeight: 440,
        contentWidth: 800,
        contentHeight: 420,
        availableWidth: 1440,
        availableHeight: 900,
        headerHeight: 44,
      }),
    ).toMatchObject({
      scale: 1,
      bodyWidth: 800,
      bodyHeight: 420,
      shellWidth: 800,
      shellHeight: 464,
      anchor: "start",
    });
  });

  test("Scenario: Given cover mode has less room than the terminal frame When resolving projection Then the terminal keeps native scale and lets the shared viewport scroll", () => {
    expect(
      resolveTerminalWindowProjection({
        mode: "cover",
        frameWidth: 1180,
        frameHeight: 720,
        availableWidth: 760,
        availableHeight: 500,
        headerHeight: 44,
      }),
    ).toMatchObject({
      scale: 1,
      bodyWidth: 1180,
      bodyHeight: 720,
      shellWidth: 1180,
      shellHeight: 764,
      anchor: "start",
    });
  });

  test("Scenario: Given fit mode has less room than the terminal frame When resolving projection Then the terminal shrinks to remain fully visible", () => {
    expect(
      resolveTerminalWindowProjection({
        mode: "fit",
        frameWidth: 1180,
        frameHeight: 720,
        availableWidth: 760,
        availableHeight: 500,
        headerHeight: 44,
      }),
    ).toMatchObject({
      scale: 0.6333333333333333,
      bodyWidth: 747,
      bodyHeight: 456,
      shellWidth: 747,
      shellHeight: 500,
      anchor: "center",
    });
  });

  test("Scenario: Given fit mode width is tighter but height is available When resolving projection Then inline-fit fills width while preserving an unscaled titlebar budget", () => {
    expect(
      resolveTerminalWindowProjection({
        mode: "fit",
        frameWidth: 1180,
        frameHeight: 720,
        availableWidth: 760,
        availableHeight: 820,
        headerHeight: 44,
      }),
    ).toMatchObject({
      scale: 0.6440677966101694,
      bodyWidth: 760,
      bodyHeight: 464,
      shellWidth: 760,
      shellHeight: 508,
      anchor: "center",
    });
  });

  test("Scenario: Given fit mode height is tighter but width is available When resolving projection Then block-fit fills height while width remains centered", () => {
    expect(
      resolveTerminalWindowProjection({
        mode: "fit",
        frameWidth: 1180,
        frameHeight: 720,
        availableWidth: 1440,
        availableHeight: 500,
        headerHeight: 44,
      }),
    ).toMatchObject({
      scale: 0.6333333333333333,
      bodyWidth: 747,
      bodyHeight: 456,
      shellWidth: 747,
      shellHeight: 500,
      anchor: "center",
    });
  });

  test("Scenario: Given a dragged terminal frame When deriving PTY geometry Then the result snaps to cols and rows instead of preserving arbitrary pixels", () => {
    expect(
      resolveTerminalGridFromFrame({
        frameWidth: 728,
        frameHeight: 446,
        cellWidth: 9,
        cellHeight: 19,
        framePaddingX: 5,
        framePaddingY: 10,
      }),
    ).toEqual({
      cols: 80,
      rows: 22,
    });
  });

  test("Scenario: Given a very small terminal frame When deriving PTY geometry Then the minimum interactive grid is preserved", () => {
    expect(
      resolveTerminalGridFromFrame({
        frameWidth: 24,
        frameHeight: 18,
        cellWidth: 9,
        cellHeight: 19,
        framePaddingX: 5,
        framePaddingY: 10,
      }),
    ).toEqual({
      cols: 8,
      rows: 4,
    });
  });

  test("Scenario: Given a projected viewport is smaller than the intrinsic terminal frame When deriving PTY geometry Then resize uses the drag frame instead of collapsing to the projection box", () => {
    expect(
      resolveTerminalGridFromFrame({
        frameWidth: 920,
        frameHeight: 520,
        cellWidth: 9,
        cellHeight: 19,
        framePaddingX: 5,
        framePaddingY: 10,
      }),
    ).toEqual({
      cols: 101,
      rows: 26,
    });
  });

  test("Scenario: Given renderer-measured viewport dimensions When resolving screen metrics Then frame padding remains a cell-derived safe area", () => {
    expect(
      resolveTerminalScreenMetrics({
        cols: 80,
        rows: 24,
        screenWidth: 800,
        screenHeight: 432,
      }),
    ).toMatchObject({
      cols: 80,
      rows: 24,
      cellWidth: 10,
      cellHeight: 18,
      framePaddingX: 5,
      framePaddingY: 9,
      frameWidth: 810,
      frameHeight: 450,
    });
  });
});
