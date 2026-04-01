import { describe, expect, test } from "vitest";

import { markdownToPlainText } from "../src/features/chat/chat-message-actions";

describe("Feature: chat message action transforms", () => {
  test("Scenario: Given markdown with links and fences When copying plain text Then formatting syntax is removed while readable text remains", () => {
    const result = markdownToPlainText(
      [
        "# Heading",
        "",
        "Use `npm run test` and [read docs](https://example.com).",
        "",
        "```ts",
        "const ok = true;",
        "```",
      ].join("\n"),
    );

    expect(result).toContain("Heading");
    expect(result).toContain("npm run test");
    expect(result).toContain("read docs");
    expect(result).toContain("const ok = true;");
    expect(result).not.toContain("```");
  });
});
