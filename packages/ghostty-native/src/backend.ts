/**
 * Native Ghostty backend for termless.
 *
 * Wraps libghostty-vt (Ghostty's VT parser compiled as a native library)
 * via Zig napigen N-API bindings. Same terminal emulation as Ghostty,
 * but running natively (no WASM overhead).
 *
 * Requires the native module to be built first:
 *   cd packages/ghostty-native && bash build/build.sh
 */

import { createRequire } from "node:module"

import type {
  TerminalBackend,
  TerminalOptions,
  Cell,
  CursorState,
  CursorStyle,
  TerminalMode,
  ScrollbackState,
  TerminalCapabilities,
  RGB,
  TerminalInteractionCapabilities,
  TerminalInteractionController,
  TerminalOwnerCoordinate,
  TerminalSelectionOverlay,
  TerminalSelectionRange,
} from "@termless/core"
import { encodeKeyToAnsi } from "@termless/core"

const DEFAULT_INTERACTION_OWNER_ID = "terminal"

// ═══════════════════════════════════════════════════════
// Native module types (from Zig napigen)
// ═══════════════════════════════════════════════════════

// Opaque pointer — napigen wraps this as a JS object
type NativeTerminalHandle = Record<string, never>

interface NativeCell {
  text: string
  fg_r: number // -1 = default
  fg_g: number
  fg_b: number
  bg_r: number
  bg_g: number
  bg_b: number
  bold: boolean
  faint: boolean
  italic: boolean
  underline: number // 0=none, 1=single, 2=double, 3=curly, 4=dotted, 5=dashed
  strikethrough: boolean
  inverse: boolean
  wide: number // 0=narrow, 1=wide, 2=spacer_tail
}

interface NativeCursor {
  x: number
  y: number
  visible: boolean
  style: number // 0=bar, 1=block, 2=underline, 3=block_hollow
}

interface NativeScrollback {
  viewport_offset: number
  total_lines: number
  screen_lines: number
}

interface NativeColors {
  fg_r: number
  fg_g: number
  fg_b: number
  bg_r: number
  bg_g: number
  bg_b: number
}

interface NativeSelectionOverlayRow {
  row: number
  start_col: number
  end_col: number
}

interface NativeModule {
  createTerminal(cols: number, rows: number, maxScrollback: number): NativeTerminalHandle
  destroyTerminal(handle: NativeTerminalHandle): void
  feed(handle: NativeTerminalHandle, data: Uint8Array): void
  resize(handle: NativeTerminalHandle, cols: number, rows: number): void
  reset(handle: NativeTerminalHandle): void
  getText(handle: NativeTerminalHandle): string
  getTextRange(handle: NativeTerminalHandle, startRow: number, startCol: number, endRow: number, endCol: number): string
  getCell(handle: NativeTerminalHandle, row: number, col: number): NativeCell
  getLine(handle: NativeTerminalHandle, row: number): NativeCell[]
  getLines(handle: NativeTerminalHandle): NativeCell[][]
  getLinesRange?(handle: NativeTerminalHandle, startRow: number, rowCount: number): NativeCell[][]
  getViewportLines?(handle: NativeTerminalHandle): NativeCell[][]
  getCursor(handle: NativeTerminalHandle): NativeCursor
  getMode(handle: NativeTerminalHandle, mode: string): boolean
  getTitle(handle: NativeTerminalHandle): string
  getScrollback(handle: NativeTerminalHandle): NativeScrollback
  scrollViewport(handle: NativeTerminalHandle, delta: number): void
  clearSelection?(handle: NativeTerminalHandle): void
  selectRange?(
    handle: NativeTerminalHandle,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    rectangular: boolean,
  ): boolean
  selectWordAt?(handle: NativeTerminalHandle, row: number, col: number): boolean
  selectLineAt?(handle: NativeTerminalHandle, row: number, col: number): boolean
  getSelectionText?(handle: NativeTerminalHandle): string
  getSelectionOverlay?(handle: NativeTerminalHandle): NativeSelectionOverlayRow[]
  getDefaultColors(handle: NativeTerminalHandle): NativeColors
  /** Check if the terminal has pending response data. Returns false if not available. */
  hasResponse?(handle: NativeTerminalHandle): boolean
  /** Read pending response data (DA1/DA2/DSR). Returns null if no responses pending or method not available. */
  readResponse?(handle: NativeTerminalHandle): string | null
}

// ═══════════════════════════════════════════════════════
// Native module loading
// ═══════════════════════════════════════════════════════

let nativeModule: NativeModule | null = null
const require = createRequire(import.meta.url)

