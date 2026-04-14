import { describe, expect, test } from "vitest";

import type { HeartbeatPartItem } from "@agenter/client-sdk";

import { buildHeartbeatDisplayBlocks } from "./runtime-heartbeat-parts";

const baseEntry: HeartbeatPartItem = {
  id: 1,
  messageId: "heartbeat-part:assistant:1",
  windowId: null,
  aiCallId: 42,
  roundIndex: 3,
  scope: "heartbeat_part",
  role: "assistant",
  createdAt: 1712931900000,
  updatedAt: 1712931950000,
  isComplete: true,
  text: "",
  parts: [],
};

describe("Feature: Runtime Heartbeat display block parsing", () => {
  test("Scenario: Given a text part stores a fenced yaml tool trace When display blocks are built Then the row upgrades into the Tool primitive instead of a raw text card", () => {
    const entry = {
      ...baseEntry,
      parts: [
        {
          partId: 11,
          partIndex: 0,
          messageId: baseEntry.messageId,
          windowId: null,
          aiCallId: baseEntry.aiCallId,
          roundIndex: baseEntry.roundIndex,
          scope: baseEntry.scope,
          role: "assistant",
          partType: "text",
          mimeType: null,
          payload: {
            type: "text",
            content: [
              "```yaml",
              'invocationId: "tool-1"',
              "tool: root_workspace_bash",
              "status: success",
              "input:",
              '  command: "echo hi"',
              "output:",
              '  stdout: "hi\\n"',
              '  stderr: ""',
              "  exitCode: 0",
              "error: null",
              "```",
            ].join("\n"),
          },
          createdAt: baseEntry.createdAt,
          updatedAt: baseEntry.updatedAt,
          isComplete: true,
        },
      ],
    } satisfies HeartbeatPartItem;

    const blocks = buildHeartbeatDisplayBlocks(entry);

    expect(blocks).toEqual([
      {
        kind: "tool",
        key: "tool-1",
        tool: "root_workspace_bash",
        state: "output-available",
        input: {
          command: "echo hi",
        },
        output: {
          stdout: "hi\n",
          stderr: "",
          exitCode: 0,
        },
        errorText: null,
      },
    ]);
  });

  test("Scenario: Given a regular markdown text part When display blocks are built Then the part stays a normal heartbeat content block", () => {
    const entry = {
      ...baseEntry,
      parts: [
        {
          partId: 12,
          partIndex: 0,
          messageId: baseEntry.messageId,
          windowId: null,
          aiCallId: baseEntry.aiCallId,
          roundIndex: baseEntry.roundIndex,
          scope: baseEntry.scope,
          role: "assistant",
          partType: "text",
          mimeType: null,
          payload: {
            type: "text",
            content: "Regular assistant text",
          },
          createdAt: baseEntry.createdAt,
          updatedAt: baseEntry.updatedAt,
          isComplete: true,
        },
      ],
    } satisfies HeartbeatPartItem;

    expect(buildHeartbeatDisplayBlocks(entry)).toEqual([
      {
        kind: "part",
        part: entry.parts[0],
      },
    ]);
  });
});
