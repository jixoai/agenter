import { z } from "zod";

import { productIdSchema } from "./descriptor";

const avatarPrincipalIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^0x[a-f0-9]{40}$/u, "avatarPrincipalId must be a canonical principal id");

export const productAssistantEnsureInputSchema = z.object({
  productId: productIdSchema,
  workspacePath: z.string().trim().min(1),
  avatarNickname: z.string().trim().min(1),
  displayName: z.string().trim().min(1).optional(),
  classify: z.string().trim().min(1).nullable().optional(),
});
export type ProductAssistantEnsureInput = z.infer<typeof productAssistantEnsureInputSchema>;

export const productAvatarPromptSeedInputSchema = z
  .object({
    avatarPrincipalId: avatarPrincipalIdSchema,
    kind: z.literal("agenter").default("agenter"),
    seedContent: z.string(),
  })
  .strict();
export type ProductAvatarPromptSeedInput = z.infer<typeof productAvatarPromptSeedInputSchema>;

export const productMemoryRoleSchema = z.object({
  role: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-_]*$/u, "memory role must be kebab/snake safe"),
  path: z.string().trim().min(1),
  seedContent: z.string(),
});
export type ProductMemoryRole = z.infer<typeof productMemoryRoleSchema>;

export const productPrivateAssetKindSchema = z.enum(["skills", "memory", "tools", "archive"]);
export type ProductPrivateAssetKind = z.infer<typeof productPrivateAssetKindSchema>;

export const productPrivateTextAssetEnsureInputSchema = z.object({
  workspacePath: z.string().trim().min(1),
  avatarNickname: z.string().trim().min(1),
  assetKind: productPrivateAssetKindSchema.default("memory"),
  relativePath: z.string().trim().min(1),
  seedContent: z.string(),
});
export type ProductPrivateTextAssetEnsureInput = z.infer<typeof productPrivateTextAssetEnsureInputSchema>;

export const productMemoryPackEnsureInputSchema = z.object({
  workspacePath: z.string().trim().min(1),
  avatarNickname: z.string().trim().min(1),
  roles: z.array(productMemoryRoleSchema).min(1),
});
export type ProductMemoryPackEnsureInput = z.infer<typeof productMemoryPackEnsureInputSchema>;
