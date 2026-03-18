import { createTRPCProxyClient, createWSClient, wsLink, type TRPCClientErrorLike, type TRPCLink } from "@trpc/client";

import type { AppRouter } from "@agenter/app-server";
import superjson from "superjson";

export interface AgenterClientOptions {
  wsUrl: string;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: TRPCClientErrorLike<AppRouter> | Error) => void;
}

export interface AgenterClient {
  trpc: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
  wsUrl: string;
  httpUrl: string;
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
  const wsClient = createWSClient({
    url: options.wsUrl,
    onOpen: options.onOpen,
    onClose: options.onClose,
    onError: options.onError
      ? (event) => {
          options.onError?.(new Error(event?.type ?? "ws-error"));
        }
      : undefined,
  });

  const links: TRPCLink<AppRouter>[] = [
    wsLink({
      client: wsClient,
      transformer: superjson,
    }),
  ];

  const trpc = createTRPCProxyClient<AppRouter>({
    links,
  });

  return {
    trpc,
    wsUrl: options.wsUrl,
    httpUrl: toHttpUrl(options.wsUrl),
    close: () => {
      wsClient.close();
    },
  };
};
