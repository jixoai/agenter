import { BoxRenderable, TextRenderable, type CliRenderer, type MouseEvent } from "@opentui/core";

import type { ChildLayoutNode, ResizeEdge, RootLayout } from "./layout";

interface ResizeRegion {
  readonly id: string;
  readonly paneId: string;
  readonly edge: ResizeEdge;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly axis: "horizontal" | "vertical";
  readonly content: string;
}

interface ActiveResize {
  readonly paneId: string;
  readonly edge: ResizeEdge;
  readonly axis: "horizontal" | "vertical";
  readonly startedX: number;
  readonly startedY: number;
  readonly clickDelta: number;
  lastX: number;
  lastY: number;
  dragged: boolean;
}

interface ResizeHandleRenderables {
  readonly hitTarget: BoxRenderable;
  readonly visual: TextRenderable;
  region: ResizeRegion;
}

export interface ShellPaneResizeControllerInput {
  readonly renderer: CliRenderer;
  readonly layout: RootLayout;
  readonly onLayoutChanged: () => void;
}

export const resolveShellResizeHandleClickDelta = (input: {
  readonly axis: "horizontal" | "vertical";
  readonly regionX: number;
  readonly regionY: number;
  readonly eventX: number;
  readonly eventY: number;
}): number => {
  if (input.axis === "horizontal") {
    return Math.trunc(input.eventX) <= Math.trunc(input.regionX) ? -1 : 1;
  }
  return Math.trunc(input.eventY) <= Math.trunc(input.regionY) ? -1 : 1;
};

const rectEndX = (node: ChildLayoutNode): number => node.rect.x + node.rect.width;
const rectEndY = (node: ChildLayoutNode): number => node.rect.y + node.rect.height;

const overlap = (startA: number, endA: number, startB: number, endB: number): { start: number; size: number } | null => {
  const start = Math.max(startA, startB);
  const end = Math.min(endA, endB);
  const size = end - start;
  return size > 0 ? { start, size } : null;
};

const centeredOffset = (start: number, size: number, handleSize: number): number =>
  start + Math.max(0, Math.floor((size - handleSize) / 2));

const createRegions = (children: readonly ChildLayoutNode[]): ResizeRegion[] => {
  const regions: ResizeRegion[] = [];
  for (let leftIndex = 0; leftIndex < children.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < children.length; rightIndex += 1) {
      const a = children[leftIndex];
      const b = children[rightIndex];
      if (rectEndX(a) === b.rect.x) {
        const y = overlap(a.rect.y, rectEndY(a), b.rect.y, rectEndY(b));
        if (y) {
          regions.push({
            id: `${a.id}:right:${b.id}`,
            paneId: a.id,
            edge: "right",
            x: Math.max(0, b.rect.x - 1),
            y: centeredOffset(y.start, y.size, 1),
            width: 2,
            height: 1,
            axis: "horizontal",
            content: "◀▶",
          });
        }
      } else if (rectEndX(b) === a.rect.x) {
        const y = overlap(a.rect.y, rectEndY(a), b.rect.y, rectEndY(b));
        if (y) {
          regions.push({
            id: `${b.id}:right:${a.id}`,
            paneId: b.id,
            edge: "right",
            x: Math.max(0, a.rect.x - 1),
            y: centeredOffset(y.start, y.size, 1),
            width: 2,
            height: 1,
            axis: "horizontal",
            content: "◀▶",
          });
        }
      }
      if (rectEndY(a) === b.rect.y) {
        const x = overlap(a.rect.x, rectEndX(a), b.rect.x, rectEndX(b));
        if (x) {
          regions.push({
            id: `${a.id}:bottom:${b.id}`,
            paneId: a.id,
            edge: "bottom",
            x: centeredOffset(x.start, x.size, 1),
            y: Math.max(0, b.rect.y - 1),
            width: 1,
            height: 2,
            axis: "vertical",
            content: "▲\n▼",
          });
        }
      } else if (rectEndY(b) === a.rect.y) {
        const x = overlap(a.rect.x, rectEndX(a), b.rect.x, rectEndX(b));
        if (x) {
          regions.push({
            id: `${b.id}:bottom:${a.id}`,
            paneId: b.id,
            edge: "bottom",
            x: centeredOffset(x.start, x.size, 1),
            y: Math.max(0, a.rect.y - 1),
            width: 1,
            height: 2,
            axis: "vertical",
            content: "▲\n▼",
          });
        }
      }
    }
  }
  return regions;
};

