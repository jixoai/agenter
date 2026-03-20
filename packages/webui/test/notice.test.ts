import { describe, expect, test } from "vitest";

import { displayNoticeFromError, normalizeUserNotice } from "../src/shared/notice";

describe("Feature: user-facing notices", () => {
  test("Scenario: Given a browser fetch failure When normalizing the notice Then the UI explains how to reconnect the app server", () => {
    expect(normalizeUserNotice("Failed to fetch", "fallback")).toBe(
      "WebUI cannot reach the Agenter app server. Start it with `agenter web --dev` or verify the current API endpoint.",
    );

    expect(displayNoticeFromError(new Error("Failed to fetch"), "fallback")).toBe(
      "WebUI cannot reach the Agenter app server. Start it with `agenter web --dev` or verify the current API endpoint.",
    );
  });
});
