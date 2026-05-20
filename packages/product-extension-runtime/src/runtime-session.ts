import { z } from "zod";

export const productRuntimeSessionClearInputSchema = z.object({
  workspacePath: z.string().trim().min(1),
  avatarNickname: z.string().trim().min(1),
});
export type ProductRuntimeSessionClearInput = z.infer<typeof productRuntimeSessionClearInputSchema>;
