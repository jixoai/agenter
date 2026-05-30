import type { TerminalRenderRichLine } from "@agenter/termless-core";

import type { CliShellDialoguePlacement } from "./types";

export type CliShellProjectionProtocol = "raw-terminal-transport" | "screen-projection";

export type CliShellProjectionFrameSource =
  | "terminal-1-shell"
  | "terminal-chat"
  | "terminal-2-composed"
  | "native-host-adapter"
  | "web-host-adapter";

export interface CliShellRawTerminalOutput {
  protocol: "raw-terminal-transport";
  source: CliShellProjectionFrameSource;
  bytes: Uint8Array;
}

export interface CliShellScreenFrameCursor {
  x: number;
  y: number;
  visible: boolean;
}

export interface CliShellScreenFrame {
  protocol: "screen-projection";
  source: CliShellProjectionFrameSource;
  cols: number;
  rows: number;
  seq: number;
  lines: readonly TerminalRenderRichLine[];
  cursor: CliShellScreenFrameCursor;
}

export interface CliShellOffscreenRendererFrame extends CliShellScreenFrame {
  chrome: {
    scrollbar: "visible" | "hidden";
    focus: "visible" | "hidden";
    selection: "visible";
    cursor: "visible";
  };
}

export interface CliShellTerminal2ComposedScreen extends CliShellScreenFrame {
  shellTerminalId: string;
  terminalId: string;
  dialogue: {
    open: boolean;
    placement: CliShellDialoguePlacement | null;
  };
  rawAdapter?: CliShellRawTerminalOutput;
}
