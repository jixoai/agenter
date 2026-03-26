import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { settingsSchema, type AiApiStandard } from "@agenter/settings";

import { stableStringify } from "../src/loopbus-kernel";

const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
const DEFAULT_CACHE_NAMESPACE = "openai-chat";
const SUPPORTED_PROXY_STANDARDS = new Set<AiApiStandard>(["openai-chat"]);

export interface RealModelConfig {
  apiStandard: AiApiStandard;
  apiKey: string;
  baseUrl: string;
  model: string;
  vendor: string;
  profile?: string;
  headers?: Record<string, string>;
}

export interface CachedModelProxyHandle {
  mode: "real";
  config: RealModelConfig;
  cacheDir: string;
  stop: () => Promise<void>;
}

interface DotEnvRecord {
  [key: string]: string;
}

interface CachedModelResponse {
  version: 1;
  createdAt: string;
  upstreamBaseUrl: string;
  requestPath: string;
  request: unknown;
  response: unknown;
}

const trimTrailingSlash = (value: string): string => value.trim().replace(/\/+$/g, "");

const normalizeBaseUrl = (apiStandard: AiApiStandard, value: string): string => {
  const trimmed = trimTrailingSlash(value);
  if (apiStandard === "anthropic") {
    return trimmed.replace(/\/v1$/u, "");
  }
  if (trimmed.endsWith("/v1")) {
    return trimmed;
  }
  return `${trimmed}/v1`;
};

const parseDotEnvText = (text: string): DotEnvRecord => {
  const values: DotEnvRecord = {};
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
};

const readDotEnvFile = (path: string): DotEnvRecord => {
  if (!existsSync(path)) {
    return {};
  }
  return parseDotEnvText(readFileSync(path, "utf8"));
};

const resolveEnvValue = (env: DotEnvRecord, key: string): string | undefined => {
  const runtimeValue = process.env[key];
  if (typeof runtimeValue === "string" && runtimeValue.trim().length > 0) {
    return runtimeValue.trim();
  }
  const fileValue = env[key];
  return typeof fileValue === "string" && fileValue.trim().length > 0 ? fileValue.trim() : undefined;
};

const resolveLegacyDotEnvConfig = (env: DotEnvRecord): RealModelConfig | null => {
  const apiKey = resolveEnvValue(env, "DEEPSEEK_API_KEY");
  if (!apiKey) {
    return null;
  }

  const baseUrl = resolveEnvValue(env, "DEEPSEEK_BASE_URL") ?? DEFAULT_DEEPSEEK_BASE_URL;
  const model = resolveEnvValue(env, "DEEPSEEK_MODEL") ?? DEFAULT_DEEPSEEK_MODEL;

  return {
    apiStandard: "openai-chat",
    apiKey,
    baseUrl: normalizeBaseUrl("openai-chat", baseUrl),
    model,
    vendor: "deepseek",
  };
};

const resolveExplicitEnvConfig = (env: DotEnvRecord): RealModelConfig | null => {
  const apiKey = resolveEnvValue(env, "AGENTER_REAL_AI_API_KEY");
  if (!apiKey) {
    return null;
  }

  const apiStandard = (resolveEnvValue(env, "AGENTER_REAL_AI_API_STANDARD") as AiApiStandard | undefined) ?? "openai-chat";
  const baseUrl = resolveEnvValue(env, "AGENTER_REAL_AI_BASE_URL");
  const model = resolveEnvValue(env, "AGENTER_REAL_AI_MODEL");
  if (!baseUrl || !model) {
    return null;
  }

  return {
    apiStandard,
    apiKey,
    baseUrl: normalizeBaseUrl(apiStandard, baseUrl),
    model,
    vendor: resolveEnvValue(env, "AGENTER_REAL_AI_VENDOR") ?? "real",
  };
};

const resolveUserSettingsConfig = (): RealModelConfig | null => {
  const settingsPath = join(homedir(), ".agenter", "settings.json");
  if (!existsSync(settingsPath)) {
    return null;
  }

  const parsed = settingsSchema.parse(JSON.parse(readFileSync(settingsPath, "utf8")) as unknown);
  const ai = parsed.ai;
  if (!ai?.providers || Object.keys(ai.providers).length === 0) {
    return null;
  }

  const preferredProviderId = process.env.AGENTER_REAL_AI_PROVIDER?.trim() || ai.activeProvider;
  const providerId = preferredProviderId && ai.providers[preferredProviderId] ? preferredProviderId : Object.keys(ai.providers)[0];
  const provider = ai.providers[providerId];
  if (!provider) {
    return null;
  }

  const apiKey = provider.apiKey ?? (provider.apiKeyEnv ? process.env[provider.apiKeyEnv]?.trim() : undefined);
  if (!apiKey || !provider.baseUrl) {
    return null;
  }

  return {
    apiStandard: provider.apiStandard,
    apiKey,
    baseUrl: normalizeBaseUrl(provider.apiStandard, provider.baseUrl),
    model: provider.model,
    vendor: provider.vendor ?? provider.apiStandard,
    profile: provider.profile,
    headers: provider.headers,
  };
};

