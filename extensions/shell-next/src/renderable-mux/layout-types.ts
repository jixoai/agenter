export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type LayoutSourceKind = "terminal-protocol" | "opentui-renderable";

export type LayoutAxis = "horizontal" | "vertical";

export type SplitDirection = "left" | "right" | "above" | "below";

export type FocusDirection = "left" | "right" | "up" | "down";

export type ResizeEdge = "left" | "right" | "top" | "bottom";

export interface LayoutPaneInput {
  id: string;
  sourceId?: string;
  sourceKind: LayoutSourceKind;
}

export interface ChildLayoutNode extends LayoutPaneInput {
  rect: LayoutRect;
  focused: boolean;
}

export interface RootLayout {
  readonly rect: LayoutRect;
  readonly children: readonly ChildLayoutNode[];
  resize(rect: LayoutRect): void;
  focus(nodeId: string): boolean;
  focusAdjacent(direction: FocusDirection): boolean;
  split(nodeId: string, direction: SplitDirection, pane: LayoutPaneInput): boolean;
  movePane(nodeId: string, anchorNodeId: string, direction: SplitDirection): boolean;
  close(nodeId: string): boolean;
  resizePane(nodeId: string, edge: ResizeEdge, delta: number): boolean;
  hitTest(x: number, y: number): ChildLayoutNode | null;
}
