import { describe, expect, test } from "vitest";

import {
  deriveAnchoredVirtualListMutationRequest,
  normalizeAnchoredVirtualListScrollRequest,
  planAnchoredVirtualListScroll,
} from "./anchored-virtual-list-scroll-plan";

describe("Feature: anchored virtual list scroll planner", () => {
  test("Scenario: Given a stabilize reconcile request When normalized Then it receives background priority and settle boundary", () => {
    const normalized = normalizeAnchoredVirtualListScrollRequest({
      intent: "stabilize",
      target: { kind: "edge", edge: "latest" },
      source: "reconcile",
    });

    expect(normalized.priority).toBe("background");
    expect(normalized.settle).toBe("settle");
    expect(normalized.interruptionPolicy).toBe("cancel-on-user-input");
  });

  test("Scenario: Given the viewport is pinned at latest When append mutation is derived Then it defers to host-native anchoring instead of forcing a pin-latest request", () => {
    const request = deriveAnchoredVirtualListMutationRequest(
      {
        kind: "append",
        debugLabel: "append-latest",
      },
      {
        atLatest: true,
        atStart: false,
      },
    );

    expect(request).toBeNull();
  });

  test("Scenario: Given an element target When planned Then the planner preserves element semantics instead of degrading to position", () => {
    const element = {
      scrollIntoView() {},
    } as unknown as Element;

    const plan = planAnchoredVirtualListScroll(
      normalizeAnchoredVirtualListScrollRequest({
        intent: "reveal",
        target: { kind: "element", selector: "[data-row='42']" },
      }),
      {
        kind: "element",
        selector: "[data-row='42']",
        element,
      },
    );

    expect(plan.kind).toBe("element");
    if (plan.kind !== "element") {
      return;
    }
    expect(plan.element).toBe(element);
    expect(plan.scrollMode).toBe("if-needed");
  });
});
