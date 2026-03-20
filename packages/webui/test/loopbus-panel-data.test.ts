import { describe, expect, test } from "vitest";

import { buildCycleDigests } from "../src/features/loopbus/loopbus-panel-data";

describe("Feature: loopbus cycle digests", () => {
  test("Scenario: Given traces and model calls When digesting cycles Then latest cycles merge step and model summaries without duplication", () => {
    const digests = buildCycleDigests(
      [
        {
          id: 1,
          cycleId: 7,
          seq: 1,
          step: "race",
          status: "ok",
          startedAt: 100,
          endedAt: 140,
          detail: {},
        },
        {
          id: 2,
          cycleId: 7,
          seq: 2,
          step: "collect",
          status: "ok",
          startedAt: 140,
          endedAt: 240,
          detail: {},
        },
      ],
      [
        {
          id: 4,
          cycleId: 7,
          createdAt: 160,
          provider: "openai",
          model: "gpt-5.4",
          request: {},
        },
      ],
    );

    expect(digests).toHaveLength(1);
    expect(digests[0]?.cycleId).toBe(7);
    expect(digests[0]?.steps).toEqual(["race", "collect"]);
    expect(digests[0]?.modelCalls).toBe(1);
  });
});
