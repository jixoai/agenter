import {
  createTRPCProxyClient,
  createWSClient,
  httpBatchLink,
  splitLink,
  wsLink,
  type TRPCClientErrorLike,
  type TRPCLink,
} from "@trpc/client";

import type { AppRouter } from "@agenter/app-server";
import superjson from "superjson";

export interface AgenterClientOptions {
  wsUrl: string;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: TRPCClientErrorLike<AppRouter> | Error) => void;
}

export type AgenterTransportEvent = { type: "open" } | { type: "close" } | { type: "error"; error: Error };

export interface AgenterClient {
  trpc: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
  wsUrl: string;
  httpUrl: string;
  subscribeTransport: (listener: (event: AgenterTransportEvent) => void) => () => void;
  close: () => void;
}

const toHttpUrl = (wsUrl: string): string => {
  const url = new URL(wsUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  if (url.pathname.endsWith("/trpc")) {
    url.pathname = url.pathname.slice(0, -5) || "/";
  }
  return url.toString().replace(/\/$/, "");
};

export const createAgenterClient = (options: AgenterClientOptions): AgenterClient => {
  const transportListeners = new Set<(event: AgenterTransportEvent) => void>();
  const emitTransport = (event: AgenterTransportEvent) => {
    for (const listener of transportListeners) {
      listener(event);
    }
  };
  const wsClient = createWSClient({
    url: options.wsUrl,
    onOpen: () => {
      options.onOpen?.();
      emitTransport({ type: "open" });
    },
    onClose: () => {
      options.onClose?.();
      emitTransport({ type: "close" });
    },
    onError: options.onError
      ? (event) => {
          const error = new Error(event?.type ?? "ws-error");
          options.onError?.(error);
          emitTransport({ type: "error", error });
        }
      : (event) => {
          emitTransport({ type: "error", error: new Error(event?.type ?? "ws-error") });
        },
  });

  const httpUrl = toHttpUrl(options.wsUrl);

  const links: TRPCLink<AppRouter>[] = [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: wsLink({
        client: wsClient,
        transformer: superjson,
      }),
      false: httpBatchLink({
        url: `${httpUrl}/trpc`,
        transformer: superjson,
      }),
    }),
  ];

  const trpc = createTRPCProxyClient<AppRouter>({
    links,
  });

  return {
    trpc,
    wsUrl: options.wsUrl,
    httpUrl,
    subscribeTransport: (listener) => {
      transportListeners.add(listener);
      return () => {
        transportListeners.delete(listener);
      };
    },
    close: () => {
      wsClient.close();
    },
  };
};
