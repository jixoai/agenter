import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const cyclesStageSource = readFileSync(resolve(import.meta.dirname, "runtime-stage-cycles.svelte"), "utf8");

describe("Feature: Runtime cycles stage disclosure contract", () => {
  test("Scenario: Given the primary stage already owns the outer scaffold When reading the cycles stage source Then cycle history is rendered as an inspector workbench without a nested card shell", () => {
    expect(cyclesStageSource).not.toContain("<Card.Root>");
    expect(cyclesStageSource).not.toContain("import * as Card");
    expect(cyclesStageSource).toContain("import * as Item");
    expect(cyclesStageSource).toContain("<Item.Root");
    expect(cyclesStageSource).toContain('data-testid="runtime-cycle-timeline"');
    expect(cyclesStageSource).toContain("buildRuntimeCycleTimelineItems");
  });

  test("Scenario: Given operators need to inspect a cycle inline When reading the cycles stage source Then the detail workbench exposes summary, io, model, and attention tabs with durable fields", () => {
    expect(cyclesStageSource).toContain("<Tabs.Root");
    expect(cyclesStageSource).toContain('value="summary"');
    expect(cyclesStageSource).toContain('value="io"');
    expect(cyclesStageSource).toContain('value="model"');
    expect(cyclesStageSource).toContain('value="attention"');
    expect(cyclesStageSource).toContain("Client messages");
    expect(cyclesStageSource).toContain("Model call");
    expect(cyclesStageSource).toContain("System prompt");
    expect(cyclesStageSource).toContain("Input contexts");
  });
});
