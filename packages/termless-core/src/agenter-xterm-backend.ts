import { Terminal, type IBuffer, type IBufferCell, type IBufferLine, type IModes } from "./xterm-headless-module.js";
import type {
  Cell,
  CursorState,
  KeyDescriptor,
  RGB,
  ScrollbackState,
  TerminalBackend,
  TerminalCapabilities,
  TerminalMode,
  TerminalOptions,
  UnderlineStyle,
} from "./termless-types.js";

const DEFAULT_CAPABILITIES: TerminalCapabilities = {
  name: "xterm-headless",
  version: "6.1.0-beta.167",
  truecolor: true,
  kittyKeyboard: false,
  kittyGraphics: false,
  sixel: false,
  osc8Hyperlinks: false,
  semanticPrompts: false,
  unicode: "unknown",
  reflow: false,
  extensions: new Set<string>(),
};

const PALETTE_ANCHORS: Array<[number, number, number]> = [
  [0, 0, 0],
  [205, 49, 49],
  [13, 188, 121],
  [229, 229, 16],
  [36, 114, 200],
  [188, 63, 188],
  [17, 168, 205],
  [229, 229, 229],
  [102, 102, 102],
  [241, 76, 76],
  [35, 209, 139],
  [245, 245, 67],
  [59, 142, 234],
  [214, 112, 214],
  [41, 184, 219],
  [255, 255, 255],
];

const textDecoder = new TextDecoder();

const paletteIndexToRgb = (index: number): RGB => {
  if (index < 0 || index > 255) {
    return { r: 255, g: 255, b: 255 };
  }
  if (index < 16) {
    const rgb = PALETTE_ANCHORS[index] ?? [255, 255, 255];
    return { r: rgb[0], g: rgb[1], b: rgb[2] };
  }
  if (index >= 16 && index <= 231) {
    const idx = index - 16;
    const r = Math.floor(idx / 36);
    const g = Math.floor((idx % 36) / 6);
    const b = idx % 6;
    const level = (n: number): number => (n === 0 ? 0 : 55 + n * 40);
    return { r: level(r), g: level(g), b: level(b) };
  }
  const gray = 8 + (index - 232) * 10;
  return { r: gray, g: gray, b: gray };
};

const toRgb = (color: number): RGB => ({
  r: (color >> 16) & 0xff,
  g: (color >> 8) & 0xff,
  b: color & 0xff,
});

const readColor = (cell: IBufferCell, kind: "fg" | "bg"): RGB | null => {
  const isPalette = kind === "fg" ? cell.isFgPalette() : cell.isBgPalette();
  if (isPalette) {
    return paletteIndexToRgb(kind === "fg" ? cell.getFgColor() : cell.getBgColor());
  }
  const isRgb = kind === "fg" ? cell.isFgRGB() : cell.isBgRGB();
  if (isRgb) {
    return toRgb(kind === "fg" ? cell.getFgColor() : cell.getBgColor());
  }
  return null;
};

const readUnderline = (cell: IBufferCell): UnderlineStyle => {
  if (cell.isUnderline() === 0) {
    return false;
  }
  if (typeof cell.getUnderlineStyle !== "function") {
    return "single";
  }
  switch (cell.getUnderlineStyle()) {
    case 2:
      return "double";
    case 3:
      return "curly";
    case 4:
      return "dotted";
    case 5:
      return "dashed";
    default:
      return "single";
  }
};

const readUnderlineColor = (cell: IBufferCell): RGB | null => {
  if (typeof cell.isUnderlineColorDefault === "function" && cell.isUnderlineColorDefault()) {
    return null;
  }
  if (typeof cell.isUnderlineColorRGB === "function" && cell.isUnderlineColorRGB()) {
    return toRgb(cell.getUnderlineColor());
  }
  if (typeof cell.isUnderlineColorPalette === "function" && cell.isUnderlineColorPalette()) {
    return paletteIndexToRgb(cell.getUnderlineColor());
  }
  return null;
};

const toCell = (cell: IBufferCell | undefined): Cell => {
  if (!cell) {
    return {
      char: " ",
      fg: null,
      bg: null,
      bold: false,
      dim: false,
      italic: false,
      underline: false,
      underlineColor: null,
      strikethrough: false,
      inverse: false,
      blink: false,
      hidden: false,
      wide: false,
      continuation: false,
      hyperlink: null,
    };
  }
  const chars = cell.getChars();
  return {
    char: chars.length === 0 ? " " : chars,
    fg: readColor(cell, "fg"),
    bg: readColor(cell, "bg"),
    bold: cell.isBold() !== 0,
    dim: typeof cell.isDim === "function" ? cell.isDim() !== 0 : false,
    italic: typeof cell.isItalic === "function" ? cell.isItalic() !== 0 : false,
    underline: readUnderline(cell),
    underlineColor: readUnderlineColor(cell),
    strikethrough: typeof cell.isStrikethrough === "function" ? cell.isStrikethrough() !== 0 : false,
    inverse: cell.isInverse() !== 0,
    blink: typeof cell.isBlink === "function" ? cell.isBlink() !== 0 : false,
    hidden: typeof cell.isInvisible === "function" ? cell.isInvisible() !== 0 : false,
    wide: cell.getWidth() === 2,
    continuation: cell.getWidth() === 0,
    hyperlink: null,
  };
};

