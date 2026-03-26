import { describe, expect, test } from "vitest";

import { parseYamlMappingLine, resolveJsonViewerMode } from "../src/components/ui/json-viewer";

describe("Feature: JSON viewer parsing", () => {
  test("Scenario: Given a quoted YAML key with a colon When parsed Then the full key stays intact", () => {
    expect(parseYamlMappingLine('"message:chat-main": 100')).toEqual({
      indent: "",
      dash: "",
      key: '"message:chat-main"',
      separator: ": ",
      value: "100",
    });
  });

  test("Scenario: Given a local mode override When resolving the viewer mode Then local wins over global", () => {
    expect(
      resolveJsonViewerMode({
        localMode: "raw-text-json",
        globalMode: "highlight-yaml",
      }),
    ).toBe("raw-text-json");
  });
});
