export { runShell, type ShellRunResult } from "./run-shell";
export {
  createFourPaneLayout,
  createRootLayout,
  getOpenComposeMinimumSplitSize,
  type ChildLayoutNode,
  type FocusDirection,
  type LayoutAxis,
  type LayoutPaneInput,
  type LayoutRect,
  type LayoutSourceKind,
  type ResizeEdge,
  type RootLayout,
  type SplitDirection,
} from "./renderable-mux/layout";
export {
  createBunPtyPaneSource,
  createCommandTaskPaneSource,
  createOpenTuiRenderablePaneSource,
  createPaneSourceId,
  getPaneSourceLayoutKind,
  normalizeTerminalPaneSource,
  type BunPtyLaunchOptions,
  type BunPtyPaneSource,
  type CommandTaskLaunchOptions,
  type CommandTaskPaneSource,
  type OpenTuiRenderablePaneSource,
  type PaneSource,
  type PaneSourceId,
  type TerminalFrameSnapshot,
  type TerminalInputChunk,
  type TerminalLikePaneSource,
  type TerminalPaneSize,
  type TerminalProtocolPaneSource,
} from "./renderable-mux/pane-source";
export {
  ShellMuxRenderable,
  type ShellMuxRenderableInput,
  type TerminalPaneFactory,
  type TerminalPaneFactoryInput,
  type TerminalPaneRenderable,
} from "./renderable-mux/mux-renderable";
export {
  buildShellStatusbarLeft,
  buildShellStatusbarRight,
  buildShellStatusbarText,
  ShellStatusbarRenderable,
  type ShellAiContextSummary,
  type ShellAttentionContextSummary,
  type ShellRuntimeStatusSummary,
  type ShellStatusbarRenderableInput,
  type ShellStatusbarState,
} from "./renderable-mux/statusbar";
export {
  PaneRenderable,
  type PaneFrameRenderEvent,
  type PaneRenderableInput,
} from "./renderable-mux/pane-renderable";
export {
  FourPaneRendererGridDemo,
  startFourPaneRendererGridDemo,
  type FourPaneRendererGridDemoController,
  type FourPaneRendererGridDemoInput,
} from "./demos/renderer-grid-demo";
export {
  ShellApp,
  startShellApp,
  type ShellAppController,
  type ShellAppInput,
} from "./app/shell-app";
export {
  encodeShellTerminalKey,
  type ShellTerminalKeyEncodingOptions,
} from "./input/terminal-key";
export {
  LocalBunTerminalProtocolSource,
  createLocalBunPtyPaneSource,
  createLocalCommandTaskPaneSource,
  resolveDefaultShellLaunch,
  type LocalBunTerminalExitEvent,
  type LocalBunTerminalProtocolSourceInput,
} from "./sources/bun-terminal-protocol-source";
export {
  ShellLiveTerminalProtocolSource,
  type ShellLiveTerminalProtocolSourceInput,
} from "./sources/shell-live-terminal-source";
export {
  ShellFrameBufferTerminalPane,
  createShellFrameBufferTerminalPane,
  type ShellFrameBufferTerminalPaneInput,
} from "./terminal-projection/framebuffer-terminal-pane";
export {
  ShellChatSurface,
  type ShellChatSurfaceInput,
} from "./surfaces/chat-surface";
export {
  ShellRoomSurface,
  type ShellRoomSurfaceInput,
  type ShellRoomSurfaceStore,
} from "./surfaces/room-surface";
export {
  ShellHelpSurface,
  type ShellHelpSurfaceInput,
} from "./surfaces/help-surface";
export {
  parseShellArgs,
  type ShellAttachArgs,
  type ShellParsedArgs,
  type ShellView,
} from "./app-runtime/argv";
export {
  runShellAppAttach,
  type ShellAppRunDependencies,
} from "./app-runtime/runtime";
export type { ShellStore } from "./app-runtime/bootstrap";
