import { describe, expect, test } from "bun:test";

import { ModelClient, resolveApiEnvHint, resolveModelCapabilities } from "../src";

describe("Feature: canonical model provider routing", () => {
  test("Scenario: Given a DeepSeek-compatible chat provider When resolving capabilities Then vendor overrides are applied on top of the standard", () => {
    const capabilities = resolveModelCapabilities({
      apiStandard: "openai-chat",
      vendor: "deepseek",
      profile: "compatible",
      baseUrl: "https://api.deepseek.com/v1",
      extensions: ["file-upload"],
    });

    expect(capabilities).toEqual({
      streaming: true,
      tools: true,
      imageInput: false,
      nativeCompact: false,
      summarizeFallback: true,
      fileUpload: true,
      mcpCatalog: false,
    });
  });

  test("Scenario: Given a canonical provider When inspecting model metadata Then the client exposes API standard, vendor, and capabilities", () => {
    const client = new ModelClient({
      providerId: "glm-main",
      apiStandard: "anthropic",
      vendor: "glm",
      profile: "compatible",
      model: "glm-4.5",
      apiKey: "sk-test",
      baseUrl: "https://open.bigmodel.cn/api/anthropic",
      temperature: 0.2,
      maxRetries: 2,
    });

    const meta = client.getMeta();
    expect(meta.providerId).toBe("glm-main");
    expect(meta.apiStandard).toBe("anthropic");
    expect(meta.vendor).toBe("glm");
    expect(meta.profile).toBe("compatible");
    expect(meta.capabilities.tools).toBe(true);
    expect(meta.capabilities.imageInput).toBe(true);
  });

  test("Scenario: Given a provider without a token When responding Then the missing credential hint follows the canonical provider metadata", async () => {
    const client = new ModelClient({
      providerId: "deepseek-main",
      apiStandard: "openai-chat",
      vendor: "deepseek",
      model: "deepseek-chat",
      temperature: 0.2,
      maxRetries: 1,
    });

    const response = await client.respondWithMeta({
      systemPrompt: "You are helpful.",
      messages: [],
      tools: [],
    });

    expect(resolveApiEnvHint({ apiStandard: "openai-chat", vendor: "deepseek" })).toBe("DEEPSEEK_API_KEY");
    expect(response.text).toContain("DEEPSEEK_API_KEY");
  });
});