const readMode = (modes: IModes, mode: TerminalMode): boolean => {
  switch (mode) {
    case "altScreen":
      return false;
    case "cursorVisible":
      return modes.showCursor;
    case "bracketedPaste":
      return modes.bracketedPasteMode;
    case "applicationCursor":
      return modes.applicationCursorKeysMode;
    case "applicationKeypad":
      return modes.applicationKeypadMode;
    case "autoWrap":
      return modes.wraparoundMode;
    case "mouseTracking":
      return modes.mouseTrackingMode !== "none";
    case "focusTracking":
      return modes.sendFocusMode;
    case "originMode":
      return modes.originMode;
    case "insertMode":
      return modes.insertMode;
    case "reverseVideo":
      return false;
  }
  return false;
};

type XtermSyncTerminal = Terminal & {
  _core?: {
    writeSync?: (data: string | Uint8Array) => void;
  };
};

export class AgenterXtermBackend implements TerminalBackend {
  public readonly name = "xterm-headless";
  public readonly capabilities = DEFAULT_CAPABILITIES;
  public onResponse?: (data: Uint8Array) => void;

  private readonly terminal: XtermSyncTerminal;
  private title = "";

  constructor(options: TerminalOptions) {
    this.terminal = new Terminal({
      cols: options.cols,
      rows: options.rows,
      allowProposedApi: true,
      scrollback: options.scrollbackLimit ?? 10_000,
    }) as XtermSyncTerminal;
    this.terminal.onTitleChange((title) => {
      this.title = title;
    });
  }

  init(_opts: TerminalOptions): void {}

  destroy(): void {
    this.terminal.dispose();
  }

  feed(data: Uint8Array): void {
    const writeSync = this.terminal._core?.writeSync;
    if (writeSync) {
      writeSync.call(this.terminal._core, data);
      return;
    }
    this.terminal.write(textDecoder.decode(data));
  }

  resize(cols: number, rows: number): void {
    this.terminal.resize(cols, rows);
  }

  reset(): void {
    this.title = "";
    this.terminal.reset();
  }

  encodeKey(_key: KeyDescriptor): Uint8Array {
    return new Uint8Array();
  }

  scrollViewport(delta: number): void {
    if (delta === 0) {
      return;
    }
    this.terminal.scrollToLine(Math.max(0, this.buffer.viewportY + delta));
  }

  getText(): string {
    return this.getLines()
      .map((line) => line.map((cell) => cell.char).join(""))
      .join("\n");
  }

  getTextRange(startRow: number, startCol: number, endRow: number, endCol: number): string {
    const rows: string[] = [];
    for (let row = startRow; row <= endRow; row += 1) {
      const line = this.buffer.getLine(row);
      if (!line) {
        rows.push("");
        continue;
      }
      const fromCol = row === startRow ? startCol : 0;
      const toCol = row === endRow ? endCol : this.terminal.cols;
      rows.push(line.translateToString(false, fromCol, toCol));
    }
    return rows.join("\n");
  }

  getCell(row: number, col: number): Cell {
    const line = this.buffer.getLine(row);
    return line ? toCell(line.getCell(col)) : toCell(undefined);
  }

  getLine(row: number): Cell[] {
    const line = this.buffer.getLine(row);
    if (!line) {
      return [];
    }
    const cells: Cell[] = [];
    for (let col = 0; col < this.terminal.cols; col += 1) {
      cells.push(toCell(line.getCell(col)));
    }
    return cells;
  }

  getLines(): Cell[][] {
    const lines: Cell[][] = [];
    for (let row = 0; row < this.buffer.length; row += 1) {
      lines.push(this.getLine(row));
    }
    return lines;
  }

  getCursor(): CursorState {
    return {
      x: this.buffer.cursorX,
      y: this.buffer.baseY + this.buffer.cursorY,
      visible: this.terminal.modes.showCursor,
      style: null,
    };
  }

  getMode(mode: TerminalMode): boolean {
    return readMode(this.terminal.modes, mode);
  }

  getTitle(): string {
    return this.title;
  }

  getScrollback(): ScrollbackState {
    const buffer = this.buffer;
    return {
      viewportOffset: buffer.viewportY,
      totalLines: buffer.length,
      screenLines: this.terminal.rows,
    };
  }

  public get cols(): number {
    return this.terminal.cols;
  }

  public get rows(): number {
    return this.terminal.rows;
  }

  public get writableTerminal(): Terminal {
    return this.terminal;
  }

  private get buffer(): IBuffer {
    return this.terminal.buffer.active;
  }
}
