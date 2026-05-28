import type { TerminalTransportOwnerCoordinate } from "@agenter/terminal-transport-protocol";

import type { TerminalInputChunk, TerminalProtocolPaneSource } from "../renderable-mux/pane-source";

export interface ShellNextTerminalSelectionAnchorState {
  readonly anchor: TerminalTransportOwnerCoordinate | null;
}

export interface ShellNextTerminalInputTransactionOptions {
  readonly preserveSelectionAnchor?: boolean;
}

export interface ShellNextTerminalInputTransactionInput {
  readonly source: Pick<TerminalProtocolPaneSource, "writeInput" | "clearSelection" | "followCursor">;
  readonly chunk: TerminalInputChunk;
  readonly selectionState?: ShellNextTerminalSelectionAnchorState;
  readonly onSelectionAnchorChange?: (anchor: TerminalTransportOwnerCoordinate | null) => void;
  readonly options?: ShellNextTerminalInputTransactionOptions;
}

export const runShellNextTerminalInputTransaction = (input: ShellNextTerminalInputTransactionInput): boolean => {
  const preserveSelectionAnchor = input.options?.preserveSelectionAnchor === true;
  if (!preserveSelectionAnchor) {
    input.onSelectionAnchorChange?.(null);
    input.source.clearSelection?.("terminal");
  }
  const accepted = input.source.writeInput(input.chunk);
  if (accepted) {
    input.source.followCursor?.();
  }
  return accepted;
};
