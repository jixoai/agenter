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
    focusTerminal: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          terminalId: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.focusTerminal(input.sessionId, input.terminalId)),
  }),
  chat: t.router({
    send: t.procedure
      .input(
        z.object({
          sessionId: z.string().min(1),
          text: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.sendChat(input.sessionId, input.text)),
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
            sessionId: z.string().min(1),
          }),
        )
        .query(async ({ ctx, input }) => ctx.kernel.listSettingsLayers(input.sessionId)),
      read: t.procedure
        .input(
          z.object({
            sessionId: z.string().min(1),
            layerId: z.string().min(1),
          }),
        )
        .query(async ({ ctx, input }) => ctx.kernel.readSettingsLayer(input)),
      save: t.procedure
        .input(
          z.object({
            sessionId: z.string().min(1),
            layerId: z.string().min(1),
            content: z.string(),
            baseMtimeMs: z.number().nonnegative(),
          }),
        )
        .mutation(async ({ ctx, input }) => ctx.kernel.saveSettingsLayer(input)),
    }),
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
