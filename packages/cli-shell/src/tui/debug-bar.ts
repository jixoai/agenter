import { FrameBufferRenderable, RGBA, type FrameBufferOptions, type RenderContext } from "@opentui/core";

import { fitTerminalText } from "./cell-width";
import type { CliShellPerfSnapshot } from "./perf-trace";

const DEBUG_FG = RGBA.fromHex("#d6f3ff");
const DEBUG_BG = RGBA.fromHex("#07151f");

export interface CliShellDebugBarOptions extends FrameBufferOptions {
  snapshot: CliShellPerfSnapshot;
}

const formatMs = (value: number | null): string => (value === null ? "-" : `${Math.max(0, Math.round(value))}ms`);
const formatFps = (value: number | null): string => (value === null ? "-" : `${Math.max(0, Math.round(value))}`);
const formatBytes = (value: number | null): string => {
  if (value === null) {
    return "-";
  }
  const safeValue = Math.max(0, Math.round(value));
  if (safeValue >= 1024 * 1024) {
    return `${(safeValue / (1024 * 1024)).toFixed(1)}mb`;
  }
  if (safeValue >= 1024) {
    return `${(safeValue / 1024).toFixed(1)}kb`;
  }
  return `${safeValue}b`;
};

export const formatCliShellDebugBarLine = (snapshot: CliShellPerfSnapshot, width: number): string =>
  fitTerminalText(
    [
      `dirty ${formatMs(snapshot.dirtyAgoMs)}`,
      `pull ${formatMs(snapshot.pullMs)}`,
      `patch ${snapshot.patch}`,
      `bytes f${formatBytes(snapshot.frameBytes)}/d${formatBytes(snapshot.diffBytes)}`,
      `apply ${formatMs(snapshot.applyMs)}`,
      `paint ${formatMs(snapshot.renderMs)}`,
      `gap ${formatMs(snapshot.frameGapMs)}`,
      `fps ${formatFps(snapshot.fps)}`,
      `q d${snapshot.dirtyQueue}/p${snapshot.pullQueue}/r${snapshot.renderQueue}`,
      `skip ${snapshot.skippedFrames}`,
      `cells ${snapshot.paintCells}`,
      `vp ${snapshot.viewport}`,
      `src ${snapshot.frameSource}`,
      `mode ${snapshot.mode}`,
    ].join(" | "),
    Math.max(1, width),
    { ellipsis: true },
  );

export class CliShellDebugBarRenderable extends FrameBufferRenderable {
  #snapshot: CliShellPerfSnapshot;

  constructor(ctx: RenderContext, options: CliShellDebugBarOptions) {
    super(ctx, options);
    this.#snapshot = options.snapshot;
    this.paint();
  }

  set snapshot(snapshot: CliShellPerfSnapshot) {
    this.#snapshot = snapshot;
    this.paint();
    this.requestRender();
  }

  protected onResize(width: number, height: number): void {
    super.onResize(width, height);
    this.paint();
  }

  private paint(): void {
    this.frameBuffer.clear(DEBUG_BG);
    if (this.width <= 0 || this.height <= 0) {
      return;
    }
    this.frameBuffer.drawText(formatCliShellDebugBarLine(this.#snapshot, this.width), 0, 0, DEBUG_FG, DEBUG_BG);
  }
}
