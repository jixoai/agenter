import type { CliRenderer } from "@opentui/core";

import type { ChildLayoutNode, RootLayout } from "../renderable-mux/layout";
import type { ShellMuxRenderable } from "../renderable-mux/mux-renderable";
import {
  createOpenTuiRenderablePaneSource,
  createPaneSourceId,
  type OpenTuiRenderableSurface,
} from "../renderable-mux/pane-source";
import { ShellChatSurface } from "../surfaces/chat-surface";
import { ShellRoomAppSurface } from "../surfaces/shell-room-app-surface";
import { ShellHelpSurface } from "../surfaces/help-surface";
import { ShellRoomSurface } from "../surfaces/room-surface";
import type { ShellRoomInput } from "./shell-app-types";
import type { ShellRoomLayoutMode } from "../product-room/room-app";

export type ShellProductSurfaceKind = "help" | "chat";

export interface ToggleShellProductSurfaceInput {
  readonly kind: ShellProductSurfaceKind;
  readonly renderer: CliRenderer;
  readonly layout?: RootLayout;
  readonly mux?: ShellMuxRenderable;
  readonly node?: ChildLayoutNode;
  readonly room?: ShellRoomInput;
  readonly onClose?: (paneId: string) => void;
  readonly onLayoutRequest?: (mode: ShellRoomLayoutMode) => void | Promise<void | { closeCurrentSurface: boolean }>;
  readonly onTopLayerRequest?: () => void | Promise<void>;
  readonly layoutMode?: ShellRoomLayoutMode;
}

export const createShellProductSurface = (input: ToggleShellProductSurfaceInput): OpenTuiRenderableSurface => {
  const focused = input.node ?? input.mux?.focusedNode;
  if (!focused) {
    throw new Error(`cannot open ${input.kind} surface without a focused pane`);
  }
  const node = {
    id: input.kind,
    sourceId: input.kind,
    sourceKind: "opentui-renderable" as const,
    rect: focused.rect,
    focused: false,
  };
  const common = {
    renderer: input.renderer,
    node,
    onFocus: (paneId: string) => input.mux?.focusPane(paneId),
    onClose: (paneId: string) => input.onClose?.(paneId),
    onLayoutRequest: input.onLayoutRequest,
  };
  if (input.kind === "help") {
    return new ShellHelpSurface(common);
  }
  if (input.room) {
    if (input.room.attached) {
      return new ShellRoomAppSurface({
        ...common,
        layoutMode: input.layoutMode ?? "right",
        room: {
          store: input.room.store,
          shellName: input.room.shellName ?? input.room.attached.binding.resourceKey,
          attached: input.room.attached,
          settings: input.room.settings,
          keybindings: input.room.keybindings,
        },
        onQuit: () => input.onClose?.(input.kind),
        onLayoutRequest: input.onLayoutRequest,
        onTopLayerRequest: input.onTopLayerRequest,
      });
    }
    return new ShellRoomSurface({
      ...common,
      ...input.room,
    });
  }
  return new ShellChatSurface({ ...common, layoutMode: input.layoutMode ?? "right" });
};

export const toggleShellProductSurface = (input: ToggleShellProductSurfaceInput): boolean => {
  if (!input.layout || !input.mux) {
    throw new Error("toggleShellProductSurface requires layout and mux");
  }
  const existing = input.layout.children.find((node) => node.id === input.kind);
  if (existing) {
    const closed = input.layout.close(existing.id);
    if (closed) {
      input.mux.syncLayout();
      input.onClose?.(existing.id);
    }
    return closed;
  }
  if (!input.mux.focusedNode) {
    return false;
  }
  const surface = createShellProductSurface(input);
  const source = createOpenTuiRenderablePaneSource({
    id: createPaneSourceId(input.kind),
    surface,
  });
  return input.mux.splitFocused(
    "right",
    { id: input.kind, sourceId: input.kind, sourceKind: "opentui-renderable" },
    source,
  );
};
