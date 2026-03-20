import type { RuntimeChatCycle, RuntimeChatMessage } from "@agenter/client-sdk";
import { describe, expect, test } from "vitest";

import { projectConversationRows } from "../src/features/chat/chat-projection";

const buildMessages = (): RuntimeChatMessage[] => [
  {
    id: "100",
    role: "user",
    content: "hello from persisted history",
    timestamp: 1,
    cycleId: null,
  },
  {
    id: "101",
    role: "assistant",
    channel: "to_user",
    content: "reply from persisted history",
    timestamp: 3,
    cycleId: 2,
  },
];

const buildCycle = (id: string, cycleId: number): RuntimeChatCycle => ({
  id,
  cycleId,
  seq: cycleId,
  createdAt: cycleId,
  wakeSource: "user",
  kind: "model",
  status: "done",
  clientMessageIds: [id],
  inputs: [
    {
      source: "message",
      role: "user",
      name: "User",
      parts: [{ type: "text", text: `hello from ${id}` }],
      meta: { clientMessageId: id },
    },
  ],
  outputs: [
    {
      id: `${id}-tool`,
      role: "assistant",
      channel: "tool_call",
      content: "```yaml+tool_call\ntool: terminal_read\n```",
      timestamp: cycleId + 1,
      cycleId,
      tool: { name: "terminal_read" },
    },
  ],
  liveMessages: [],
  streaming: null,
  modelCallId: 1,
});

describe("Feature: conversation projection", () => {
  test("Scenario: Given persisted user-visible history When projecting rows Then internal assistant records stay out of the main flow", () => {
    const rows = projectConversationRows(buildMessages(), [buildCycle("cycle:2", 2)], "idle");

    const messageRows = rows.filter((row) => row.type === "message");

    expect(messageRows.map((row) => row.message.content)).toEqual([
      "hello from persisted history",
      "reply from persisted history",
    ]);
    expect(messageRows.some((row) => row.message.channel === "tool_call")).toBe(false);
  });

  test("Scenario: Given an optimistic pending cycle When projecting rows Then the pending user turn stays visible until persisted history arrives", () => {
    const rows = projectConversationRows(
      [],
      [
        {
          ...buildCycle("pending:client-1", 0),
          cycleId: null,
          status: "pending",
          createdAt: 10,
          outputs: [],
        },
      ],
      "waiting model",
    );

    expect(rows.map((row) => row.key)).toContain("pending-user:pending:client-1:0");
    expect(rows.some((row) => row.type === "status" && row.text.includes("preparing a reply"))).toBe(true);
  });

  test("Scenario: Given a streaming cycle When projecting rows Then the in-flight assistant reply is appended without exposing cycle chrome", () => {
    const rows = projectConversationRows(
      buildMessages(),
      [
        {
          ...buildCycle("cycle:3", 3),
          status: "streaming",
          outputs: [],
          liveMessages: [
            {
              id: "live-thought",
              role: "assistant",
              channel: "self_talk",
              content: "hidden internal trace",
              timestamp: 4,
              cycleId: 3,
            },
          ],
          streaming: {
            content: "streaming reply",
          },
        },
      ],
      "waiting model",
    );

    expect(rows.filter((row) => row.type === "message").map((row) => row.message.content)).toContain("streaming reply");
    expect(rows.some((row) => row.type === "message" && row.message.content.includes("hidden internal trace"))).toBe(false);
  });

  test("Scenario: Given long same-day gaps and a day change When projecting rows Then restrained time dividers are inserted without spamming every turn", () => {
    const rows = projectConversationRows(
      [
        {
          id: "200",
          role: "user",
          content: "first turn",
          timestamp: Date.parse("2026-03-19T10:00:00.000Z"),
          cycleId: null,
        },
        {
          id: "201",
          role: "assistant",
          channel: "to_user",
          content: "second turn",
          timestamp: Date.parse("2026-03-19T10:05:00.000Z"),
          cycleId: 3,
        },
        {
          id: "202",
          role: "assistant",
          channel: "to_user",
          content: "third turn",
          timestamp: Date.parse("2026-03-19T10:12:00.000Z"),
          cycleId: 3,
        },
        {
          id: "203",
          role: "assistant",
          channel: "to_user",
          content: "next day turn",
          timestamp: Date.parse("2026-03-20T09:00:00.000Z"),
          cycleId: 4,
        },
      ],
      [],
      "idle",
    );

    const dividerRows = rows.filter((row) => row.type === "time-divider");
    expect(dividerRows).toHaveLength(2);
    expect(dividerRows[0]?.emphasis).toBe("time");
    expect(dividerRows[1]?.emphasis).toBe("date");

    expect(rows.map((row) => row.type)).toEqual([
      "message",
      "time-divider",
      "message",
      "message",
      "time-divider",
      "message",
    ]);
  });
});
