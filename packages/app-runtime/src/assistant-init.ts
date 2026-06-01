import { z } from "zod";

import { appIdSchema } from "./descriptor";

const avatarPrincipalIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^0x[a-f0-9]{40}$/u, "avatarPrincipalId must be a canonical principal id");

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
