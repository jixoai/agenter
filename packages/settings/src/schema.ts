import { z } from "zod";

import { aiProviderSchema } from "./provider";

const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9._-]{16,128}$/;
const aiThinkingSchema = z
  .object({
    enabled: z.boolean().describe("Whether reasoning mode is enabled for model calls.").optional(),
    budgetTokens: z.number().int().positive().describe("Reasoning token budget when supported.").optional(),
  })
  .describe("Runtime reasoning policy for the active provider.")
  .optional();

export const settingsSchema = z.object({
  settingsSource: z.array(z.string()).describe("Settings source precedence from low to high priority.").optional(),
  avatar: z.string().min(1).describe("Nickname of the active avatar profile.").optional(),
  profileReference: z
    .string()
    .min(1)
    .describe("Canonical durable profile reference used for profile-service-backed identity and icon selection.")
    .optional(),
  sessionStoreTarget: z
    .enum(["global", "workspace"])
    .describe("Session storage target: global profile or workspace-local.")
    .optional(),
  lang: z.string().min(1).describe("Preferred locale for UI and prompts.").optional(),
  agentCwd: z.string().min(1).describe("Working directory for agent process startup.").optional(),
  agent: z
    .object({
      defaultAssignee: z.string().min(1).describe("Default assignee for newly created tasks.").optional(),
    })
    .describe("Agent behavior preferences.")
    .optional(),
  terminal: z
    .object({
      terminalId: z.string().min(1).describe("Terminal preset id used as default shell target.").optional(),
      command: z.array(z.string().min(1)).min(1).describe("Command array used to boot the primary terminal.").optional(),
      submitGapMs: z.number().int().nonnegative().describe("Delay between terminal submit chunks in milliseconds.").optional(),
      outputRoot: z.string().min(1).describe("Output directory for terminal artifacts and logs.").optional(),
      gitLog: z
        .union([z.literal(false), z.literal("normal"), z.literal("verbose")])
        .describe("Git log capture level for terminal context collection.")
        .optional(),
      presets: z
        .record(
          z.string().min(1),
          z.object({
            command: z.array(z.string().min(1)).min(1).describe("Command array for this terminal preset."),
            cwd: z.string().min(1).describe("Working directory for this preset.").optional(),
            submitGapMs: z.number().int().nonnegative().describe("Per-preset submit delay in milliseconds.").optional(),
            helpSource: z.string().min(1).describe("Help markdown source for this preset.").optional(),
          }),
        )
        .describe("Named terminal presets.")
        .optional(),
      helpSources: z.record(z.string().min(1), z.string().min(1)).describe("Terminal help source map by terminal id.").optional(),
    })
    .describe("Terminal runtime and preset settings.")
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
                  id: z.string().min(1).describe("Terminal preset id to boot."),
                  focus: z.boolean().describe("Whether this boot terminal should gain focus.").optional(),
                  autoRun: z.boolean().describe("Whether this boot terminal should auto start.").optional(),
                }),
              ]),
            )
            .describe("Boot terminal descriptors.")
            .optional(),
        })
        .describe("Terminal feature switches.")
        .optional(),
      message: z
        .object({
          chatMainDefaults: z
            .object({
              title: z
                .string()
                .trim()
                .min(1)
                .describe("Default title for the primary room inside the chat channel.")
                .optional(),
              participants: z
                .array(
                  z.object({
                    id: z.string().trim().min(1).describe("Participant id."),
                    label: z.string().trim().min(1).describe("Participant label.").optional(),
                  }),
                )
                .describe("Default participants for the primary room inside the chat channel.")
                .optional(),
              metadata: z
                .record(z.string(), z.unknown())
                .describe("Additional metadata merged into the primary room inside the chat channel.")
                .optional(),
              adminToken: z
                .string()
                .trim()
                .regex(ACCESS_TOKEN_PATTERN, "adminToken must be 16-128 chars [A-Za-z0-9._-]")
                .describe("Optional explicit admin token for the primary room bootstrap.")
                .optional(),
            })
            .describe("Bootstrap config for the primary room inside the chat channel.")
            .optional(),
          maxFocusedRoomCount: z
            .number()
            .int()
            .positive()
            .describe("Maximum unread rooms ingested into one runtime cycle.")
            .optional(),
          maxBatchReadRoomMessageCount: z
            .number()
            .int()
            .positive()
            .describe("Maximum unread messages ingested per room for one runtime cycle.")
            .optional(),
        })
        .describe("Message feature switches.")
        .optional(),
    })
    .describe("Feature-level runtime toggles.")
    .optional(),
  ai: z
    .object({
      activeProvider: z.string().min(1).describe("Provider id selected for model calls.").optional(),
      temperature: z.number().min(0).max(2).describe("Runtime sampling temperature for the active provider.").optional(),
      topK: z.number().int().nonnegative().describe("Runtime top-k sampling bound for the active provider.").optional(),
      maxToken: z.number().int().positive().describe("Runtime max output token budget for the active provider.").optional(),
      thinking: aiThinkingSchema,
      providers: z.record(z.string().min(1), aiProviderSchema).describe("Provider registry by id.").optional(),
    })
    .describe("AI provider selection and registry.")
    .optional(),
  loop: z
    .object({
      sliceDirty: z
        .object({
          wait: z.boolean().describe("Whether loop waits for dirty slices before wake.").optional(),
          timeoutMs: z.number().int().positive().describe("Loop wait timeout in milliseconds.").optional(),
          pollMs: z.number().int().positive().describe("Loop polling interval in milliseconds.").optional(),
        })
        .describe("Loop dirty-slice wait policy.")
        .optional(),
    })
    .describe("Loop scheduling policies.")
    .optional(),
  prompt: z
    .object({
      rootDir: z.string().min(1).describe("Root directory for prompt sources.").optional(),
      agenterPath: z.string().min(1).describe("User prompt path for AGENTER.mdx.").optional(),
      internalSystemPath: z.string().min(1).describe("Internal system prompt path.").optional(),
      systemTemplatePath: z.string().min(1).describe("System template prompt path.").optional(),
      responseContractPath: z.string().min(1).describe("Response contract prompt path.").optional(),
    })
    .describe("Prompt source paths.")
    .optional(),
  tasks: z
    .object({
      sources: z
        .array(
          z.object({
            name: z.string().min(1).describe("Task source name."),
            path: z.string().min(1).describe("Task source directory path."),
          }),
        )
        .min(1)
        .describe("Task source list in load order.")
        .optional(),
    })
    .describe("Task system source settings.")
    .optional(),
});

export type SettingsSchema = z.infer<typeof settingsSchema>;
