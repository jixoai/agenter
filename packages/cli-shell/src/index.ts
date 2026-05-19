export {
  CLI_SHELL_COMMAND,
  CLI_SHELL_DEFAULT_AVATAR,
  CLI_SHELL_DEFAULT_SESSION,
  CLI_SHELL_PRODUCT_ID,
  cliShellProductDescriptor,
  createCliShellProductRuntimeClient,
} from "./product";
export {
  bootstrapCliShell,
  type CliShellBootstrapInput,
  type CliShellBootstrapResult,
  type CliShellInteractiveHostStore,
  type CliShellProductHostStore,
  type CliShellStore,
} from "./bootstrap";
export {
  buildCliShellHostingContextId,
  disableCliShellManagedMode,
  enableCliShellManagedMode,
  readCliShellManagedState,
  type CliShellManagedDisableInput,
  type CliShellManagedDisableResult,
  type CliShellManagedEnableInput,
  type CliShellManagedEnableResult,
  type CliShellManagedState,
} from "./managed";
export { isCliShellMetadataOnlyArgv, normalizeShellName, parseCliShellArgs, type CliShellParsedArgs } from "./argv";
export {
  cleanupCliShellResources,
  formatCliShellCleanupResult,
  hasCliShellCleanupFailures,
  planCliShellCleanup,
  type CliShellCleanupOptions,
  type CliShellCleanupResult,
  type CliShellCleanupStore,
  type CliShellCleanupTarget,
} from "./cleanup";
export { runCliShell } from "./run-cli-shell";
export { fitTerminalText, measureTerminalText } from "./tui/cell-width";
export {
  createTerminalCanvas,
  drawCanvasHorizontalLine,
  drawCanvasVerticalLine,
  fillCanvasRow,
  renderCanvasLines,
  splitTerminalTextToWidth,
  writeCanvasStyledText,
  writeCanvasText,
} from "./tui/canvas";
export {
  resolveCliShellToolbarStatus,
  resolveCliShellToolbarStatusIcon,
  summarizeCliShellHeartbeat,
  type CliShellToolbarStatusKind,
} from "./tui/heartbeat";
export {
  formatCliShellShortcut,
  matchCliShellShortcut,
  resolveCliShellTuiKeybindings,
  type CliShellShortcut,
  type CliShellShortcutId,
  type CliShellTuiKeybindings,
} from "./tui/keybindings";
export {
  routeCliShellKey,
  routeCliShellMouseScroll,
  routeCliShellPaste,
  routeCliShellPointerAction,
  routeCliShellViewportTarget,
  setCliShellDialogueDraft,
  submitCliShellDialogue,
  syncCliShellTerminalGeometry,
  type CliShellTuiControllerContext,
} from "./tui/controller";
export { encodeCliShellTerminalKey } from "./tui/terminal-input";
export { buildCliShellComposedSurface } from "./tui/composed-surface";
export type {
  CliShellOffscreenRendererFrame,
  CliShellProjectionFrameSource,
  CliShellProjectionProtocol,
  CliShellRawTerminalOutput,
  CliShellScreenFrame,
  CliShellScreenFrameCursor,
  CliShellTerminal2ComposedScreen,
} from "./tui/projection-law";
export {
  buildCliShellDialogueSurface,
  type CliShellDialogueSurface,
} from "./tui/dialogue-surface";
export {
  CliShellDialogueBackend,
  projectCliShellDialogueBackendFrame,
  type CliShellDialogueBackendFrame,
} from "./tui/dialogue-backend";
export {
  layoutCliShellTuiFrame,
  resolveCliShellScrollbarPointerTarget,
  resolveCliShellShellScrollbarProjection,
  resolveCliShellToolbarLayout,
  resolveCliShellTerminalScrollRegion,
  resolveCliShellTerminalScrollbarRegion,
  resolveCliShellTranscriptPanelLayout,
  resolveCliShellTerminalRegion,
  resolveCliShellTuiInteractionLayout,
  type CliShellShellScrollbarFrameState,
  type CliShellShellScrollbarProjection,
  type CliShellTuiFrame,
} from "./tui/frame";
export {
  isPointInsideDialoguePanel,
  resolveComposedSurfaceCursorCellPosition,
  resolveBackendScrollbarStateGeometry,
  resolveBackendViewportScrollPosition,
  resolveDialogueCursorCellPosition,
  resolveDialogueCursorPosition,
  resolveDialogueInputRegion,
  resolveShellCursorCellPosition,
  resolveShellCursorPosition,
  resolveShellTerminalOrigin,
  toNativeHardwareCursorPosition,
  resolveVisibleCursorCellPosition,
  resolveVisibleCursorPosition,
  type NativeCursorPosition,
} from "./tui/native-projection";
export { projectMarkdownLastLine } from "./tui/markdown-projection";
export {
  CLI_SHELL_BACKEND_INTERACTION_RECOMMENDATIONS,
  CLI_SHELL_DEFAULT_INTERACTION_PROFILE,
  resolveCliShellInteractionEnhancementProfile,
  type CliShellInteractionEnhancementProfile,
} from "./tui/interaction-capabilities";
export {
  findNextTerminalWordBoundary,
  findPreviousTerminalWordBoundary,
  findWordInTerminal,
  stringIndexToTerminalColumn,
  terminalColumnToStringIndex,
  type TerminalWordSegment,
} from "./tui/terminal-word-navigation";
export {
  inferCliShellPasteMediaFromText,
  isCliShellImagePastePayload,
  readCliShellPasteMimeTypes,
  readCliShellPastePayload,
  readCliShellPasteText,
  resolveCliShellPasteMediaKind,
  type CliShellPasteMediaItem,
  type CliShellPasteMediaKind,
  type CliShellPastePayload,
} from "./tui/paste-input";
export { createCliShellPerfTracer, type CliShellPerfTraceEvent, type CliShellPerfTracer } from "./tui/perf-trace";
export { createInitialCliShellViewState } from "./tui/view-state";
export { CliShellDebugBarRenderable, formatCliShellDebugBarLine, type CliShellDebugBarOptions } from "./tui/debug-bar";
export { buildCliShellTuiModel, resolveCliShellDialoguePlacement } from "./tui/model";
export { CliShellCoreApp, type CliShellCoreAppProps } from "./tui/core-app";
export { startCliShellTui, type CliShellTuiController } from "./tui/run-cli-shell-tui";
export { startCliShellStartupTui, type CliShellStartupTuiController, type CliShellStartupAppProps } from "./tui/startup-shell-tui";
export {
  BackendFrameRenderable,
  type BackendFramePaintStats,
  type BackendFrameInteractionTraceEvent,
  type BackendFrameProjectionUpdate,
  type BackendFrameRenderableOptions,
} from "./tui/backend-frame-renderable";
export {
  ShellTerminalViewRenderable,
  type ShellTerminalViewOptions,
} from "./tui/shell-terminal-view";
export type {
  CliShellLiveTerminalTransportSessionFactory,
  CliShellLiveTerminalTransportSessionInput,
} from "./tui/live-terminal-mirror";
export {
  BackendScrollbarRenderable,
  type BackendScrollbarOptions,
  type BackendScrollbarState,
} from "./tui/backend-scrollbar";
export {
  BackendTerminalFrameRenderable,
  type BackendTerminalFrameBridge,
  type BackendTerminalFrameOptions,
  type BackendTerminalFrameState,
  type BackendTerminalFrameUpdateResult,
} from "./tui/backend-terminal-frame";
export type {
  CliShellDialogueBlock,
  CliShellDialoguePlacement,
  CliShellDialoguePlacementRequest,
  CliShellComposedSurfaceState,
  CliShellPointerAction,
  CliShellScrollRegion,
  CliShellSelectionSource,
  CliShellTuiAppProjection,
  CliShellTuiInteractionLayout,
  CliShellTuiModel,
  CliShellTuiStore,
  CliShellTuiViewState,
} from "./tui/types";
export { SHELL_ASSISTANT_DISPLAY_NAME, buildShellAssistantPromptSeed, shellAssistantMemoryRoles } from "./shell-assistant-seeds";
