import { BoxRenderable, CliRenderEvents, createCliRenderer, type CliRenderer, type KeyEvent } from "@opentui/core";
import type { TerminalTransportSnapshot } from "@agenter/terminal-transport-protocol";

import {
  BackendTerminalFrameRenderable,
  CLI_SHELL_PRODUCT_DYNAMIC_QUIET_MS,
  createCliShellLiveTerminalMirror,
  type CliShellLiveTerminalTransportSessionFactory,
} from "./terminal-instance-view";

export interface CliShellTerminalInstancePanelController {
  finished: Promise<void>;
  destroy(): void;
}

export interface CliShellTerminalInstancePanelInput {
  terminalId: string;
  transportUrl: string;
  initialSnapshot?: TerminalTransportSnapshot | null;
  renderer?: CliRenderer;
  geometryRole?: "projection-only" | "authority";
  dynamicQuietMs?: number;
  encodeKey?: (key: KeyEvent) => string | null;
  quitOnCtrlQ?: boolean;
  createTransportSession?: CliShellLiveTerminalTransportSessionFactory;
}

const readKeyEvent = (value: unknown): KeyEvent | null =>
  typeof value === "object" && value !== null ? (value as KeyEvent) : null;

// cli-shell keeps shell-pane geometry stable by always reserving one column for
// scrollbar chrome. The scrollbar may hide when scrollback is trivial, but the
// backend PTY width must continue to match the visible terminal content area
// rather than the full panel width, otherwise glyphs shift under resize.
const resolveShellViewportWidth = (width: number): number => Math.max(1, Math.trunc(width) - 1);

const resolveShellViewportHeight = (height: number): number => Math.max(1, Math.trunc(height));

const applyCliShellScrollbarTheme = (frame: BackendTerminalFrameRenderable): void => {
  frame.scrollbar.trackOptions = {
    foregroundColor: "#94a3b8",
    backgroundColor: "#111827",
  };
};

export const startCliShellTerminalInstancePanel = async (
  input: CliShellTerminalInstancePanelInput,
): Promise<CliShellTerminalInstancePanelController> => {
  const renderer = input.renderer ?? (await createCliRenderer({ exitOnCtrlC: false, useMouse: true }));
  const ownsRenderer = input.renderer === undefined;

  let done = false;
  let renderRequested = false;
  let resolveFinished: () => void = () => {};
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });

  const root = new BoxRenderable(renderer, {
    id: "cli-shell-terminal-instance-root",
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
  });

  const mirror = createCliShellLiveTerminalMirror({
    terminalId: input.terminalId,
    transportUrl: input.transportUrl,
    initialSnapshot: input.initialSnapshot ?? null,
    geometryRole: input.geometryRole ?? "authority",
    pacing: {
      mode: "dynamic",
      dynamicQuietMs: input.dynamicQuietMs ?? CLI_SHELL_PRODUCT_DYNAMIC_QUIET_MS,
    },
    createTransportSession: input.createTransportSession,
    requestPaint: () => {
      render();
    },
  });

  const terminalFrame = new BackendTerminalFrameRenderable(renderer, {
    id: "cli-shell-terminal-instance-frame",
    position: "absolute",
    top: 0,
    left: 0,
    width: Math.max(1, renderer.width),
    height: Math.max(1, renderer.height),
    state: {
      lines: [],
      cursorCol: 0,
      cursorAbsRow: 0,
      cursorVisible: false,
      viewportStart: 0,
      scrollbackRows: 1,
      selectionOverlays: [],
    },
    bridge: {
      scrollViewport: (deltaRows) => mirror.scrollViewport(deltaRows),
      setViewportStart: (viewportStart) => mirror.setViewportStart(viewportStart),
      followCursor: () => mirror.followCursor(),
      copySelection: (ownerId) => mirror.copySelection(ownerId),
    },
  });
  applyCliShellScrollbarTheme(terminalFrame);

  root.add(terminalFrame);
  renderer.root.add(root);

  const render = (): void => {
    renderRequested = false;
    const view = mirror.getView();
    const width = Math.max(1, renderer.width);
    const height = Math.max(1, renderer.height);
    root.width = width;
    root.height = height;
    terminalFrame.syncSize(width, height);
    terminalFrame.updateBackendState({
      lines: view.richLines,
      cursorCol: view.cursorCol,
      cursorAbsRow: view.cursorAbsRow,
      cursorVisible: view.cursorVisible,
      viewportStart: view.viewportStart,
      scrollbackRows: view.scrollbackRows,
      selectionOverlays: view.interaction?.selectionOverlays,
    });
    renderer.requestRender();
    void renderer.idle()
      .then(() => {
        mirror.notifyPaintCommitted();
      })
      .catch(() => undefined);
  };

  let releaseMirror: (() => void) | null = null;

  const destroy = (): void => {
    if (done) {
      return;
    }
    done = true;
    releaseMirror?.();
    mirror.disconnect();
    renderer.keyInput.off("keypress", handleKeypress);
    renderer.off(CliRenderEvents.RESIZE, handleResize);
    root.destroyRecursively();
    if (ownsRenderer) {
      renderer.destroy();
    }
    resolveFinished();
  };

  const handleResize = (): void => {
    mirror.resize(resolveShellViewportWidth(renderer.width), resolveShellViewportHeight(renderer.height));
    render();
  };

  const handleKeypress = (value: unknown): void => {
    const key = readKeyEvent(value);
    if (!key) {
      return;
    }
    if (input.quitOnCtrlQ !== false && key.ctrl && key.name === "q") {
      key.preventDefault();
      destroy();
      return;
    }
    const encoded = input.encodeKey?.(key);
    if (!encoded) {
      return;
    }
    mirror.sendInputBytes(new TextEncoder().encode(encoded));
    key.preventDefault();
  };

  releaseMirror = mirror.subscribe(() => {
    if (!mirror.getView().running) {
      destroy();
      return;
    }
    if (renderRequested) {
      return;
    }
    renderRequested = true;
    render();
  });

  renderer.keyInput.on("keypress", handleKeypress);
  renderer.on(CliRenderEvents.RESIZE, handleResize);
  await mirror.connect();
  mirror.resize(resolveShellViewportWidth(renderer.width), resolveShellViewportHeight(renderer.height));
  terminalFrame.focusTerminal();
  render();

  return {
    finished,
    destroy,
  };
};