export class ShellPaneResizeController {
  readonly #renderer: CliRenderer;
  readonly #layout: RootLayout;
  readonly #onLayoutChanged: () => void;
  readonly #handles = new Map<string, ResizeHandleRenderables>();
  #hoveredId: string | null = null;
  #active: ActiveResize | null = null;

  constructor(input: ShellPaneResizeControllerInput) {
    this.#renderer = input.renderer;
    this.#layout = input.layout;
    this.#onLayoutChanged = input.onLayoutChanged;
  }

  sync(): void {
    const regions = createRegions(this.#layout.children);
    const live = new Set(regions.map((region) => region.id));
    for (const [id, handle] of this.#handles) {
      if (!live.has(id)) {
        handle.hitTarget.destroyRecursively();
        handle.visual.destroyRecursively();
        this.#handles.delete(id);
      }
    }
    for (const region of regions) {
      const handle = this.#handles.get(region.id) ?? this.#createHandle(region);
      this.#syncHandle(handle, region);
    }
  }

  destroy(): void {
    for (const handle of this.#handles.values()) {
      handle.hitTarget.destroyRecursively();
      handle.visual.destroyRecursively();
    }
    this.#handles.clear();
  }

  #createHandle(region: ResizeRegion): ResizeHandleRenderables {
    const hitTarget = new BoxRenderable(this.#renderer, {
      id: `shell-resizer-hit-${region.id}`,
      position: "absolute",
      width: region.width,
      height: region.height,
      shouldFill: false,
      backgroundColor: "transparent",
      zIndex: 31,
    });
    const visual = new TextRenderable(this.#renderer, {
      id: `shell-resizer-visual-${region.id}`,
      position: "absolute",
      content: region.content,
      width: region.width,
      height: region.height,
      fg: "#94a3b8",
      zIndex: 30,
    });
    this.#renderer.root.add(visual);
    this.#renderer.root.add(hitTarget);
    const handle = { hitTarget, visual, region };
    hitTarget.onMouseMove = (event) => this.#handleMouseMove(handle.region, event);
    hitTarget.onMouseDown = (event) => this.#handleMouseDown(handle.region, event);
    hitTarget.onMouseDrag = (event) => this.#handleMouseDrag(event);
    hitTarget.onMouseUp = (event) => this.#handleMouseUp(event);
    this.#handles.set(region.id, handle);
    return handle;
  }

  #syncHandle(handle: ResizeHandleRenderables, region: ResizeRegion): void {
    handle.region = region;
    const highlighted = this.#hoveredId === region.id || this.#active?.paneId === region.paneId;
    for (const renderable of [handle.hitTarget, handle.visual]) {
      renderable.left = region.x;
      renderable.top = region.y;
      renderable.width = region.width;
      renderable.height = region.height;
    }
    handle.visual.content = region.content;
    handle.visual.fg = highlighted ? "#f8fafc" : "#94a3b8";
  }

  #handleMouseMove(region: ResizeRegion, event: MouseEvent): void {
    if (this.#hoveredId !== region.id) {
      this.#hoveredId = region.id;
      this.sync();
      this.#renderer.requestRender();
    }
    event.preventDefault();
  }

  #handleMouseDown(region: ResizeRegion, event: MouseEvent): void {
    this.#active = {
      paneId: region.paneId,
      edge: region.edge,
      axis: region.axis,
      startedX: Math.trunc(event.x),
      startedY: Math.trunc(event.y),
      clickDelta: resolveShellResizeHandleClickDelta({
        axis: region.axis,
        regionX: region.x,
        regionY: region.y,
        eventX: event.x,
        eventY: event.y,
      }),
      lastX: Math.trunc(event.x),
      lastY: Math.trunc(event.y),
      dragged: false,
    };
    event.preventDefault();
  }

  #handleMouseDrag(event: MouseEvent): void {
    const active = this.#active;
    if (!active) {
      return;
    }
    const x = Math.trunc(event.x);
    const y = Math.trunc(event.y);
    const delta = active.axis === "horizontal" ? x - active.lastX : y - active.lastY;
    if (delta !== 0) {
      active.dragged = true;
    }
    if (delta !== 0 && this.#layout.resizePane(active.paneId, active.edge, delta)) {
      active.lastX = x;
      active.lastY = y;
      this.#onLayoutChanged();
    }
    event.preventDefault();
  }

  #handleMouseUp(event: MouseEvent): void {
    const active = this.#active;
    if (active) {
      if (!active.dragged) {
        const moved = this.#layout.resizePane(active.paneId, active.edge, active.clickDelta);
        if (moved) {
          this.#onLayoutChanged();
        }
      }
      this.#active = null;
      this.sync();
      this.#renderer.requestRender();
      event.preventDefault();
    }
  }
}
