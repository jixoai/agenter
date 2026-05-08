import {
  renderStructuredBuffer,
  type TerminalRenderRichLine,
  type TerminalStructuredRender,
} from "@agenter/termless-core";
import { XtermBridge } from "@agenter/termless-xterm-backend";
import {
  createTerminalTransportClientSession,
  type TerminalTransportClientConnectionState,
  type TerminalTransportClientSession,
  type TerminalTransportServerMessage,
  type TerminalTransportSnapshot,
} from "@agenter/terminal-transport-protocol";

export interface CliShellLiveTerminalView {
  plainLines: string[];
  richLines: TerminalRenderRichLine[];
  cursorAbsRow: number;
  cursorCol: number;
  cursorVisible: boolean;
  rows: number;
  cols: number;
  viewportStart: number;
  viewportEnd: number;
  scrollbackRows: number;
  running: boolean;
  connected: boolean;
}

export interface CliShellLiveTerminalMirror {
  connect(): Promise<void>;
  disconnect(): void;
  getView(): CliShellLiveTerminalView;
  sendInputBytes(data: Uint8Array): boolean;
  resize(cols: number, rows: number): boolean;
  subscribe(listener: () => void): () => void;
}

const EMPTY_STRUCTURED_RENDER: TerminalStructuredRender = {
  richLines: [],
  cursor: { x: 0, y: 0, visible: false },
  scrollback: {
    viewportOffset: 0,
    totalLines: 24,
    screenLines: 24,
  },
  rows: 24,
  cols: 80,
};

const cloneRichLines = (lines: readonly TerminalRenderRichLine[]): TerminalRenderRichLine[] =>
  lines.map((line) => ({
    spans: line.spans.map((span) => ({ ...span })),
  }));

const richLineToPlain = (line: TerminalRenderRichLine): string => line.spans.map((span) => span.text).join("");

const viewFromStructured = (input: {
  render: TerminalStructuredRender;
  running: boolean;
  connected: boolean;
}): CliShellLiveTerminalView => {
  const richLines = cloneRichLines(input.render.richLines);
  const plainLines = richLines.map((line) => richLineToPlain(line));
  const viewportStart = Math.max(0, input.render.scrollback.viewportOffset);
  const viewportEnd = Math.max(viewportStart, viewportStart + input.render.rows);
  return {
    plainLines,
    richLines,
    cursorAbsRow: input.render.cursor.y,
    cursorCol: input.render.cursor.x,
    cursorVisible: input.render.cursor.visible ?? true,
    rows: input.render.rows,
    cols: input.render.cols,
    viewportStart,
    viewportEnd,
    scrollbackRows: input.render.scrollback.totalLines,
    running: input.running,
    connected: input.connected,
  };
};