export function loadGhosttyNative(): NativeModule {
  if (nativeModule) return nativeModule

  // Try multiple locations — the build script copies to the package root,
  // and the Zig build system outputs to zig-out/lib/
  const paths = ["../termless-ghostty-native.node", "../native/zig-out/lib/termless-ghostty-native.node"]

  for (const p of paths) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      nativeModule = require(p) as NativeModule
      return nativeModule
    } catch {
      // Try next path
    }
  }

  throw new Error(
    "Ghostty native module not found. Build it first:\n" +
      "  cd packages/ghostty-native && bash build/build.sh\n" +
      "\n" +
      "Requirements: Zig 0.15.2 and macOS Command Line Tools",
  )
}

// ═══════════════════════════════════════════════════════
// Cell conversion
// ═══════════════════════════════════════════════════════

const UNDERLINE_MAP: Record<number, Cell["underline"]> = {
  0: false,
  1: "single",
  2: "double",
  3: "curly",
  4: "dotted",
  5: "dashed",
}

const CURSOR_STYLE_MAP: Record<number, CursorStyle> = {
  0: "beam",
  1: "block",
  2: "underline",
  3: "block", // block_hollow maps to block
}

function convertNativeCell(nc: NativeCell): Cell {
  return {
    char: nc.text,
    fg: nc.fg_r >= 0 ? ({ r: nc.fg_r, g: nc.fg_g, b: nc.fg_b } as RGB) : null,
    bg: nc.bg_r >= 0 ? ({ r: nc.bg_r, g: nc.bg_g, b: nc.bg_b } as RGB) : null,
    bold: nc.bold,
    dim: nc.faint,
    italic: nc.italic,
    underline: UNDERLINE_MAP[nc.underline] ?? false,
    underlineColor: null,
    strikethrough: nc.strikethrough,
    inverse: nc.inverse,
    blink: false,
    hidden: false,
    wide: nc.wide === 1,
    continuation: nc.wide === 2, // spacer_tail
    hyperlink: null,
  }
}

function emptyCell(): Cell {
  return {
    char: "",
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
  }
}

// ═══════════════════════════════════════════════════════
// Backend factory
// ═══════════════════════════════════════════════════════

const DEFAULT_COLS = 80
const DEFAULT_ROWS = 24

export interface GhosttyNativeInteractionBackend extends TerminalBackend, TerminalInteractionController {}

/**
 * Create a native Ghostty backend for termless.
 *
 * Uses libghostty-vt (Ghostty's VT parser compiled natively via Zig)
 * for headless terminal emulation. Same VT processing as the Ghostty
 * terminal emulator, but running as a native N-API module.
 *
 * Requires the native module to be built first. See README.md for
 * build instructions.
 */
