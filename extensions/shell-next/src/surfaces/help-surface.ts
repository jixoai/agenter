import { BoxRenderable, TextRenderable, type CliRenderer } from "@opentui/core";

import type { ChildLayoutNode } from "../renderable-mux/layout";
import {
  resolveShellNextPaneChromeClick,
  shellNextPaneCloseAction,
  syncShellNextPaneChrome,
  type ShellNextPaneChromeHitRegion,
} from "../renderable-mux/pane-chrome";
import { PANE_CONTENT_ORIGIN, resolveBorderedPaneContentSize } from "../renderable-mux/pane-content-geometry";
import type { OpenTuiRenderableSurface } from "../renderable-mux/pane-source";

export interface ShellNextHelpSurfaceInput {
  renderer: CliRenderer;
  node: ChildLayoutNode;
  onFocus?: (paneId: string) => void;
  onClose?: (paneId: string) => void;
}

const helpLines = [
  "shell-next help",
  "",
  "Prefix         Ctrl+B",
  "Ctrl+B H/?     show or hide this help pane",
  "Ctrl+B C       show or hide Chat pane",
  "Ctrl+B Q       close shell-next / current shell pane",
  "Ctrl+B N       split focused shell to the right",
  "Ctrl+B W       close focused pane",
  "Ctrl+B Tab     focus next pane",
  "Ctrl+B Arrow   focus adjacent pane",
  "",
  "Renderer panes support host copy and paste.",
  "Terminal input is routed only to terminal-protocol panes.",
];

export class ShellNextHelpSurface implements OpenTuiRenderableSurface {
  readonly #renderer: CliRenderer;
  readonly #root: BoxRenderable;
  readonly #content: TextRenderable;
  readonly #onFocus: ((paneId: string) => void) | undefined;
  readonly #onClose: ((paneId: string) => void) | undefined;
  #node: ChildLayoutNode;
  #chromeRegions: readonly ShellNextPaneChromeHitRegion[] = [];

  constructor(input: ShellNextHelpSurfaceInput) {
    this.#renderer = input.renderer;
    this.#node = input.node;
    this.#onFocus = input.onFocus;
    this.#onClose = input.onClose;
    this.#root = new BoxRenderable(this.#renderer, {
      id: `${input.node.id}-help-root`,
      position: "absolute",
      border: true,
      borderStyle: "rounded",
      borderColor: input.node.focused ? "#facc15" : "#475569",
      focusedBorderColor: "#facc15",
      backgroundColor: "#111827",
      titleAlignment: "left",
      focusable: true,
    });
    this.#root.onMouseDown = (event) => {
      if (resolveShellNextPaneChromeClick({ event, regions: this.#chromeRegions }) === "close") {
        event.preventDefault();
        this.#onClose?.(this.#node.id);
        return;
      }
      this.#onFocus?.(this.#node.id);
    };
    this.#root.onMouseMove = (event) => {
      const hovered = resolveShellNextPaneChromeClick({ event, regions: this.#chromeRegions }) === "close";
      this.#root.borderColor = hovered ? "#facc15" : this.#node.focused ? "#facc15" : "#475569";
      if (hovered) {
        event.preventDefault();
      }
    };
    this.#content = new TextRenderable(this.#renderer, {
      id: `${input.node.id}-help-content`,
      position: "absolute",
      left: PANE_CONTENT_ORIGIN,
      top: PANE_CONTENT_ORIGIN,
      width: resolveBorderedPaneContentSize(input.node.rect).width,
      height: resolveBorderedPaneContentSize(input.node.rect).height,
      content: "",
      fg: "#e5e7eb",
      bg: "#111827",
      selectable: true,
      selectionBg: "#facc15",
      selectionFg: "#111827",
      wrapMode: "word",
    });
    this.#root.add(this.#content);
    this.syncNode(input.node);
  }

  get root(): BoxRenderable {
    return this.#root;
  }

  syncNode(node: ChildLayoutNode): void {
    this.#node = node;
    this.#root.left = node.rect.x;
    this.#root.top = node.rect.y;
    this.#root.width = node.rect.width;
    this.#root.height = node.rect.height;
    this.#root.borderColor = node.focused ? "#facc15" : "#475569";
    this.#chromeRegions = syncShellNextPaneChrome({
      root: this.#root,
      rect: node.rect,
      state: {
        title: "Help",
        actions: [shellNextPaneCloseAction()],
      },
    });
    const contentSize = resolveBorderedPaneContentSize(node.rect);
    this.#content.left = PANE_CONTENT_ORIGIN;
    this.#content.top = PANE_CONTENT_ORIGIN;
    this.#content.width = contentSize.width;
    this.#content.height = contentSize.height;
    this.#content.content = helpLines
      .slice(0, contentSize.height)
      .map((line) => line.slice(0, contentSize.width))
      .join("\n");
    if (node.focused) {
      this.focus();
    }
  }

  focus(): void {
    this.#root.focus();
  }

  dispose(): void {
    this.#root.destroyRecursively();
  }
}
