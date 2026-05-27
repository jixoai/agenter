import type { CliRenderer } from "@opentui/core";

import type { ChildLayoutNode, RootLayout } from "../renderable-mux/layout";
import type { ShellNextMuxRenderable } from "../renderable-mux/mux-renderable";
import {
  createOpenTuiRenderablePaneSource,
  createPaneSourceId,
  type OpenTuiRenderableSurface,
} from "../renderable-mux/pane-source";
import { ShellNextChatSurface } from "../surfaces/chat-surface";
import { ShellNextRoomAppSurface } from "../surfaces/shell-next-room-app-surface";
import { ShellNextHelpSurface } from "../surfaces/help-surface";
import { ShellNextRoomSurface } from "../surfaces/room-surface";
import type { ShellNextRoomInput } from "./shell-next-app-types";
import type { ShellNextRoomLayoutMode } from "../product-room/room-app";

export type ShellNextProductSurfaceKind = "help" | "chat";

export interface ToggleShellNextProductSurfaceInput {
  readonly kind: ShellNextProductSurfaceKind;
  readonly renderer: CliRenderer;
  readonly layout?: RootLayout;
  readonly mux?: ShellNextMuxRenderable;
  readonly node?: ChildLayoutNode;
  readonly room?: ShellNextRoomInput;
  readonly onClose?: (paneId: string) => void;
  readonly onLayoutRequest?: (mode: ShellNextRoomLayoutMode) => void | Promise<void | { closeCurrentSurface: boolean }>;
  readonly onTopLayerRequest?: () => void | Promise<void>;
  readonly layoutMode?: ShellNextRoomLayoutMode;
}

export const createShellNextProductSurface = (input: ToggleShellNextProductSurfaceInput): OpenTuiRenderableSurface => {
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
    return new ShellNextHelpSurface(common);
  }
  if (input.room) {
    if (input.room.attached) {
      return new ShellNextRoomAppSurface({
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
    return new ShellNextRoomSurface({
      ...common,
      ...input.room,
    });
  }
  return new ShellNextChatSurface({ ...common, layoutMode: input.layoutMode ?? "right" });
};

export const toggleShellNextProductSurface = (input: ToggleShellNextProductSurfaceInput): boolean => {
  if (!input.layout || !input.mux) {
    throw new Error("toggleShellNextProductSurface requires layout and mux");
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
  const surface = createShellNextProductSurface(input);
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