export const createCliShellLiveTerminalMirror = (input: {
  terminalId: string;
  transportUrl: string;
  initialSnapshot?: TerminalTransportSnapshot | null;
  createTransportSession?: (input: {
    transportUrl: string;
    events: {
      onOpen: () => void;
      onClose: () => void;
      onError: () => void;
      onMessage: (message: TerminalTransportServerMessage) => void;
    };
  }) => TerminalTransportClientSession;
}): CliShellLiveTerminalMirror => {
  const bridge = new XtermBridge(input.initialSnapshot?.cols ?? 80, input.initialSnapshot?.rows ?? 24);
  let session: TerminalTransportClientSession | null = null;
  let connectionState: TerminalTransportClientConnectionState = "idle";
  let running = true;
  let hydratedSnapshotSeq = -1;
  let bridgeTask: Promise<void> = Promise.resolve();
  let latestRender: TerminalStructuredRender = {
    ...EMPTY_STRUCTURED_RENDER,
    rows: input.initialSnapshot?.rows ?? EMPTY_STRUCTURED_RENDER.rows,
    cols: input.initialSnapshot?.cols ?? EMPTY_STRUCTURED_RENDER.cols,
    scrollback: input.initialSnapshot?.scrollback ?? EMPTY_STRUCTURED_RENDER.scrollback,
  };
  const listeners = new Set<() => void>();

  const emit = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const refreshStructuredRender = (): void => {
    latestRender = renderStructuredBuffer(bridge);
  };

  const applySnapshotRender = (snapshot: TerminalTransportSnapshot): void => {
    latestRender = {
      richLines:
        snapshot.richLines && snapshot.richLines.length > 0
          ? cloneRichLines(snapshot.richLines)
          : renderStructuredBuffer(bridge).richLines,
      cursor: {
        x: Math.max(0, snapshot.cursor.x),
        y: Math.max(0, snapshot.cursor.y),
        visible: snapshot.cursor.visible ?? true,
      },
      scrollback: {
        viewportOffset: Math.max(0, snapshot.scrollback.viewportOffset),
        totalLines: Math.max(snapshot.lines.length, snapshot.scrollback.totalLines),
        screenLines: snapshot.scrollback.screenLines,
      },
      rows: snapshot.rows,
      cols: snapshot.cols,
    };
  };

  const queueBridgeTask = <T>(task: () => Promise<T>): Promise<T> => {
    const nextTask = bridgeTask.then(task);
    bridgeTask = nextTask.then(
      () => undefined,
      () => undefined,
    );
    return nextTask;
  };

  const hydrateSnapshot = async (snapshot: TerminalTransportSnapshot, force = false): Promise<boolean> => {
    return await queueBridgeTask(async () => {
      const geometryChanged = bridge.cols !== snapshot.cols || bridge.rows !== snapshot.rows;
      if (!force && snapshot.seq <= hydratedSnapshotSeq && !geometryChanged) {
        return false;
      }
      hydratedSnapshotSeq = Math.max(hydratedSnapshotSeq, snapshot.seq);
      bridge.reset();
      bridge.resize(snapshot.cols, snapshot.rows);
      const rendered = snapshot.lines.join("\r\n");
      if (rendered.length > 0) {
        await bridge.write(rendered);
      }
      applySnapshotRender(snapshot);
      return true;
    });
  };

  const writeOutputBytes = async (data: Uint8Array): Promise<void> => {
    await queueBridgeTask(async () => {
      await bridge.write(data);
      refreshStructuredRender();
    });
  };

  if (input.initialSnapshot) {
    applySnapshotRender(input.initialSnapshot);
    void hydrateSnapshot(input.initialSnapshot, true);
  } else {
    refreshStructuredRender();
  }

  const handleServerMessage = (message: TerminalTransportServerMessage): void => {
    if (message.type === "snapshot") {
      void hydrateSnapshot(message.snapshot, connectionState !== "connected").then((changed) => {
        if (!changed) {
          return;
        }
        running = true;
        emit();
      });
      return;
    }
    if (message.type === "outputBytes") {
      void writeOutputBytes(message.data).then(() => {
        emit();
      });
      return;
    }
    if (message.type === "status") {
      running = message.running;
      emit();
      return;
    }
  };

  return {
    async connect(): Promise<void> {
      if (session) {
        return;
      }
      const createTransportSession = input.createTransportSession ?? createTerminalTransportClientSession;
      session = createTransportSession({
        transportUrl: input.transportUrl,
        events: {
          onOpen: () => {
            connectionState = "connected";
            emit();
          },
          onClose: () => {
            connectionState = "closed";
            running = false;
            emit();
          },
          onError: () => {
            connectionState = "error";
            emit();
          },
          onMessage: handleServerMessage,
        },
      });
      connectionState = "connecting";
      emit();
      await session.connect();
    },
    disconnect(): void {
      connectionState = session ? "closed" : "idle";
      session?.disconnect();
      session = null;
      bridge.dispose();
    },
    getView(): CliShellLiveTerminalView {
      return viewFromStructured({
        render: latestRender,
        running,
        connected: connectionState === "connected",
      });
    },
    sendInputBytes(data: Uint8Array): boolean {
      return (
        session?.send({
          type: "inputBytes",
          data,
        }) ?? false
      );
    },
    resize(cols: number, rows: number): boolean {
      return (
        session?.send({
          type: "resize",
          cols,
          rows,
        }) ?? false
      );
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
