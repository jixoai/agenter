import { z } from "zod";

import { productIdSchema } from "./descriptor";
import { productResourceKeySchema } from "./resource-binding";

export const PRODUCT_HOSTING_SCORE_KEY = "hosting" as const;
export const PRODUCT_HOSTING_ENABLED_SCORES = Object.freeze({ [PRODUCT_HOSTING_SCORE_KEY]: 1000 } as const);
export const PRODUCT_HOSTING_DISABLED_SCORES = Object.freeze({ [PRODUCT_HOSTING_SCORE_KEY]: 0 } as const);
export const PRODUCT_HOSTING_USER_DISABLED_REASON = "user_disabled" as const;

export const productAttentionProjectionKindSchema = z.enum([
  "heartbeat",
  "room-unread",
  "terminal-state",
  "product-lifecycle",
]);

export const productTerminalProjectionStateSchema = z.enum(["idle", "dirty", "busy", "stopped"]);
export const productLifecycleStateSchema = z.enum(["attached", "detached", "managed", "unmanaged"]);

export const productAttentionProjectionSchema = z.object({
  productId: productIdSchema,
  resourceKey: productResourceKeySchema,
  runtimeId: z.string().trim().min(1),
  kind: productAttentionProjectionKindSchema,
  terminalId: z.string().trim().min(1).optional(),
  roomId: z.string().trim().min(1).optional(),
  heartbeatText: z.string().optional(),
  unreadCount: z.number().int().nonnegative().optional(),
  terminalState: productTerminalProjectionStateSchema.optional(),
  lifecycle: productLifecycleStateSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ProductAttentionProjection = z.infer<typeof productAttentionProjectionSchema>;

export const productAttentionOperationSchema = z.enum(["commit", "query", "settle"]);
export type ProductAttentionOperation = z.infer<typeof productAttentionOperationSchema>;

export const productAttentionCommitInputSchema = z.object({
  contextId: z.string().trim().min(1),
  summary: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1).optional(),
  done: z.boolean().optional(),
  scores: z.record(z.string(), z.number()).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type ProductAttentionCommitInput = z.infer<typeof productAttentionCommitInputSchema>;

export const productAttentionQueryInputSchema = z.object({
  query: z.string(),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
});
export type ProductAttentionQueryInput = z.infer<typeof productAttentionQueryInputSchema>;

export const productAttentionSettleInputSchema = z.object({
  contextId: z.string().trim().min(1),
  summary: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1).optional(),
  scores: z.record(z.string(), z.number()).optional(),
  reason: z.string().trim().min(1).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type ProductAttentionSettleInput = z.infer<typeof productAttentionSettleInputSchema>;
