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
    pullFrame(frameInput) {
      return send({ type: "pullFrame", ...frameInput });
    },
    getConnectionState: input.getConnectionState ?? (() => "connected"),
  };
};
