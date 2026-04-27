import { createServer, type IncomingMessage } from "node:http";

import { toolDefinition } from "@tanstack/ai";
import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { ModelClient, ModelDecisionError, type AssistantDeliveryEvent } from "../src";

type MockResponsePlan =
  | {
      kind: "drop";
    }
  | {
      kind: "json";
      status?: number;
      body: unknown;
      contentType?: string;
    };

const readBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
};

const buildCompletion = (content: string) => ({
  id: "mock-completion",
  object: "chat.completion",
  created: Math.floor(Date.now() / 1_000),
  model: "mock-loopbus",
  choices: [
    {
      index: 0,
      finish_reason: "stop",
      message: {
        role: "assistant",
        content,
      },
    },
  ],
  usage: {
    prompt_tokens: 7,
    completion_tokens: 3,
    total_tokens: 10,
  },
});

const buildToolCallCompletion = () => ({
  id: "mock-tool-call",
  object: "chat.completion",
  created: Math.floor(Date.now() / 1_000),
  model: "mock-loopbus",
  choices: [
    {
      index: 0,
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_probe_1",
            type: "function",
            function: {
              name: "probe_tool",
              arguments: JSON.stringify({ value: "from-model" }),
            },
          },
        ],
      },
    },
  ],
  usage: {
    prompt_tokens: 11,
    completion_tokens: 4,
    total_tokens: 15,
  },
});

const parseRequestMessages = (body: string): Array<Record<string, unknown>> => {
  const parsed = JSON.parse(body) as { messages?: unknown };
  if (!Array.isArray(parsed.messages)) {
    throw new Error("expected messages array");
  }
  return parsed.messages.map((message) => {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      throw new Error("expected message object");
    }
    return message as Record<string, unknown>;
  });
};

const startOpenAICompatServer = async (plans: readonly MockResponsePlan[]) => {
  const requests: string[] = [];
  let requestCount = 0;
  const server = createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "not found" } }));
      return;
    }

    const plan = plans[Math.min(requestCount, plans.length - 1)];
    requestCount += 1;
    requests.push(await readBody(request));

    if (!plan || plan.kind === "drop") {
      request.socket.destroy();
      return;
    }

    response.writeHead(plan.status ?? 200, {
      "content-type": plan.contentType ?? "application/json",
    });
    response.end(JSON.stringify(plan.body));
  });

  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("error", rejectReady);
    server.listen(0, "127.0.0.1", () => resolveReady());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("expected inet address from mock model server");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    stop: async () => {
      await new Promise<void>((resolveClose, rejectClose) =>
        server.close((error) => (error ? rejectClose(error) : resolveClose())),
      );
    },
  };
};

const createClient = (baseUrl: string, maxRetries: number) =>
  new ModelClient({
    providerId: "mock-openai",
    apiStandard: "openai-chat",
    vendor: "mock",
    profile: "compatible",
    model: "mock-loopbus",
    apiKey: "sk-test",
    baseUrl,
    temperature: 0,
    maxRetries,
  });

const probeTool = toolDefinition({
  name: "probe_tool",
  description: "Return a deterministic probe result.",
  inputSchema: z.object({
    value: z.string(),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    value: z.string(),
  }),
}).server((input) => ({
  ok: true,
  value: input.value,
}));

