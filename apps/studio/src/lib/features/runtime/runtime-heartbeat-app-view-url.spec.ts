import { describe, expect, test } from "vitest";

import {
  HEARTBEAT_RECORD_SELECT_MESSAGE_TYPE,
  buildHeartbeatDetailAppViewUrl,
  buildHeartbeatListAppViewUrl,
  isHeartbeatRecordSelectMessage,
} from "./runtime-heartbeat-app-view-url";

describe("Feature: Studio Heartbeat app-view URL contract", () => {
  test("Scenario: Given a runtime id When building the list app-view URL Then the URL is same-origin path-only without embed query parameters", () => {
    expect(buildHeartbeatListAppViewUrl("runtime/default")).toBe("/heartbeat-view/runtime%2Fdefault");
  });

  test("Scenario: Given a selected record When building the detail app-view URL Then the record id is encoded in the route path", () => {
    expect(buildHeartbeatDetailAppViewUrl({ runtimeId: "runtime/default", recordId: 31 })).toBe(
      "/heartbeat-view/runtime%2Fdefault/records/31",
    );
  });

  test("Scenario: Given no selected record When building the detail app-view URL Then Studio still keeps a mounted detail route", () => {
    expect(buildHeartbeatDetailAppViewUrl({ runtimeId: "runtime/default", recordId: null })).toBe(
      "/heartbeat-view/runtime%2Fdefault/records",
    );
  });

  test("Scenario: Given a Heartbeat select message When guarding parent messages Then only valid record selections pass", () => {
    expect(
      isHeartbeatRecordSelectMessage({
        type: HEARTBEAT_RECORD_SELECT_MESSAGE_TYPE,
        runtimeId: "runtime/default",
        recordId: 31,
      }),
    ).toBe(true);
    expect(isHeartbeatRecordSelectMessage({ type: HEARTBEAT_RECORD_SELECT_MESSAGE_TYPE, recordId: 0 })).toBe(false);
    expect(isHeartbeatRecordSelectMessage({ type: "other", runtimeId: "runtime/default", recordId: 31 })).toBe(false);
  });
});
