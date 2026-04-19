import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";

import type { MessageActorId } from "@agenter/message-system";
import { isPrincipalId } from "@agenter/principal-crypto";
import { AVATAR_CLASSIFY_VALUES } from "@agenter/profile-service";
import type { TerminalActorId } from "@agenter/terminal-system";
import {
  authDraftCreateInputSchema,
  authDraftDeleteInputSchema,
  authDraftEventsInputSchema,
  authDraftFilterSchema,
  authDraftGetInputSchema,
  authDraftSaveInputSchema,
  matchesAuthDraftFilter,
  type AuthDraftEvent,
} from "../auth-draft-types";
import {
  authKvFilterSchema,
  authKvKeySchema,
  jsonValueSchema,
  matchesAuthKvFilter,
  type AuthKvEvent,
} from "../auth-kv-types";
import type { AnyRuntimeEvent } from "../realtime-types";
import { settingsKindSchema } from "../realtime-types";
import { t } from "./init";

const sessionIdInput = z.object({ sessionId: z.string().min(1) });
const reverseTimeCursorSchema = z.object({
  beforeTimeMs: z.number().int().nonnegative(),
  beforeId: z.number().int().positive(),
});
const reversePageInput = z.object({
  sessionId: z.string().min(1),
  before: reverseTimeCursorSchema.optional(),
  limit: z.number().int().positive().max(500).optional(),
});
const usageAnalyticsInput = z
  .object({
    sessionId: z.string().min(1),
    sinceMs: z.number().int().nonnegative(),
    untilMs: z.number().int().nonnegative(),
    granularity: z.enum(["auto", "raw", "day", "month", "year"]).optional(),
    filters: z
      .object({
        sessionId: z.string().min(1).optional(),
        kind: z.string().min(1).optional(),
        providerId: z.string().min(1).optional(),
        model: z.string().min(1).optional(),
      })
      .optional(),
  })
  .refine((value) => value.untilMs >= value.sinceMs, {
    message: "untilMs must be greater than or equal to sinceMs",
    path: ["untilMs"],
  });
const channelAccessInput = z.object({
  chatId: z.string().min(1),
  accessToken: z.string().min(1),
});
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9._-]{16,128}$/;
const MESSAGE_ACTOR_ID_PATTERN = /^(auth|session|system):.+$/;
const TERMINAL_ACTOR_ID_PATTERN = /^(auth|session|system):.+$/;
const messageActorIdSchema = z.custom<MessageActorId>(
  (value) => typeof value === "string" && (MESSAGE_ACTOR_ID_PATTERN.test(value) || isPrincipalId(value)),
  {
    message: "message actor id must be a principal id or start with auth:, session:, or system:",
  },
);
const terminalActorIdSchema = z.custom<TerminalActorId>(
  (value) => typeof value === "string" && (TERMINAL_ACTOR_ID_PATTERN.test(value) || isPrincipalId(value)),
  {
    message: "terminal actor id must be a principal id or start with auth:, session:, or system:",
  },
);
const terminalProcessProfileSchema = z.object({
  command: z.array(z.string().min(1)).min(1).optional(),
  cwd: z.string().min(1).optional(),
  cols: z.number().int().positive().optional(),
  rows: z.number().int().positive().optional(),
  gitLog: z.union([z.literal(false), z.literal("none"), z.literal("normal"), z.literal("verbose")]).optional(),
  logStyle: z.union([z.literal("plain"), z.literal("rich")]).optional(),
  icon: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  shortcuts: z.record(z.string(), z.string().min(1)).optional(),
});
const workspaceGrantInputSchema = z.object({
  pattern: z.string().trim().min(1),
  mode: z.enum(["ro", "rw"]),
});
const messageErrorPayloadSchema = z.object({
  title: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  detail: z.string().trim().min(1).optional(),
});
const messageInteractiveFieldSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  multiline: z.boolean().optional(),
  initialValue: z.string().optional(),
});
const messageInteractivePayloadSchema = z.object({
  version: z.literal("v1"),
  kind: z.literal("form"),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  submitLabel: z.string().trim().min(1).optional(),
  fields: z.array(messageInteractiveFieldSchema).min(1),
});
const profileMetadataPatchSchema = z
  .object({
    nickname: z.string().trim().min(1).max(64).optional(),
    displayName: z.string().trim().min(1).max(128).optional(),
    phone: z.string().trim().min(1).max(64).optional(),
    address: z.string().trim().min(1).max(256).optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
const authChallengeStartInput = z.object({
  authId: z.string().trim().min(1),
});
const authChallengeVerifyInput = z.object({
  challengeId: z.string().uuid(),
  signature: z.string().trim().min(1),
});
const authKvBaseVersionSchema = z.number().int().positive().nullable().optional();
const authKvSnapshotInputSchema = authKvFilterSchema.optional();
const authKvSetInputSchema = z.object({
  key: authKvKeySchema,
  value: jsonValueSchema,
  baseVersion: authKvBaseVersionSchema,
});
const authKvDeleteInputSchema = z.object({
  key: authKvKeySchema,
  baseVersion: authKvBaseVersionSchema,
});
const authKvEventsInputSchema = authKvFilterSchema
  .extend({
    afterEventId: z.number().int().nonnegative().optional(),
  })
  .optional();
const authDraftListInputSchema = authDraftFilterSchema.optional();

const requireAuth = t.procedure.use(({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "auth token required",
    });
  }
  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth,
    },
  });
});

const requireSuperadmin = requireAuth.use(({ ctx, next }) => {
  if (!ctx.auth.claims.superadmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "superadmin auth required",
    });
  }
  return next();
});

