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
}

export interface TerminalTransportClientSession {
  connect(): Promise<void>;
  disconnect(): void;
  send(message: TerminalTransportClientMessage): boolean;
  getConnectionState(): TerminalTransportClientConnectionState;
}

export const createTerminalTransportClientSession = (input: {
  transportUrl: string;
  events?: TerminalTransportClientSessionEvents;
  createSocket?: (url: string) => TerminalTransportClientSocketLike;
}): TerminalTransportClientSession => {
  let socket: TerminalTransportClientSocketLike | null = null;
  let state: TerminalTransportClientConnectionState = "idle";

  const createSocket = (): TerminalTransportClientSocketLike =>
    input.createSocket
      ? input.createSocket(input.transportUrl)
      : (new WebSocket(input.transportUrl) as unknown as TerminalTransportClientSocketLike);

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
        if (!(event.data instanceof ArrayBuffer)) {
          state = "error";
          input.events?.onError?.("invalid transport payload");
          return;
        }
        const message = decodeTerminalTransportServerMessage(event.data);
        if (!message) {
          state = "error";
          input.events?.onError?.("invalid transport payload");
          return;
        }
        input.events?.onMessage?.(message);
      });
    },
    disconnect(): void {
      socket?.close();
      socket = null;
      if (state !== "idle") {
        state = "closed";
      }
    },
    send(message: TerminalTransportClientMessage): boolean {
      if (!socket || socket.readyState !== SOCKET_OPEN_READY_STATE || state !== "connected") {
        return false;
      }
      socket.send(toOwnedArrayBuffer(encodeTerminalTransportClientMessage(message)));
      return true;
    },
    getConnectionState(): TerminalTransportClientConnectionState {
      return state;
    },
  };
};
