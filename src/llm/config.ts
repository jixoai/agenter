/**
 * LLM Configuration
 * Pure functions for loading and resolving config
 */
import { loadEnvFile } from "../utils.js";
import path from "path";
import type { LLMConfig } from "./adapters.js";

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
  const configured = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (configured === "deepseek") return "deepseek";
  if (configured === "mock") return "mock";
  if (process.env.DEEPSEEK_API_TOKEN) return "deepseek";
  return "mock";
};

/**
 * Create DeepSeek config from environment
 */
const createDeepSeekConfig = (): LLMConfig => {
  const apiKey = process.env.DEEPSEEK_API_TOKEN;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_TOKEN is not set");
  }

  return {
    apiKey,
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
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
    storageDir: process.env.AGENTER_STORAGE_DIR,
  };
};
