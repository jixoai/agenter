import { describe, expect, test } from "vitest";

import type { HeartbeatPartItem } from "@agenter/client-sdk";

import { buildHeartbeatDisplayBlocks, getHeartbeatRowMeta, getHeartbeatToolPreview } from "./runtime-heartbeat-parts";

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
  test("Scenario: Given canonical tool_call and tool_result parts share one invocation id When display blocks are built Then the row upgrades into a single Tool block instead of two raw payload cards", () => {
    const entry = {
      ...baseEntry,
      parts: [
        {
          partId: 101,
          partIndex: 0,
          messageId: baseEntry.messageId,
          windowId: null,
          aiCallId: baseEntry.aiCallId,
          roundIndex: baseEntry.roundIndex,
          scope: baseEntry.scope,
          role: "assistant",
          partType: "tool_call",
          mimeType: null,
          payload: {
            invocationId: "workspace-bash-1",
            tool: "workspace.bash",
            input: { command: "pwd" },
          },
          createdAt: baseEntry.createdAt,
          updatedAt: baseEntry.updatedAt,
          isComplete: true,
        },
        {
          partId: 102,
          partIndex: 1,
          messageId: baseEntry.messageId,
          windowId: null,
          aiCallId: baseEntry.aiCallId,
          roundIndex: baseEntry.roundIndex,
          scope: baseEntry.scope,
          role: "assistant",
          partType: "tool_result",
          mimeType: null,
          payload: {
            invocationId: "workspace-bash-1",
            tool: "workspace.bash",
            output: { stdout: "/repo/agenter\n", exitCode: 0 },
            error: null,
          },
          createdAt: baseEntry.createdAt,
          updatedAt: baseEntry.updatedAt,
          isComplete: true,
        },
      ],
    } satisfies HeartbeatPartItem;

    expect(buildHeartbeatDisplayBlocks(entry)).toEqual([
      {
        kind: "tool",
        key: "workspace-bash-1",
        tool: "workspace.bash",
        state: "output-available",
        input: { command: "pwd" },
        output: { stdout: "/repo/agenter\n", exitCode: 0 },
        errorText: null,
      },
    ]);
  });

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

  test("Scenario: Given a row with call metadata and roundIndex zero When header metadata is built Then only high-signal facts stay visible", () => {
    const entry = {
      ...baseEntry,
      role: "user",
      roundIndex: 0,
      isComplete: true,
      aiCallId: 51,
    } satisfies HeartbeatPartItem;

    expect(getHeartbeatRowMeta(entry)).toEqual(["call #51"]);
  });

  test("Scenario: Given a shell-style tool input with long serialized arguments When the collapsed preview is built Then the header keeps only the leading command intent", () => {
    expect(
      getHeartbeatToolPreview({
        command:
          "attention commit '{\"contextId\":\"ctx-0x9d78659d03f3afe8b4bd2b2f48d939cee3d90d16\",\"parentCommitIds\":[\"commit-abc\"],\"done\":true}'",
      }),
    ).toBe("attention commit");
  });

  test("Scenario: Given a tool result arrives after an unrelated text part When display blocks are built Then the invocation still renders as one stable tool block anchored at the original tool call", () => {
    const entry = {
      ...baseEntry,
      parts: [
        {
          partId: 201,
          partIndex: 0,
          messageId: baseEntry.messageId,
          windowId: null,
          aiCallId: baseEntry.aiCallId,
          roundIndex: baseEntry.roundIndex,
          scope: baseEntry.scope,
          role: "assistant",
          partType: "tool_call",
          mimeType: null,
          payload: {
            invocationId: "workspace-bash-2",
            tool: "workspace.bash",
            input: { command: "pwd" },
          },
          createdAt: baseEntry.createdAt,
          updatedAt: baseEntry.updatedAt,
          isComplete: true,
        },
        {
          partId: 202,
          partIndex: 1,
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
            content: "Assistant narrative between tool phases",
          },
          createdAt: baseEntry.createdAt,
          updatedAt: baseEntry.updatedAt,
          isComplete: true,
        },
        {
          partId: 203,
          partIndex: 2,
          messageId: baseEntry.messageId,
          windowId: null,
          aiCallId: baseEntry.aiCallId,
          roundIndex: baseEntry.roundIndex,
          scope: baseEntry.scope,
          role: "assistant",
          partType: "tool_result",
          mimeType: null,
          payload: {
            invocationId: "workspace-bash-2",
            tool: "workspace.bash",
            output: { stdout: "/repo/agenter\n", exitCode: 0 },
            error: null,
          },
          createdAt: baseEntry.createdAt,
          updatedAt: baseEntry.updatedAt,
          isComplete: true,
        },
      ],
    } satisfies HeartbeatPartItem;

    expect(buildHeartbeatDisplayBlocks(entry)).toEqual([
      {
        kind: "tool",
        key: "workspace-bash-2",
        tool: "workspace.bash",
        state: "output-available",
        input: { command: "pwd" },
        output: { stdout: "/repo/agenter\n", exitCode: 0 },
        errorText: null,
      },
      {
        kind: "part",
        part: entry.parts[1],
      },
    ]);
  });

  test("Scenario: Given a running tool call has not produced args or a result yet When display blocks are built Then the tool block still remains visible in streaming state", () => {
    const entry = {
      ...baseEntry,
      isComplete: false,
      parts: [
        {
          partId: 301,
          partIndex: 0,
          messageId: baseEntry.messageId,
          windowId: null,
          aiCallId: baseEntry.aiCallId,
          roundIndex: baseEntry.roundIndex,
          scope: baseEntry.scope,
          role: "assistant",
          partType: "tool_call",
          mimeType: null,
          payload: {
            invocationId: "workspace-bash-3",
            tool: "workspace.bash",
            input: "",
          },
          createdAt: baseEntry.createdAt,
          updatedAt: baseEntry.updatedAt,
          isComplete: false,
        },
      ],
    } satisfies HeartbeatPartItem;

    expect(buildHeartbeatDisplayBlocks(entry)).toEqual([
      {
        kind: "tool",
        key: "workspace-bash-3",
        tool: "workspace.bash",
        state: "input-streaming",
        input: "",
        output: undefined,
        errorText: null,
      },
    ]);
  });
});
