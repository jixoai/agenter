import { describe, expect, test } from "vitest";

import {
  shouldTriggerNotesScrollPagination,
  shouldTriggerNotesScrollPaginationFromEvent,
  type NotesScrollPaginationMetrics,
} from "./notes-scroll-pagination";

const createScrollEvent = (metrics: NotesScrollPaginationMetrics): Event => {
  const event = new Event("scroll");
  Object.defineProperty(event, "currentTarget", {
    configurable: true,
    value: metrics,
  });
  return event;
};

describe("Feature: Notes Browse scroll pagination", () => {
  test("Scenario: Given a virtual list viewport When the operator scrolls near the end Then the stage should request the next page", () => {
    expect(
      shouldTriggerNotesScrollPagination({
        scrollTop: 720,
        clientHeight: 400,
        scrollHeight: 1_260,
      }),
    ).toBe(true);
  });

  test("Scenario: Given a virtual list viewport When the operator remains far from the end Then the stage should not request the next page", () => {
    expect(
      shouldTriggerNotesScrollPagination({
        scrollTop: 120,
        clientHeight: 400,
        scrollHeight: 1_260,
      }),
    ).toBe(false);
  });

  test("Scenario: Given a ScrollView event When currentTarget carries scroll metrics Then pagination uses the viewport metrics", () => {
    expect(
      shouldTriggerNotesScrollPaginationFromEvent(
        createScrollEvent({
          scrollTop: 700,
          clientHeight: 400,
          scrollHeight: 1_260,
        }),
      ),
    ).toBe(true);
  });

  test("Scenario: Given a horizontal notebook switcher When the operator scrolls near the end Then the stage should request the next notebook page", () => {
    expect(
      shouldTriggerNotesScrollPagination({
        scrollTop: 0,
        clientHeight: 80,
        scrollHeight: 80,
        scrollLeft: 980,
        clientWidth: 420,
        scrollWidth: 1_560,
      }),
    ).toBe(true);
  });
});
