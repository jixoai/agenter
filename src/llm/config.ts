/**
 * LLM Configuration
 * Pure functions for loading and resolving config
 */
import { loadEnvFile } from "../utils.js";
import path from "path";
import type { LLMConfig } from "./adapters.js";
import { llmConfig, storageConfig } from "../env.js";

// ============================================================================
// Types
// ============================================================================

export interface ResolvedConfig {
  provider: "deepseek" | "mock";
  llmConfig?: LLMConfig;
  storageDir?: string;
}

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * Resolve LLM provider from environment
 */
const resolveProvider = (): "deepseek" | "mock" => {
  const configured = llmConfig.provider.trim().toLowerCase();
  if (configured === "deepseek") return "deepseek";
  if (configured === "mock") return "mock";
  try {
    const _ = llmConfig.apiToken; // 检查是否设置了 token
    return "deepseek";
  } catch {
    return "mock";
  }
};

/**
 * Create DeepSeek config from environment
 */
const createDeepSeekConfig = (): LLMConfig => {
  return {
    apiKey: llmConfig.apiToken,
    baseUrl: llmConfig.baseUrl,
    model: llmConfig.model,
    temperature: 0,
  };
};

/**
 * Load runtime configuration
 * @param envPath - Path to .env file
 * @returns Resolved configuration
 */
export const loadRuntimeConfig = async (
  envPath: string = path.resolve(".env")
): Promise<ResolvedConfig> => {
  await loadEnvFile(envPath);

  const provider = resolveProvider();

  return {
    provider,
    llmConfig: provider === "deepseek" ? createDeepSeekConfig() : undefined,
    storageDir: storageConfig.dir,
  };
};
