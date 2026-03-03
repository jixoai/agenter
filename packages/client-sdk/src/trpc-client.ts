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
  close: () => void;
}

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
    close: () => {
      wsClient.close();
    },
  };
};
