import type { TerminalRendererAdapter } from "./terminal-renderer-adapter";
import type { TerminalResolvedRenderer } from "./terminal-renderer-profile";
import { ghosttyWebRendererAdapter } from "./renderers/ghostty-web-renderer-adapter";
import { xtermRendererAdapter } from "./renderers/xterm-renderer-adapter";

const TERMINAL_RENDERER_ADAPTERS = {
  "ghostty-web": ghosttyWebRendererAdapter,
  xterm: xtermRendererAdapter,
} as const satisfies Partial<Record<TerminalResolvedRenderer, TerminalRendererAdapter>>;

export const resolveTerminalRendererAdapter = (
  renderer: TerminalResolvedRenderer,
): TerminalRendererAdapter | null => {
  if (renderer === "wterm") {
    // Preserve the explicit `wterm` slot for future web/mobile accessibility work.
    // This round only upgrades the law so hosts stop assuming xterm internals.
    return null;
  }
  return TERMINAL_RENDERER_ADAPTERS[renderer] ?? null;
};

export const resolveTerminalRendererStyles = (renderer: TerminalResolvedRenderer | null | undefined): string => {
  if (!renderer) {
    return "";
  }
  return resolveTerminalRendererAdapter(renderer)?.styles ?? "";
};
