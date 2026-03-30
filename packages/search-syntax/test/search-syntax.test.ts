import { describe, expect, test } from "bun:test";

import { diagnoseSearchSyntax, formatSearchSyntax, parseSearchSyntax } from "../src";

describe("Feature: search query syntax parsing", () => {
  test("Scenario: Given field clauses, booleans, and phrases When parsing Then the AST preserves their structure", () => {
    const parsed = parseSearchSyntax('author:avatar:jane AND "weather report" OR source:terminal');
    expect(parsed).toEqual({
      type: "boolean",
      operator: "OR",
      children: [
        {
          type: "boolean",
          operator: "AND",
          children: [
            { type: "text", field: "author", value: "avatar:jane", quoted: false },
            { type: "text", value: "weather report", quoted: true },
          ],
        },
        { type: "text", field: "source", value: "terminal", quoted: false },
      ],
    });
  });

  test("Scenario: Given grouped logic and comparisons When formatting Then the query round-trips to normalized syntax", () => {
    const parsed = parseSearchSyntax('(source:terminal OR source:message) AND createdAt:>2026-03-01');
    expect(formatSearchSyntax(parsed)).toBe("(source:terminal OR source:message) AND createdAt:>2026-03-01");
  });

  test("Scenario: Given adjacent clauses without explicit operator When parsing Then they become implicit conjunction", () => {
    const parsed = parseSearchSyntax("context:ctx-chat-main weather source:terminal");
    expect(parsed).toEqual({
      type: "boolean",
      operator: "AND",
      children: [
        { type: "text", field: "context", value: "ctx-chat-main", quoted: false },
        { type: "text", value: "weather", quoted: false },
        { type: "text", field: "source", value: "terminal", quoted: false },
      ],
    });
  });

  test("Scenario: Given invalid syntax When diagnosing Then the parser returns an explicit error", () => {
    expect(diagnoseSearchSyntax('"unfinished')).toEqual([
      {
        message: "Unterminated quoted string",
        index: 0,
      },
    ]);
  });
});
