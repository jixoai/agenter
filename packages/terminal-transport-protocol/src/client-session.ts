import {
  canUseTerminalTransportDirectRegistry,
  getTerminalTransportDirectRegistry,
  TERMINAL_TRANSPORT_DIRECT_REGISTRY_KEY,
  type TerminalTransportDirectConnection,
  type TerminalTransportDirectEndpoint,
} from "./direct-registry";
import {
  decodeTerminalTransportServerMessage,
  encodeTerminalTransportClientMessage,
  type TerminalTransportClientMessage,
  type TerminalTransportServerMessage,
} from "./index";

const toOwnedArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const SOCKET_OPEN_READY_STATE = 1;
const globalRuntime = globalThis as {
  Bun?: unknown;
  process?: { pid?: unknown };
};

export type TerminalTransportClientConnectionState = "idle" | "connecting" | "connected" | "closed" | "error";

export interface TerminalTransportClientSocketLike {
  readonly readyState: number;
  binaryType: string;
  send(data: ArrayBuffer): void;
  close(): void;
  addEventListener(type: "open", listener: () => void): void;
  addEventListener(type: "close", listener: () => void): void;
  addEventListener(type: "error", listener: () => void): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
}

export interface TerminalTransportClientSessionEvents {
  onOpen?(): void;
  onClose?(): void;
  onError?(message: string): void;
  onMessage?(message: TerminalTransportServerMessage): void;
  onTrace?(event: {
    kind:
      | "client-send"
      | "client-raw-message"
      | "client-decode-message"
      | "client-direct-upgrade"
      | "client-direct-message";
    messageType?: string;
    byteLength?: number;
    decodeMs?: number;
    reason?: string;
    dataPlane?: "websocket" | "direct";
  }): void;
}

export interface TerminalTransportClientSession {
  connect(): Promise<void>;
  disconnect(): void;
  send(message: TerminalTransportClientMessage): boolean;
  sendInputBytes(data: Uint8Array): boolean;
  resize(cols: number, rows: number): boolean;
  scrollViewport(deltaRows: number): boolean;
  setViewportStart(viewportStart: number): boolean;
  followCursor(): boolean;
  selectionStart(point: Extract<TerminalTransportClientMessage, { type: "selectionStart" }>["point"]): boolean;
  selectionUpdate(point: Extract<TerminalTransportClientMessage, { type: "selectionUpdate" }>["point"]): boolean;
  selectionEnd(point: Extract<TerminalTransportClientMessage, { type: "selectionEnd" }>["point"]): boolean;
  selectWordAt(point: Extract<TerminalTransportClientMessage, { type: "selectWordAt" }>["point"]): boolean;
  selectLineAt(point: Extract<TerminalTransportClientMessage, { type: "selectLineAt" }>["point"]): boolean;
  selectRange(range: Extract<TerminalTransportClientMessage, { type: "selectRange" }>["range"]): boolean;
  copySelection(ownerId?: string): boolean;
  clearSelection(ownerId?: string): boolean;
  pullFrame(input: { lastAppliedFrameSeq: number; cols: number; rows: number; maxPatchBytes?: number }): boolean;
  getConnectionState(): TerminalTransportClientConnectionState;
}

