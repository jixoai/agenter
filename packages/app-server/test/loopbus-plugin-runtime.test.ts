import { describe, expect, test } from "bun:test";

import {
  LoopBusPluginRuntime,
  type AttentionDraft,
  type LoopBusPlugin,
  type LoopSourceReadResult,
  type LoopSourceRef,
} from "../src/loopbus-plugin-runtime";

const createReadResult = (content: string): LoopSourceReadResult => ({
  kind: "snapshot",
  content,
  bytes: content.length,
  fromHash: null,
  toHash: String(content.length),
});

describe("Feature: LoopBus plugin runtime", () => {
  test("Scenario: Given sequential-waterfall hooks When reading invalidated attention Then each hook receives the previous result", async () => {
    const observed: string[] = [];
    const plugins: LoopBusPlugin[] = [
      {
        name: "source",
        setup(api) {
          api.registerSource({
            systemId: "message",
            match: (ref) => ref.systemId === "message",
            read: async () => createReadResult("base"),
            toAttentionDrafts: async (_result, request) => [
              {
                sourceRef: request.ref,
                content: "base",
                from: "message",
              },
            ],
          });
        },
        attentionWillLoad: {
          order: "pre",
          handler(request) {
            observed.push("will:pre");
            return { ...request, mode: "snapshot" };
          },
        },
      },
      {
        name: "transform-a",
        attentionTransform(drafts) {
          observed.push(`transform-a:${drafts[0]?.content ?? ""}`);
          return drafts.map((draft) => ({ ...draft, content: `${draft.content}:a` }));
        },
      },
      {
        name: "transform-b",
        attentionTransform: {
          order: "post",
          handler(drafts) {
            observed.push(`transform-b:${drafts[0]?.content ?? ""}`);
            return drafts.map((draft) => ({ ...draft, content: `${draft.content}:b` }));
          },
        },
      },
    ];
    const runtime = new LoopBusPluginRuntime(plugins);
    await runtime.setup();

    runtime.invalidate({
      systemId: "message",
      subjectId: "message-system",
      reason: "message-committed",
    });

    const drafts = await runtime.readInvalidatedAttentionDrafts();
    expect(drafts).toEqual<AttentionDraft[]>([
      {
        sourceRef: {
          systemId: "message",
          subjectId: "message-system",
          reason: "message-committed",
        },
        content: "base:a:b",
        from: "message",
      },
    ]);
    expect(observed).toEqual(["will:pre", "transform-a:base", "transform-b:base:a"]);
  });

  test("Scenario: Given first hooks When deciding cycle start Then the first authoritative result wins", async () => {
    const calls: string[] = [];
    const runtime = new LoopBusPluginRuntime([
      {
        name: "first-a",
        cycleShouldStart() {
          calls.push("a");
          return null;
        },
      },
      {
        name: "first-b",
        cycleShouldStart() {
          calls.push("b");
          return { allow: false, reason: "deferred" };
        },
      },
      {
        name: "first-c",
        cycleShouldStart() {
          calls.push("c");
          return { allow: true };
        },
      },
    ]);
    await runtime.setup();

    const result = await runtime.shouldStartCycle([
      {
        sourceRef: {
          systemId: "message",
          subjectId: "message-system",
          reason: "message-committed",
        },
        content: "hello",
        from: "user",
      },
    ]);

    expect(result).toEqual({ allow: false, reason: "deferred" });
    expect(calls).toEqual(["a", "b"]);
  });

  test("Scenario: Given parallel attentionCommitted hooks When drafts are committed Then every hook runs for the same batch", async () => {
    const calls: string[] = [];
    const runtime = new LoopBusPluginRuntime([
      {
        name: "source",
        setup(api) {
          api.registerSource({
            systemId: "message",
            match: (ref) => ref.systemId === "message",
            read: async () => createReadResult("hello"),
            toAttentionDrafts: async (_result, request) => [
              {
                sourceRef: request.ref,
                content: "hello",
                from: "message",
              },
            ],
          });
        },
      },
      {
        name: "commit-a",
        attentionCommitted(drafts) {
          calls.push(`a:${drafts.length}`);
        },
      },
      {
        name: "commit-b",
        attentionCommitted(drafts) {
          calls.push(`b:${drafts.length}`);
        },
      },
    ]);
    await runtime.setup();

    runtime.invalidate({
      systemId: "message",
      subjectId: "parallel-check",
      reason: "message-committed",
    });

    const drafts = await runtime.readInvalidatedAttentionDrafts();
    expect(drafts).toHaveLength(1);
    expect(calls.sort()).toEqual(["a:1", "b:1"]);
  });

  test("Scenario: Given exposed services and invalidations When plugins setup Then services are shared and invalidations are coalesced by subject", async () => {
    const refs: LoopSourceRef[] = [];
    const runtime = new LoopBusPluginRuntime([
      {
        name: "service-owner",
        setup(api) {
          api.expose("terminal.focus", {
            record(ref: LoopSourceRef) {
              refs.push(ref);
            },
          });
          api.registerSource({
            systemId: "terminal",
            match: (ref) => ref.systemId === "terminal",
            read: async (request) => createReadResult(request.ref.subjectId),
            toAttentionDrafts: async (result, request) => [
              {
                sourceRef: request.ref,
                content: result.content,
                from: "terminal",
              },
            ],
          });
        },
      },
      {
        name: "service-user",
        setup(api) {
          const service = api.useExposed<{ record: (ref: LoopSourceRef) => void }>("terminal.focus");
          service?.record({
            systemId: "terminal",
            subjectId: "iflow",
            reason: "focus-replaced",
          });
          api.invalidate({
            systemId: "terminal",
            subjectId: "iflow",
            reason: "semantic-change",
            versionHint: 1,
          });
          api.invalidate({
            systemId: "terminal",
            subjectId: "iflow",
            reason: "semantic-change",
            versionHint: 2,
          });
        },
      },
    ]);
    await runtime.setup();

    const drafts = await runtime.readInvalidatedAttentionDrafts();
    expect(refs).toEqual([
      {
        systemId: "terminal",
        subjectId: "iflow",
        reason: "focus-replaced",
      },
    ]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.content).toBe("iflow");
    expect(drafts[0]?.sourceRef.versionHint).toBe(2);
  });
});
