export {
  CLI_SHELL_COMMAND,
  CLI_SHELL_DEFAULT_AVATAR,
  CLI_SHELL_DEFAULT_SESSION,
  CLI_SHELL_PRODUCT_ID,
  cliShellProductDescriptor,
  createCliShellProductRuntimeClient,
} from "./product";
export { bootstrapCliShell, type CliShellBootstrapInput, type CliShellBootstrapResult, type CliShellStore } from "./bootstrap";
export {
  CLI_SHELL_DEFAULT_DELEGATION_TTL_MS,
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
export { normalizeShellName, parseCliShellArgs, type CliShellParsedArgs } from "./argv";
export { runCliShell } from "./run-cli-shell";
export { fitTerminalText, measureTerminalText } from "./tui/cell-width";
export { createTerminalCanvas, drawCanvasHorizontalLine, drawCanvasVerticalLine, fillCanvasRow, renderCanvasLines, writeCanvasText } from "./tui/canvas";
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
  routeCliShellPaste,
  syncCliShellTerminalGeometry,
  type CliShellTuiControllerContext,
} from "./tui/controller";
export { encodeCliShellTerminalKey } from "./tui/terminal-input";
export { layoutCliShellTuiFrame, type CliShellTuiFrame } from "./tui/frame";
export { buildCliShellTuiModel, resolveCliShellDialoguePlacement } from "./tui/model";
export { CliShellTuiApp, type CliShellTuiAppProps } from "./tui/app";
export { startCliShellTui, type CliShellTuiController } from "./tui/run-cli-shell-tui";
export type {
  CliShellDialogueBlock,
  CliShellDialoguePlacement,
  CliShellDialoguePlacementRequest,
  CliShellTuiAppProjection,
  CliShellTuiModel,
  CliShellTuiStore,
  CliShellTuiViewState,
} from "./tui/types";
export { SHELL_ASSISTANT_DISPLAY_NAME, buildShellAssistantPromptSeed, shellAssistantMemoryRoles } from "./shell-assistant-seeds";
