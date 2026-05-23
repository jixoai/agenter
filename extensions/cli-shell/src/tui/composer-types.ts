export type CliShellComposerMode = "textarea" | "panel" | "confirm";

export interface CliShellComposerSelection {
  start: number;
  end: number;
}

export interface CliShellTextareaState {
  value: string;
  selection: CliShellComposerSelection | null;
}

export interface CliShellHistoryItem {
  rowId: number;
  messageId: number;
  text: string;
  senderLabel: string;
}

export interface CliShellHistoryPanelState {
  items: CliShellHistoryItem[];
  selectedIndex: number;
  loading: boolean;
  hasMoreBefore: boolean;
}

export interface CliShellConfirmPanelState {
  title: string;
  message: string;
  confirmLabel: string;
  alternateLabel: string;
}
