import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const runtimeStageAttentionSource = readFileSync(
  resolve(import.meta.dirname, "runtime-stage-attention.svelte"),
  "utf8",
);

describe("Feature: Runtime attention stage projection contract", () => {
  test("Scenario: Given Attention truth must stay distinct from downstream message projections When reading the stage source Then queued pushes and watch remnants are labeled as projections instead of core Attention facts", () => {
    expect(runtimeStageAttentionSource).toContain("Card.Title>Queued context pushes</Card.Title>");
    expect(runtimeStageAttentionSource).toContain(
      "These are notification projections attached to attention contexts. They are not standalone Attention truth.",
    );
    expect(runtimeStageAttentionSource).toContain("Card.Title>Context projections</Card.Title>");
    expect(runtimeStageAttentionSource).toContain("Legacy watch projections");
    expect(runtimeStageAttentionSource).toContain("data-testid=\"runtime-attention-statusbar\"");
    expect(runtimeStageAttentionSource).not.toContain("Card.Title>Queued push inbox</Card.Title>");
    expect(runtimeStageAttentionSource).not.toContain("Card.Title>Delivery ledger</Card.Title>");
  });
});
