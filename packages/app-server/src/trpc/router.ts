import { observable } from "@trpc/server/observable";
import { z } from "zod";

import type { AnyRuntimeEvent } from "../realtime-types";
import { settingsKindSchema } from "../realtime-types";
import { t } from "./init";

const sessionIdInput = z.object({ sessionId: z.string().min(1) });

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
      .input(
        z.object({
          sessionId: z.string().min(1),
          afterId: z.number().int().nonnegative().optional(),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listChatMessages(input.sessionId, input.afterId ?? 0, input.limit ?? 200),
      })),
    listBefore: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          beforeId: z.number().int().positive(),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listChatMessagesBefore(input.sessionId, input.beforeId, input.limit ?? 200),
      })),
    cycles: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listChatCycles(input.sessionId, input.limit ?? 120),
      })),
    cyclesBefore: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          beforeCycleId: z.number().int().positive(),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listChatCyclesBefore(input.sessionId, input.beforeCycleId, input.limit ?? 120),
      })),
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
  notification: t.router({
    snapshot: t.procedure.query(({ ctx }) => ctx.kernel.getNotificationSnapshot()),
    setChatVisibility: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          visible: z.boolean(),
          focused: z.boolean(),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.setChatVisibility(input)),
    consume: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
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
    loopbusStateLogs: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          afterId: z.number().int().nonnegative().optional(),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listLoopbusStateLogs(input.sessionId, input.afterId ?? 0, input.limit ?? 200),
      })),
    loopbusStateLogsBefore: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          beforeId: z.number().int().positive(),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listLoopbusStateLogsBefore(input.sessionId, input.beforeId, input.limit ?? 200),
      })),
    loopbusTraces: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          afterId: z.number().int().nonnegative().optional(),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listLoopbusTraces(input.sessionId, input.afterId ?? 0, input.limit ?? 200),
      })),
    loopbusTracesBefore: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          beforeId: z.number().int().positive(),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) => ({
        items: ctx.kernel.listLoopbusTracesBefore(input.sessionId, input.beforeId, input.limit ?? 200),
      })),
    modelCallsPage: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          afterId: z.number().int().nonnegative().optional(),
          beforeId: z.number().int().positive().optional(),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) => {
        if (input.beforeId !== undefined) {
          return {
            items: ctx.kernel.listModelCallsBefore(input.sessionId, input.beforeId, input.limit ?? 200),
          };
        }
        return {
          items: ctx.kernel.listModelCalls(input.sessionId, input.afterId ?? 0, input.limit ?? 200),
        };
      }),
    modelDebug: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
        }),
      )
      .query(async ({ ctx, input }) => await ctx.kernel.inspectModelDebug(input.sessionId)),
    apiCallsPage: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          afterId: z.number().int().nonnegative().optional(),
          beforeId: z.number().int().positive().optional(),
          limit: z.number().int().positive().max(500).optional(),
        }),
      )
      .query(({ ctx, input }) => {
        if (input.beforeId !== undefined) {
          return {
            items: ctx.kernel.listApiCallsBefore(input.sessionId, input.beforeId, input.limit ?? 200),
          };
        }
        return {
          items: ctx.kernel.listApiCalls(input.sessionId, input.afterId ?? 0, input.limit ?? 200),
        };
      }),
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
