import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const sourceText = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../example/src/lib/review-shell-client.svelte"),
  "utf8",
);

describe("Feature: contact request surface contract", () => {
  test("Scenario: Given the contacts root request history When reading the implementation Then request rows expose durable route-proof data and do not pretend every request is pending", () => {
    expect(sourceText).toContain("{#snippet requestHistoryList(");
    expect(sourceText).toContain('data-review-request-key={request.key}');
    expect(sourceText).toContain('data-review-request-source={request.sourceId}');
    expect(sourceText).toContain('data-review-request-direction={request.direction}');
    expect(sourceText).toContain('data-review-request-state={request.state}');
    expect(sourceText).toContain("<BlockTitle>Requests</BlockTitle>");
    expect(sourceText).not.toContain("<BlockTitle>Pending requests</BlockTitle>");
  });
});
