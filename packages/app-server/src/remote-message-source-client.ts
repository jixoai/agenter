import { createTRPCUntypedClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { z } from "zod";

import type { MessageContactId } from "@agenter/message-system";

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/+$/u, "");

const remoteCatalogItemSchema = z.object({
  actorId: z.string().trim().min(1),
  label: z.string(),
  subtitle: z.string(),
  iconUrl: z.string(),
});

const remoteCatalogResponseSchema = z.object({
  items: z.array(remoteCatalogItemSchema),
});

const acceptRemoteContactResponseSchema = z.object({
  result: z.object({
    localDirectChatId: z.string().trim().min(1).optional(),
  }),
});

export type RemoteMessageSourceCatalogItem = z.infer<typeof remoteCatalogItemSchema>;

export interface RemoteReceiveContactRequestInput {
  requestId: string;
  sourceId: string;
  remoteContactId: MessageContactId;
  remoteLabel?: string;
  remoteSubtitle?: string;
  remoteIconUrl?: string;
  message?: string;
  callbackEndpoint?: string;
  expiresAt?: number;
}

export interface RemoteAcceptContactRequestInput {
  requestId: string;
  remoteContactId: MessageContactId;
  remoteLabel?: string;
  remoteSubtitle?: string;
  remoteIconUrl?: string;
  firstChat?: string;
  remoteDirectChatId?: string;
}

/**
 * app-server owns the remote HTTP boundary for contact discovery and request
 * exchange. Keep this adapter narrow and typed so message-system itself stays
 * transport-agnostic.
 */
export const createRemoteMessageSourceClient = (input: {
  endpoint: string;
  authToken?: string;
}) => {
  const baseUrl = normalizeBaseUrl(input.endpoint);
  const authToken = input.authToken?.trim() || null;
  const client = createTRPCUntypedClient({
    links: [
      httpBatchLink({
        url: `${baseUrl}/trpc`,
        transformer: superjson,
        headers: async () => (authToken ? { authorization: `Bearer ${authToken}` } : {}),
      }),
    ],
  });

  return {
    async searchAuthCatalog(input: { query?: string }): Promise<RemoteMessageSourceCatalogItem[]> {
      const response = await client.query("auth.catalog", input);
      return remoteCatalogResponseSchema.parse(response).items;
    },

    async receiveContactRequest(input: RemoteReceiveContactRequestInput): Promise<void> {
      await client.mutation("message.receiveContactRequest", input);
    },

    async acceptContactRequestRemote(input: RemoteAcceptContactRequestInput): Promise<{
      localDirectChatId?: string;
    }> {
      const response = await client.mutation("message.acceptContactRequestRemote", input);
      return acceptRemoteContactResponseSchema.parse(response).result;
    },
  };
};
