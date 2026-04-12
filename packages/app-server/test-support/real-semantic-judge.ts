import { homedir } from "node:os";
import { join } from "node:path";

import { loadSettings } from "@agenter/settings";

import { ModelClient, resolveApiEnvHint, type ModelProviderConfig } from "../src";
import { createSemanticJudge, type SemanticJudge } from "../src/semantic-judge";

export const REAL_SEMANTIC_JUDGE_PROVIDER_ID = "jixoai/agenter/test";

export interface RealSemanticJudgeAvailability {
  available: boolean;
  providerId: string;
  searchedPaths: string[];
  warning?: string;
  config?: ModelProviderConfig;
}

const buildMissingProviderWarning = (input: {
  providerId: string;
  projectSettingsPath: string;
  userSettingsPath: string;
}): string =>
  [
    `Real semantic judge provider "${input.providerId}" is not configured.`,
    `Configure it in ${input.projectSettingsPath} or ${input.userSettingsPath}.`,
  ].join(" ");

export const resolveRealSemanticJudgeAvailability = async (input: {
  projectRoot: string;
  cwd?: string;
  homeDir?: string;
}): Promise<RealSemanticJudgeAvailability> => {
  const homeDir = input.homeDir ?? homedir();
  const projectSettingsPath = join(input.projectRoot, ".agenter", "settings.json");
  const userSettingsPath = join(homeDir, ".agenter", "settings.json");
  const loaded = await loadSettings({
    projectRoot: input.projectRoot,
    cwd: input.cwd ?? input.projectRoot,
    homeDir,
  });
  const provider = loaded.settings.ai?.providers?.[REAL_SEMANTIC_JUDGE_PROVIDER_ID];
  if (!provider) {
    return {
      available: false,
      providerId: REAL_SEMANTIC_JUDGE_PROVIDER_ID,
      searchedPaths: [projectSettingsPath, userSettingsPath],
      warning: buildMissingProviderWarning({
        providerId: REAL_SEMANTIC_JUDGE_PROVIDER_ID,
        projectSettingsPath,
        userSettingsPath,
      }),
    };
  }

  const apiKey = provider.apiKey ?? (provider.apiKeyEnv ? process.env[provider.apiKeyEnv]?.trim() : undefined);
  const config: ModelProviderConfig = {
    providerId: REAL_SEMANTIC_JUDGE_PROVIDER_ID,
    apiStandard: provider.apiStandard,
    vendor: provider.vendor,
    profile: provider.profile,
    extensions: provider.extensions,
    model: provider.model,
    lang: loaded.settings.lang,
    apiKey,
    apiKeyEnv: provider.apiKeyEnv,
    baseUrl: provider.baseUrl,
    headers: provider.headers,
    temperature: provider.temperature ?? 0,
    maxRetries: provider.maxRetries ?? 0,
    maxToken: provider.maxToken,
    compactThreshold: provider.compactThreshold,
  };
  if (!config.baseUrl) {
    return {
      available: false,
      providerId: REAL_SEMANTIC_JUDGE_PROVIDER_ID,
      searchedPaths: [projectSettingsPath, userSettingsPath],
      warning: `Real semantic judge provider "${REAL_SEMANTIC_JUDGE_PROVIDER_ID}" is missing baseUrl.`,
      config,
    };
  }
  if (!apiKey && config.profile !== "ollama" && config.vendor !== "ollama") {
    return {
      available: false,
      providerId: REAL_SEMANTIC_JUDGE_PROVIDER_ID,
      searchedPaths: [projectSettingsPath, userSettingsPath],
      warning: [
        `Real semantic judge provider "${REAL_SEMANTIC_JUDGE_PROVIDER_ID}" is missing credentials.`,
        `Set ${resolveApiEnvHint(config)} or inline apiKey in ${projectSettingsPath} or ${userSettingsPath}.`,
      ].join(" "),
      config,
    };
  }
  return {
    available: true,
    providerId: REAL_SEMANTIC_JUDGE_PROVIDER_ID,
    searchedPaths: [projectSettingsPath, userSettingsPath],
    config,
  };
};

export const createRealSemanticJudge = async (input: {
  projectRoot: string;
  cwd?: string;
  homeDir?: string;
}): Promise<{ judge: SemanticJudge | null; availability: RealSemanticJudgeAvailability }> => {
  const availability = await resolveRealSemanticJudgeAvailability(input);
  if (!availability.available || !availability.config) {
    return {
      judge: null,
      availability,
    };
  }
  return {
    judge: createSemanticJudge(new ModelClient(availability.config)),
    availability,
  };
};
