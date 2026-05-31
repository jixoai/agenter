export type ShellComposerMode = "textarea" | "panel" | "confirm";

export interface ShellComposerSelection {
  start: number;
  end: number;
}

export interface ShellTextareaState {
  value: string;
  selection: ShellComposerSelection | null;
}

export interface ShellHistoryItem {
  rowId: number;
  messageId: number;
  text: string;
  senderLabel: string;
}

export interface ShellHistoryPanelState {
  items: ShellHistoryItem[];
  selectedIndex: number;
  loading: boolean;
  hasMoreBefore: boolean;
}

export type ShellComposerPanelKind = "history" | "avatar";

export interface ShellConfirmPanelState {
  title: string;
  message: string;
  confirmLabel: string;
  alternateLabel: string;
}