export const resolveRealModelConfig = (projectRoot: string): RealModelConfig | null => {
  const envFile = readDotEnvFile(resolve(projectRoot, "demo/.env"));
  return resolveExplicitEnvConfig(envFile) ?? resolveUserSettingsConfig() ?? resolveLegacyDotEnvConfig(envFile);
};

export const canProxyRealModelConfig = (config: RealModelConfig): boolean =>
  SUPPORTED_PROXY_STANDARDS.has(config.apiStandard);

const buildCachePath = (cacheDir: string, key: string): string => join(cacheDir, `${key}.json`);

const buildCacheKey = (input: { upstreamBaseUrl: string; requestPath: string; request: unknown }): string =>
  createHash("sha256")
    .update(
      stableStringify({
        v: 1,
        upstreamBaseUrl: input.upstreamBaseUrl,
        requestPath: input.requestPath,
        request: input.request,
      }),
    )
    .digest("hex");

const readRequestBody = async (request: import("node:http").IncomingMessage): Promise<string> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

export const startCachedRealModelProxy = async (input: {
  host: string;
  port: number;
  config: RealModelConfig;
  cacheDir?: string;
}): Promise<CachedModelProxyHandle> => {
  if (!canProxyRealModelConfig(input.config)) {
    throw new Error(`real-model proxy does not support apiStandard=${input.config.apiStandard}`);
  }

  const cacheDir =
    input.cacheDir ??
    join(homedir(), ".agenter", "model-response-cache", input.config.vendor, DEFAULT_CACHE_NAMESPACE, input.config.model);
  await mkdir(cacheDir, { recursive: true });

  const server = createHttpServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method !== "POST" || requestUrl.pathname !== "/v1/chat/completions") {
      response.statusCode = 404;
      response.end("not found");
      return;
    }

    const rawBody = await readRequestBody(request);
    const parsedBody = JSON.parse(rawBody) as unknown;
    const cacheKey = buildCacheKey({
      upstreamBaseUrl: input.config.baseUrl,
      requestPath: requestUrl.pathname,
      request: parsedBody,
    });
    const cachePath = buildCachePath(cacheDir, cacheKey);

    if (existsSync(cachePath)) {
      const cached = JSON.parse(await readFile(cachePath, "utf8")) as CachedModelResponse;
      response.statusCode = 200;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.setHeader("x-agenter-model-cache", "hit");
      response.end(JSON.stringify(cached.response));
      return;
    }

    const upstreamResponse = await fetch(`${input.config.baseUrl}/chat/completions${requestUrl.search}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.config.apiKey}`,
        "Content-Type": "application/json",
        ...(input.config.headers ?? {}),
      },
      body: rawBody,
    });
    const responseText = await upstreamResponse.text();
    const contentType = upstreamResponse.headers.get("content-type") ?? "application/json; charset=utf-8";

    response.statusCode = upstreamResponse.status;
    response.setHeader("content-type", contentType);
    response.setHeader("x-agenter-model-cache", "miss");
    response.end(responseText);

    if (!upstreamResponse.ok || !contentType.includes("application/json")) {
      return;
    }

    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(responseText) as unknown;
    } catch {
      return;
    }

    const cached: CachedModelResponse = {
      version: 1,
      createdAt: new Date().toISOString(),
      upstreamBaseUrl: input.config.baseUrl,
      requestPath: requestUrl.pathname,
      request: parsedBody,
      response: parsedResponse,
    };
    await writeFile(cachePath, `${JSON.stringify(cached, null, 2)}\n`, "utf8");
  });

  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("error", rejectReady);
    server.listen(input.port, input.host, () => resolveReady());
  });

  return {
    mode: "real",
    config: input.config,
    cacheDir,
    stop: async () => {
      await new Promise<void>((resolveStop, rejectStop) => {
        server.close((error) => {
          if (error) {
            rejectStop(error);
            return;
          }
          resolveStop();
        });
      });
    },
  };
};
