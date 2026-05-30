import { BoxRenderable, TextRenderable, type CliRenderer, type MouseEvent } from "@opentui/core";

import type { ChildLayoutNode } from "../renderable-mux/layout";
import {
  ShellPaneChromeController,
  resolveShellPaneChromeClick,
  shellPaneCloseAction,
  type ShellPaneChromeHitRegion,
} from "../renderable-mux/pane-chrome";
import { ShellButtonPressController } from "../renderable-mux/button-press-controller";
import { PANE_CONTENT_ORIGIN, resolveBorderedPaneContentSize } from "../renderable-mux/pane-content-geometry";
import type { OpenTuiRenderableSurface } from "../renderable-mux/pane-source";
import {
  createShellRendererSelectionBehavior,
  type ShellRendererSelectionBehavior,
} from "../renderable-mux/renderer-selection";

export interface ShellHelpSurfaceInput {
  renderer: CliRenderer;
  node: ChildLayoutNode;
  onFocus?: (paneId: string) => void;
  onClose?: (paneId: string) => void;
}

const helpLines = [
  "shell help",
  "",
  "Prefix         Ctrl+B",
  "Ctrl+B H/?     show or hide this help pane",
  "Ctrl+B C       show or hide Chat pane",
  "Ctrl+B Q       close shell / current shell pane",
  "Ctrl+B N       split focused shell to the right",
  "Ctrl+B W       close focused pane",
  "Ctrl+B Tab     focus next pane",
  "Ctrl+B Arrow   focus adjacent pane",
  "",
  "Renderer panes support host copy and paste.",
  "Terminal input is routed only to terminal-protocol panes.",
];

export class ShellHelpSurface implements OpenTuiRenderableSurface {
  readonly #renderer: CliRenderer;
  readonly #root: BoxRenderable;
  readonly #content: TextRenderable;
  readonly #onFocus: ((paneId: string) => void) | undefined;
  readonly #onClose: ((paneId: string) => void) | undefined;
  readonly #chrome: ShellPaneChromeController;
  readonly #buttonPress: ShellButtonPressController<string>;
  readonly #selectionBehavior: ShellRendererSelectionBehavior;
  #node: ChildLayoutNode;
  #chromeRegions: readonly ShellPaneChromeHitRegion[] = [];
  #hoveredChromeAction: string | null = null;

  constructor(input: ShellHelpSurfaceInput) {
    this.#renderer = input.renderer;
    this.#node = input.node;
    this.#onFocus = input.onFocus;
    this.#onClose = input.onClose;
    this.#selectionBehavior = createShellRendererSelectionBehavior({
      renderer: this.#renderer,
      resolveTargets: () => [{ renderable: this.#content }],
    });
    this.#buttonPress = new ShellButtonPressController({
      resolveAction: (event) => resolveShellPaneChromeClick({ event, regions: this.#chromeRegions }),
      onClick: (_action, event) => {
        event.preventDefault();
        this.#onClose?.(this.#node.id);
      },
      onHoverChange: (action) => {
        if (action === this.#hoveredChromeAction) {
          return;
        }
        this.#hoveredChromeAction = action;
        this.syncNode(this.#node);
      },
    });
    this.#chrome = new ShellPaneChromeController({
      renderer: this.#renderer,
      id: `${input.node.id}-help-chrome`,
      bg: "#111827",
      onMouseDown: (event) => this.#handleMouseDown(event),
      onMouseUp: (event) => this.#handleMouseUp(event),
      onMouseMove: (event) => this.#handleMouseMove(event),
    });
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
    this.#root.onMouseDown = (event) => this.#handleMouseDown(event);
    this.#root.onMouseUp = (event) => this.#handleMouseUp(event);
    this.#root.onMouseMove = (event) => this.#handleMouseMove(event);
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
    this.#chromeRegions = this.#chrome.sync({
      root: this.#root,
      rect: node.rect,
      state: {
        title: "Help",
        hoveredActionId: this.#hoveredChromeAction,
        actions: [shellPaneCloseAction()],
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
    this.#chrome.destroy();
    this.#root.destroyRecursively();
  }

  #handleMouseDown(event: MouseEvent): void {
    if (this.#selectionBehavior.handleMouseDown(event)) {
      this.#onFocus?.(this.#node.id);
      return;
    }
    if (this.#buttonPress.handleMouseDown(event)) {
      return;
    }
    this.#onFocus?.(this.#node.id);
  }

  #handleMouseUp(event: MouseEvent): void {
    if (this.#selectionBehavior.handleMouseUp(event)) {
      return;
    }
    this.#buttonPress.handleMouseUp(event);
  }

  #handleMouseMove(event: MouseEvent): void {
    this.#buttonPress.handleMouseMove(event);
  }
}
