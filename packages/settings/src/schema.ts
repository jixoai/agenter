import { z } from "zod";

const aiProviderSchema = z.object({
  kind: z.enum([
    "deepseek",
    "openai",
    "anthropic",
    "gemini",
    "grok",
    "ollama",
    "openai-compatible",
    "anthropic-compatible",
  ]),
  model: z.string().min(1),
  apiKey: z.string().min(1).optional(),
  apiKeyEnv: z.string().min(1).optional(),
  baseUrl: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxRetries: z.number().int().nonnegative().optional(),
  maxToken: z.number().int().positive().optional(),
  compactThreshold: z.number().gt(0).lte(1).optional(),
});

export const settingsSchema = z.object({
  settingsSource: z.array(z.string()).optional(),
  avatar: z.string().min(1).optional(),
  sessionStoreTarget: z.enum(["global", "workspace"]).optional(),
  lang: z.string().min(1).optional(),
  agentCwd: z.string().min(1).optional(),
  agent: z
    .object({
      defaultAssignee: z.string().min(1).optional(),
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
        })
        .optional(),
    })
    .optional(),
  ai: z
    .object({
      activeProvider: z.string().min(1).optional(),
      providers: z.record(z.string().min(1), aiProviderSchema).optional(),
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
  tasks: z
    .object({
      sources: z
        .array(
          z.object({
            name: z.string().min(1),
            path: z.string().min(1),
          }),
        )
        .min(1)
        .optional(),
    })
    .optional(),
});

export type SettingsSchema = z.infer<typeof settingsSchema>;
