import { describe, expect, test } from "bun:test";

import { ModelClient, ModelDecisionError, resolveApiEnvHint, resolveModelCapabilities } from "../src";

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

  test("Scenario: Given a provider without a token When responding Then the client raises a transport delivery error with the canonical credential hint", async () => {
    const client = new ModelClient({
      providerId: "deepseek-main",
      apiStandard: "openai-chat",
      vendor: "deepseek",
      model: "deepseek-chat",
      temperature: 0.2,
      maxRetries: 1,
    });

    expect(resolveApiEnvHint({ apiStandard: "openai-chat", vendor: "deepseek" })).toBe("DEEPSEEK_API_KEY");
    await expect(
      client.respondWithMeta({
        systemPrompt: "You are helpful.",
        messages: [],
        tools: [],
      }),
    ).rejects.toMatchObject({
      name: "ModelDecisionError",
      message: expect.stringContaining("DEEPSEEK_API_KEY"),
      deliveryError: {
        providerEventKind: "transport_error",
        errorMessage: expect.stringContaining("DEEPSEEK_API_KEY"),
      },
    });
  });

  test("Scenario: Given the provider returns RUN_ERROR When responding Then the client throws a model decision error instead of silently returning no-progress", async () => {
    const originalFetch = globalThis.fetch;
    const mockedFetch: typeof fetch = Object.assign(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ error: { message: "Insufficient Balance", code: "invalid_request_error" } }), {
          status: 402,
          headers: { "content-type": "application/json" },
        }),
      originalFetch,
    );
    globalThis.fetch = mockedFetch;

    try {
      const client = new ModelClient({
        providerId: "deepseek-main",
        apiStandard: "openai-chat",
        vendor: "deepseek",
        model: "deepseek-chat",
        apiKey: "sk-test",
        baseUrl: "https://api.deepseek.com/v1",
        temperature: 0,
        maxRetries: 0,
      });

      await expect(
        client.respondWithMeta({
          systemPrompt: "You are helpful.",
          messages: [],
          tools: [],
        }),
      ).rejects.toBeInstanceOf(ModelDecisionError);

      await expect(
        client.respondWithMeta({
          systemPrompt: "You are helpful.",
          messages: [],
          tools: [],
        }),
      ).rejects.toThrow("402 status code");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Scenario: Given an anthropic provider with maxToken configured When responding Then the outbound request forwards max_tokens instead of falling back to the adapter default", async () => {
    const originalFetch = globalThis.fetch;
    let capturedBody: Record<string, unknown> | null = null;
    const mockedFetch: typeof fetch = Object.assign(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedBody = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
        return new Response(JSON.stringify({ error: { type: "invalid_request_error", message: "forced failure" } }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      },
      originalFetch,
    );
    globalThis.fetch = mockedFetch;

    try {
      const client = new ModelClient({
        providerId: "anthropic-main",
        apiStandard: "anthropic",
        vendor: "anthropic",
        model: "claude-sonnet-4-20250514",
        apiKey: "sk-test",
        baseUrl: "https://api.anthropic.com",
        temperature: 0,
        maxRetries: 0,
        maxToken: 4096,
      });

      await expect(
        client.respondWithMeta({
          systemPrompt: "You are helpful.",
          messages: [],
          tools: [],
        }),
      ).rejects.toBeInstanceOf(ModelDecisionError);

      const body = capturedBody;
      if (body === null) {
        throw new Error("expected anthropic request body");
      }
      expect(body).toMatchObject({ max_tokens: 4096 });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
