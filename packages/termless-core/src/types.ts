export interface TerminalOptions {
  cols: number;
  rows: number;
  scrollbackLimit?: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export type UnderlineStyle = false | "single" | "double" | "curly" | "dotted" | "dashed";

export interface Cell {
  char: string;
  fg: RGB | null;
  bg: RGB | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: UnderlineStyle;
  underlineColor: RGB | null;
  strikethrough: boolean;
  inverse: boolean;
  blink: boolean;
  hidden: boolean;
  wide: boolean;
  continuation: boolean;
  hyperlink: string | null;
}

export interface CursorState {
  x: number;
  y: number;
  visible: boolean | null;
  style: "block" | "underline" | "beam" | null;
}

export type TerminalMode =
  | "altScreen"
  | "cursorVisible"
  | "bracketedPaste"
  | "applicationCursor"
  | "applicationKeypad"
  | "autoWrap"
  | "mouseTracking"
  | "focusTracking"
  | "originMode"
  | "insertMode"
  | "reverseVideo";

export interface ScrollbackState {
  viewportOffset: number;
  totalLines: number;
  screenLines: number;
}

export interface KeyDescriptor {
  key: string;
  shift?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  super?: boolean;
}

export interface TerminalCapabilities {
  name: string;
  version: string;
  truecolor: boolean;
  kittyKeyboard: boolean;
  kittyGraphics: boolean;
  sixel: boolean;
  osc8Hyperlinks: boolean;
  semanticPrompts: boolean;
  unicode: string;
  reflow: boolean;
  extensions: Set<string>;
}

export interface TerminalReadable {
  getText(): string;
  getTextRange(startRow: number, startCol: number, endRow: number, endCol: number): string;
  getCell(row: number, col: number): Cell | undefined;
  getLine(row: number): Cell[];
  getLines(): Cell[][];
  getCursor(): CursorState;
  getMode(mode: TerminalMode): boolean;
  getTitle(): string;
  getScrollback(): ScrollbackState;
}

export interface TerminalBackend extends TerminalReadable {
  readonly name: string;
  readonly capabilities: TerminalCapabilities;
  init(opts: TerminalOptions): void;
  destroy(): void;
  feed(data: Uint8Array): void;
  resize(cols: number, rows: number): void;
  reset(): void;
  encodeKey(key: KeyDescriptor): Uint8Array;
  scrollViewport(delta: number): void;
  onResponse?: (data: Uint8Array) => void;
}

export interface TermlessBridge extends TerminalReadable {
  write(data: string | Uint8Array): Promise<void>;
  writeSync(data: string | Uint8Array): void;
  resize(cols: number, rows: number): void;
  reset(): void;
  dispose(): void;
  onTitleChange(listener: (title: string) => void): () => void;
  readonly cols: number;
  readonly rows: number;
}
