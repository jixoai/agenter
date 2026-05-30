import { z } from "zod";

export const appRuntimeSessionClearInputSchema = z.object({
  workspacePath: z.string().trim().min(1),
  avatarNickname: z.string().trim().min(1),
});
export type AppRuntimeSessionClearInput = z.infer<typeof appRuntimeSessionClearInputSchema>;
