import { describe, expect, test } from "vitest";

import { findWorkspacePathToken, replaceWorkspacePathToken } from "../src/features/chat/ai-input-logic";

describe("Feature: AI input path token logic", () => {
  test("Scenario: Given the user only typed @ When resolving a workspace token Then the token stays completable for quick path lookup", () => {
    expect(findWorkspacePathToken("Open @", 6)).toEqual({
      from: 5,
      to: 6,
      query: "",
      raw: "@",
    });
  });

  test("Scenario: Given an @ token When applying a workspace path Then the inserted text keeps the @ addressing semantics", () => {
    expect(replaceWorkspacePathToken("Open @src/i", { from: 5, to: 11 }, "src/index.ts")).toEqual({
      value: "Open @src/index.ts",
      cursor: 18,
    });
  });
});
