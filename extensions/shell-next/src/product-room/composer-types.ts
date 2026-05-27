export type ShellNextComposerMode = "textarea" | "panel" | "confirm";

export interface ShellNextComposerSelection {
  start: number;
  end: number;
}

export interface ShellNextTextareaState {
  value: string;
  selection: ShellNextComposerSelection | null;
}

export interface ShellNextHistoryItem {
  rowId: number;
  messageId: number;
  text: string;
  senderLabel: string;
}

export interface ShellNextHistoryPanelState {
  items: ShellNextHistoryItem[];
  selectedIndex: number;
  loading: boolean;
  hasMoreBefore: boolean;
}

export interface ShellNextConfirmPanelState {
  title: string;
  message: string;
  confirmLabel: string;
  alternateLabel: string;
}
