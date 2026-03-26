import { describe, expect, test } from "bun:test";

import { AttentionHashAliasRegistry } from "../src/attention-hash-alias-registry";

describe("Feature: attention hash alias registry", () => {
  test("Scenario: Given the same digest twice When alias tokens are resolved Then the registry returns the same short token", () => {
    const registry = new AttentionHashAliasRegistry();
    const digest = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    expect(registry.ensureTokenForDigest(digest)).toBe("abcdef");
    expect(registry.ensureTokenForDigest(digest)).toBe("abcdef");
  });

  test("Scenario: Given two digests with the same six-char prefix When alias tokens are resolved Then the later digest expands to avoid collision", () => {
    const registry = new AttentionHashAliasRegistry();

    expect(
      registry.ensureTokenForDigest("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"),
    ).toBe("abcdef");
    expect(
      registry.ensureTokenForDigest("abcdef9fedcba0987654321abcdef9fedcba0987654321abcdef9fedcba098"),
    ).toBe("abcdef9");
  });
});
