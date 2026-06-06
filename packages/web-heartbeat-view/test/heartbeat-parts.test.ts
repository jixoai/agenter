import { describe, expect, test } from "vitest";

import {
  buildHeartbeatDisplayBlocks,
  buildHeartbeatDisplayGroups,
  buildHeartbeatEntryClipboardText,
  buildHeartbeatGroupClipboardText,
  buildHeartbeatSectionClipboardText,
  buildHeartbeatSubjectSections,
  getHeartbeatGroupLabel,
  getHeartbeatRowLabel,
  getHeartbeatToolPreview,
  isHeartbeatRowFoldedByDefault,
  readHeartbeatPartText,
} from "../src";
import { heartbeatEntry, heartbeatGroup, heartbeatPart } from "./heartbeat-fixtures";

describe("Feature: Heartbeat parser materializes grouped runtime facts", () => {
  test("Scenario: Given before-call, call, and pending groups When labels are read Then grouped semantics stay visible", () => {
    const beforeCall = heartbeatGroup({
      id: 1,
      kind: "before-call",
      aiCallId: 7,
      items: [
        heartbeatEntry({
          id: 1,
          parts: [heartbeatPart({ partId: 1, messageId: "p1", partType: "text", payload: "pre" })],
        }),
      ],
    });
    const call = heartbeatGroup({
      id: 2,
      kind: "call",
      aiCallId: 7,
      items: [
        heartbeatEntry({
          id: 2,
          parts: [heartbeatPart({ partId: 2, messageId: "p2", partType: "text", payload: "call" })],
        }),
      ],
    });
    const pending = heartbeatGroup({
      id: 3,
      kind: "before-call-pending",
      aiCallId: null,
      items: [
        heartbeatEntry({
          id: 3,
          parts: [heartbeatPart({ partId: 3, messageId: "p3", partType: "text", payload: "pending" })],
        }),
      ],
    });

    expect(getHeartbeatGroupLabel(beforeCall)).toBe("Before Call #7");
    expect(getHeartbeatGroupLabel(call)).toBe("Call #7");
    expect(getHeartbeatGroupLabel(pending)).toBe("Before Call (Pending)");
  });

  test("Scenario: Given folded request facts When row metadata is read Then system prompt, tools, config, and compact rows stay inspectable", () => {
    const foldedTypes = ["systemPrompt", "tools", "config", "compact"];

    for (const [index, partType] of foldedTypes.entries()) {
      const entry = heartbeatEntry({
        id: 100 + index,
        scope: "request_aux",
        role: partType === "config" ? "config" : "system",
        parts: [
          heartbeatPart({
            partId: 100 + index,
            messageId: `folded-${partType}`,
            scope: "request_aux",
            role: partType === "config" ? "config" : "system",
            partType,
            payload: { text: `${partType} payload` },
          }),
        ],
      });

      expect(isHeartbeatRowFoldedByDefault(entry)).toBe(true);
      expect(getHeartbeatRowLabel(entry)).toBe(
        partType === "systemPrompt" ? "System prompt" : partType[0]!.toUpperCase() + partType.slice(1),
      );
      expect(buildHeartbeatEntryClipboardText(entry)).toContain(`[${getHeartbeatRowLabel(entry)}]`);
    }
  });

  test("Scenario: Given compact prompt and result groups When display groups are built Then compact remains one semantic event", () => {
    const prompt = heartbeatGroup({
      id: 10,
      kind: "before-call",
      aiCallId: 7,
      items: [
        heartbeatEntry({
          id: 11,
          scope: "request_aux",
          role: "system",
          parts: [
            heartbeatPart({
              partId: 11,
              messageId: "aux-11",
              scope: "request_aux",
              role: "system",
              partType: "systemPrompt",
              payload: { text: "system" },
            }),
          ],
        }),
      ],
    });
    const result = heartbeatGroup({
      id: 12,
      kind: "compact",
      aiCallId: 7,
      items: [
        heartbeatEntry({
          id: 13,
          role: "assistant",
          parts: [
            heartbeatPart({
              partId: 13,
              messageId: "compact-13",
              role: "assistant",
              partType: "compact",
              payload: { text: "Compacted memory" },
            }),
          ],
        }),
      ],
    });

    const [display] = buildHeartbeatDisplayGroups([prompt, result]);

    expect(display?.kind).toBe("compact");
    expect(display?.items.map((item) => item.id)).toEqual([11, 13]);
  });

  test("Scenario: Given running tool params When blocks are built Then the tool row exposes running intent before completion", () => {
    const entry = heartbeatEntry({
      id: 20,
      role: "assistant",
      isComplete: false,
      parts: [
        heartbeatPart({
          partId: 20,
          messageId: "tool-call",
          role: "assistant",
          partType: "tool_call",
          isComplete: false,
          payload: {
            invocationId: "call_1",
            tool: "shell.exec",
            input: { command: "sleep 5" },
            startedAt: 1_000,
          },
        }),
      ],
    });

    const [block] = buildHeartbeatDisplayBlocks(entry);

    expect(block).toMatchObject({
      kind: "tool",
      tool: "shell.exec",
      state: "input-available",
      input: { command: "sleep 5" },
      visualHint: { kind: "shell-sleep", durationMs: 5_000 },
    });
    expect(getHeartbeatToolPreview({ workspaceAlias: "repo", command: "bun test" })).toBe("repo · bun test");
  });

  test("Scenario: Given fenced tool trace text When blocks are built Then legacy structured tool facts are promoted into one tool block", () => {
    const entry = heartbeatEntry({
      id: 21,
      role: "assistant",
      parts: [
        heartbeatPart({
          partId: 21,
          messageId: "tool-trace",
          role: "assistant",
          partType: "text",
          payload: {
            text: [
              "```yaml",
              "tool: shell.exec",
              "status: running",
              "input:",
              "  command: bun test",
              "startedAt: 1000",
              "```",
            ].join("\n"),
          },
        }),
      ],
    });

    const [block] = buildHeartbeatDisplayBlocks(entry);

    expect(block).toMatchObject({
      kind: "tool",
      tool: "shell.exec",
      state: "input-available",
      input: { command: "bun test" },
    });
  });

  test("Scenario: Given assistant thinking and text When sections are materialized Then chronological order is preserved", () => {
    const group = heartbeatGroup({
      id: 30,
      items: [
        heartbeatEntry({
          id: 31,
          parts: [
            heartbeatPart({
              partId: 31,
              messageId: "thinking",
              partType: "thinking",
              payload: { text: "Think first" },
            }),
            heartbeatPart({
              partId: 32,
              partIndex: 32,
              messageId: "text",
              partType: "text",
              payload: { text: "Then answer" },
            }),
          ],
        }),
      ],
    });

    const [section] = buildHeartbeatSubjectSections(group);

    expect(
      section?.blocks.map((block) => (block.content.kind === "part" ? block.content.part.partType : "tool")),
    ).toEqual(["thinking", "text"]);
    expect(section ? buildHeartbeatSectionClipboardText(section) : "").toContain("[Thinking]");
  });

  test("Scenario: Given JSON and text payloads When text is read Then structured facts stay inspectable", () => {
    const textPart = heartbeatPart({
      partId: 40,
      messageId: "text",
      partType: "text",
      payload: { content: "hello" },
    });
    const jsonPart = heartbeatPart({
      partId: 41,
      messageId: "json",
      partType: "config",
      payload: { ai: { maxToken: 1000 } },
    });

    expect(readHeartbeatPartText(textPart)).toBe("hello");
    expect(readHeartbeatPartText(jsonPart)).toBeNull();
  });

  test("Scenario: Given source rows When clipboard text is built Then exact grouped and section facts remain recoverable", () => {
    const group = heartbeatGroup({
      id: 50,
      kind: "call",
      aiCallId: 9,
      items: [
        heartbeatEntry({
          id: 51,
          role: "assistant",
          parts: [
            heartbeatPart({
              partId: 51,
              messageId: "text-51",
              role: "assistant",
              partType: "text",
              payload: { text: "Exact source text" },
            }),
          ],
        }),
      ],
    });
    const [section] = buildHeartbeatSubjectSections(group);

    expect(buildHeartbeatGroupClipboardText(group)).toContain("group=Call #9");
    expect(section ? buildHeartbeatSectionClipboardText(section) : "").toContain("Exact source text");
  });
});
