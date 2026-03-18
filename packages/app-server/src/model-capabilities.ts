import type { ModelProviderConfig } from "./model-client";
import type { ModelCapabilities } from "./types";

const isDeepseekBaseUrl = (baseUrl: string | undefined): boolean => {
  if (!baseUrl) {
    return false;
  }
  return baseUrl.toLowerCase().includes("api.deepseek.com");
};

export const resolveModelCapabilities = (
  config: Pick<ModelProviderConfig, "kind" | "baseUrl">,
): ModelCapabilities => {
  if (config.kind === "deepseek") {
    return { imageInput: false };
  }
  if (config.kind === "ollama") {
    return { imageInput: false };
  }
  if (config.kind === "openai-compatible") {
    return { imageInput: !isDeepseekBaseUrl(config.baseUrl) };
  }
  if (config.kind === "anthropic-compatible") {
    return { imageInput: true };
  }
  if (config.kind === "openai" || config.kind === "anthropic" || config.kind === "gemini" || config.kind === "grok") {
    return { imageInput: true };
  }
  return { imageInput: false };
};
