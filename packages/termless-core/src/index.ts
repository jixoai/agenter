export { createTerminal, termlessMatchers } from "@termless/core";
export {
  DEFAULT_TERMINAL_BACKEND,
  TERMINAL_BACKEND_KINDS,
  assertTerminalBackendKind,
  createTerminalBackend,
  isTerminalBackendKind,
  type CreateTerminalBackendInput,
  type RangeReadableTerminalBackend,
  type TerminalBackendKind,
} from "./backend-factory.js";
export { projectTerminalViewport } from "./project-terminal-viewport.js";
export type { ProjectedTerminalViewport, TerminalViewportCursorSource } from "./project-terminal-viewport.js";
export {
  readTerminalLinesRange,
  renderStructuredBuffer,
  renderStructuredViewportBuffer,
  type TerminalLinesRangeReadable,
  type TerminalStructuredReadable,
} from "./render-structured-buffer.js";
export type {
  TerminalRenderRichLine,
  TerminalRenderRichSpan,
  TerminalStructuredRender,
} from "./render-structured-buffer.js";
export {
  TERMINAL_INTERACTION_DEFAULT_OWNER_ID,
  TERMINAL_INTERACTION_HOST_PROJECTION_ONLY,
  TERMINAL_INTERACTION_UNAVAILABLE,
  applyTerminalInteractionEvent,
  cloneTerminalInteractionCapabilities,
  cloneTerminalInteractionFrameState,
  cloneTerminalSelectionOverlay,
  createBackendInteractionAdapter,
  createTerminalInteractionCapabilities,
  findWordInTerminalLine,
  isBackendOwnedTerminalInteraction,
  isTerminalInteractionController,
  type BackendInteractionAdapterOptions,
  type TerminalInteractionCapabilities,
  type TerminalInteractionController,
  type TerminalInteractionEvent,
  type TerminalInteractionFrameState,
  type TerminalInteractionOwnerId,
  type TerminalInteractionOwnership,
  type TerminalInteractionReadable,
  type TerminalInteractionResult,
  type TerminalOwnerCoordinate,
  type TerminalPointerButton,
  type TerminalPointerEvent,
  type TerminalSelectionOverlay,
  type TerminalSelectionOverlayRow,
  type TerminalSelectionRange,
  type TerminalSemanticSelectionKind,
} from "./terminal-interaction.js";
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
export { createXtermBackend } from "./termless-xtermjs.js";
export { XtermBridge, XtermReadableBridge } from "./xterm-bridge.js";
export type { XtermBridgeReadable } from "./xterm-bridge.js";