const resolveTerminalCallerScope = (
  auth: { claims: { authId: string; superadmin: boolean } } | null | undefined,
): { actorId?: TerminalActorId; superadminActorId?: TerminalActorId } => {
  if (!auth?.claims.authId) {
    return {};
  }
  const actorId = `auth:${auth.claims.authId}` as TerminalActorId;
  return auth.claims.superadmin ? { superadminActorId: actorId } : { actorId };
};

const resolveMessageCallerScope = (
  auth: { claims: { authId: string; superadmin: boolean } } | null | undefined,
): { actorId?: MessageActorId; superadminActorId?: MessageActorId } => {
  if (!auth?.claims.authId) {
    return {};
  }
  const actorId = `auth:${auth.claims.authId}` as MessageActorId;
  return auth.claims.superadmin ? { superadminActorId: actorId } : { actorId };
};

export const appRouter = t.router({
  auth: t.router({
    service: t.procedure.query(async ({ ctx }) => await ctx.kernel.getAuthServiceDescriptor()),
    actors: t.procedure.query(async ({ ctx }) => ({ items: await ctx.kernel.listAuthActors() })),
    challengeStart: t.procedure
      .input(authChallengeStartInput)
      .mutation(async ({ ctx, input }) => await ctx.kernel.startAuthChallenge(input.authId)),
    bootstrapManagedKey: t.procedure.mutation(async ({ ctx }) => await ctx.kernel.revealManagedRootAuthPrivateKey()),
    challengeVerify: t.procedure
      .input(authChallengeVerifyInput)
      .mutation(
        async ({ ctx, input }) =>
          await ctx.kernel.verifyAuthChallenge({ ...input, token: ctx.auth?.token ?? undefined }),
      ),
    session: requireAuth.query(({ ctx }) => ctx.auth),
    superadminStatus: requireSuperadmin.query(({ ctx }) => ({
      ok: true,
      claims: ctx.auth.claims,
    })),
  }),
  kv: t.router({
    snapshot: requireAuth.input(authKvSnapshotInputSchema).query(({ ctx, input }) => {
      return ctx.kernel.snapshotAuthKv(ctx.auth.claims.authId, input);
    }),
    set: requireAuth.input(authKvSetInputSchema).mutation(({ ctx, input }) => {
      return ctx.kernel.setAuthKv(ctx.auth.claims.authId, input);
    }),
    delete: requireAuth.input(authKvDeleteInputSchema).mutation(({ ctx, input }) => {
      return ctx.kernel.deleteAuthKv(ctx.auth.claims.authId, input);
    }),
    events: requireAuth.input(authKvEventsInputSchema).subscription(({ ctx, input }) => {
      return observable<AuthKvEvent>((emit) => {
        let cursor = input?.afterEventId ?? 0;
        const filter = input ? { keys: input.keys, prefix: input.prefix } : undefined;
        const pushEvent = (event: AuthKvEvent): void => {
          if (event.eventId <= cursor) {
            return;
          }
          const key = event.kind === "set" ? event.entry.key : event.key;
          if (!matchesAuthKvFilter(key, filter)) {
            return;
          }
          cursor = event.eventId;
          emit.next(event);
        };

        const unsubscribe = ctx.kernel.onAuthKvEvent(ctx.auth.claims.authId, pushEvent);
        for (const event of ctx.kernel.getAuthKvEventsAfter(ctx.auth.claims.authId, cursor, input)) {
          pushEvent(event);
        }
        return unsubscribe;
      });
    }),
  }),
  drafts: t.router({
    list: requireAuth.input(authDraftListInputSchema).query(({ ctx, input }) => {
      return ctx.kernel.listAuthDrafts(ctx.auth.claims.authId, input);
    }),
    get: requireAuth.input(authDraftGetInputSchema).query(({ ctx, input }) => {
      return ctx.kernel.getAuthDraft(ctx.auth.claims.authId, input.draftId);
    }),
    create: requireAuth.input(authDraftCreateInputSchema).mutation(({ ctx, input }) => {
      return ctx.kernel.createAuthDraft(ctx.auth.claims.authId, input);
    }),
    save: requireAuth.input(authDraftSaveInputSchema).mutation(({ ctx, input }) => {
      return ctx.kernel.saveAuthDraft(ctx.auth.claims.authId, input);
    }),
    delete: requireAuth.input(authDraftDeleteInputSchema).mutation(({ ctx, input }) => {
      return ctx.kernel.deleteAuthDraft(ctx.auth.claims.authId, input);
    }),
    events: requireAuth.input(authDraftEventsInputSchema).subscription(({ ctx, input }) => {
      return observable<AuthDraftEvent>((emit) => {
        let cursor = input?.afterEventId ?? 0;
        const filter = input ? { kind: input.kind, draftIds: input.draftIds } : undefined;
        const pushEvent = (event: AuthDraftEvent): void => {
          if (event.eventId <= cursor) {
            return;
          }
          const entry =
            event.kind === "upsert"
              ? {
                  draftId: event.entry.draftId,
                  kind: event.entry.kind,
                }
              : {
                  draftId: event.draftId,
                  kind: event.draftKind,
                };
          if (!matchesAuthDraftFilter(entry, filter)) {
            return;
          }
          cursor = event.eventId;
          emit.next(event);
        };

        const unsubscribe = ctx.kernel.onAuthDraftEvent(ctx.auth.claims.authId, pushEvent);
        for (const event of ctx.kernel.getAuthDraftEventsAfter(ctx.auth.claims.authId, cursor, input)) {
          pushEvent(event);
        }
        return unsubscribe;
      });
    }),
  }),
  avatar: t.router({
    catalog: t.procedure.query(async ({ ctx }) => ({
      items: await ctx.kernel.listGlobalAvatarCatalog(),
    })),
    create: t.procedure
      .input(
        z.object({
          nickname: z.string().trim().min(1).max(64),
          displayName: z.string().trim().min(1).max(128).nullable().optional(),
          classify: z.enum(AVATAR_CLASSIFY_VALUES).nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        avatar: await ctx.kernel.createGlobalAvatar(input),
      })),
  }),
  session: t.router({
    list: t.procedure.query(({ ctx }) => ({ sessions: ctx.kernel.listSessions() })),
    create: t.procedure
      .input(
        z.object({
          cwd: z.string().min(1),
          name: z.string().optional(),
          avatar: z.string().optional(),
          autoStart: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const session = await ctx.kernel.createSession(input);
        return { session };
      }),
    update: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          name: z.string().optional(),
        }),
      )
      .mutation(({ ctx, input }) => {
        const session = ctx.kernel.updateSession(input.sessionId, {
          name: input.name,
        });
        return { session };
      }),
    delete: t.procedure.input(sessionIdInput).mutation(async ({ ctx, input }) => {
      return await ctx.kernel.deleteSession(input.sessionId);
    }),
    start: t.procedure.input(sessionIdInput).mutation(async ({ ctx, input }) => {
      const session = await ctx.kernel.startSession(input.sessionId);
      return { session };
    }),
    stop: t.procedure.input(sessionIdInput).mutation(async ({ ctx, input }) => {
      const session = await ctx.kernel.stopSession(input.sessionId);
      return { session };
    }),
    abort: t.procedure.input(sessionIdInput).mutation(async ({ ctx, input }) => {
      const session = await ctx.kernel.abortSession(input.sessionId);
      return { session };
    }),
    archive: t.procedure.input(sessionIdInput).mutation(async ({ ctx, input }) => {
      const session = await ctx.kernel.archiveSession(input.sessionId);
      return { session };
    }),
    restore: t.procedure.input(sessionIdInput).mutation(async ({ ctx, input }) => {
      const session = await ctx.kernel.restoreSession(input.sessionId);
      return { session };
    }),
    focusTerminal: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          terminalId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => await ctx.kernel.focusTerminal(input.sessionId, input.terminalId)),
    cycles: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) => ({ items: ctx.kernel.listCurrentBranchCycles(input.sessionId, input.limit ?? 200) })),
    rollback: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          cycleId: z.number().int().positive(),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.rollbackSessionCycle(input.sessionId, input.cycleId)),
  }),
  chat: t.router({
    send: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          text: z.string().min(1),
          assetIds: z.array(z.string().min(1)).optional(),
          clientMessageId: z.string().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.sendChat(input.sessionId, input.text, input.assetIds ?? [], input.clientMessageId),
      ),
    list: t.procedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageChatMessages(input.sessionId, { before: input.before, limit: input.limit ?? 200 }),
      ),
    cycles: t.procedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageChatCycles(input.sessionId, { before: input.before, limit: input.limit ?? 120 }),
      ),
  }),
  message: t.router({
    listChannels: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          includeArchived: z.boolean().optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listMessageChannels(input.sessionId, { includeArchived: input.includeArchived }),
      })),
    createChannel: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          kind: z.literal("room"),
          title: z.string().trim().min(1).optional(),
          participants: z
            .array(
              z.object({
                id: z.string().trim().min(1),
                label: z.string().trim().min(1).optional(),
              }),
            )
            .optional(),
          metadata: z.record(z.string(), z.unknown()).optional(),
          adminToken: z
            .string()
            .trim()
            .regex(ACCESS_TOKEN_PATTERN, "adminToken must be 16-128 chars [A-Za-z0-9._-]")
            .optional(),
          focus: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        channel: await ctx.kernel.createMessageChannel({
          sessionId: input.sessionId,
          kind: input.kind,
          title: input.title,
          participants: input.participants,
          metadata: input.metadata,
          adminToken: input.adminToken,
          focus: input.focus,
        }),
      })),
    focus: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          op: z.enum(["add", "remove", "replace", "clear"]),
          channels: z.array(channelAccessInput).default([]),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        items: await ctx.kernel.focusMessageChannels({
          sessionId: input.sessionId,
          op: input.op,
          channels: input.channels,
        }),
      })),
    send: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          text: z.string().min(1),
          assetIds: z.array(z.string().min(1)).optional(),
          clientMessageId: z.string().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.sendMessageChannel({
          sessionId: input.sessionId,
          chatId: input.chatId,
          accessToken: input.accessToken,
          text: input.text,
          assetIds: input.assetIds,
          clientMessageId: input.clientMessageId,
        }),
      ),
    edit: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          messageId: z.number().int().positive(),
          text: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.editMessageChannel({
          sessionId: input.sessionId,
          chatId: input.chatId,
          accessToken: input.accessToken,
          messageId: input.messageId,
          text: input.text,
        }),
      ),
    recall: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          messageId: z.number().int().positive(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.recallMessageChannel({
          sessionId: input.sessionId,
          chatId: input.chatId,
          accessToken: input.accessToken,
          messageId: input.messageId,
        }),
      ),
    sendError: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          content: z.string().trim().min(1),
          error: messageErrorPayloadSchema,
          clientMessageId: z.string().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.sendMessageChannelError({
          sessionId: input.sessionId,
          chatId: input.chatId,
          accessToken: input.accessToken,
          content: input.content,
          error: input.error,
          clientMessageId: input.clientMessageId,
        }),
      ),
    sendInteractive: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          content: z.string().trim().min(1),
          interactive: messageInteractivePayloadSchema,
          clientMessageId: z.string().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.sendMessageChannelInteractive({
          sessionId: input.sessionId,
          chatId: input.chatId,
          accessToken: input.accessToken,
          content: input.content,
          interactive: input.interactive,
          clientMessageId: input.clientMessageId,
        }),
      ),
    updateChannel: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          patch: z.object({
            title: z.string().trim().min(1).optional(),
            participants: z
              .array(
                z.object({
                  id: z.string().min(1),
                  label: z.string().trim().min(1).optional(),
                }),
              )
              .optional(),
            metadata: z.record(z.string(), z.unknown()).optional(),
          }),
        }),
      )
      .mutation(({ ctx, input }) => ({
        channel: ctx.kernel.updateMessageChannel(input),
      })),
    archiveChannel: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          archivedBy: z.string().trim().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) => ({
        channel: ctx.kernel.archiveMessageChannel(input),
      })),
    deleteChannel: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) => ({
        channel: ctx.kernel.deleteMessageChannel(input),
      })),
    listChannelGrants: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listMessageChannelGrants(input),
      })),
    issueChannelGrant: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          role: z.enum(["admin", "member", "readonly"]),
          label: z.string().trim().min(1).optional(),
          participantId: z.string().trim().min(1).optional(),
          accessTokenHint: z
            .string()
            .trim()
            .regex(ACCESS_TOKEN_PATTERN, "accessTokenHint must be 16-128 chars [A-Za-z0-9._-]")
            .optional(),
        }),
      )
      .mutation(({ ctx, input }) => ({
        grant: ctx.kernel.issueMessageChannelGrant(input),
      })),
    revokeChannelGrant: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          grantId: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.revokeMessageChannelGrant(input)),
    globalList: requireAuth
      .input(
        z.object({
          includeArchived: z.boolean().optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listGlobalRooms({
          includeArchived: input.includeArchived,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalCreate: requireAuth
      .input(
        z.object({
          chatId: z.string().trim().min(1).optional(),
          kind: z.literal("room").default("room"),
          title: z.string().trim().min(1).optional(),
          participants: z
            .array(
              z.object({
                id: z.string().trim().min(1),
                label: z.string().trim().min(1).optional(),
              }),
            )
            .optional(),
          initialUsers: z
            .array(
              z.object({
                actorId: messageActorIdSchema,
                label: z.string().trim().min(1).optional(),
                role: z.enum(["admin", "member", "readonly"]),
                focused: z.boolean().optional(),
              }),
            )
            .optional(),
          metadata: z.record(z.string(), z.unknown()).optional(),
          adminToken: z
            .string()
            .trim()
            .regex(ACCESS_TOKEN_PATTERN, "adminToken must be 16-128 chars [A-Za-z0-9._-]")
            .optional(),
          focus: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        channel: await ctx.kernel.createGlobalRoom({
          chatId: input.chatId,
          title: input.title,
          participants: input.participants,
          initialUsers: input.initialUsers,
          metadata: input.metadata,
          adminToken: input.adminToken,
          focus: input.focus,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalFocus: requireAuth
      .input(
        z.object({
          op: z.enum(["add", "remove", "replace", "clear"]),
          channels: z
            .array(
              z.object({
                chatId: z.string().min(1),
                accessToken: z.string().min(1).optional(),
              }),
            )
            .default([]),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.focusGlobalRooms({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      ),
    globalSnapshot: requireAuth
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) =>
        ctx.kernel.snapshotGlobalRoom({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      ),
    globalMarkRead: requireAuth
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          messageId: z.number().int().positive().optional(),
        }),
      )
      .mutation(({ ctx, input }) => ({
        channel: ctx.kernel.markGlobalRoomRead({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalPage: requireAuth
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          before: reverseTimeCursorSchema.optional(),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) =>
        ctx.kernel.pageGlobalRoomMessages({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      ),
    globalSend: requireAuth
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          sendAsActorId: messageActorIdSchema.optional(),
          text: z.string().min(1),
          assetIds: z.array(z.string().min(1)).optional(),
          clientMessageId: z.string().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.sendGlobalRoomMessage({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      ),
    globalEdit: requireAuth
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          messageId: z.number().int().positive(),
          text: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.editGlobalRoomMessage({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      ),
    globalRecall: requireAuth
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          messageId: z.number().int().positive(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.recallGlobalRoomMessage({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      ),
    globalUpdate: requireAuth
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          patch: z.object({
            title: z.string().trim().min(1).optional(),
            participants: z
              .array(
                z.object({
                  id: z.string().min(1),
                  label: z.string().trim().min(1).optional(),
                }),
              )
              .optional(),
            metadata: z.record(z.string(), z.unknown()).optional(),
            adminGroupCandidateIds: z.array(messageActorIdSchema).optional(),
          }),
        }),
      )
      .mutation(({ ctx, input }) => ({
        channel: ctx.kernel.updateGlobalRoom({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalArchive: requireAuth
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          archivedBy: z.string().trim().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) => ({
        channel: ctx.kernel.archiveGlobalRoom({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalDelete: requireAuth
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) => ({
        channel: ctx.kernel.deleteGlobalRoom({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalListGrants: requireAuth
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listGlobalRoomGrants({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalListAssets: requireAuth
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listGlobalRoomAssets({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalIssueGrant: requireAuth
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          role: z.enum(["admin", "member", "readonly"]),
          label: z.string().trim().min(1).optional(),
          participantId: messageActorIdSchema,
          accessTokenHint: z
            .string()
            .trim()
            .regex(ACCESS_TOKEN_PATTERN, "accessTokenHint must be 16-128 chars [A-Za-z0-9._-]")
            .optional(),
        }),
      )
      .mutation(({ ctx, input }) => ({
        grant: ctx.kernel.issueGlobalRoomGrant({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      })),
    globalRevokeGrant: requireAuth
      .input(
        z.object({
          chatId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          grantId: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.revokeGlobalRoomGrant({
          ...input,
          ...resolveMessageCallerScope(ctx.auth),
        }),
      ),
  }),
  terminal: t.router({
    list: t.procedure
      .input(sessionIdInput)
      .query(({ ctx, input }) => ({ items: ctx.kernel.listTerminals(input.sessionId) })),
    create: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          terminalId: z.string().min(1).optional(),
          processKind: z.string().trim().min(1).optional(),
          command: z.array(z.string().min(1)).min(1).optional(),
          cwd: z.string().min(1).optional(),
          profile: terminalProcessProfileSchema.optional(),
          focus: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        result: await ctx.kernel.createTerminal(input),
      })),
    focus: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          op: z.enum(["add", "remove", "replace", "clear"]),
          terminalIds: z.array(z.string().min(1)).default([]),
        }),
      )
      .mutation(async ({ ctx, input }) => await ctx.kernel.focusTerminals(input)),
    delete: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          terminalId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => await ctx.kernel.deleteTerminal(input)),
    globalList: requireAuth.query(({ ctx }) => ({
      items: ctx.kernel.listGlobalTerminals(resolveTerminalCallerScope(ctx.auth)),
    })),
    globalCreate: requireAuth
      .input(
        z.object({
          terminalId: z.string().min(1).optional(),
          processKind: z.string().trim().min(1).optional(),
          command: z.array(z.string().min(1)).min(1).optional(),
          cwd: z.string().min(1).optional(),
          profile: terminalProcessProfileSchema.optional(),
          focus: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        result: await ctx.kernel.createGlobalTerminal({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      })),
    globalFocus: requireAuth
      .input(
        z.object({
          op: z.enum(["add", "remove", "replace", "clear"]),
          terminalIds: z.array(z.string().min(1)).default([]),
          accessToken: z.string().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.focusGlobalTerminals({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      ),
    globalDelete: requireAuth
      .input(
        z.object({
          terminalId: z.string().min(1),
        }),
      )
      .mutation(
        async ({ ctx, input }) =>
          await ctx.kernel.deleteGlobalTerminal({
            ...input,
            ...resolveTerminalCallerScope(ctx.auth),
          }),
      ),
    activityPage: requireAuth
      .input(
        z.object({
          terminalId: z.string().min(1),
          before: reverseTimeCursorSchema.optional(),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) =>
        ctx.kernel.pageGlobalTerminalActivity({
          terminalId: input.terminalId,
          before: input.before,
          limit: input.limit ?? 120,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      ),
    read: requireAuth
      .input(
        z.object({
          terminalId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          mode: z.enum(["auto", "diff", "snapshot"]).optional(),
          remark: z.boolean().optional(),
        }),
      )
      .query(({ ctx, input }) =>
        ctx.kernel.readGlobalTerminal({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      ),
    write: requireAuth
      .input(
        z.object({
          terminalId: z.string().min(1),
          accessToken: z.string().min(1).optional(),
          text: z.string(),
          submit: z.boolean().optional(),
          submitKey: z.enum(["enter", "linefeed"]).optional(),
          submitGapMs: z.number().int().nonnegative().optional(),
          createApprovalRequest: z.boolean().optional(),
          readMode: z.enum(["auto", "diff", "snapshot"]).optional(),
          returnRead: z
            .union([
              z.boolean(),
              z.object({
                throttleMs: z.number().int().nonnegative().optional(),
                debounceMs: z.number().int().nonnegative().optional(),
              }),
            ])
            .optional(),
        }),
      )
      .mutation(
        async ({ ctx, input }) =>
          await ctx.kernel.writeGlobalTerminal({
            ...input,
            ...resolveTerminalCallerScope(ctx.auth),
          }),
      ),
    listGrants: requireAuth
      .input(
        z.object({
          terminalId: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listGlobalTerminalGrants({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      })),
    issueGrant: requireAuth
      .input(
        z.object({
          terminalId: z.string().min(1),
          role: z.enum(["admin", "writer", "requester", "readonly"]),
          participantId: terminalActorIdSchema,
          label: z.string().trim().min(1).optional(),
          accessTokenHint: z
            .string()
            .trim()
            .regex(ACCESS_TOKEN_PATTERN, "accessTokenHint must be 16-128 chars [A-Za-z0-9._-]")
            .optional(),
          adminCandidateRank: z.number().int().nonnegative().nullable().optional(),
        }),
      )
      .mutation(({ ctx, input }) => ({
        grant: ctx.kernel.issueGlobalTerminalGrant({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      })),
    revokeGrant: requireAuth
      .input(
        z.object({
          terminalId: z.string().min(1),
          grantId: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.revokeGlobalTerminalGrant({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      ),
    listApprovalRequests: requireAuth
      .input(
        z.object({
          terminalId: z.string().min(1),
          assignedAdminId: terminalActorIdSchema.optional(),
          participantId: terminalActorIdSchema.optional(),
          statuses: z.array(z.enum(["pending", "approved", "denied", "expired"])).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listGlobalTerminalApprovalRequests({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      })),
    approveRequest: requireAuth
      .input(
        z.object({
          terminalId: z.string().min(1),
          requestId: z.string().min(1),
          durationMs: z.number().int().positive(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.approveGlobalTerminalRequest({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      ),
    denyRequest: requireAuth
      .input(
        z.object({
          terminalId: z.string().min(1),
          requestId: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.denyGlobalTerminalRequest({
          ...input,
          ...resolveTerminalCallerScope(ctx.auth),
        }),
      ),
  }),
  draft: t.router({
    resolve: t.procedure
      .input(
        z.object({
          cwd: z.string().min(1),
          avatar: z.string().min(1).optional(),
        }),
      )
      .query(async ({ ctx, input }) => await ctx.kernel.resolveDraft(input)),
  }),
  settings: t.router({
    global: t.router({
      read: t.procedure.query(async ({ ctx }) => await ctx.kernel.readGlobalSettings()),
      save: t.procedure
        .input(
          z.object({
            content: z.string(),
            baseMtimeMs: z.number().nonnegative(),
          }),
        )
        .mutation(async ({ ctx, input }) => await ctx.kernel.saveGlobalSettings(input)),
    }),
    scope: t.router({
      list: t.procedure
        .input(
          z.object({
            scope: z.enum(["workspace", "global"]),
            workspacePath: z.string().min(1).optional(),
            avatar: z.string().min(1).optional(),
          }),
        )
        .query(async ({ ctx, input }) => await ctx.kernel.listSettingsScope(input)),
      read: t.procedure
        .input(
          z.object({
            scope: z.enum(["workspace", "global"]),
            workspacePath: z.string().min(1).optional(),
            layerId: z.string().min(1),
            avatar: z.string().min(1).optional(),
          }),
        )
        .query(async ({ ctx, input }) => await ctx.kernel.readSettingsScopeLayer(input)),
      save: t.procedure
        .input(
          z.object({
            scope: z.enum(["workspace", "global"]),
            workspacePath: z.string().min(1).optional(),
            layerId: z.string().min(1),
            content: z.string(),
            baseMtimeMs: z.number().nonnegative(),
            avatar: z.string().min(1).optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => await ctx.kernel.saveSettingsScopeLayer(input)),
    }),
    read: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          kind: settingsKindSchema,
        }),
      )
      .query(async ({ ctx, input }) => {
        return await ctx.kernel.readSettings(input);
      }),
    save: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          kind: settingsKindSchema,
          content: z.string(),
          baseMtimeMs: z.number().nonnegative(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return await ctx.kernel.saveSettings(input);
      }),
    layers: t.router({
      list: t.procedure
        .input(
          z.object({
            workspacePath: z.string().min(1),
          }),
        )
        .query(async ({ ctx, input }) => ctx.kernel.listSettingsLayers(input.workspacePath)),
      read: t.procedure
        .input(
          z.object({
            workspacePath: z.string().min(1),
            layerId: z.string().min(1),
          }),
        )
        .query(async ({ ctx, input }) => ctx.kernel.readSettingsLayer(input)),
      save: t.procedure
        .input(
          z.object({
            workspacePath: z.string().min(1),
            layerId: z.string().min(1),
            content: z.string(),
            baseMtimeMs: z.number().nonnegative(),
          }),
        )
        .mutation(async ({ ctx, input }) => ctx.kernel.saveSettingsLayer(input)),
    }),
  }),
  profile: t.router({
    service: t.procedure.query(async ({ ctx }) => await ctx.kernel.getProfileServiceDescriptor()),
    list: t.procedure.query(async ({ ctx }) => ({ items: await ctx.kernel.listProfiles() })),
    get: t.procedure
      .input(
        z.object({
          reference: z.string().trim().min(1),
        }),
      )
      .query(async ({ ctx, input }) => await ctx.kernel.getProfile(input.reference)),
    update: requireAuth
      .input(
        z.object({
          reference: z.string().trim().min(1),
          patch: profileMetadataPatchSchema,
        }),
      )
      .mutation(
        async ({ ctx, input }) =>
          await ctx.kernel.updateProfile({
            reference: input.reference,
            token: ctx.auth.token,
            patch: input.patch,
          }),
      ),
    auth: t.router({
      emailStart: t.procedure
        .input(
          z.object({
            email: z.string().email(),
          }),
        )
        .mutation(async ({ ctx, input }) => await ctx.kernel.startProfileEmailChallenge(input.email)),
      emailVerify: t.procedure
        .input(
          z.object({
            email: z.string().email(),
            code: z
              .string()
              .trim()
              .regex(/^\d{6}$/),
            token: z.string().trim().min(1).optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => await ctx.kernel.verifyProfileEmailChallenge(input)),
    }),
  }),
  notification: t.router({
    snapshot: t.procedure.query(async ({ ctx }) => await ctx.kernel.getNotificationSnapshot()),
    setChatVisibility: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1).optional(),
          visible: z.boolean(),
          focused: z.boolean(),
        }),
      )
      .mutation(async ({ ctx, input }) => await ctx.kernel.setChatVisibility(input)),
    setTerminalVisibility: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          terminalId: z.string().min(1).optional(),
          visible: z.boolean(),
          focused: z.boolean(),
        }),
      )
      .mutation(async ({ ctx, input }) => await ctx.kernel.setTerminalVisibility(input)),
    consume: t.procedure
      .input(
        z
          .object({
            sessionId: z.string().min(1),
            chatId: z.string().min(1).optional(),
            terminalId: z.string().min(1).optional(),
            upToSrc: z.string().min(1).optional(),
          })
          .refine((value) => !(value.chatId && value.terminalId), {
            message: "chatId and terminalId cannot be used together",
            path: ["terminalId"],
          }),
      )
      .mutation(async ({ ctx, input }) => await ctx.kernel.consumeNotifications(input)),
  }),
  task: t.router({
    list: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) => ctx.kernel.listTasks(input.sessionId)),
    triggerManual: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          source: z.string().min(1),
          id: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.triggerTaskManual(input.sessionId, {
          source: input.source,
          id: input.id,
        }),
      ),
    emitEvent: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          topic: z.string().min(1),
          payload: z.unknown().optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.kernel.emitTaskEvent(input.sessionId, {
          topic: input.topic,
          payload: input.payload,
          source: "api",
        }),
      ),
  }),
  runtime: t.router({
    snapshot: t.procedure.query(({ ctx }) => ctx.kernel.getSnapshot()),
    attentionState: t.procedure
      .input(sessionIdInput)
      .query(async ({ ctx, input }) => await ctx.kernel.inspectAttentionState(input.sessionId)),
    attentionQuery: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          query: z.string(),
          offset: z.number().int().min(0).optional(),
          limit: z.number().int().min(1).max(200).optional(),
        }),
      )
      .query(async ({ ctx, input }) => ({
        items: await ctx.kernel.queryAttention(input.sessionId, {
          query: input.query,
          offset: input.offset,
          limit: input.limit,
        }),
      })),
    requestCompact: t.procedure
      .input(sessionIdInput)
      .mutation(({ ctx, input }) => ctx.kernel.requestRuntimeCompact(input.sessionId)),
    schedulerLogs: t.procedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageSchedulerLogs(input.sessionId, { before: input.before, limit: input.limit ?? 200 }),
      ),
    observabilityTraces: t.procedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageObservabilityTraces(input.sessionId, { before: input.before, limit: input.limit ?? 200 }),
      ),
    observabilityTraceLookup: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          ref: z.string().min(1),
          limit: z.number().int().min(1).max(500).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listObservabilityTracesByRef(input.sessionId, input.ref, input.limit ?? 200),
      })),
    heartbeatPartsPage: t.procedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageHeartbeatParts(input.sessionId, { before: input.before, limit: input.limit ?? 200 }),
      ),
    heartbeatGroupsPage: t.procedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageHeartbeatGroups(input.sessionId, { before: input.before, limit: input.limit ?? 5 }),
      ),
    modelCallsPage: t.procedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageModelCalls(input.sessionId, { before: input.before, limit: input.limit ?? 200 }),
      ),
    usageAnalytics: t.procedure.input(usageAnalyticsInput).query(({ ctx, input }) =>
      ctx.kernel.queryUsageAnalytics(input.sessionId, {
        sinceMs: input.sinceMs,
        untilMs: input.untilMs,
        granularity: input.granularity,
        filters: input.filters,
      }),
    ),
    requestAuxPage: t.procedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageRequestAuxMessages(input.sessionId, { before: input.before, limit: input.limit ?? 200 }),
      ),
    apiCallsPage: t.procedure
      .input(reversePageInput)
      .query(({ ctx, input }) =>
        ctx.kernel.pageApiCalls(input.sessionId, { before: input.before, limit: input.limit ?? 200 }),
      ),
    terminalActivityPage: t.procedure
      .input(
        reversePageInput.extend({
          terminalId: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) =>
        ctx.kernel.pageTerminalActivity(input.sessionId, input.terminalId, {
          before: input.before,
          limit: input.limit ?? 120,
        }),
      ),
    events: t.procedure
      .input(
        z
          .object({
            afterEventId: z.number().int().nonnegative().optional(),
          })
          .optional(),
      )
      .subscription(({ ctx, input }) => {
        return observable<AnyRuntimeEvent>((emit) => {
          let cursor = input?.afterEventId ?? 0;
          const pushEvent = (event: AnyRuntimeEvent): void => {
            if (event.eventId <= cursor) {
              return;
            }
            cursor = event.eventId;
            emit.next(event);
          };

          const unsubscribe = ctx.kernel.onEvent(pushEvent);
          for (const event of ctx.kernel.getEventsAfter(cursor)) {
            pushEvent(event);
          }
          return unsubscribe;
        });
      }),
    apiCalls: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          afterId: z.number().int().nonnegative().optional(),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .subscription(({ ctx, input }) => {
        return observable<
          | {
              type: "apiCall";
              payload: ReturnType<typeof ctx.kernel.listApiCalls>[number];
            }
          | {
              type: "recording";
              payload: { enabled: boolean; refCount: number };
            }
        >((emit) => {
          let cursor = input.afterId ?? 0;
          let closed = false;

          const pushRows = (rows: ReturnType<typeof ctx.kernel.listApiCalls>): void => {
            for (const row of rows) {
              if (row.id <= cursor) {
                continue;
              }
              cursor = row.id;
              emit.next({ type: "apiCall", payload: row });
            }
          };

          void ctx.kernel
            .retainApiCallSubscription(input.sessionId)
            .then((state) => {
              if (closed) {
                return;
              }
              emit.next({ type: "recording", payload: state });
              pushRows(ctx.kernel.listApiCalls(input.sessionId, cursor, input.limit ?? 200));
            })
            .catch((error) => {
              emit.error(error instanceof Error ? error : new Error(String(error)));
            });

          const unsubscribe = ctx.kernel.onEvent((event) => {
            if (event.sessionId !== input.sessionId) {
              return;
            }
            if (event.type === "runtime.apiCall") {
              const payload = event.payload as { entry: ReturnType<typeof ctx.kernel.listApiCalls>[number] };
              if (payload.entry.id <= cursor) {
                return;
              }
              cursor = payload.entry.id;
              emit.next({ type: "apiCall", payload: payload.entry });
              return;
            }
            if (event.type === "runtime.apiRecording") {
              emit.next({
                type: "recording",
                payload: event.payload as { enabled: boolean; refCount: number },
              });
            }
          });

          return () => {
            closed = true;
            unsubscribe();
            ctx.kernel.releaseApiCallSubscription(input.sessionId);
          };
        });
      }),
  }),
  workspace: t.router({
    recent: t.procedure
      .input(
        z
          .object({
            limit: z.number().int().positive().max(128).optional(),
          })
          .optional(),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listRecentWorkspaces(input?.limit ?? 8),
      })),
    listAll: t.procedure.query(({ ctx }) => ({
      items: ctx.kernel.listAllWorkspaces(),
    })),
    listSessions: t.procedure
      .input(
        z.object({
          path: z.string().min(1),
          tab: z.enum(["all", "running", "stopped", "archive"]),
          cursor: z.number().int().nonnegative().optional(),
          limit: z.number().int().positive().max(200).optional(),
        }),
      )
      .query(({ ctx, input }) => ctx.kernel.listWorkspaceSessions(input)),
    avatarCatalog: t.procedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
        }),
      )
      .query(async ({ ctx, input }) => ({
        items: await ctx.kernel.listWorkspaceAvatarCatalog(input.workspacePath),
      })),
    forkAvatar: t.procedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          avatar: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        avatar: await ctx.kernel.forkWorkspaceAvatar(input),
      })),
    copyAvatar: t.procedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          sourceAvatar: z.string().min(1),
          targetAvatar: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        avatar: await ctx.kernel.copyWorkspaceAvatar(input),
      })),
    welcomeSnapshot: t.procedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          avatar: z.string().min(1).optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const terminalScope = resolveTerminalCallerScope(ctx.auth);
        return await ctx.kernel.inspectWorkspaceWelcome({
          workspacePath: input.workspacePath,
          avatar: input.avatar,
          ...resolveMessageCallerScope(ctx.auth),
          terminalActorId: terminalScope.actorId,
          superadminTerminalActorId: terminalScope.superadminActorId,
        });
      }),
    saveAvatarRoomSeat: t.procedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          avatar: z.string().min(1),
          chatId: z.string().min(1),
          accessToken: z.string().min(1),
          accessRole: z.enum(["admin", "member", "readonly"]),
          state: z.enum(["active", "credential-invalid"]).optional(),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.saveWorkspaceAvatarRoomSeat(input)),
    saveAvatarTerminalSeat: t.procedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          avatar: z.string().min(1),
          terminalId: z.string().min(1),
          accessToken: z.string().min(1),
          accessRole: z.enum(["admin", "writer", "requester", "readonly"]),
          state: z.enum(["active", "credential-invalid"]).optional(),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.saveWorkspaceAvatarTerminalSeat(input)),
    searchPaths: t.procedure
      .input(
        z.object({
          cwd: z.string().min(1),
          query: z.string().optional(),
          limit: z.number().int().positive().max(100).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.searchWorkspacePaths(input),
      })),
    runtimeMounts: t.procedure
      .input(
        z.object({
          runtimeId: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listRuntimeWorkspaceMounts(input.runtimeId),
      })),
    runtimeGrants: t.procedure
      .input(
        z.object({
          runtimeId: z.string().min(1),
          workspacePath: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listRuntimeWorkspaceGrants(input),
      })),
    grantRuntime: t.procedure
      .input(
        z.object({
          runtimeId: z.string().min(1),
          workspacePath: z.string().min(1),
          grants: z.array(workspaceGrantInputSchema),
        }),
      )
      .mutation(({ ctx, input }) => ({
        items: ctx.kernel.grantRuntimeWorkspace(input),
      })),
    detachRuntime: t.procedure
      .input(
        z.object({
          runtimeId: z.string().min(1),
          workspacePath: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.detachRuntimeWorkspace(input)),
    assetRoots: t.procedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          avatar: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) => ctx.kernel.getRuntimeWorkspaceAssetRoots(input)),
    workbenchTree: t.procedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          avatar: z.string().min(1),
          mode: z.enum(["explorer", "private"]),
          path: z.string().optional(),
          offset: z.number().int().nonnegative().optional(),
          limit: z.number().int().positive().max(1000).optional(),
        }),
      )
      .query(({ ctx, input }) => ctx.kernel.listWorkspaceWorkbenchTree(input)),
    workbenchPreview: t.procedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          avatar: z.string().min(1),
          mode: z.enum(["explorer", "private"]),
          path: z.string().min(1),
          maxBytes: z
            .number()
            .int()
            .positive()
            .max(512 * 1024)
            .optional(),
        }),
      )
      .query(({ ctx, input }) => ctx.kernel.readWorkspaceWorkbenchPreview(input)),
    createPrivateAsset: t.procedure
      .input(
        z.object({
          workspacePath: z.string().min(1),
          avatar: z.string().min(1),
          parentPath: z.string().optional(),
          name: z.string().trim().min(1),
          kind: z.enum(["file", "directory"]),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.createWorkspacePrivateAsset(input)),
    exec: t.procedure
      .input(
        z.object({
          runtimeId: z.string().min(1),
          workspacePath: z.string().min(1),
          avatar: z.string().min(1),
          command: z.string().min(1),
          cwd: z.string().min(1).optional(),
          env: z.record(z.string(), z.string()).optional(),
          stdin: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => await ctx.kernel.execRuntimeWorkspace(input)),
    toggleFavorite: t.procedure
      .input(
        z.object({
          path: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) => ({
        item: ctx.kernel.toggleWorkspaceFavorite(input.path),
      })),
    toggleSessionFavorite: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.toggleSessionFavorite(input.sessionId)),
    delete: t.procedure
      .input(
        z.object({
          path: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.removeWorkspace(input.path)),
    cleanMissing: t.procedure.mutation(({ ctx }) => ctx.kernel.removeMissingWorkspaces()),
  }),
  fs: t.router({
    listDirectories: t.procedure
      .input(
        z
          .object({
            path: z.string().min(1).optional(),
            includeHidden: z.boolean().optional(),
          })
          .optional(),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listDirectories({
          path: input?.path,
          includeHidden: input?.includeHidden,
        }),
      })),
    validateDirectory: t.procedure
      .input(
        z.object({
          path: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) => ctx.kernel.validateDirectory(input.path)),
  }),
});

export type AppRouter = typeof appRouter;
