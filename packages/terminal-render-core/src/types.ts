export interface TerminalRenderRichSpan {
  text: string;
  fg?: string;
  bg?: string;
  bold?: boolean;
  underline?: boolean;
  inverse?: boolean;
}

export interface TerminalRenderRichLine {
  spans: TerminalRenderRichSpan[];
}

export interface TerminalStructuredRender {
  richLines: TerminalRenderRichLine[];
  cursorAbsRow: number;
  cursorCol: number;
  cursorVisible: boolean;
  rows: number;
  cols: number;
}
