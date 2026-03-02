import { z } from "zod";

export const settingsSchema = z.object({
  settingsSource: z.array(z.string()).optional(),
  lang: z.string().min(1).optional(),
  agentCwd: z.string().min(1).optional(),
  agent: z
    .object({
      maxStepsPerTask: z.number().int().positive().optional(),
    })
    .optional(),
  terminal: z
    .object({
      terminalId: z.string().min(1).optional(),
      command: z.array(z.string().min(1)).min(1).optional(),
      submitGapMs: z.number().int().nonnegative().optional(),
      outputRoot: z.string().min(1).optional(),
      gitLog: z.union([z.literal(false), z.literal("normal"), z.literal("verbose")]).optional(),
      presets: z
        .record(
          z.string().min(1),
          z.object({
            command: z.array(z.string().min(1)).min(1),
            cwd: z.string().min(1).optional(),
            submitGapMs: z.number().int().nonnegative().optional(),
            helpSource: z.string().min(1).optional(),
          }),
        )
        .optional(),
      helpSources: z.record(z.string().min(1), z.string().min(1)).optional(),
    })
    .optional(),
  features: z
    .object({
      terminal: z
        .object({
          bootTerminals: z
            .array(
              z.union([
                z.string().min(1),
                z.object({
                  id: z.string().min(1),
                  focus: z.boolean().optional(),
                  autoRun: z.boolean().optional(),
                }),
              ]),
            )
            .optional(),
          focusMode: z.literal("exclusive").optional(),
          unfocusedSignal: z.literal("summary").optional(),
        })
        .optional(),
    })
    .optional(),
  ai: z
    .object({
      provider: z.literal("deepseek").optional(),
      apiKey: z.string().min(1).optional(),
      apiKeyEnv: z.string().min(1).optional(),
      model: z.string().min(1).optional(),
      baseUrl: z.string().min(1).optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxRetries: z.number().int().nonnegative().optional(),
    })
    .optional(),
  loop: z
    .object({
      sliceDirty: z
        .object({
          wait: z.boolean().optional(),
          timeoutMs: z.number().int().positive().optional(),
          pollMs: z.number().int().positive().optional(),
        })
        .optional(),
    })
    .optional(),
  prompt: z
    .object({
      rootDir: z.string().min(1).optional(),
      agenterPath: z.string().min(1).optional(),
      internalSystemPath: z.string().min(1).optional(),
      systemTemplatePath: z.string().min(1).optional(),
      responseContractPath: z.string().min(1).optional(),
    })
    .optional(),
});

export type SettingsSchema = z.infer<typeof settingsSchema>;