export function createGhosttyNativeBackend(opts?: Partial<TerminalOptions>): GhosttyNativeInteractionBackend {
  let handle: NativeTerminalHandle | null = null

  function ensureHandle(): NativeTerminalHandle {
    if (!handle) throw new Error("ghostty-native backend not initialized — call init() first")
    return handle
  }

  function init(options: TerminalOptions): void {
    if (handle) {
      const native = loadGhosttyNative()
      native.destroyTerminal(handle)
    }

    const native = loadGhosttyNative()
    handle = native.createTerminal(options.cols, options.rows, options.scrollbackLimit ?? 1000)
  }

  if (opts) {
    init({
      cols: opts.cols ?? DEFAULT_COLS,
      rows: opts.rows ?? DEFAULT_ROWS,
      scrollbackLimit: opts.scrollbackLimit,
    })
  }

  function destroy(): void {
    if (handle) {
      const native = loadGhosttyNative()
      native.destroyTerminal(handle)
      handle = null
    }
  }

  function feed(data: Uint8Array): void {
    const native = loadGhosttyNative()
    const h = ensureHandle()
    native.feed(h, data)

    // Drain DA1/DA2/DSR responses and forward to the terminal layer
    if (backend.onResponse && native.hasResponse && native.readResponse) {
      while (native.hasResponse(h)) {
        const response = native.readResponse(h)
        if (response) {
          backend.onResponse(new TextEncoder().encode(response))
        }
      }
    }
  }

  function resize(cols: number, rows: number): void {
    const native = loadGhosttyNative()
    native.resize(ensureHandle(), cols, rows)
  }

  function reset(): void {
    const native = loadGhosttyNative()
    native.reset(ensureHandle())
  }

  function getText(): string {
    const native = loadGhosttyNative()
    return native.getText(ensureHandle())
  }

  function getTextRange(startRow: number, startCol: number, endRow: number, endCol: number): string {
    const native = loadGhosttyNative()
    return native.getTextRange(ensureHandle(), startRow, startCol, endRow, endCol)
  }

  function getCell(row: number, col: number): Cell {
    const native = loadGhosttyNative()
    try {
      return convertNativeCell(native.getCell(ensureHandle(), row, col))
    } catch {
      return emptyCell()
    }
  }

  function getLine(row: number): Cell[] {
    const native = loadGhosttyNative()
    try {
      return native.getLine(ensureHandle(), row).map(convertNativeCell)
    } catch {
      return []
    }
  }

  function getLines(): Cell[][] {
    const native = loadGhosttyNative()
    try {
      return native.getLines(ensureHandle()).map((row) => row.map(convertNativeCell))
    } catch {
      return []
    }
  }

  function getLinesRange(startRow: number, rowCount: number): Cell[][] {
    const native = loadGhosttyNative()
    const h = ensureHandle()
    const safeStart = Math.max(0, Math.trunc(startRow))
    const safeRows = Math.max(1, Math.trunc(rowCount))
    try {
      const nativeRows =
        typeof native.getLinesRange === "function"
          ? native.getLinesRange(h, safeStart, safeRows)
          : Array.from({ length: safeRows }, (_, index) => native.getLine(h, safeStart + index))
      return nativeRows.map((row) => row.map(convertNativeCell))
    } catch {
      return []
    }
  }

  function getViewportLines(): Cell[][] {
    const native = loadGhosttyNative()
    const h = ensureHandle()
    try {
      const nativeRows =
        typeof native.getViewportLines === "function"
          ? native.getViewportLines(h)
          : (() => {
              const scrollback = native.getScrollback(h)
              return typeof native.getLinesRange === "function"
                ? native.getLinesRange(h, scrollback.viewport_offset, scrollback.screen_lines)
                : Array.from({ length: scrollback.screen_lines }, (_, index) =>
                    native.getLine(h, scrollback.viewport_offset + index),
                  )
            })()
      return nativeRows.map((row) => row.map(convertNativeCell))
    } catch {
      return []
    }
  }

  function getCursor(): CursorState {
    const native = loadGhosttyNative()
    const nc = native.getCursor(ensureHandle())
    return {
      x: nc.x,
      y: nc.y,
      visible: nc.visible,
      style: CURSOR_STYLE_MAP[nc.style] ?? "block",
    }
  }

  function getMode(mode: TerminalMode): boolean {
    const native = loadGhosttyNative()
    return native.getMode(ensureHandle(), mode)
  }

  function getTitle(): string {
    const native = loadGhosttyNative()
    return native.getTitle(ensureHandle())
  }

  function getScrollback(): ScrollbackState {
    const native = loadGhosttyNative()
    const ns = native.getScrollback(ensureHandle())
    return {
      viewportOffset: ns.viewport_offset,
      totalLines: ns.total_lines,
      screenLines: ns.screen_lines,
    }
  }

  function scrollViewport(delta: number): void {
    const native = loadGhosttyNative()
    native.scrollViewport(ensureHandle(), delta)
  }

  const interactionCapabilities: TerminalInteractionCapabilities = {
    ownership: "backend-native",
    selection: true,
    copy: true,
    semanticSelection: true,
    cursorFollow: true,
    overlay: true,
  }

  const pointToBackend = (point: TerminalOwnerCoordinate): { row: number; col: number } | null => {
    if (point.ownerId !== DEFAULT_INTERACTION_OWNER_ID) {
      return null
    }
    const row = Math.max(0, Math.trunc(point.row))
    const col = Math.max(0, Math.trunc(point.col))
    return { row, col }
  }

  const clearSelection = (ownerId?: string): boolean => {
    if (ownerId && ownerId !== DEFAULT_INTERACTION_OWNER_ID) {
      return false
    }
    const native = loadGhosttyNative()
    native.clearSelection?.(ensureHandle())
    return typeof native.clearSelection === "function"
  }

  const selectRange = (range: TerminalSelectionRange): boolean => {
    if (range.ownerId !== DEFAULT_INTERACTION_OWNER_ID) {
      return false
    }
    const native = loadGhosttyNative()
    if (typeof native.selectRange !== "function") {
      return false
    }
    return native.selectRange(
      ensureHandle(),
      Math.max(0, Math.trunc(range.startRow)),
      Math.max(0, Math.trunc(range.startCol)),
      Math.max(0, Math.trunc(range.endRow)),
      Math.max(0, Math.trunc(range.endCol)),
      range.rectangular === true,
    )
  }

  const startSelection = (point: TerminalOwnerCoordinate): boolean => {
    const normalized = pointToBackend(point)
    if (!normalized) {
      return false
    }
    return selectRange({
      ownerId: DEFAULT_INTERACTION_OWNER_ID,
      startRow: normalized.row,
      startCol: normalized.col,
      endRow: normalized.row,
      endCol: normalized.col,
    })
  }

  let selectionAnchor: TerminalOwnerCoordinate | null = null

  const updateSelection = (point: TerminalOwnerCoordinate): boolean => {
    const normalized = pointToBackend(point)
    if (!normalized || !selectionAnchor) {
      return false
    }
    return selectRange({
      ownerId: DEFAULT_INTERACTION_OWNER_ID,
      startRow: selectionAnchor.row,
      startCol: selectionAnchor.col,
      endRow: normalized.row,
      endCol: normalized.col,
    })
  }

  const endSelection = (point: TerminalOwnerCoordinate): boolean => {
    const updated = updateSelection(point)
    selectionAnchor = null
    return updated
  }

  const selectWordAt = (point: TerminalOwnerCoordinate): boolean => {
    const normalized = pointToBackend(point)
    if (!normalized) {
      return false
    }
    const native = loadGhosttyNative()
    return native.selectWordAt?.(ensureHandle(), normalized.row, normalized.col) === true
  }

  const selectLineAt = (point: TerminalOwnerCoordinate): boolean => {
    const normalized = pointToBackend(point)
    if (!normalized) {
      return false
    }
    const native = loadGhosttyNative()
    return native.selectLineAt?.(ensureHandle(), normalized.row, normalized.col) === true
  }

  const copySelection = (ownerId?: string): string => {
    if (ownerId && ownerId !== DEFAULT_INTERACTION_OWNER_ID) {
      return ""
    }
    const native = loadGhosttyNative()
    return native.getSelectionText?.(ensureHandle()) ?? ""
  }

  const getSelectionOverlay = (ownerId?: string): TerminalSelectionOverlay | null => {
    if (ownerId && ownerId !== DEFAULT_INTERACTION_OWNER_ID) {
      return null
    }
    const native = loadGhosttyNative()
    const rows = native.getSelectionOverlay?.(ensureHandle()) ?? []
    if (rows.length === 0) {
      return null
    }
    return {
      ownerId: DEFAULT_INTERACTION_OWNER_ID,
      ownership: "backend-native",
      rows: rows.map((row) => ({
        row: row.row,
        startCol: row.start_col,
        endCol: row.end_col,
      })),
      selectedText: copySelection(ownerId),
    }
  }

  const capabilities: TerminalCapabilities = {
    name: "ghostty-native",
    version: "1.3.1",
    truecolor: true,
    kittyKeyboard: true,
    kittyGraphics: true,
    sixel: false,
    osc8Hyperlinks: true,
    semanticPrompts: true,
    unicode: "15.1",
    reflow: true,
    extensions: new Set(),
  }

  // TODO(native): Wire DA1/DA2/DSR response capture in main.zig.
  // The Zig side uses ReadonlyStream which doesn't capture write-back data.
  // Steps:
  //   1. Replace ReadonlyStream with a full Stream that captures terminal output
  //      (or add a separate response buffer to TerminalHandle)
  //   2. Accumulate response bytes written by the terminal into the buffer
  //   3. Expose hasResponse(handle) and readResponse(handle) via napigen
  // The TS side is already wired — it calls hasResponse/readResponse after each feed().

  const backend: GhosttyNativeInteractionBackend = {
    name: "ghostty-native",
    init,
    destroy,
    feed,
    resize,
    reset,
    getText,
    getTextRange,
    getCell,
    getLine,
    getLines,
    getLinesRange,
    getViewportLines,
    getCursor,
    getMode,
    getTitle,
    getScrollback,
    scrollViewport,
    interactionCapabilities,
    startSelection(point) {
      selectionAnchor = point.ownerId === DEFAULT_INTERACTION_OWNER_ID ? point : null
      clearSelection(DEFAULT_INTERACTION_OWNER_ID)
      return selectionAnchor !== null
    },
    updateSelection,
    endSelection,
    selectRange,
    selectWordAt,
    selectLineAt,
    clearSelection,
    copySelection,
    getSelectionOverlay,
    followCursor() {
      const cursor = getCursor()
      const scrollback = getScrollback()
      const viewportSize = Math.max(1, scrollback.screenLines)
      const target = Math.max(0, Math.trunc(cursor.y) - viewportSize + 1)
      const delta = target - scrollback.viewportOffset
      if (delta !== 0) {
        scrollViewport(delta)
      }
      return true
    },
    encodeKey: encodeKeyToAnsi,
    capabilities,
  }

  return backend
}
