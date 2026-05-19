import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { resolveEditableSettingsPath } from "../src/settings-editor";

describe("Feature: settings editor prompt path authority", () => {
  test("Scenario: Given no canonical prompt path When resolving AGENTER.mdx Then workspace root fallback is rejected", () => {
    expect(() => resolveEditableSettingsPath("/repo", "agenter", {})).toThrow("avatar AGENTER.mdx path is unavailable");
  });

  test("Scenario: Given a canonical prompt root When resolving AGENTER.mdx Then the editor uses the avatar root", () => {
    const principalRoot = join("/repo", ".agenter", "avatars", "by-principal", "0xabc");

    expect(resolveEditableSettingsPath("/repo", "agenter", { rootDir: principalRoot })).toBe(
      join(principalRoot, "AGENTER.mdx"),
    );
  });
});
