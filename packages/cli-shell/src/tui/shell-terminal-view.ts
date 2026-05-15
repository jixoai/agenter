import type { FrameBufferOptions, RenderContext } from "@opentui/core";
import type { TerminalRenderRichLine } from "@agenter/termless-core";

import { BackendFrameRenderable } from "./backend-frame-renderable";
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
  onMouseDown?: BackendFrameRenderable["onMouseDown"];
  onMouseDrag?: BackendFrameRenderable["onMouseDrag"];
  onMouseScroll?: BackendFrameRenderable["onMouseScroll"];
}

export class ShellTerminalViewRenderable extends BackendFrameRenderable {
  constructor(ctx: RenderContext, options: ShellTerminalViewOptions) {
    super(ctx, options);
  }
}
