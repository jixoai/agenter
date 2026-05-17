import type { FrameBufferOptions, RenderContext } from "@opentui/core";
import type { TerminalRenderRichLine } from "@agenter/termless-core";
import type { TerminalTransportSelectionOverlay } from "@agenter/terminal-transport-protocol";

import { BackendFrameRenderable } from "./backend-frame-renderable";
import type { CliShellInteractionEnhancementProfile } from "./interaction-capabilities";
import type { CliShellSelectionRegion, CliShellSelectionSource } from "./types";

export interface ShellTerminalViewOptions extends FrameBufferOptions {
  lines: readonly TerminalRenderRichLine[];
  focused?: boolean;
  selectionRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  selectionRegions?: readonly CliShellSelectionRegion[];
  selectionSources?: readonly CliShellSelectionSource[];
  selectionOverlays?: readonly TerminalTransportSelectionOverlay[];
  interactionProfile?: CliShellInteractionEnhancementProfile;
  semanticClickMaxDistanceCells?: number;
  onSelectionStart?: ConstructorParameters<typeof BackendFrameRenderable>[1]["onSelectionStart"];
  onSelectionUpdate?: ConstructorParameters<typeof BackendFrameRenderable>[1]["onSelectionUpdate"];
  onSelectionEnd?: ConstructorParameters<typeof BackendFrameRenderable>[1]["onSelectionEnd"];
  onSelectWordAt?: ConstructorParameters<typeof BackendFrameRenderable>[1]["onSelectWordAt"];
  onSelectLineAt?: ConstructorParameters<typeof BackendFrameRenderable>[1]["onSelectLineAt"];
  onClearSelection?: ConstructorParameters<typeof BackendFrameRenderable>[1]["onClearSelection"];
  onInteractionTrace?: ConstructorParameters<typeof BackendFrameRenderable>[1]["onInteractionTrace"];
  onMouseDown?: BackendFrameRenderable["onMouseDown"];
  onMouseDrag?: BackendFrameRenderable["onMouseDrag"];
  onMouseDragEnd?: BackendFrameRenderable["onMouseDragEnd"];
  onMouseUp?: BackendFrameRenderable["onMouseUp"];
  onMouseScroll?: BackendFrameRenderable["onMouseScroll"];
}

export class ShellTerminalViewRenderable extends BackendFrameRenderable {
  constructor(ctx: RenderContext, options: ShellTerminalViewOptions) {
    super(ctx, options);
  }
}
