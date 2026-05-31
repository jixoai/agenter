import { z } from "zod";

import { appIdSchema } from "./descriptor";

const avatarPrincipalIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^0x[a-f0-9]{40}$/u, "avatarPrincipalId must be a canonical principal id");

const isSafeRelativeFilePath = (value: string): boolean => {
  const normalized = value.replace(/\\/gu, "/").trim();
  if (normalized.length === 0 || normalized === "." || normalized.startsWith("/")) {
    return false;
  }
  return normalized.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
};

export const appAssistantEnsureInputSchema = z
  .object({
    appId: appIdSchema,
    avatarNickname: z.string().trim().min(1),
    displayName: z.string().trim().min(1).optional(),
    classify: z.string().trim().min(1).nullable().optional(),
  })
  .strict();
export type AppAssistantEnsureInput = z.infer<typeof appAssistantEnsureInputSchema>;

export const appAvatarPromptSeedInputSchema = z
  .object({
    avatarPrincipalId: avatarPrincipalIdSchema,
    kind: z.literal("agenter").default("agenter"),
    seedContent: z.string(),
  })
  .strict();
export type AppAvatarPromptSeedInput = z.infer<typeof appAvatarPromptSeedInputSchema>;

export const appMemoryRoleSchema = z.object({
  role: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-_]*$/u, "memory role must be kebab/snake safe"),
  path: z.string().trim().min(1).refine(isSafeRelativeFilePath, "memory role path must be a safe relative file path"),
  seedContent: z.string(),
});
export type AppMemoryRole = z.infer<typeof appMemoryRoleSchema>;

export const appAvatarMemoryPackFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  created: z.boolean(),
  mtimeMs: z.number(),
});
export type AppAvatarMemoryPackFile = z.infer<typeof appAvatarMemoryPackFileSchema>;

export const appPrivateAssetKindSchema = z.enum(["skills", "memory", "tools", "archive"]);
export type AppPrivateAssetKind = z.infer<typeof appPrivateAssetKindSchema>;

export const appPrivateTextAssetEnsureInputSchema = z.object({
  workspacePath: z.string().trim().min(1),
  avatarNickname: z.string().trim().min(1),
  assetKind: appPrivateAssetKindSchema.default("memory"),
  relativePath: z.string().trim().min(1),
  seedContent: z.string(),
});
export type AppPrivateTextAssetEnsureInput = z.infer<typeof appPrivateTextAssetEnsureInputSchema>;

export const appMemoryPackEnsureInputSchema = z
  .object({
    avatarPrincipalId: avatarPrincipalIdSchema,
    roles: z.array(appMemoryRoleSchema).min(1),
  })
  .strict();
export type AppMemoryPackEnsureInput = z.infer<typeof appMemoryPackEnsureInputSchema>;
