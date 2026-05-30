import { z } from "zod";

import { appIdSchema } from "./descriptor";
import { appResourceKeySchema } from "./resource-binding";

export const APP_HOSTING_SCORE_KEY = "hosting" as const;
export const APP_HOSTING_ENABLED_SCORES = Object.freeze({ [APP_HOSTING_SCORE_KEY]: 1000 } as const);
export const APP_HOSTING_DISABLED_SCORES = Object.freeze({ [APP_HOSTING_SCORE_KEY]: 0 } as const);
export const APP_HOSTING_USER_DISABLED_REASON = "user_disabled" as const;

export const appAttentionProjectionKindSchema = z.enum([
  "heartbeat",
  "room-unread",
  "terminal-state",
  "app-lifecycle",
]);

export const appTerminalProjectionStateSchema = z.enum(["idle", "dirty", "busy", "stopped"]);
export const appLifecycleStateSchema = z.enum(["attached", "detached", "managed", "unmanaged"]);

export const appAttentionProjectionSchema = z.object({
  appId: appIdSchema,
  resourceKey: appResourceKeySchema,
  runtimeId: z.string().trim().min(1),
  kind: appAttentionProjectionKindSchema,
  terminalId: z.string().trim().min(1).optional(),
  roomId: z.string().trim().min(1).optional(),
  heartbeatText: z.string().optional(),
  unreadCount: z.number().int().nonnegative().optional(),
  terminalState: appTerminalProjectionStateSchema.optional(),
  lifecycle: appLifecycleStateSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AppAttentionProjection = z.infer<typeof appAttentionProjectionSchema>;

export const appAttentionOperationSchema = z.enum(["commit", "query", "settle"]);
export type AppAttentionOperation = z.infer<typeof appAttentionOperationSchema>;

export const appAttentionCommitInputSchema = z.object({
  contextId: z.string().trim().min(1),
  summary: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1).optional(),
  done: z.boolean().optional(),
  scores: z.record(z.string(), z.number()).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type AppAttentionCommitInput = z.infer<typeof appAttentionCommitInputSchema>;

export const appAttentionQueryInputSchema = z.object({
  query: z.string(),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
});
export type AppAttentionQueryInput = z.infer<typeof appAttentionQueryInputSchema>;

export const appAttentionSettleInputSchema = z.object({
  contextId: z.string().trim().min(1),
  summary: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1).optional(),
  scores: z.record(z.string(), z.number()).optional(),
  reason: z.string().trim().min(1).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type AppAttentionSettleInput = z.infer<typeof appAttentionSettleInputSchema>;
