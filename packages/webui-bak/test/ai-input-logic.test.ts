import { describe, expect, test } from "vitest";

import {
  findSlashCommandToken,
  findWorkspacePathToken,
  replaceSlashCommandToken,
  replaceWorkspacePathToken,
} from "../src/features/chat/ai-input-logic";

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

  test("Scenario: Given a slash command token When resolving and applying a command Then the composer keeps the slash-command semantics", () => {
    expect(findSlashCommandToken("Run /scr", 8)).toEqual({
      from: 4,
      to: 8,
      query: "scr",
      raw: "/scr",
    });

    expect(replaceSlashCommandToken("Run /scr", { from: 4, to: 8 }, "/screenshot")).toEqual({
      value: "Run /screenshot",
      cursor: 15,
    });
  });
});
