import type {
  TerminalTransportOwnerCoordinate,
  TerminalTransportSelectionOverlay,
  TerminalTransportSelectionRange,
} from "@agenter/terminal-transport-protocol";
import {
  createTerminalHostInputController,
  type TerminalHostInputTarget,
  type TerminalHostKeyEvent,
  type TerminalHostPointerDispatchResult,
  type TerminalHostPointerInput,
  type TerminalKeyboardInteractionView,
} from "@agenter/termless-backend-utils";
import { XtermBridge, renderStructuredViewportBuffer, type TerminalBackendKind } from "@agenter/termless-core";

import {
  createBunPtyPaneSource,
  createCommandTaskPaneSource,
  type BunPtyLaunchOptions,
  type BunPtyPaneSource,
  type CommandTaskLaunchOptions,
  type CommandTaskPaneSource,
  type PaneSourceId,
  type TerminalFrameSnapshot,
  type TerminalInputChunk,
  type TerminalPaneSize,
  type TerminalProtocolPaneSource,
} from "../renderable-mux/pane-source";
import { ConflatedResizeDispatcher } from "./conflated-resize-dispatcher";

const DEFAULT_SCROLLBACK_ROWS = 10_000;
const DEFAULT_TERMINAL_NAME = "xterm-256color";
const LOCAL_TERMINAL_BACKEND_RESIZE_DEBOUNCE_MS = 25;

interface BunTerminalEnvironmentInput {
  readonly extra?: Readonly<Record<string, string>>;
}

export interface LocalBunTerminalProtocolSourceInput {
  readonly id: PaneSourceId;
  readonly launch: BunPtyLaunchOptions;
  readonly initialSize: TerminalPaneSize;
  readonly backend?: TerminalBackendKind;
  readonly scrollbackRows?: number;
  readonly onExit?: (event: LocalBunTerminalExitEvent) => void;
}

export interface LocalBunTerminalExitEvent {
  readonly paneId: string;
  readonly ptyExitCode: number | null;
  readonly processExitCode: number | null;
  readonly signalCode: string | null;
}

type BunTerminal = InstanceType<typeof Bun.Terminal>;
type BunSubprocess = ReturnType<typeof Bun.spawn>;

const sanitizeSize = (size: TerminalPaneSize): TerminalPaneSize => ({
  cols: Math.max(1, Math.trunc(size.cols)),
  rows: Math.max(1, Math.trunc(size.rows)),
});

const createBunTerminalEnvironment = (input: BunTerminalEnvironmentInput): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  for (const [key, value] of Object.entries(input.extra ?? {})) {
    env[key] = value;
  }
  env.TERM = env.TERM || DEFAULT_TERMINAL_NAME;
  return env;
};

const richLineToPlain = (line: ReturnType<typeof renderStructuredViewportBuffer>["richLines"][number]): string =>
  line.spans
    .map((span) => span.text)
    .join("")
    .replace(/\s+$/u, "");

const toTransportSelectionOverlays = (
  overlays: readonly ReturnType<XtermBridge["getSelectionOverlay"]>[],
): TerminalTransportSelectionOverlay[] =>
  overlays.flatMap((overlay) => {
    if (!overlay) {
      return [];
    }
    return [
      {
        ownerId: overlay.ownerId,
        ownership: overlay.ownership,
        rows: overlay.rows.map((row) => ({ ...row })),
        selectedText: overlay.selectedText,
      },
    ];
  });

export class LocalBunTerminalProtocolSource implements TerminalProtocolPaneSource {
  readonly kind = "terminal-protocol" as const;
  readonly id: PaneSourceId;
  readonly #bridge: XtermBridge;
  readonly #terminal: BunTerminal;
  readonly #listeners = new Set<() => void>();
  readonly #onExit: ((event: LocalBunTerminalExitEvent) => void) | undefined;
  #process: BunSubprocess | null = null;
  #size: TerminalPaneSize;
  #revision = 0;
  #disposed = false;
  #ptyExitCode: number | null = null;
  #signalCode: string | null = null;
  #processExitCode: number | null = null;
  #configuredTitle: string | null = null;
  #currentTitle: string | null = null;
  #releaseTitleListener: (() => void) | null = null;
  readonly #resizeDispatcher: ConflatedResizeDispatcher;
  readonly #hostInput = createTerminalHostInputController();

