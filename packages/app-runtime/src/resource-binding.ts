import { z } from "zod";

import { appIdSchema } from "./descriptor";

export const appResourceKeySchema = z.string().trim().min(1);
export const appResourceKindSchema = z.enum(["terminal", "room"]);
export const appResourceOwnerSystemSchema = z.enum(["terminal-system", "message-system"]);

export type AppResourceKind = z.infer<typeof appResourceKindSchema>;
export type AppResourceOwnerSystem = z.infer<typeof appResourceOwnerSystemSchema>;

export const appBindingMetadataSchema = z.object({
  appId: appIdSchema,
  resourceKey: appResourceKeySchema,
  ownerSystem: appResourceOwnerSystemSchema,
});
export type AppBindingMetadata = z.infer<typeof appBindingMetadataSchema>;

export const appResourceBindingInputSchema = z.object({
  appId: appIdSchema,
  resourceKey: appResourceKeySchema,
  resourceKind: appResourceKindSchema,
  ownerSystem: appResourceOwnerSystemSchema,
  title: z.string().trim().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AppResourceBindingInput = z.infer<typeof appResourceBindingInputSchema>;

export const buildAppBindingMetadata = (input: AppResourceBindingInput): AppBindingMetadata => ({
  appId: input.appId,
  resourceKey: input.resourceKey,
  ownerSystem: input.ownerSystem,
});

export const matchesAppBindingMetadata = (
  value: unknown,
  expected: Pick<AppBindingMetadata, "appId" | "resourceKey">,
): boolean => {
  const parsed = appBindingMetadataSchema.safeParse(value);
  if (!parsed.success) {
    return false;
  }
  return parsed.data.appId === expected.appId && parsed.data.resourceKey === expected.resourceKey;
};
