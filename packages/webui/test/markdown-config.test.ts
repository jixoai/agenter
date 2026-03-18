import { describe, expect, test } from "vitest";

import {
  normalizeMarkdownCodeLanguage,
  resolveMarkdownCodeLanguage,
  resolveMarkdownDocumentProfile,
} from "../src/components/markdown/markdown-config";

describe("Feature: markdown document profiles", () => {
  test("Scenario: Given inspector usage When resolving profile Then semantic defaults stay tuned for compact inspection panes", () => {
    expect(resolveMarkdownDocumentProfile({ usage: "inspector" })).toEqual({
      usage: "inspector",
      surface: "muted",
      overflow: "scroll",
      density: "compact",
      padding: "compact",
      syntaxTone: "accented",
      maxHeight: 320,
    });
  });

  test("Scenario: Given chat bubble override When resolving profile Then surface semantics win without changing the chat layout defaults", () => {
    expect(resolveMarkdownDocumentProfile({ usage: "chat", surface: "bubble-user", syntaxTone: "accented" })).toEqual({
      usage: "chat",
      surface: "bubble-user",
      overflow: "grow",
      density: "compact",
      padding: "none",
      syntaxTone: "accented",
      maxHeight: undefined,
    });
  });

  test("Scenario: Given composite fenced code info When normalizing language Then code highlighting resolves to the canonical language", () => {
    expect(normalizeMarkdownCodeLanguage("yaml+tool_call")).toBe("yaml");
    expect(normalizeMarkdownCodeLanguage("TSX highlighted")).toBe("tsx");
    expect(resolveMarkdownCodeLanguage("yaml+tool_result")?.name.toLowerCase()).toContain("yaml");
  });
});
