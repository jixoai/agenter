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
export {
  TERMINAL_INTERACTION_HOST_PROJECTION_ONLY,
  TERMINAL_INTERACTION_UNAVAILABLE,
  TERMINAL_INTERACTION_DEFAULT_OWNER_ID,
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
