import { mount } from "svelte";
import { describe, expect, test } from "vitest";

import HeartbeatRecordDetailTrack from "../../src/heartbeat-record-detail-track.svelte";
import { buildHeartbeatRecordDetailRows } from "../../src/heartbeat-record-detail-model";
import { buildHeartbeatRecordFullTimeline } from "../../src/heartbeat-record-chips";
import { buildHeartbeatSubjectSections } from "../../src/heartbeat-parts";
import type { HeartbeatRecordItem, HeartbeatRecordPartSummary, HeartbeatPartItem } from "../../src";
import { trackMountedComponent } from "../vitest.setup";

const part = (input: {
  partId: number;
  messageId: string;
  role: HeartbeatRecordPartSummary["role"];
  type: string;
  startedAt: number;
  completedAt?: number | null;
  label?: string;
}): HeartbeatRecordPartSummary => ({
  messageId: input.messageId,
  partId: String(input.partId),
  role: input.role,
  type: input.type,
  mimeType: null,
  aiCallId: 77,
  startedAt: input.startedAt,
  completedAt: input.completedAt ?? input.startedAt + 50,
  label: input.label ?? input.type,
  isComplete: input.completedAt !== null,
});

const message = (input: {
  id: number;
  messageId: string;
  role: HeartbeatPartItem["role"];
  createdAt: number;
  updatedAt: number;
  parts: HeartbeatPartItem["parts"];
}): HeartbeatPartItem => ({
  id: input.id,
  messageId: input.messageId,
  windowId: null,
  aiCallId: 77,
  roundIndex: 1,
  scope: "heartbeat_part",
  role: input.role,
  createdAt: input.createdAt,
  updatedAt: input.updatedAt,
  isComplete: input.parts.every((item) => item.isComplete),
  parts: input.parts,
  text: "",
});

describe("Feature: Heartbeat record detail track input projection", () => {
  test("Scenario: Given a model run input When detail renders Then the input station uses the same heartbeat entry card as other chips", () => {
    const record: HeartbeatRecordItem = {
      id: 1,
      recordKey: "record:1",
      kind: "model_call",
      status: "completed",
      primaryAiCallId: 77,
      aiCallIds: [77],
      sourceRefs: [],
      featureFlags: {},
      summary: {
        provider: "openai",
        model: "gpt-test",
        parts: [
          part({
            partId: 1,
            messageId: "input-1",
            role: "user",
            type: "text",
            startedAt: 1_000,
            completedAt: 1_020,
            label: "Open the detail",
          }),
          part({
            partId: 2,
            messageId: "answer-1",
            role: "assistant",
            type: "text",
            startedAt: 1_050,
            completedAt: 1_100,
            label: "Done",
          }),
        ],
        counts: {
          parts: 2,
          toolCalls: 0,
          toolResults: 0,
          errors: 0,
        },
        firstFrameMs: 50,
        thinkingDurationMs: 0,
      },
      previewText: "Done",
      startedAt: 1_000,
      updatedAt: 1_100,
      completedAt: 1_100,
      isComplete: true,
    };

    const inputMessage = message({
      id: 10,
      messageId: "input-1",
      role: "user",
      createdAt: 1_000,
      updatedAt: 1_020,
      parts: [
        {
          partId: 1,
          partIndex: 0,
          messageId: "input-1",
          windowId: null,
          aiCallId: 77,
          roundIndex: 1,
          scope: "heartbeat_part",
          role: "user",
          partType: "text",
          mimeType: null,
          payload: { type: "text", content: "Open the detail" },
          createdAt: 1_000,
          updatedAt: 1_020,
          isComplete: true,
        },
      ],
    });
    const answerMessage = message({
      id: 11,
      messageId: "answer-1",
      role: "assistant",
      createdAt: 1_050,
      updatedAt: 1_100,
      parts: [
        {
          partId: 2,
          partIndex: 0,
          messageId: "answer-1",
          windowId: null,
          aiCallId: 77,
          roundIndex: 1,
          scope: "heartbeat_part",
          role: "assistant",
          partType: "text",
          mimeType: null,
          payload: { type: "text", content: "Done" },
          createdAt: 1_050,
          updatedAt: 1_100,
          isComplete: true,
        },
      ],
    });

    const rows = buildHeartbeatRecordDetailRows(
      [inputMessage, answerMessage],
      new Map([
        ["1", record.summary.parts[0]!],
        ["2", record.summary.parts[1]!],
      ]),
    );
    const sections = buildHeartbeatSubjectSections({
      id: 1,
      groupId: record.recordKey,
      kind: "call",
      aiCallId: record.primaryAiCallId,
      createdAt: record.startedAt,
      updatedAt: record.updatedAt,
      isComplete: record.isComplete,
      items: [inputMessage, answerMessage],
    });
    const timeline = buildHeartbeatRecordFullTimeline(record);

    const component = mount(HeartbeatRecordDetailTrack, {
      target: document.body,
      props: {
        record,
        timeline,
        rows,
        sections,
      },
    });
    trackMountedComponent(component);

    expect(document.querySelector(".station-input-body")).toBeNull();
    expect(document.querySelector('.station-body-copy[data-station-kind="input"] .ag-heartbeat-entry')).not.toBeNull();
    expect(document.body.textContent).toContain("Open the detail");
  });
});
