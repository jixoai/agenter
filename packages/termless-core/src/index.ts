export { createTerminal, termlessMatchers } from "@termless/core";
export { projectTerminalViewport } from "./project-terminal-viewport.js";
export {
  readTerminalLinesRange,
  renderStructuredBuffer,
  renderStructuredViewportBuffer,
  type TerminalLinesRangeReadable,
  type TerminalStructuredReadable,
} from "./render-structured-buffer.js";
export {
  assertTerminalBackendKind,
  createTerminalBackend,
  DEFAULT_TERMINAL_BACKEND,
  isTerminalBackendKind,
  TERMINAL_BACKEND_KINDS,
  type CreateTerminalBackendInput,
  type RangeReadableTerminalBackend,
  type TerminalBackendKind,
} from "./backend-factory.js";
export { XtermBridge, XtermReadableBridge } from "./xterm-bridge.js";
export { createXtermBackend } from "./termless-xtermjs.js";
export type { TerminalRenderRichLine, TerminalRenderRichSpan, TerminalStructuredRender } from "./render-structured-buffer.js";
export type { ProjectedTerminalViewport, TerminalViewportCursorSource } from "./project-terminal-viewport.js";
export type { XtermBridgeReadable } from "./xterm-bridge.js";
export type {
  Cell,
  CursorState,
  KeyDescriptor,
  RGB,
  ScrollbackState,
  Terminal,
  TerminalBackend,
  TerminalCapabilities,
  TerminalCreateOptions,
  TerminalMode,
  TerminalOptions,
  TerminalReadable,
  UnderlineStyle,
} from "./termless-types.js";
