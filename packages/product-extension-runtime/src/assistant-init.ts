import { z } from "zod";

import { productIdSchema } from "./descriptor";

export const productAssistantEnsureInputSchema = z.object({
  productId: productIdSchema,
  workspacePath: z.string().trim().min(1),
  avatarNickname: z.string().trim().min(1),
  displayName: z.string().trim().min(1).optional(),
  classify: z.string().trim().min(1).nullable().optional(),
});
export type ProductAssistantEnsureInput = z.infer<typeof productAssistantEnsureInputSchema>;

export const productPromptKindSchema = z.enum(["agenter", "system", "template", "contract"]);
export type ProductPromptKind = z.infer<typeof productPromptKindSchema>;

export const productPromptSeedInputSchema = z.object({
  sessionId: z.string().trim().min(1),
  kind: productPromptKindSchema.default("agenter"),
  seedContent: z.string(),
});
export type ProductPromptSeedInput = z.infer<typeof productPromptSeedInputSchema>;

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
