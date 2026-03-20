import { z } from "zod";

export const LEGACY_AI_PROVIDER_KINDS = [
  "deepseek",
  "openai",
  "anthropic",
  "gemini",
  "grok",
  "ollama",
  "openai-compatible",
  "anthropic-compatible",
] as const;

export const AI_API_STANDARDS = [
  "gemini",
  "anthropic",
  "openai-chat",
  "openai-completion",
  "openai-responses",
] as const;

export type LegacyAiProviderKind = (typeof LEGACY_AI_PROVIDER_KINDS)[number];
export type AiProviderKind = LegacyAiProviderKind;
export type AiApiStandard = (typeof AI_API_STANDARDS)[number];

interface AiProviderSharedFields {
  model: string;
  apiKey?: string;
  apiKeyEnv?: string;
  baseUrl?: string;
  temperature?: number;
  maxRetries?: number;
  maxToken?: number;
  compactThreshold?: number;
  headers?: Record<string, string>;
}

export interface AiProviderSettings extends AiProviderSharedFields {
  apiStandard: AiApiStandard;
  vendor?: string;
  profile?: string;
  extensions?: string[];
}

export interface LegacyAiProviderSettings extends AiProviderSharedFields {
  kind: LegacyAiProviderKind;
}

export type AiProviderInputSettings = AiProviderSettings | LegacyAiProviderSettings;

const compactThresholdSchema = z.number().gt(0).lte(1).optional();
const sharedFields = {
  model: z.string().min(1),
  apiKey: z.string().min(1).optional(),
  apiKeyEnv: z.string().min(1).optional(),
  baseUrl: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxRetries: z.number().int().nonnegative().optional(),
  maxToken: z.number().int().positive().optional(),
  compactThreshold: compactThresholdSchema,
  headers: z.record(z.string().min(1), z.string()).optional(),
} satisfies Record<string, z.ZodTypeAny>;

const canonicalAiProviderSchema = z.object({
  apiStandard: z.enum(AI_API_STANDARDS),
  vendor: z.string().min(1).optional(),
  profile: z.string().min(1).optional(),
  extensions: z.array(z.string().min(1)).optional(),
  ...sharedFields,
});

const legacyAiProviderSchema = z.object({
  kind: z.enum(LEGACY_AI_PROVIDER_KINDS),
  ...sharedFields,
});

const normalizeBaseUrl = (value: string | undefined): string | undefined => {
  if (!value) {
    return value;
  }
  return value.trim().replace(/\/+$/g, "");
};

const inferVendorFromBaseUrl = (baseUrl: string | undefined): string | undefined => {
  const normalized = normalizeBaseUrl(baseUrl)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized.includes("api.deepseek.com")) {
    return "deepseek";
  }
  if (normalized.includes("api.x.ai") || normalized.includes("x.ai")) {
    return "xai";
  }
  if (normalized.includes("moonshot") || normalized.includes("kimi")) {
    return "kimi";
  }
  if (normalized.includes("bigmodel") || normalized.includes("glm")) {
    return "glm";
  }
  if (normalized.includes("ark.cn-beijing.volces.com") || normalized.includes("volcengine")) {
    return "doubao";
  }
  if (normalized.includes("openrouter.ai")) {
    return "openrouter";
  }
  return undefined;
};

const withSharedFields = (
  input: AiProviderSharedFields,
  patch: Pick<AiProviderSettings, "apiStandard" | "vendor"> & Partial<AiProviderSettings>,
): AiProviderSettings => ({
  apiStandard: patch.apiStandard,
  vendor: patch.vendor,
  profile: patch.profile,
  extensions: patch.extensions,
  model: input.model,
  apiKey: input.apiKey,
  apiKeyEnv: input.apiKeyEnv,
  baseUrl: normalizeBaseUrl(input.baseUrl),
  temperature: input.temperature,
  maxRetries: input.maxRetries,
  maxToken: input.maxToken,
  compactThreshold: input.compactThreshold,
  headers: input.headers,
});

export const normalizeAiProviderSettings = (input: AiProviderInputSettings): AiProviderSettings => {
  if ("apiStandard" in input) {
    return withSharedFields(input, {
      apiStandard: input.apiStandard,
      vendor: input.vendor,
      profile: input.profile,
      extensions: input.extensions,
    });
  }

  switch (input.kind) {
    case "deepseek":
      return withSharedFields(input, { apiStandard: "openai-chat", vendor: "deepseek" });
    case "openai":
      return withSharedFields(input, { apiStandard: "openai-responses", vendor: "openai" });
    case "anthropic":
      return withSharedFields(input, { apiStandard: "anthropic", vendor: "anthropic" });
    case "gemini":
      return withSharedFields(input, { apiStandard: "gemini", vendor: "google" });
    case "grok":
      return withSharedFields(input, { apiStandard: "openai-responses", vendor: "xai" });
    case "ollama":
      return withSharedFields(input, {
        apiStandard: "openai-chat",
        vendor: "ollama",
        profile: "ollama",
      });
    case "anthropic-compatible":
      return withSharedFields(input, {
        apiStandard: "anthropic",
        vendor: inferVendorFromBaseUrl(input.baseUrl),
        profile: "compatible",
      });
    case "openai-compatible":
      return withSharedFields(input, {
        apiStandard: "openai-chat",
        vendor: inferVendorFromBaseUrl(input.baseUrl),
        profile: "compatible",
      });
  }
};

export const aiProviderSchema = z
  .union([canonicalAiProviderSchema, legacyAiProviderSchema])
  .transform((input) => normalizeAiProviderSettings(input));