  constructor(input: LocalBunTerminalProtocolSourceInput) {
    this.id = input.id;
    this.#size = sanitizeSize(input.initialSize);
    this.#onExit = input.onExit;
    this.#bridge = new XtermBridge(
      this.#size.cols,
      this.#size.rows,
      input.scrollbackRows ?? DEFAULT_SCROLLBACK_ROWS,
      input.backend ?? "ghostty-native",
    );
    this.#configuredTitle = input.launch.command;
    this.#resizeDispatcher = new ConflatedResizeDispatcher({
      delayMs: LOCAL_TERMINAL_BACKEND_RESIZE_DEBOUNCE_MS,
      deliver: (size) => this.#deliverResize(size),
    });
    this.#releaseTitleListener = this.#bridge.onTitleChange((title) => {
      const normalized = title.trim();
      this.#currentTitle = normalized.length > 0 ? normalized : null;
      this.#revision += 1;
      this.#emitFrame();
    });
    this.#terminal = new Bun.Terminal({
      cols: this.#size.cols,
      rows: this.#size.rows,
      name: DEFAULT_TERMINAL_NAME,
      data: (_terminal, data) => {
        if (this.#disposed) {
          return;
        }
        this.#bridge.writeSync(data);
        this.#revision += 1;
        this.#emitFrame();
      },
      exit: (_terminal, exitCode, signal) => {
        this.#ptyExitCode = exitCode;
        this.#signalCode = signal;
        this.#revision += 1;
        this.#emitFrame();
        this.#emitExitIfSettled();
      },
    });
    this.#process = Bun.spawn([input.launch.command, ...(input.launch.args ?? [])], {
      cwd: input.launch.cwd,
      env: createBunTerminalEnvironment({ extra: input.launch.env }),
      terminal: this.#terminal,
    });
    void this.#process.exited
      .then((exitCode) => {
        this.#processExitCode = exitCode;
        this.#emitExitIfSettled();
      })
      .catch(() => {
        this.#processExitCode = 1;
        this.#emitExitIfSettled();
      });
  }

  readFrame(): TerminalFrameSnapshot {
    const structured = renderStructuredViewportBuffer(this.#bridge);
    return {
      size: this.#size,
      lines: structured.richLines.map(richLineToPlain),
      richLines: structured.richLines,
      cursor: {
        x: Math.max(0, Math.trunc(structured.cursor.x)),
        y: Math.max(0, Math.trunc(structured.cursor.y)),
        visible: structured.cursor.visible ?? false,
      },
      viewportStart: Math.max(0, Math.trunc(structured.scrollback.viewportOffset)),
      scrollbackRows: Math.max(structured.rows, Math.trunc(structured.scrollback.totalLines)),
      selectionOverlays: toTransportSelectionOverlays([this.#bridge.getSelectionOverlay("terminal")]),
      revision: this.#revision,
    };
  }

  readTitle(): string | null {
    return this.#currentTitle ?? this.#configuredTitle;
  }

  writeInput(chunk: TerminalInputChunk): boolean {
    if (this.#disposed || this.#terminal.closed) {
      return false;
    }
    this.#terminal.write(chunk);
    return true;
  }

  handleKey(key: TerminalHostKeyEvent): boolean {
    return this.#hostInput.handleKey(this.#inputTarget(), key);
  }

  pasteText(text: string): boolean {
    return this.#hostInput.pasteText(this.#inputTarget(), text);
  }

  pointerDown(input: TerminalHostPointerInput): TerminalHostPointerDispatchResult {
    const result = this.#hostInput.handlePointerDown(this.#inputTarget(), input);
    this.#emitSelectionFrame(result.handled);
    return result;
  }

  pointerDrag(input: TerminalHostPointerInput): TerminalHostPointerDispatchResult {
    const result = this.#hostInput.handlePointerDrag(this.#inputTarget(), input);
    this.#emitSelectionFrame(result.handled);
    return result;
  }

  pointerUp(input: TerminalHostPointerInput): TerminalHostPointerDispatchResult {
    const result = this.#hostInput.handlePointerUp(this.#inputTarget(), input);
    this.#emitSelectionFrame(result.handled);
    return result;
  }

  resize(size: TerminalPaneSize): void {
    if (this.#disposed) {
      return;
    }
    this.#resizeDispatcher.resize(size);
  }

  #deliverResize(size: TerminalPaneSize): void {
    if (this.#disposed) {
      return;
    }
    const next = sanitizeSize(size);
    if (this.#size.cols === next.cols && this.#size.rows === next.rows) {
      return;
    }
    this.#size = next;
    this.#bridge.resize(next.cols, next.rows);
    if (!this.#terminal.closed) {
      this.#terminal.resize(next.cols, next.rows);
    }
    this.#revision += 1;
    this.#emitFrame();
  }

  selectionStart(point: TerminalTransportOwnerCoordinate): boolean {
    const selected = this.#bridge.startSelection(point);
    this.#emitSelectionFrame(selected);
    return selected;
  }

  selectionUpdate(point: TerminalTransportOwnerCoordinate): boolean {
    const selected = this.#bridge.updateSelection(point);
    this.#emitSelectionFrame(selected);
    return selected;
  }

  selectionEnd(point: TerminalTransportOwnerCoordinate): boolean {
    const selected = this.#bridge.endSelection(point);
    this.#emitSelectionFrame(selected);
    return selected;
  }

  selectWordAt(point: TerminalTransportOwnerCoordinate): boolean {
    const selected = this.#bridge.selectWordAt(point);
    this.#emitSelectionFrame(selected);
    return selected;
  }

  selectLineAt(point: TerminalTransportOwnerCoordinate): boolean {
    const selected = this.#bridge.selectLineAt(point);
    this.#emitSelectionFrame(selected);
    return selected;
  }

  selectRange(range: TerminalTransportSelectionRange): boolean {
    const selected = this.#bridge.selectRange(range);
    this.#emitSelectionFrame(selected);
    return selected;
  }

  clearSelection(ownerId?: string): boolean {
    const cleared = this.#bridge.clearSelection(ownerId);
    this.#emitSelectionFrame(cleared);
    return cleared;
  }

  copySelection(ownerId?: string): string {
    return this.#bridge.copySelection(ownerId);
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#listeners.clear();
    this.#resizeDispatcher.dispose();
    this.#releaseTitleListener?.();
    this.#releaseTitleListener = null;
    if (!this.#terminal.closed) {
      this.#terminal.close();
    }
    this.#process?.kill();
    this.#bridge.dispose();
  }

  #emitFrame(): void {
    if (this.#disposed) {
      return;
    }
    for (const listener of this.#listeners) {
      listener();
    }
  }

  #emitSelectionFrame(changed: boolean): void {
    if (!changed || this.#disposed) {
      return;
    }
    this.#revision += 1;
    this.#emitFrame();
  }

  #readKeyboardInteractionView(): TerminalKeyboardInteractionView | null {
    const frame = this.readFrame();
    const cursor = frame.cursor;
    if (!cursor) {
      return null;
    }
    const viewportStart = Math.max(0, Math.trunc(frame.viewportStart ?? 0));
    return {
      cursorAbsRow: viewportStart + Math.max(0, Math.trunc(cursor.y)),
      cursorCol: Math.max(0, Math.trunc(cursor.x)),
      viewportStart,
      plainLines: frame.lines,
    };
  }

  #inputTarget(): TerminalHostInputTarget {
    return {
      readKeyboardInteractionView: () => this.#readKeyboardInteractionView(),
      writeInput: (chunk) => this.writeInput(chunk),
      followCursor: () => this.#bridge.followCursor(),
      startSelection: (point) => this.#bridge.startSelection(point),
      updateSelection: (point) => this.#bridge.updateSelection(point),
      endSelection: (point) => this.#bridge.endSelection(point),
      selectRange: (range) => this.#bridge.selectRange(range),
      selectWordAt: (point) => this.#bridge.selectWordAt(point),
      selectLineAt: (point) => this.#bridge.selectLineAt(point),
      clearSelection: (ownerId) => this.#bridge.clearSelection(ownerId),
      getSelectionOverlay: (ownerId) => this.#bridge.getSelectionOverlay(ownerId),
    };
  }

  #emitExitIfSettled(): void {
    if (this.#disposed) {
      return;
    }
    if (this.#processExitCode === null || this.#ptyExitCode === null) {
      return;
    }
    this.#onExit?.({
      paneId: this.id.value,
      ptyExitCode: this.#ptyExitCode,
      processExitCode: this.#processExitCode,
      signalCode: this.#signalCode,
    });
  }
}

