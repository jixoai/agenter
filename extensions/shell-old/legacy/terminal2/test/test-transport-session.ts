import type {
  TerminalTransportClientMessage,
  TerminalTransportClientSession,
} from "@agenter/terminal-transport-protocol";

export const createTestTransportSession = (input: {
  connect(): Promise<void>;
  disconnect?(): void;
  send?(message: TerminalTransportClientMessage): boolean;
  getConnectionState?(): ReturnType<TerminalTransportClientSession["getConnectionState"]>;
}): TerminalTransportClientSession => {
  const send = input.send ?? (() => true);
  return {
    connect: input.connect,
    disconnect: input.disconnect ?? (() => {}),
    send,
    sendInputBytes(data) {
      return send({ type: "inputBytes", data });
    },
    resize(cols, rows) {
      return send({ type: "resize", cols, rows });
    },
    scrollViewport(deltaRows) {
      return send({ type: "viewportDelta", deltaRows });
    },
    setViewportStart(viewportStart) {
      return send({ type: "viewportTarget", viewportStart });
    },
    followCursor() {
      return send({ type: "followCursor" });
    },
    selectionStart(point) {
      return send({ type: "selectionStart", point });
    },
    selectionUpdate(point) {
      return send({ type: "selectionUpdate", point });
    },
    selectionEnd(point) {
      return send({ type: "selectionEnd", point });
    },
    selectWordAt(point) {
      return send({ type: "selectWordAt", point });
    },
    selectLineAt(point) {
      return send({ type: "selectLineAt", point });
    },
    selectRange(range) {
      return send({ type: "selectRange", range });
    },
    copySelection(ownerId) {
      return send({ type: "copySelection", ownerId });
    },
    clearSelection(ownerId) {
      return send({ type: "clearSelection", ownerId });
    },
    pullFrame(frameInput) {
      return send({ type: "pullFrame", ...frameInput });
    },
    getConnectionState: input.getConnectionState ?? (() => "connected"),
  };
};
