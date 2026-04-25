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
  initialAuthToken?: string | null;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: TRPCClientErrorLike<AppRouter> | Error) => void;
}

export type AgenterTransportEvent = { type: "open" } | { type: "close" } | { type: "error"; error: Error };

export interface AgenterClient {
  trpc: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
  wsUrl: string;
  httpUrl: string;
  setAuthToken: (token: string | null | undefined) => void;
  getAuthToken: () => string | null;
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
  let authToken = options.initialAuthToken?.trim() ? options.initialAuthToken.trim() : null;
  const emitTransport = (event: AgenterTransportEvent) => {
    for (const listener of transportListeners) {
      listener(event);
    }
  };
  const readAuthorizationHeader = (): string | null => (authToken ? `Bearer ${authToken}` : null);
  const wsClient = createWSClient({
    url: options.wsUrl,
    connectionParams: async () => {
      const authorization = readAuthorizationHeader();
      return authorization ? { authorization } : {};
    },
    lazy: {
      enabled: true,
      closeMs: 0,
    },
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
        headers: async () => {
          const authorization = readAuthorizationHeader();
          return authorization ? { authorization } : {};
        },
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
    setAuthToken: (token) => {
      const normalized = token?.trim() ?? "";
      const nextAuthToken = normalized.length > 0 ? normalized : null;
      const authChanged = authToken !== nextAuthToken;
      authToken = nextAuthToken;
      if (authChanged && wsClient.connection) {
        void wsClient.close();
      }
    },
    getAuthToken: () => authToken,
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
