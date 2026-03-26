import { describe, expect, test } from "vitest";

import { buildSessionDevtoolsSearch, validateSessionDevtoolsSearch } from "../src/features/attention/attention-devtools-route";

describe("Feature: Session Devtools route search", () => {
  test("Scenario: Given a bare Devtools deep link When search is validated Then attention becomes the default panel and context becomes the default detail view", () => {
    expect(validateSessionDevtoolsSearch({})).toEqual({
      panel: "attention",
      attentionView: "context",
      attentionQuery: undefined,
      commitId: undefined,
      contextId: undefined,
      cycleId: undefined,
    });
  });

  test("Scenario: Given a cycle deep link without an explicit panel When search is validated Then cycles becomes the default panel", () => {
    expect(
      validateSessionDevtoolsSearch({
        cycleId: "7",
        attentionView: "items",
        attentionQuery: "  score:hash-1 deep:2  ",
      }),
    ).toEqual({
      panel: "cycles",
      cycleId: 7,
      attentionView: "items",
      attentionQuery: "score:hash-1 deep:2",
      commitId: undefined,
      contextId: undefined,
    });
  });

  test("Scenario: Given an existing attention drill-down When the route patch updates the query Then the rest of the selection is preserved and normalized", () => {
    expect(
      buildSessionDevtoolsSearch(
        {
          attentionQuery: "  score:abc123 deep:2  ",
        },
        {
          panel: "attention",
          cycleId: undefined,
          contextId: "ctx-chat-main",
          commitId: "commit-3",
          attentionView: "items",
          attentionQuery: undefined,
        },
      ),
    ).toEqual({
      panel: "attention",
      cycleId: undefined,
      contextId: "ctx-chat-main",
      commitId: "commit-3",
      attentionView: "items",
      attentionQuery: "score:abc123 deep:2",
    });
  });
});
