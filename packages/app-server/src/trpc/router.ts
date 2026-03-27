import { observable } from "@trpc/server/observable";
import { z } from "zod";

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
const channelAccessInput = z.object({
  chatId: z.string().min(1),
  accessToken: z.string().min(1),
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

export const appRouter = t.router({
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
      .mutation(({ ctx, input }) => ctx.kernel.focusTerminal(input.sessionId, input.terminalId)),
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
      .query(({ ctx, input }) => ctx.kernel.pageChatMessages(input.sessionId, { before: input.before, limit: input.limit ?? 200 })),
    cycles: t.procedure
      .input(reversePageInput)
      .query(({ ctx, input }) => ctx.kernel.pageChatCycles(input.sessionId, { before: input.before, limit: input.limit ?? 120 })),
  }),
  message: t.router({
    listChannels: t.procedure
      .input(sessionIdInput)
      .query(({ ctx, input }) => ({ items: ctx.kernel.listMessageChannels(input.sessionId) })),
    createChannel: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          kind: z.enum(["direct", "room"]),
          title: z.string().trim().min(1).optional(),
          focus: z.boolean().optional(),
        }),
      )
      .mutation(({ ctx, input }) => ({
        channel: ctx.kernel.createMessageChannel({
          sessionId: input.sessionId,
          kind: input.kind,
          title: input.title,
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
      .mutation(({ ctx, input }) => ({
        items: ctx.kernel.focusMessageChannels({
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
                  role: z.enum(["avatar", "user", "system"]).optional(),
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
  avatar: t.router({
    list: t.procedure.query(async ({ ctx }) => await ctx.kernel.listAvatarCatalog()),
    create: t.procedure
      .input(
        z.object({
          nickname: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => await ctx.kernel.createAvatar(input)),
  }),
  notification: t.router({
    snapshot: t.procedure.query(({ ctx }) => ctx.kernel.getNotificationSnapshot()),
    setChatVisibility: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1).optional(),
          visible: z.boolean(),
          focused: z.boolean(),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.setChatVisibility(input)),
    consume: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          chatId: z.string().min(1).optional(),
          upToMessageId: z.string().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.consumeNotifications(input)),
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
          contextId: z.string().optional(),
          hash: z.string().optional(),
          depth: z.number().int().min(0).max(8).optional(),
          author: z.string().optional(),
          source: z.string().optional(),
          text: z.string().optional(),
          offset: z.number().int().min(0).optional(),
          limit: z.number().int().min(1).max(200).optional(),
          minScore: z.number().int().min(0).max(100).optional(),
        }),
      )
      .query(async ({ ctx, input }) => ({
        items: await ctx.kernel.queryAttention(input.sessionId, {
          contextId: input.contextId,
          hash: input.hash,
          depth: input.depth,
          author: input.author,
          source: input.source,
          text: input.text,
          offset: input.offset,
          limit: input.limit,
          minScore: input.minScore,
        }),
      })),
    schedulerLogs: t.procedure
      .input(reversePageInput)
      .query(({ ctx, input }) => ctx.kernel.pageSchedulerLogs(input.sessionId, { before: input.before, limit: input.limit ?? 200 })),
    observabilityTraces: t.procedure
      .input(reversePageInput)
      .query(({ ctx, input }) => ctx.kernel.pageObservabilityTraces(input.sessionId, { before: input.before, limit: input.limit ?? 200 })),
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
    modelCallsPage: t.procedure
      .input(reversePageInput)
      .query(({ ctx, input }) => ctx.kernel.pageModelCalls(input.sessionId, { before: input.before, limit: input.limit ?? 200 })),
    apiCallsPage: t.procedure
      .input(reversePageInput)
      .query(({ ctx, input }) => ctx.kernel.pageApiCalls(input.sessionId, { before: input.before, limit: input.limit ?? 200 })),
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
