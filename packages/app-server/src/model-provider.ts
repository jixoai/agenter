import type { AiApiStandard } from "@agenter/settings";

import type { ModelCapabilities } from "./types";

export interface ModelProviderConfig {
  providerId: string;
  apiStandard: AiApiStandard;
  vendor?: string;
  profile?: string;
  extensions?: string[];
  model: string;
  lang?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  temperature: number;
  maxRetries: number;
  maxToken?: number;
  compactThreshold?: number;
}

export interface ModelVendorExtension {
  id: string;
  patchCapabilities?: (capabilities: ModelCapabilities, config: ModelProviderConfig) => void;
  patchHeaders?: (headers: Record<string, string>, config: ModelProviderConfig) => void;
}

const isVendor = (config: Pick<ModelProviderConfig, "vendor">, vendor: string): boolean =>
  config.vendor?.toLowerCase() === vendor;

const MODEL_VENDOR_EXTENSIONS: Record<string, ModelVendorExtension> = {
  "file-upload": {
    id: "file-upload",
    patchCapabilities: (capabilities) => {
      capabilities.fileUpload = true;
    },
  },
  "mcp-catalog": {
    id: "mcp-catalog",
    patchCapabilities: (capabilities) => {
      capabilities.mcpCatalog = true;
    },
  },
};

export const isDeepseekVendor = (config: Pick<ModelProviderConfig, "vendor" | "baseUrl">): boolean => {
  if (isVendor(config, "deepseek")) {
    return true;
  }
  return config.baseUrl?.toLowerCase().includes("api.deepseek.com") ?? false;
};

export const isOllamaProvider = (config: Pick<ModelProviderConfig, "vendor" | "profile">): boolean =>
  isVendor(config, "ollama") || config.profile === "ollama";

export const resolveApiEnvHint = (config: Pick<ModelProviderConfig, "apiKeyEnv" | "apiStandard" | "vendor">): string => {
  if (config.apiKeyEnv?.trim()) {
    return config.apiKeyEnv.trim();
  }
  if (config.vendor === "deepseek") {
    return "DEEPSEEK_API_KEY";
  }
  if (config.apiStandard === "anthropic") {
    return "ANTHROPIC_API_KEY";
  }
  if (config.apiStandard === "gemini") {
    return "GOOGLE_API_KEY/GEMINI_API_KEY";
  }
  return "OPENAI_API_KEY";
};

export const canCallModel = (config: Pick<ModelProviderConfig, "vendor" | "profile" | "apiKey">): boolean => {
  if (isOllamaProvider(config)) {
    return true;
  }
  return Boolean(config.apiKey && config.apiKey.trim().length > 0);
};

export const resolveModelVendorExtensions = (config: Pick<ModelProviderConfig, "extensions">): ModelVendorExtension[] =>
  (config.extensions ?? [])
    .map((extensionId) => MODEL_VENDOR_EXTENSIONS[extensionId])
    .filter((extension): extension is ModelVendorExtension => Boolean(extension));

export const resolveProviderHeaders = (config: Pick<ModelProviderConfig, "headers" | "extensions">): Record<string, string> | undefined => {
  const headers = { ...(config.headers ?? {}) };
  for (const extension of resolveModelVendorExtensions(config)) {
    extension.patchHeaders?.(headers, config as ModelProviderConfig);
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
};

const baseCapabilitiesForStandard = (apiStandard: AiApiStandard): ModelCapabilities => {
  switch (apiStandard) {
    case "gemini":
      return {
        streaming: true,
        tools: true,
        imageInput: true,
        nativeCompact: false,
        summarizeFallback: true,
        fileUpload: false,
        mcpCatalog: false,
      };
    case "anthropic":
      return {
        streaming: true,
        tools: true,
        imageInput: true,
        nativeCompact: false,
        summarizeFallback: true,
        fileUpload: false,
        mcpCatalog: false,
      };
    case "openai-responses":
      return {
        streaming: true,
        tools: true,
        imageInput: true,
        nativeCompact: true,
        summarizeFallback: true,
        fileUpload: false,
        mcpCatalog: false,
      };
    case "openai-chat":
      return {
        streaming: true,
        tools: true,
        imageInput: false,
        nativeCompact: false,
        summarizeFallback: true,
        fileUpload: false,
        mcpCatalog: false,
      };
    case "openai-completion":
      return {
        streaming: true,
        tools: false,
        imageInput: false,
        nativeCompact: false,
        summarizeFallback: true,
        fileUpload: false,
        mcpCatalog: false,
      };
  }
};

export const resolveModelCapabilities = (
  config: Pick<ModelProviderConfig, "apiStandard" | "vendor" | "profile" | "baseUrl" | "extensions">,
): ModelCapabilities => {
  const capabilities = baseCapabilitiesForStandard(config.apiStandard);

  if (isDeepseekVendor(config)) {
    capabilities.imageInput = false;
    capabilities.nativeCompact = false;
  }
  if (isOllamaProvider(config)) {
    capabilities.imageInput = false;
    capabilities.fileUpload = false;
  }

  for (const extension of resolveModelVendorExtensions(config)) {
    extension.patchCapabilities?.(capabilities, config as ModelProviderConfig);
  }

  return capabilities;
};
