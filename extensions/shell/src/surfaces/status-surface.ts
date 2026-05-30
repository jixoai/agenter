import { TextRenderable, type CliRenderer } from "@opentui/core";

import type { ChildLayoutNode } from "../renderable-mux/layout";
import { buildShellStatusbarLeft, type ShellStatusbarState } from "../renderable-mux/statusbar";
import type { OpenTuiRenderableSurface } from "../renderable-mux/pane-source";

export interface ShellStatusSurfaceInput {
  readonly renderer: CliRenderer;
  readonly node: ChildLayoutNode;
  readonly getState: () => ShellStatusbarState;
}

const truncateLine = (text: string, width: number): string => {
  const safeWidth = Math.max(1, Math.trunc(width));
  if (text.length <= safeWidth) {
    return text;
  }
  if (safeWidth <= 3) {
    return text.slice(0, safeWidth);
  }
  return `${text.slice(0, safeWidth - 3)}...`;
};

export class ShellStatusSurface implements OpenTuiRenderableSurface {
  readonly #renderer: CliRenderer;
  readonly #getState: () => ShellStatusbarState;
  readonly #root: TextRenderable;
  #node: ChildLayoutNode;

  constructor(input: ShellStatusSurfaceInput) {
    this.#renderer = input.renderer;
    this.#getState = input.getState;
    this.#node = input.node;
    this.#root = new TextRenderable(this.#renderer, {
      id: `${input.node.id}-status-root`,
      position: "absolute",
      left: input.node.rect.x,
      top: input.node.rect.y,
      width: Math.max(1, input.node.rect.width),
      height: 1,
      content: "",
      fg: "#cbd5e1",
      bg: "#0f172a",
      wrapMode: "none",
    });
    this.syncNode(input.node);
  }

  get root(): TextRenderable {
    return this.#root;
  }

  syncNode(node: ChildLayoutNode): void {
    this.#node = node;
    this.#root.left = node.rect.x;
    this.#root.top = node.rect.y;
    this.#root.width = Math.max(1, node.rect.width);
    this.#root.height = 1;
    this.refresh();
  }

  refresh(): void {
    this.#root.content = truncateLine(buildShellStatusbarLeft(this.#getState()), Number(this.#root.width));
    this.#renderer.requestRender();
  }

  dispose(): void {
    this.#root.destroyRecursively();
  }
}
