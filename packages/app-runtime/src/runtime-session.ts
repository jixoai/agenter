import { z } from "zod";

const avatarPrincipalIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^0x[a-f0-9]{40}$/u, "avatarPrincipalId must be a canonical principal id");

export const appRuntimeSessionClearInputSchema = z
  .object({
    avatarPrincipalId: avatarPrincipalIdSchema,
  })
  .strict();
export type AppRuntimeSessionClearInput = z.infer<typeof appRuntimeSessionClearInputSchema>;
