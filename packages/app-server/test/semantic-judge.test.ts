import { describe, expect, test } from "bun:test";
import { z } from "zod";

import {
  SemanticJudgeDecisionError,
  createSemanticJudge,
  judgeContainsUrl,
  judgeUrlSpan,
  type SemanticJudgeModelClient,
} from "../src";

const createStubModelClient = (
  handler: SemanticJudgeModelClient["respondWithMeta"],
): {
  client: SemanticJudgeModelClient;
  calls: Parameters<SemanticJudgeModelClient["respondWithMeta"]>[0][];
} => {
  const calls: Parameters<SemanticJudgeModelClient["respondWithMeta"]>[0][] = [];
  return {
    client: {
      async respondWithMeta(input) {
        calls.push(input);
        return handler(input);
      },
    },
    calls,
  };
};

describe("Feature: semantic judge primitives", () => {
  test("Scenario: Given a boolean semantic decision When the judge runs Then it uses deterministic low-token settings and returns a boolean", async () => {
    const { client, calls } = createStubModelClient(async () => ({
      thinking: "",
      text: "1",
    }));
    const judge = createSemanticJudge(client);

    await expect(
      judge.judgeBoolean({
        instruction: "如果内容中包含 URL，判断为是。",
        content: "This is the backend url: http://localhost:12555",
      }),
    ).resolves.toBe(true);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.temperature).toBe(0);
    expect(calls[0]?.maxTokens).toBe(1);
  });

  test("Scenario: Given a completion-style span decision When the judge runs Then it continues from the prefix and parses the range", async () => {
    const { client, calls } = createStubModelClient(async () => ({
      thinking: "",
      text: "25, 47]",
    }));
    const judge = createSemanticJudge(client);

    await expect(
      judge.judgeSpan({
        instruction: "如果内容中包含 URL，返回该 URL 在原文中的下标范围。",
        content: "This is the backend url: http://localhost:12555",
      }),
    ).resolves.toEqual({ start: 25, end: 47 });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.messages.at(-1)?.role).toBe("assistant");
    expect(calls[0]?.messages.at(-1)?.content).toBe("[");
  });

  test("Scenario: Given a structured semantic decision When the judge runs Then the returned JSON is validated against the schema", async () => {
    const { client } = createStubModelClient(async () => ({
      thinking: "",
      text: '{"s":25,"e":47}',
    }));
    const judge = createSemanticJudge(client);

    await expect(
      judge.judgeStructured({
        instruction: "返回 URL 范围。",
        content: "This is the backend url: http://localhost:12555",
        outputSchema: z.object({
          s: z.number().int(),
          e: z.number().int(),
        }),
      }),
    ).resolves.toEqual({ s: 25, e: 47 });
  });

  test("Scenario: Given an invalid boolean token When the judge parses the result Then it throws a semantic judge error", async () => {
    const { client } = createStubModelClient(async () => ({
      thinking: "",
      text: "maybe",
    }));
    const judge = createSemanticJudge(client);

    await expect(
      judge.judgeBoolean({
        instruction: "如果内容中包含 URL，判断为是。",
        content: "This is the backend url: http://localhost:12555",
      }),
    ).rejects.toBeInstanceOf(SemanticJudgeDecisionError);
  });

  test("Scenario: Given content without URL-like signal When judgeContainsUrl runs Then it returns false without paying for a model call", async () => {
    let modelCalls = 0;
    const { client } = createStubModelClient(async () => {
      modelCalls += 1;
      return {
        thinking: "",
        text: "1",
      };
    });
    const judge = createSemanticJudge(client);

    await expect(judgeContainsUrl(judge, "today we only discuss lunch")).resolves.toBe(false);
    expect(modelCalls).toBe(0);
  });

  test("Scenario: Given content with URL-like signal When URL helpers run Then they delegate to the semantic judge layer", async () => {
    const responses = ["1", "25, 47]"];
    const { client } = createStubModelClient(async () => ({
      thinking: "",
      text: responses.shift() ?? "0",
    }));
    const judge = createSemanticJudge(client);
    const content = "This is the backend url: http://localhost:12555";

    await expect(judgeContainsUrl(judge, content)).resolves.toBe(true);
    await expect(judgeUrlSpan(judge, content)).resolves.toEqual({ start: 25, end: 47 });
  });
});
