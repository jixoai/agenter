import { describe, expect, test } from "vitest";

import type { HeartbeatGroupItem, HeartbeatPartItem } from "@agenter/client-sdk";

import {
  buildHeartbeatDisplayBlocks,
  buildHeartbeatDisplayGroups,
  buildHeartbeatSubjectSections,
  getHeartbeatRowMeta,
  getHeartbeatSectionTimeMeta,
  getHeartbeatToolPreview,
  type HeartbeatSubjectSection,
} from "./runtime-heartbeat-parts";
import { getHeartbeatToolVisualHint } from "./runtime-heartbeat-tool-visual-hints";

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
              "tool: root_bash",
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
        tool: "root_bash",
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

  test("Scenario: Given a shell-style tool input with long serialized arguments When the collapsed preview is built Then the header keeps the full command text for CSS overflow handling", () => {
    expect(
      getHeartbeatToolPreview({
        command:
          'attention commit \'{"contextId":"ctx-0x9d78659d03f3afe8b4bd2b2f48d939cee3d90d16","parentCommitIds":["commit-abc"],"done":true}\'',
      }),
    ).toBe(
      'attention commit \'{"contextId":"ctx-0x9d78659d03f3afe8b4bd2b2f48d939cee3d90d16","parentCommitIds":["commit-abc"],"done":true}\'',
    );
  });

  test("Scenario: Given a traced workspace alias and command When the collapsed preview is built Then the header prefixes the command with the workspace alias snapshot", () => {
    expect(
      getHeartbeatToolPreview({
        workspaceAlias: "root",
        command: "message send",
      }),
    ).toBe("root · message send");
  });

  test("Scenario: Given a shell command starts with sleep When tool visual hints are projected Then the hint captures only the sleep window", () => {
    expect(
      getHeartbeatToolVisualHint({
        tool: "root_bash",
        input: {
          command: "sleep 5 && curl -s -o /dev/null http://127.0.0.1:8091/index.html",
        },
        startedAt: baseEntry.createdAt,
      }),
    ).toEqual({
      kind: "shell-sleep",
      startedAt: baseEntry.createdAt,
      durationMs: 5_000,
    });

    expect(
      getHeartbeatToolVisualHint({
        tool: "root_bash",
        input: { command: "sleep 0.5m; echo done" },
        startedAt: baseEntry.createdAt,
      }),
    ).toEqual({
      kind: "shell-sleep",
      startedAt: baseEntry.createdAt,
      durationMs: 30_000,
    });
  });

  test("Scenario: Given sleep is not the leading shell command When tool visual hints are projected Then no visual hint is inferred", () => {
    expect(
      getHeartbeatToolVisualHint({
        tool: "root_bash",
        input: { command: "echo sleep 5" },
        startedAt: baseEntry.createdAt,
      }),
    ).toBeNull();
    expect(
      getHeartbeatToolVisualHint({
        tool: "root_bash",
        input: { command: 'bash -lc "sleep 5"' },
        startedAt: baseEntry.createdAt,
      }),
    ).toBeNull();
  });

  test("Scenario: Given a shell command starts with timeout When tool visual hints are projected Then the hint captures only the timeout budget", () => {
    expect(
      getHeartbeatToolVisualHint({
        tool: "root_bash",
        input: {
          command: "timeout 30s curl -s -o /dev/null http://127.0.0.1:8091/index.html",
        },
        startedAt: baseEntry.createdAt,
      }),
    ).toEqual({
      kind: "shell-timeout",
      startedAt: baseEntry.createdAt,
      durationMs: 30_000,
    });

    expect(
      getHeartbeatToolVisualHint({
        tool: "root_bash",
        input: {
          command: "timeout --foreground -k 5s 0.5m pnpm test",
        },
        startedAt: baseEntry.createdAt,
      }),
    ).toEqual({
      kind: "shell-timeout",
      startedAt: baseEntry.createdAt,
      durationMs: 30_000,
    });

    expect(
      getHeartbeatToolVisualHint({
        tool: "root_bash",
        input: {
          command: "timeout --kill-after 5s --signal TERM 30s pnpm test",
        },
        startedAt: baseEntry.createdAt,
      }),
    ).toEqual({
      kind: "shell-timeout",
      startedAt: baseEntry.createdAt,
      durationMs: 30_000,
    });
  });

  test("Scenario: Given timeout is not the leading shell command When tool visual hints are projected Then no visual hint is inferred", () => {
    expect(
      getHeartbeatToolVisualHint({
        tool: "root_bash",
        input: { command: "echo timeout 30s" },
        startedAt: baseEntry.createdAt,
      }),
    ).toBeNull();
    expect(
      getHeartbeatToolVisualHint({
        tool: "root_bash",
        input: { command: "timeout 30s" },
        startedAt: baseEntry.createdAt,
      }),
    ).toBeNull();
  });

  test("Scenario: Given a running sleep tool call has a start timestamp When display blocks are built Then the tool block carries a visual sleep progress hint", () => {
    const startedAt = baseEntry.createdAt + 250;
    const entry = {
      ...baseEntry,
      isComplete: false,
      parts: [
        {
          partId: 191,
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
            invocationId: "root-sleep-1",
            tool: "root_bash",
            input: {
              workspaceAlias: "root",
              command: "sleep 5 && curl -s -o /dev/null http://127.0.0.1:8091/index.html",
            },
            startedAt,
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
        key: "root-sleep-1",
        tool: "root_bash",
        state: "input-available",
        input: {
          workspaceAlias: "root",
          command: "sleep 5 && curl -s -o /dev/null http://127.0.0.1:8091/index.html",
        },
        output: undefined,
        errorText: null,
        visualHint: {
          kind: "shell-sleep",
          startedAt,
          durationMs: 5_000,
        },
      },
    ]);
  });

  test("Scenario: Given a running timeout tool call has a start timestamp When display blocks are built Then the tool block carries a visual timeout progress hint", () => {
    const startedAt = baseEntry.createdAt + 500;
    const entry = {
      ...baseEntry,
      isComplete: false,
      parts: [
        {
          partId: 192,
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
            invocationId: "root-timeout-1",
            tool: "root_bash",
            input: {
              workspaceAlias: "root",
              command: "timeout 30s curl -s -o /dev/null http://127.0.0.1:8091/index.html",
            },
            startedAt,
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
        key: "root-timeout-1",
        tool: "root_bash",
        state: "input-available",
        input: {
          workspaceAlias: "root",
          command: "timeout 30s curl -s -o /dev/null http://127.0.0.1:8091/index.html",
        },
        output: undefined,
        errorText: null,
        visualHint: {
          kind: "shell-timeout",
          startedAt,
          durationMs: 30_000,
        },
      },
    ]);
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

  test("Scenario: Given a running tool call already exposes parameters before the result arrives When display blocks are built Then the tool block is marked running instead of pending", () => {
    const entry = {
      ...baseEntry,
      isComplete: false,
      parts: [
        {
          partId: 311,
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
            invocationId: "workspace-bash-3b",
            tool: "workspace.bash",
            input: { command: 'attention commit --compact \'["ctx-1",[],"Settled."]\'' },
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
        key: "workspace-bash-3b",
        tool: "workspace.bash",
        state: "input-available",
        input: { command: 'attention commit --compact \'["ctx-1",[],"Settled."]\'' },
        output: undefined,
        errorText: null,
      },
    ]);
  });

  test("Scenario: Given an assistant tool call and a later tool result transport row When subject sections are built Then the tool stays in one assistant card instead of splitting into separate user and assistant cards", () => {
    const assistantToolEntry = {
      ...baseEntry,
      id: 401,
      messageId: "heartbeat-part:assistant:tool-call",
      parts: [
        {
          partId: 401,
          partIndex: 0,
          messageId: "heartbeat-part:assistant:tool-call",
          windowId: null,
          aiCallId: baseEntry.aiCallId,
          roundIndex: baseEntry.roundIndex,
          scope: baseEntry.scope,
          role: "assistant",
          partType: "tool_call",
          mimeType: null,
          payload: {
            invocationId: "workspace-bash-4",
            tool: "workspace.bash",
            input: { command: "pwd" },
          },
          createdAt: baseEntry.createdAt,
          updatedAt: baseEntry.updatedAt,
          isComplete: true,
        },
      ],
    } satisfies HeartbeatPartItem;

    const toolTransportEntry = {
      ...baseEntry,
      id: 402,
      role: "user",
      messageId: "heartbeat-part:user:tool-result",
      parts: [
        {
          partId: 402,
          partIndex: 0,
          messageId: "heartbeat-part:user:tool-result",
          windowId: null,
          aiCallId: baseEntry.aiCallId,
          roundIndex: baseEntry.roundIndex,
          scope: baseEntry.scope,
          role: "user",
          partType: "tool_result",
          mimeType: null,
          payload: {
            invocationId: "workspace-bash-4",
            tool: "workspace.bash",
            output: { stdout: "/repo/agenter\n", exitCode: 0 },
            error: null,
          },
          createdAt: baseEntry.createdAt + 1_000,
          updatedAt: baseEntry.updatedAt + 1_000,
          isComplete: true,
        },
      ],
    } satisfies HeartbeatPartItem;

    const assistantNarrativeEntry = {
      ...baseEntry,
      id: 403,
      messageId: "heartbeat-part:assistant:follow-up",
      parts: [
        {
          partId: 403,
          partIndex: 0,
          messageId: "heartbeat-part:assistant:follow-up",
          windowId: null,
          aiCallId: baseEntry.aiCallId,
          roundIndex: baseEntry.roundIndex,
          scope: baseEntry.scope,
          role: "assistant",
          partType: "text",
          mimeType: null,
          payload: {
            type: "text",
            content: "Tool result returned. Continue the plan.",
          },
          createdAt: baseEntry.createdAt + 2_000,
          updatedAt: baseEntry.updatedAt + 2_000,
          isComplete: true,
        },
      ],
    } satisfies HeartbeatPartItem;

    const group = {
      id: 601,
      groupId: "heartbeat-group:call:99",
      kind: "call",
      aiCallId: 99,
      createdAt: assistantToolEntry.createdAt,
      updatedAt: assistantNarrativeEntry.updatedAt,
      isComplete: true,
      items: [assistantToolEntry, toolTransportEntry, assistantNarrativeEntry],
    } satisfies HeartbeatGroupItem;

    const sections = buildHeartbeatSubjectSections(group);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.role).toBe("assistant");
    expect(sections[0]?.entryId).toBe(401);
    expect(sections[0]?.entries.map((entry) => entry.id)).toEqual([401, 402, 403]);
    expect(sections[0]?.blocks.map((block) => block.content.kind)).toEqual(["tool", "part"]);
    expect(sections[0]?.blocks[0]?.content).toEqual({
      kind: "tool",
      key: "workspace-bash-4",
      tool: "workspace.bash",
      state: "output-available",
      input: { command: "pwd" },
      output: { stdout: "/repo/agenter\n", exitCode: 0 },
      errorText: null,
    });
    expect(getHeartbeatSectionTimeMeta(sections[0]!)).toEqual({
      startedAt: assistantToolEntry.createdAt,
      endedAt: assistantNarrativeEntry.updatedAt,
      durationMs: assistantNarrativeEntry.updatedAt - assistantToolEntry.createdAt,
      isRunning: false,
      showRange: true,
    });
  });

  test("Scenario: Given a compact Heartbeat group When subject sections are built Then prompt facts and compact response stay in one special card without replaying the raw compact request", () => {
    const systemPromptEntry = {
      ...baseEntry,
      id: 801,
      messageId: "request_aux:systemPrompt:compact",
      scope: "request_aux",
      role: "system",
      text: "You are rewriting the bounded prompt window.",
      parts: [
        {
          partId: 801,
          partIndex: 0,
          messageId: "request_aux:systemPrompt:compact",
          windowId: null,
          aiCallId: 88,
          roundIndex: 2,
          scope: "request_aux",
          role: "system",
          partType: "systemPrompt",
          mimeType: null,
          payload: "You are rewriting the bounded prompt window.",
          createdAt: baseEntry.createdAt,
          updatedAt: baseEntry.updatedAt,
          isComplete: true,
        },
      ],
    } satisfies HeartbeatPartItem;

    const toolsEntry = {
      ...baseEntry,
      id: 802,
      messageId: "request_aux:tools:compact",
      scope: "request_aux",
      role: "system",
      text: '[{"name":"root_bash"}]',
      parts: [
        {
          partId: 802,
          partIndex: 0,
          messageId: "request_aux:tools:compact",
          windowId: null,
          aiCallId: 88,
          roundIndex: 2,
          scope: "request_aux",
          role: "system",
          partType: "tools",
          mimeType: null,
          payload: [{ name: "root_bash" }],
          createdAt: baseEntry.createdAt + 1,
          updatedAt: baseEntry.updatedAt + 1,
          isComplete: true,
        },
      ],
    } satisfies HeartbeatPartItem;

    const compactRequestEntry = {
      ...baseEntry,
      id: 803,
      messageId: "heartbeat-part:ai-call:88:request:0",
      scope: "heartbeat_part",
      role: "user",
      text: "## AttentionContexts.metadata",
      parts: [
        {
          partId: 803,
          partIndex: 0,
          messageId: "heartbeat-part:ai-call:88:request:0",
          windowId: null,
          aiCallId: 88,
          roundIndex: 2,
          scope: "heartbeat_part",
          role: "user",
          partType: "text",
          mimeType: null,
          payload: {
            type: "text",
            content: "## AttentionContexts.metadata",
          },
          createdAt: baseEntry.createdAt + 2,
          updatedAt: baseEntry.updatedAt + 2,
          isComplete: true,
        },
      ],
    } satisfies HeartbeatPartItem;

    const compactResponseEntry = {
      ...baseEntry,
      id: 804,
      messageId: "heartbeat-part:ai-call:88:compact",
      scope: "heartbeat_part",
      role: "system",
      text: "Prompt window compacted (manual).",
      parts: [
        {
          partId: 804,
          partIndex: 0,
          messageId: "heartbeat-part:ai-call:88:compact",
          windowId: null,
          aiCallId: 88,
          roundIndex: 3,
          scope: "heartbeat_part",
          role: "system",
          partType: "compact",
          mimeType: null,
          payload: {
            type: "compact",
            text: "Prompt window compacted (manual).",
          },
          createdAt: baseEntry.createdAt + 3,
          updatedAt: baseEntry.updatedAt + 3,
          isComplete: true,
        },
      ],
    } satisfies HeartbeatPartItem;

    const group = {
      id: 880,
      groupId: "heartbeat-group:compact:88",
      kind: "compact",
      aiCallId: 88,
      createdAt: systemPromptEntry.createdAt,
      updatedAt: compactResponseEntry.updatedAt,
      isComplete: true,
      items: [systemPromptEntry, toolsEntry, compactRequestEntry, compactResponseEntry],
    } satisfies HeartbeatGroupItem;

    const sections = buildHeartbeatSubjectSections(group);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.role).toBe("system");
    expect(sections[0]?.entries.map((entry) => entry.id)).toEqual([801, 802, 804]);
    expect(
      sections[0]?.blocks.map((block) =>
        block.content.kind === "part" ? block.content.part.partType : block.content.kind,
      ),
    ).toEqual(["systemPrompt", "tools", "compact"]);
  });

  test("Scenario: Given a before-call group directly precedes a compact group for the same aiCallId When display groups are built Then Heartbeat renders one compact card instead of two separate cards", () => {
    const beforeCallGroup = {
      id: 901,
      groupId: "heartbeat-group:before-call:88",
      kind: "before-call",
      aiCallId: 88,
      createdAt: 1_000,
      updatedAt: 1_100,
      isComplete: true,
      items: [
        {
          ...baseEntry,
          id: 9011,
          messageId: "request_aux:systemPrompt:88",
          scope: "request_aux",
          role: "system",
        },
      ],
    } satisfies HeartbeatGroupItem;

    const compactGroup = {
      id: 902,
      groupId: "heartbeat-group:compact:88",
      kind: "compact",
      aiCallId: 88,
      createdAt: 1_200,
      updatedAt: 1_300,
      isComplete: true,
      items: [
        {
          ...baseEntry,
          id: 9021,
          messageId: "heartbeat-part:ai-call:88:compact",
          scope: "heartbeat_part",
          role: "system",
          parts: [
            {
              partId: 9021,
              partIndex: 0,
              messageId: "heartbeat-part:ai-call:88:compact",
              windowId: null,
              aiCallId: 88,
              roundIndex: 3,
              scope: "heartbeat_part",
              role: "system",
              partType: "compact",
              mimeType: null,
              payload: {
                type: "compact",
                text: "Prompt window compacted (manual).",
              },
              createdAt: 1_200,
              updatedAt: 1_300,
              isComplete: true,
            },
          ],
          text: "Prompt window compacted (manual).",
        },
      ],
    } satisfies HeartbeatGroupItem;

    const groups = buildHeartbeatDisplayGroups([beforeCallGroup, compactGroup]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe("compact");
    expect(groups[0]?.groupId).toBe("heartbeat-group:compact:88");
    expect(groups[0]?.items.map((item) => item.id)).toEqual([9011, 9021]);
    expect(groups[0]?.createdAt).toBe(1_000);
    expect(groups[0]?.updatedAt).toBe(1_300);
  });

  test("Scenario: Given a running section When section time metadata is projected with wall-clock input Then the elapsed duration grows without needing a new Heartbeat row", () => {
    const runningSection: HeartbeatSubjectSection = {
      key: "heartbeat-group:call:77:assistant",
      role: "assistant",
      name: null,
      entryId: 701,
      entries: [
        {
          ...baseEntry,
          id: 701,
          messageId: "heartbeat-part:assistant:running",
          createdAt: 1_000,
          updatedAt: 1_200,
          isComplete: false,
        },
      ],
      blocks: [],
    };

    expect(getHeartbeatSectionTimeMeta(runningSection, 3_500)).toEqual({
      startedAt: 1_000,
      endedAt: 3_500,
      durationMs: 2_500,
      isRunning: true,
      showRange: true,
    });
  });
});
