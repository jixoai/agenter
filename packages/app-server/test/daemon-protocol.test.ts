import { describe, expect, test } from "bun:test";

import { parseClientMessage } from "../src/daemon-protocol";

describe("Feature: daemon websocket protocol parsing", () => {
  test("Scenario: Given a valid chat.send payload When parsing Then return typed chat command", () => {
    const parsed = parseClientMessage(
      JSON.stringify({
        type: "chat.send",
        requestId: "req-1",
        payload: { instanceId: "i-1", text: "hello" },
      }),
    );

    expect(parsed.type).toBe("chat.send");
    if (parsed.type !== "chat.send") {
      return;
    }
    expect(parsed.payload.instanceId).toBe("i-1");
    expect(parsed.payload.text).toBe("hello");
  });

  test("Scenario: Given unknown command type When parsing Then reject as bad request", () => {
    expect(() => parseClientMessage(JSON.stringify({ type: "unknown" }))).toThrow();
  });
});
