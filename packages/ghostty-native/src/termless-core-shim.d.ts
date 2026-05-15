declare module "@termless/core" {
  export interface RGB {
    r: number;
    g: number;
    b: number;
  }

  export type UnderlineStyle =
    | false
    | "single"
    | "double"
    | "curly"
    | "dotted"
    | "dashed";

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

  export type CursorStyle = "beam" | "block" | "underline";

  export interface CursorState {
    x: number;
    y: number;
    visible: boolean;
    style: CursorStyle;
  }

  export type TerminalMode = string;

  export interface ScrollbackState {
    viewportOffset: number;
    totalLines: number;
    screenLines: number;
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

  export interface KeyDescriptor {
    key: string;
    shift?: boolean;
    alt?: boolean;
    ctrl?: boolean;
    meta?: boolean;
  }

  export interface TerminalOptions {
    cols: number;
    rows: number;
    scrollbackLimit?: number;
  }

  export interface TerminalBackend {
    readonly name: string;
    onResponse?: (data: Uint8Array) => void;
    init(options: TerminalOptions): void;
    destroy(): void;
    feed(data: Uint8Array): void;
    resize(cols: number, rows: number): void;
    reset(): void;
    getText(): string;
    getTextRange(
      startRow: number,
      startCol: number,
      endRow: number,
      endCol: number,
    ): string;
    getCell(row: number, col: number): Cell;
    getLine(row: number): Cell[];
    getLines(): Cell[][];
    getLinesRange(startRow: number, rowCount: number): Cell[][];
    getViewportLines(): Cell[][];
    getCursor(): CursorState;
    getMode(mode: TerminalMode): boolean;
    getTitle(): string;
    getScrollback(): ScrollbackState;
    scrollViewport(delta: number): void;
    encodeKey?(key: KeyDescriptor): string;
    capabilities?: TerminalCapabilities;
  }

  export function encodeKeyToAnsi(key: KeyDescriptor): string;
}