export const createTerminalTransportClientSession = (input: {
  transportUrl: string;
  terminalId?: string;
  geometryRole?: "projection-only" | "authority";
  geometryOrder?: number;
  debugTrace?: boolean;
  events?: TerminalTransportClientSessionEvents;
  createSocket?: (url: string) => TerminalTransportClientSocketLike;
}): TerminalTransportClientSession => {
  let socket: TerminalTransportClientSocketLike | null = null;
  let directConnection: TerminalTransportDirectConnection | null = null;
  let state: TerminalTransportClientConnectionState = "idle";
  const directClientToken =
    typeof crypto === "object" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  const createSocket = (): TerminalTransportClientSocketLike =>
    input.createSocket
      ? input.createSocket(input.transportUrl)
      : (new WebSocket(input.transportUrl) as unknown as TerminalTransportClientSocketLike);

  const resolveRuntime = (): Extract<TerminalTransportClientMessage, { type: "hello" }>["runtime"] => {
    const runtime = globalRuntime.Bun !== undefined ? "bun" : typeof window !== "undefined" ? "browser" : "unknown";
    const pid = typeof globalRuntime.process?.pid === "number" ? globalRuntime.process.pid : undefined;
    return {
      kind: runtime,
      pid,
      directRegistryKey: canUseTerminalTransportDirectRegistry()
        ? TERMINAL_TRANSPORT_DIRECT_REGISTRY_KEY
        : undefined,
    };
  };

  const handleDirectServerMessage = (message: TerminalTransportServerMessage): void => {
    input.events?.onTrace?.({
      kind: "client-direct-message",
      messageType: message.type,
      dataPlane: "direct",
    });
    input.events?.onMessage?.(message);
  };

  const tryUpgradeDirect = (
    offer: Extract<TerminalTransportServerMessage, { type: "helloAck" }>["direct"],
  ): void => {
    if (!offer?.accepted || !offer.upgradeId || !offer.serverToken) {
      input.events?.onTrace?.({
        kind: "client-direct-upgrade",
        reason: offer?.reason ?? "not-offered",
        dataPlane: "websocket",
      });
      return;
    }
    const registry = getTerminalTransportDirectRegistry();
    const endpoint: TerminalTransportDirectEndpoint | null = registry?.claim(offer.upgradeId, offer.serverToken) ?? null;
    const connection = endpoint?.acceptClient({
      clientToken: directClientToken,
      onServerMessage: handleDirectServerMessage,
      onClose: () => {
        directConnection = null;
        input.events?.onTrace?.({
          kind: "client-direct-upgrade",
          reason: "closed",
          dataPlane: "websocket",
        });
      },
    }) ?? null;
    if (!connection) {
      input.events?.onTrace?.({
        kind: "client-direct-upgrade",
        reason: "claim-failed",
        dataPlane: "websocket",
      });
      return;
    }
    directConnection = connection;
    input.events?.onTrace?.({
      kind: "client-direct-upgrade",
      reason: "connected",
      dataPlane: "direct",
    });
  };

  const sendWebSocket = (message: TerminalTransportClientMessage): boolean => {
    if (!socket || socket.readyState !== SOCKET_OPEN_READY_STATE || state !== "connected") {
      return false;
    }
    const encoded = encodeTerminalTransportClientMessage(message);
    input.events?.onTrace?.({
      kind: "client-send",
      messageType: message.type,
      byteLength: encoded.byteLength,
      dataPlane: "websocket",
    });
    socket.send(toOwnedArrayBuffer(encoded));
    return true;
  };

  const sendSemantic = (message: TerminalTransportClientMessage): boolean => {
    if (directConnection) {
      input.events?.onTrace?.({
        kind: "client-send",
        messageType: message.type,
        dataPlane: "direct",
      });
      return directConnection.sendClientMessage(message);
    }
    return sendWebSocket(message);
  };

  return {
    async connect(): Promise<void> {
      if (state === "connected" || state === "connecting") {
        return;
      }
      const nextSocket = createSocket();
      nextSocket.binaryType = "arraybuffer";
      socket = nextSocket;
      state = "connecting";
      await new Promise<void>((resolveReady, rejectReady) => {
        let settled = false;
        const fail = (message: string): void => {
          if (settled || socket !== nextSocket) {
            return;
          }
          settled = true;
          state = "error";
          socket = null;
          input.events?.onError?.(message);
          rejectReady(new Error(`terminal transport failed: ${input.transportUrl}: ${message}`));
        };
        nextSocket.addEventListener("open", () => {
          if (settled || socket !== nextSocket) {
            return;
          }
          settled = true;
          state = "connected";
          const hello = encodeTerminalTransportClientMessage({
            type: "hello",
            terminalId: input.terminalId,
            geometryRole: input.geometryRole,
            geometryOrder: input.geometryOrder,
            debugTrace: input.debugTrace,
            runtime: resolveRuntime(),
            direct: {
              requested: true,
              clientToken: directClientToken,
            },
          });
          input.events?.onTrace?.({
            kind: "client-send",
            messageType: "hello",
            byteLength: hello.byteLength,
            dataPlane: "websocket",
          });
          nextSocket.send(toOwnedArrayBuffer(hello));
          input.events?.onOpen?.();
          resolveReady();
        });
        nextSocket.addEventListener("error", () => {
          if (settled || socket !== nextSocket) {
            return;
          }
          fail("transport error");
        });
        nextSocket.addEventListener("close", () => {
          if (settled || socket !== nextSocket) {
            return;
          }
          settled = true;
          state = "closed";
          socket = null;
          input.events?.onClose?.();
          rejectReady(new Error(`terminal transport closed before open: ${input.transportUrl}`));
        });
      });
      nextSocket.addEventListener("close", () => {
        if (socket !== nextSocket) {
          return;
        }
        state = "closed";
        socket = null;
        input.events?.onClose?.();
      });
      nextSocket.addEventListener("message", (event) => {
        const rawReceivedAt = performance.now();
        if (!(event.data instanceof ArrayBuffer)) {
          state = "error";
          input.events?.onError?.("invalid transport payload");
          return;
        }
        const message = decodeTerminalTransportServerMessage(event.data);
        const decodeMs = performance.now() - rawReceivedAt;
        if (!message) {
          state = "error";
          input.events?.onError?.("invalid transport payload");
          return;
        }
        if (message.type !== "trace") {
          input.events?.onTrace?.({
            kind: "client-raw-message",
            byteLength: event.data.byteLength,
          });
          input.events?.onTrace?.({
            kind: "client-decode-message",
            messageType: message.type,
            byteLength: event.data.byteLength,
            decodeMs,
            dataPlane: "websocket",
          });
        }
        if (message.type === "helloAck") {
          tryUpgradeDirect(message.direct);
        }
        input.events?.onMessage?.(message);
      });
    },
    disconnect(): void {
      directConnection?.close();
      directConnection = null;
      socket?.close();
      socket = null;
      if (state !== "idle") {
        state = "closed";
      }
    },
    send(message: TerminalTransportClientMessage): boolean {
      return sendSemantic(message);
    },
    sendInputBytes(data: Uint8Array): boolean {
      return sendSemantic({ type: "inputBytes", data });
    },
    resize(cols: number, rows: number): boolean {
      return sendSemantic({ type: "resize", cols, rows });
    },
    scrollViewport(deltaRows: number): boolean {
      return sendSemantic({ type: "viewportDelta", deltaRows });
    },
    setViewportStart(viewportStart: number): boolean {
      return sendSemantic({ type: "viewportTarget", viewportStart });
    },
    followCursor(): boolean {
      return sendSemantic({ type: "followCursor" });
    },
    selectionStart(point): boolean {
      return sendSemantic({ type: "selectionStart", point });
    },
    selectionUpdate(point): boolean {
      return sendSemantic({ type: "selectionUpdate", point });
    },
    selectionEnd(point): boolean {
      return sendSemantic({ type: "selectionEnd", point });
    },
    selectWordAt(point): boolean {
      return sendSemantic({ type: "selectWordAt", point });
    },
    selectLineAt(point): boolean {
      return sendSemantic({ type: "selectLineAt", point });
    },
    selectRange(range): boolean {
      return sendSemantic({ type: "selectRange", range });
    },
    copySelection(ownerId): boolean {
      return sendSemantic({ type: "copySelection", ownerId });
    },
    clearSelection(ownerId): boolean {
      return sendSemantic({ type: "clearSelection", ownerId });
    },
    pullFrame(frameInput): boolean {
      return sendSemantic({ type: "pullFrame", ...frameInput });
    },
    getConnectionState(): TerminalTransportClientConnectionState {
      return state;
    },
  };
};
