import { describe, expect, test } from "vitest";

import { DEFAULT_JSON_VIEWER_MODE, resolveJsonViewerMode } from "../src/components/ui/json-viewer";

describe("Feature: JSON viewer mode resolution", () => {
  test("Scenario: Given no local override When resolving a viewer mode Then the global default wins and falls back to YAML", () => {
    expect(resolveJsonViewerMode({ globalMode: "fmt-highlight-json" })).toBe("fmt-highlight-json");
    expect(resolveJsonViewerMode({ globalMode: null })).toBe(DEFAULT_JSON_VIEWER_MODE);
  });

  test("Scenario: Given a local override When resolving a viewer mode Then it wins over the global default", () => {
    expect(
      resolveJsonViewerMode({
        localMode: "raw-text-json",
        globalMode: "highlight-yaml",
      }),
    ).toBe("raw-text-json");
  });
});
