import type { LayoutRect } from "./layout";

export const PANE_CONTENT_ORIGIN = 0;

const PANE_BORDER_CELLS = 1;

export interface PaneContentSize {
  readonly width: number;
  readonly height: number;
}

export const resolveBorderedPaneContentSize = (rect: LayoutRect): PaneContentSize => ({
  width: Math.max(1, Math.trunc(rect.width) - PANE_BORDER_CELLS * 2),
  height: Math.max(1, Math.trunc(rect.height) - PANE_BORDER_CELLS * 2),
});
