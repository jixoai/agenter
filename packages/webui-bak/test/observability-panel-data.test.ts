import { describe, expect, test } from "vitest";

import { buildCycleDigests } from "../src/features/devtools/observability/observability-panel-data";

const createTrace = (input: {
  id: number;
  cycleId: number;
  seq: number;
  kind: string;
  name: string;
  startedAt: number;
  endedAt: number;
}) => ({
  id: input.id,
  cycleId: input.cycleId,
  seq: input.seq,
  traceId: `trace-${input.cycleId}`,
  spanId: `span-${input.id}`,
  parentSpanId: null,
  kind: input.kind,
  name: input.name,
  status: "done" as const,
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  refs: [],
  links: [],
  events: [],
  attributes: {},
  outcome: { code: "done" as const },
});

describe("Feature: observability cycle digests", () => {
  test("Scenario: Given traces and model calls When digesting cycles Then latest cycles merge step and model summaries without duplication", () => {
    const digests = buildCycleDigests(
      [
        createTrace({ id: 1, cycleId: 7, seq: 1, kind: "scheduler.wait", name: "race", startedAt: 100, endedAt: 140 }),
        createTrace({
          id: 2,
          cycleId: 7,
          seq: 2,
          kind: "source.collect",
          name: "collect",
          startedAt: 140,
          endedAt: 240,
        }),
      ],
      [
        {
          id: 4,
          cycleId: 7,
          createdAt: 160,
          status: "done",
          completedAt: 180,
          provider: "openai",
          model: "gpt-5.4",
          request: {},
        },
      ],
    );

    expect(digests).toHaveLength(1);
    expect(digests[0]?.cycleId).toBe(7);
    expect(digests[0]?.steps).toEqual(["scheduler.wait / race", "source.collect / collect"]);
    expect(digests[0]?.modelCalls).toBe(1);
  });
});
