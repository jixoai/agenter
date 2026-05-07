import { z } from "zod";

import { productIdSchema } from "./descriptor";
import { productResourceKeySchema } from "./resource-binding";

export const productDelegationModeSchema = z.enum(["observe", "write", "confirm-before-write"]);
export const productDelegationStatusSchema = z.enum(["active", "revoked", "expired"]);

export const productDelegationPolicySchema = z.object({
  mode: productDelegationModeSchema,
  maxWriteBytes: z.number().int().positive().optional(),
});
export type ProductDelegationPolicy = z.infer<typeof productDelegationPolicySchema>;

export const productDelegationProvenanceSchema = z.object({
  source: z.string().trim().min(1),
  attentionContextId: z.string().trim().min(1).optional(),
  attentionCommitId: z.string().trim().min(1).optional(),
  terminalLeaseId: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
});
export type ProductDelegationProvenance = z.infer<typeof productDelegationProvenanceSchema>;

export const productDelegationCreateInputSchema = z.object({
  productId: productIdSchema,
  resourceKey: productResourceKeySchema,
  runtimeId: z.string().trim().min(1),
  avatarActorId: z.string().trim().min(1),
  grantedByActorId: z.string().trim().min(1),
  terminalId: z.string().trim().min(1),
  roomId: z.string().trim().min(1),
  enabledAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  policy: productDelegationPolicySchema,
  provenance: productDelegationProvenanceSchema,
});
export type ProductDelegationCreateInput = z.infer<typeof productDelegationCreateInputSchema>;

export const productDelegationRecordSchema = productDelegationCreateInputSchema.extend({
  delegationId: z.string().trim().min(1),
  status: productDelegationStatusSchema,
  revokedAt: z.number().int().positive().optional(),
  revokedReason: z.string().trim().min(1).optional(),
});
export type ProductDelegationRecord = z.infer<typeof productDelegationRecordSchema>;

export const productDelegationLookupSchema = z.object({
  productId: productIdSchema,
  resourceKey: productResourceKeySchema.optional(),
  runtimeId: z.string().trim().min(1).optional(),
  avatarActorId: z.string().trim().min(1).optional(),
  includeRevoked: z.boolean().optional(),
});
export type ProductDelegationLookup = z.infer<typeof productDelegationLookupSchema>;

export const productDelegationRevokeInputSchema = z.object({
  delegationId: z.string().trim().min(1),
  revokedAt: z.number().int().positive(),
  revokedReason: z.string().trim().min(1),
});
export type ProductDelegationRevokeInput = z.infer<typeof productDelegationRevokeInputSchema>;