describe("Feature: ModelClient delivery receipts", () => {
  test("Scenario: Given the provider cannot be called because credentials are missing When a round starts Then ModelClient emits one transport error receipt and throws instead of returning fallback assistant text", async () => {
    const deliveryEvents: AssistantDeliveryEvent[] = [];
    const client = new ModelClient({
      providerId: "deepseek-main",
      apiStandard: "openai-chat",
      vendor: "deepseek",
      model: "deepseek-chat",
      temperature: 0,
      maxRetries: 1,
    });

    await expect(
      client.respondWithMeta({
        systemPrompt: "You are helpful.",
        messages: [],
        tools: [],
        onDeliveryEvent: (event) => {
          deliveryEvents.push(event);
        },
      }),
    ).rejects.toMatchObject({
      name: "ModelDecisionError",
      message: expect.stringContaining("DEEPSEEK_API_KEY"),
      deliveryError: {
        providerEventKind: "transport_error",
        errorMessage: expect.stringContaining("DEEPSEEK_API_KEY"),
      },
    });

    expect(
      deliveryEvents.map((event) =>
        event.kind === "attempt_started"
          ? `start:${event.attemptIndex}`
          : `${event.attemptIndex}:${event.status}:${event.providerEventKind}`,
      ),
    ).toEqual(["start:1", "1:errored:transport_error"]);
  });

  test("Scenario: Given staged committed attention after a tool call When the provider loop continues Then the next HTTP request contains tool result plus staged user message", async () => {
    const server = await startOpenAICompatServer([
      { kind: "json", body: buildToolCallCompletion() },
      { kind: "json", body: buildCompletion("final after staged attention") },
    ]);
    let consumeCount = 0;
    let yieldCheckCount = 0;

    try {
      const client = createClient(server.baseUrl, 0);
      const response = await client.respondWithMeta({
        systemPrompt: "You are helpful.",
        messages: [{ role: "user", content: "initial user request" }],
        tools: [probeTool],
        consumeCommittedAttentionMessages: ({ finishReason, messages }) => {
          consumeCount += 1;
          expect(finishReason).toBe("tool_calls");
          expect(messages.some((message) => message.role === "tool")).toBeTrue();
          return [{ role: "user", content: "STAGED-ATTENTION-MESSAGE" }];
        },
        shouldYieldAfterToolPhase: () => {
          yieldCheckCount += 1;
          return true;
        },
      });

      expect(response.text).toBe("final after staged attention");
      expect(response.yieldedAfterToolPhase).toBe(false);
      expect(consumeCount).toBe(1);
      expect(yieldCheckCount).toBe(0);
      expect(server.requests).toHaveLength(2);

      const secondMessages = parseRequestMessages(server.requests[1] ?? "");
      const toolMessageIndex = secondMessages.findIndex((message) => message.role === "tool");
      const stagedMessageIndex = secondMessages.findIndex(
        (message) => message.role === "user" && message.content === "STAGED-ATTENTION-MESSAGE",
      );
      expect(toolMessageIndex).toBeGreaterThan(-1);
      expect(stagedMessageIndex).toBeGreaterThan(toolMessageIndex);
    } finally {
      await server.stop();
    }
  });

  test("Scenario: Given the first provider attempt collapses before any usable reply When the retry succeeds Then ModelClient keeps one errored attempt followed by accepted and completed receipts", async () => {
    const server = await startOpenAICompatServer([
      { kind: "drop" },
      { kind: "json", body: buildCompletion("recovered on retry") },
    ]);
    const deliveryEvents: AssistantDeliveryEvent[] = [];

    try {
      const client = createClient(server.baseUrl, 1);
      const response = await client.respondWithMeta({
        systemPrompt: "You are helpful.",
        messages: [],
        tools: [],
        onDeliveryEvent: (event) => {
          deliveryEvents.push(event);
        },
      });

      expect(response.text).toBe("recovered on retry");
      expect(server.requests).toHaveLength(2);
      expect(
        deliveryEvents.map((event) =>
          event.kind === "attempt_started"
            ? `start:${event.attemptIndex}`
            : `${event.attemptIndex}:${event.status}:${event.providerEventKind}`,
        ),
      ).toEqual([
        "start:1",
        "1:errored:run_error",
        "start:2",
        "2:accepted:text_delta",
        "2:completed:run_finished",
      ]);

      const firstAttemptError = deliveryEvents[1];
      if (!firstAttemptError || firstAttemptError.kind !== "receipt") {
        throw new Error("expected first attempt receipt");
      }
      expect(firstAttemptError.errorMessage?.length ?? 0).toBeGreaterThan(0);
    } finally {
      await server.stop();
    }
  });

  test("Scenario: Given every provider attempt collapses before a usable reply When retries are exhausted Then ModelClient records exactly one errored receipt per attempt", async () => {
    const server = await startOpenAICompatServer([{ kind: "drop" }, { kind: "drop" }]);
    const deliveryEvents: AssistantDeliveryEvent[] = [];

    try {
      const client = createClient(server.baseUrl, 1);
      await expect(
        client.respondWithMeta({
          systemPrompt: "You are helpful.",
          messages: [],
          tools: [],
          onDeliveryEvent: (event) => {
            deliveryEvents.push(event);
          },
        }),
      ).rejects.toBeInstanceOf(ModelDecisionError);

      expect(server.requests).toHaveLength(2);
      expect(
        deliveryEvents.map((event) =>
          event.kind === "attempt_started"
            ? `start:${event.attemptIndex}`
            : `${event.attemptIndex}:${event.status}:${event.providerEventKind}`,
        ),
      ).toEqual([
        "start:1",
        "1:errored:run_error",
        "start:2",
        "2:errored:run_error",
      ]);
      expect(
        deliveryEvents.filter((event) => event.kind === "receipt" && event.status === "errored"),
      ).toHaveLength(2);
    } finally {
      await server.stop();
    }
  });

  test("Scenario: Given the provider returns a first-frame HTTP failure When no retries remain Then ModelClient emits a single run_error receipt without a duplicate fallback receipt", async () => {
    const server = await startOpenAICompatServer([
      {
        kind: "json",
        status: 503,
        body: { error: { message: "provider unavailable" } },
        contentType: "application/json",
      },
    ]);
    const deliveryEvents: AssistantDeliveryEvent[] = [];

    try {
      const client = createClient(server.baseUrl, 0);
      await expect(
        client.respondWithMeta({
          systemPrompt: "You are helpful.",
          messages: [],
          tools: [],
          onDeliveryEvent: (event) => {
            deliveryEvents.push(event);
          },
        }),
      ).rejects.toBeInstanceOf(ModelDecisionError);

      expect(server.requests).toHaveLength(1);
      expect(
        deliveryEvents.map((event) =>
          event.kind === "attempt_started"
            ? `start:${event.attemptIndex}`
            : `${event.attemptIndex}:${event.status}:${event.providerEventKind}`,
        ),
      ).toEqual(["start:1", "1:errored:run_error"]);
      expect(
        deliveryEvents.filter((event) => event.kind === "receipt" && event.status === "errored"),
      ).toHaveLength(1);
    } finally {
      await server.stop();
    }
  });
});