export const createLocalBunPtyPaneSource = (input: LocalBunTerminalProtocolSourceInput): BunPtyPaneSource => {
  const protocol = new LocalBunTerminalProtocolSource(input);
  return createBunPtyPaneSource({
    id: input.id,
    launch: input.launch,
    protocol,
  });
};

export const createLocalCommandTaskPaneSource = (input: {
  readonly id: PaneSourceId;
  readonly task: CommandTaskLaunchOptions;
  readonly initialSize: TerminalPaneSize;
  readonly backend?: TerminalBackendKind;
  readonly onExit?: (event: LocalBunTerminalExitEvent) => void;
}): CommandTaskPaneSource => {
  const protocol = new LocalBunTerminalProtocolSource({
    id: input.id,
    launch: {
      command: input.task.command,
      args: input.task.args,
      cwd: input.task.cwd,
      env: input.task.env,
    },
    initialSize: input.initialSize,
    backend: input.backend,
    onExit: input.onExit,
  });
  return createCommandTaskPaneSource({
    id: input.id,
    task: input.task,
    protocol,
  });
};

export const resolveDefaultShellLaunch = (cwd: string = process.cwd()): BunPtyLaunchOptions => {
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "powershell.exe",
      cwd,
    };
  }
  return {
    command: process.env.SHELL || "/bin/sh",
    args: ["-l"],
    cwd,
  };
};
