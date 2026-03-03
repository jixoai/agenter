import { observable } from "@trpc/server/observable";
import { z } from "zod";

import type { AnyRuntimeEvent } from "../realtime-types";
import { settingsKindSchema } from "../realtime-types";
import { t } from "./init";

const instanceIdInput = z.object({ instanceId: z.string().min(1) });

export const appRouter = t.router({
  session: t.router({
    list: t.procedure.query(({ ctx }) => ({ instances: ctx.kernel.listInstances() })),
    create: t.procedure
      .input(
        z.object({
          cwd: z.string().min(1),
          name: z.string().optional(),
          autoStart: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const instance = ctx.kernel.createInstance(input);
        if (instance.autoStart) {
          await ctx.kernel.startInstance(instance.id);
          const refreshed = ctx.kernel.getInstance(instance.id);
          return { instance: refreshed ?? instance };
        }
        return { instance };
      }),
    update: t.procedure
      .input(
        z.object({
          instanceId: z.string().min(1),
          name: z.string().optional(),
          autoStart: z.boolean().optional(),
        }),
      )
      .mutation(({ ctx, input }) => {
        const instance = ctx.kernel.updateInstance(input.instanceId, {
          name: input.name,
          autoStart: input.autoStart,
        });
        return { instance };
      }),
    delete: t.procedure.input(instanceIdInput).mutation(async ({ ctx, input }) => {
      return await ctx.kernel.deleteInstance(input.instanceId);
    }),
    start: t.procedure.input(instanceIdInput).mutation(async ({ ctx, input }) => {
      const instance = await ctx.kernel.startInstance(input.instanceId);
      return { instance };
    }),
    stop: t.procedure.input(instanceIdInput).mutation(async ({ ctx, input }) => {
      const instance = await ctx.kernel.stopInstance(input.instanceId);
      return { instance };
    }),
    focusTerminal: t.procedure
      .input(
        z.object({
          instanceId: z.string().min(1),
          terminalId: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.focusTerminal(input.instanceId, input.terminalId)),
  }),
  chat: t.router({
    send: t.procedure
      .input(
        z.object({
          instanceId: z.string().min(1),
          text: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) => ctx.kernel.sendChat(input.instanceId, input.text)),
  }),
  settings: t.router({
    read: t.procedure
      .input(
        z.object({
          instanceId: z.string().min(1),
          kind: settingsKindSchema,
        }),
      )
      .query(async ({ ctx, input }) => {
        return await ctx.kernel.readSettings(input);
      }),
    save: t.procedure
      .input(
        z.object({
          instanceId: z.string().min(1),
          kind: settingsKindSchema,
          content: z.string(),
          baseMtimeMs: z.number().nonnegative(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return await ctx.kernel.saveSettings(input);
      }),
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
});

export type AppRouter = typeof appRouter;
