export { runShellNext, type ShellNextRunResult } from "./run-shell-next";
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
  ShellNextMuxRenderable,
  type ShellNextMuxRenderableInput,
  type TerminalPaneFactory,
  type TerminalPaneFactoryInput,
  type TerminalPaneRenderable,
} from "./renderable-mux/mux-renderable";
export {
  buildShellNextStatusbarLeft,
  buildShellNextStatusbarRight,
  buildShellNextStatusbarText,
  ShellNextStatusbarRenderable,
  type ShellNextAiContextSummary,
  type ShellNextAttentionContextSummary,
  type ShellNextRuntimeStatusSummary,
  type ShellNextStatusbarRenderableInput,
  type ShellNextStatusbarState,
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
  ShellNextApp,
  startShellNextApp,
  type ShellNextAppController,
  type ShellNextAppInput,
} from "./app/shell-next-app";
export {
  encodeShellNextTerminalKey,
  type ShellNextTerminalKeyEncodingOptions,
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
  ShellNextLiveTerminalProtocolSource,
  type ShellNextLiveTerminalProtocolSourceInput,
} from "./sources/shell-next-live-terminal-source";
export {
  ShellNextFrameBufferTerminalPane,
  createShellNextFrameBufferTerminalPane,
  type ShellNextFrameBufferTerminalPaneInput,
} from "./terminal-projection/framebuffer-terminal-pane";
export {
  ShellNextChatSurface,
  type ShellNextChatSurfaceInput,
} from "./surfaces/chat-surface";
export {
  ShellNextRoomSurface,
  type ShellNextRoomSurfaceInput,
  type ShellNextRoomSurfaceStore,
} from "./surfaces/room-surface";
export {
  ShellNextHelpSurface,
  type ShellNextHelpSurfaceInput,
} from "./surfaces/help-surface";
export {
  parseShellNextArgs,
  type ShellNextAttachArgs,
  type ShellNextParsedArgs,
  type ShellNextView,
} from "./product/argv";
export {
  runShellNextProductAttach,
  type ShellNextProductRunDependencies,
} from "./product/runtime";
export type { ShellNextStore } from "./product/bootstrap";
