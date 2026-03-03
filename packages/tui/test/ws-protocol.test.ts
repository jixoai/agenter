import { describe, expect, test } from "bun:test";

import { parseServerMessage } from "../src/ws-protocol";

describe("Feature: tui websocket message parsing", () => {
  test("Scenario: Given instance snapshot payload When parsing Then return normalized instances", () => {
    const parsed = parseServerMessage({
      type: "instance.snapshot",
      payload: {
        instances: [
          { id: "i-1", name: "demo", cwd: "/tmp/demo", status: "running" },
          { id: 1, name: "bad", cwd: "/tmp", status: "running" },
        ],
      },
    });

    expect(parsed?.type).toBe("instance.snapshot");
    if (!parsed || parsed.type !== "instance.snapshot") {
      return;
    }
    expect(parsed.instances).toHaveLength(1);
    expect(parsed.instances[0]?.id).toBe("i-1");
  });

  test("Scenario: Given malformed message When parsing Then return null", () => {
    const parsed = parseServerMessage({
      type: "chat.message",
      payload: { instanceId: "i-1", message: { role: "assistant" } },
    });
    expect(parsed).toBeNull();
  });
});

