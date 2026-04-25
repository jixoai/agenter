import { describe, expect, test } from "bun:test";

import { LoopBusKernel } from "../src/loopbus-kernel";

describe("Feature: loopbus kernel delivery state", () => {
  test("Scenario: Given a registered commit without attempts When projected Then delivery stays pending", () => {
    const kernel = new LoopBusKernel({ now: () => 100 });

    kernel.registerCommitRef({ contextId: "ctx-room-1", commitId: "commit-1" });

    expect(kernel.getDeliveryProjection({ contextId: "ctx-room-1", commitId: "commit-1" })).toEqual({
      contextId: "ctx-room-1",
      commitId: "commit-1",
      state: "pending",
      attemptCount: 0,
      latestDispatchId: null,
      latestReceiptId: null,
      agentCallId: null,
      sessionModelCallId: null,
      firstAcceptedAt: null,
      latestReceiptAt: null,
      latestError: null,
    });
  });

  test("Scenario: Given a dispatch without receipts When projected Then delivery stays dispatching", async () => {
    const kernel = new LoopBusKernel({ now: () => 100 });

    await kernel.createDispatch({
      contextId: "ctx-room-1",
      commitId: "commit-1",
      cycleId: 7,
      agentCallId: "agent-call-1",
    });

    expect(kernel.getDeliveryProjection({ contextId: "ctx-room-1", commitId: "commit-1" })?.state).toBe("dispatching");
  });

  test("Scenario: Given a first valid SSE When a receipt is appended Then delivery becomes accepted", async () => {
    let now = 100;
    const kernel = new LoopBusKernel({
      now: () => now,
      createDispatchId: () => "dispatch-1",
      createReceiptId: () => "receipt-1",
    });
    await kernel.createDispatch({
      contextId: "ctx-room-1",
      commitId: "commit-1",
      cycleId: 3,
      agentCallId: "agent-call-1",
    });

    now = 120;
    await kernel.appendReceipt({
      dispatchId: "dispatch-1",
      status: "accepted",
      providerEventKind: "text_delta",
    });

    expect(kernel.getDeliveryProjection({ contextId: "ctx-room-1", commitId: "commit-1" })).toEqual({
      contextId: "ctx-room-1",
      commitId: "commit-1",
      state: "accepted",
      attemptCount: 1,
      latestDispatchId: "dispatch-1",
      latestReceiptId: "receipt-1",
      agentCallId: "agent-call-1",
      sessionModelCallId: null,
      firstAcceptedAt: 120,
      latestReceiptAt: 120,
      latestError: null,
    });
  });

  test("Scenario: Given a first provider error When a receipt is appended Then delivery errors without acceptance", async () => {
    let dispatchCounter = 0;
    let receiptCounter = 0;
    const kernel = new LoopBusKernel({
      now: () => 200,
      createDispatchId: () => `dispatch-${++dispatchCounter}`,
      createReceiptId: () => `receipt-${++receiptCounter}`,
    });
    await kernel.createDispatch({
      contextId: "ctx-room-1",
      commitId: "commit-1",
      cycleId: 9,
      agentCallId: "agent-call-1",
    });
    await kernel.appendReceipt({
      dispatchId: "dispatch-1",
      status: "errored",
      providerEventKind: "run_error",
      errorCode: "provider_error",
      errorMessage: "model rejected the stream",
    });

    expect(kernel.getDeliveryProjection({ contextId: "ctx-room-1", commitId: "commit-1" })).toEqual({
      contextId: "ctx-room-1",
      commitId: "commit-1",
      state: "errored",
      attemptCount: 1,
      latestDispatchId: "dispatch-1",
      latestReceiptId: "receipt-1",
      agentCallId: "agent-call-1",
      sessionModelCallId: null,
      firstAcceptedAt: null,
      latestReceiptAt: 200,
      latestError: {
        code: "provider_error",
        message: "model rejected the stream",
      },
    });
  });

  test("Scenario: Given accepted work When completion arrives Then the latest projection becomes completed", async () => {
    let now = 100;
    let receiptCounter = 0;
    const kernel = new LoopBusKernel({
      now: () => now,
      createDispatchId: () => "dispatch-1",
      createReceiptId: () => `receipt-${++receiptCounter}`,
    });
    await kernel.createDispatch({
      contextId: "ctx-room-1",
      commitId: "commit-1",
      cycleId: 5,
      agentCallId: "agent-call-1",
    });
    now = 110;
    await kernel.appendReceipt({
      dispatchId: "dispatch-1",
      status: "accepted",
      providerEventKind: "thinking_delta",
    });
    now = 140;
    await kernel.appendReceipt({
      dispatchId: "dispatch-1",
      status: "completed",
      providerEventKind: "run_finished",
      finishReason: "stop",
      usage: { completionTokens: 10, promptTokens: 20, totalTokens: 30 },
    });

    expect(kernel.getDeliveryProjection({ contextId: "ctx-room-1", commitId: "commit-1" })).toEqual({
      contextId: "ctx-room-1",
      commitId: "commit-1",
      state: "completed",
      attemptCount: 1,
      latestDispatchId: "dispatch-1",
      latestReceiptId: "receipt-2",
      agentCallId: "agent-call-1",
      sessionModelCallId: null,
      firstAcceptedAt: 110,
      latestReceiptAt: 140,
      latestError: null,
    });
  });

  test("Scenario: Given a retry after failure When queried Then both attempts remain while the latest summary wins", async () => {
    let dispatchCounter = 0;
    let receiptCounter = 0;
    let now = 100;
    const kernel = new LoopBusKernel({
      now: () => now,
      createDispatchId: () => `dispatch-${++dispatchCounter}`,
      createReceiptId: () => `receipt-${++receiptCounter}`,
    });

    await kernel.createDispatch({
      contextId: "ctx-room-1",
      commitId: "commit-1",
      cycleId: 1,
      agentCallId: "agent-call-1",
    });
    now = 120;
    await kernel.appendReceipt({
      dispatchId: "dispatch-1",
      status: "errored",
      providerEventKind: "transport_error",
      errorMessage: "socket closed",
    });

    now = 200;
    await kernel.createDispatch({
      contextId: "ctx-room-1",
      commitId: "commit-1",
      cycleId: 2,
      agentCallId: "agent-call-2",
    });
    now = 240;
    await kernel.appendReceipt({
      dispatchId: "dispatch-2",
      status: "accepted",
      providerEventKind: "tool_call_start",
    });

    const projection = kernel.getDeliveryProjection({ contextId: "ctx-room-1", commitId: "commit-1" });
    const timeline = kernel.queryAttentionDeliveryTimeline({ contextId: "ctx-room-1", commitId: "commit-1" });

    expect(projection).toEqual({
      contextId: "ctx-room-1",
      commitId: "commit-1",
      state: "accepted",
      attemptCount: 2,
      latestDispatchId: "dispatch-2",
      latestReceiptId: "receipt-2",
      agentCallId: "agent-call-2",
      sessionModelCallId: null,
      firstAcceptedAt: 240,
      latestReceiptAt: 240,
      latestError: null,
    });
    expect(timeline.dispatches.map((dispatch) => ({ attemptIndex: dispatch.attemptIndex, dispatchId: dispatch.dispatchId }))).toEqual([
      { attemptIndex: 1, dispatchId: "dispatch-1" },
      { attemptIndex: 2, dispatchId: "dispatch-2" },
    ]);
    expect(
      timeline.receipts.map((receipt) => ({
        dispatchId: receipt.dispatchId,
        status: receipt.status,
      })),
    ).toEqual([
      { dispatchId: "dispatch-1", status: "errored" },
      { dispatchId: "dispatch-2", status: "accepted" },
    ]);
  });

  test("Scenario: Given hooks and late ai_call binding When dispatch and receipts are recorded Then hooks observe stable identities", async () => {
    const seen: string[] = [];
    let receiptCounter = 0;
    const kernel = new LoopBusKernel<string>({
      now: () => 100,
      createDispatchId: () => "dispatch-1",
      createReceiptId: () => `receipt-${++receiptCounter}`,
      hooks: {
        attentionDispatched: [
          async ({ dispatch }, context) => {
            seen.push(`dispatch:${dispatch.dispatchId}:${context.agentCallId}`);
            return "dispatch-hook";
          },
        ],
        attentionReceipt: [
          async ({ receipt }, context) => {
            seen.push(`receipt:${receipt.status}:${context.dispatchId}`);
            return "receipt-hook";
          },
        ],
      },
    });

    const dispatchResult = await kernel.createDispatch({
      contextId: "ctx-room-1",
      commitId: "commit-1",
      cycleId: 11,
      agentCallId: "agent-call-1",
    });
    kernel.bindDispatchModelCall({ dispatchId: "dispatch-1", sessionModelCallId: 42 });
    const receiptResult = await kernel.appendReceipt({
      dispatchId: "dispatch-1",
      status: "aborted",
      providerEventKind: "abort",
    });

    expect(dispatchResult.hookResults).toEqual(["dispatch-hook"]);
    expect(receiptResult.hookResults).toEqual(["receipt-hook"]);
    expect(kernel.getDispatch("dispatch-1")?.sessionModelCallId).toBe(42);
    expect(seen).toEqual(["dispatch:dispatch-1:agent-call-1", "receipt:aborted:dispatch-1"]);
  });

  test("Scenario: Given persisted delivery facts When restoring a kernel timeline Then pending and retry history remain queryable without replaying live hooks", () => {
    const kernel = new LoopBusKernel();

    kernel.restoreTimeline({
      commitRefs: [
        {
          contextId: "ctx-room-1",
          commitId: "commit-pending",
          createdAt: 90,
        },
      ],
      dispatches: [
        {
          dispatchId: "dispatch-1",
          contextId: "ctx-room-1",
          commitId: "commit-retried",
          cycleId: 3,
          attemptIndex: 1,
          agentCallId: "agent-call-1",
          sessionModelCallId: 41,
          createdAt: 100,
        },
        {
          dispatchId: "dispatch-2",
          contextId: "ctx-room-1",
          commitId: "commit-retried",
          cycleId: 4,
          attemptIndex: 2,
          agentCallId: "agent-call-2",
          sessionModelCallId: 42,
          createdAt: 200,
        },
      ],
      receipts: [
        {
          receiptId: "receipt-1",
          dispatchId: "dispatch-1",
          contextId: "ctx-room-1",
          commitId: "commit-retried",
          cycleId: 3,
          attemptIndex: 1,
          agentCallId: "agent-call-1",
          sessionModelCallId: 41,
          status: "errored",
          providerEventKind: "transport_error",
          timestamp: 120,
          errorMessage: "socket closed",
        },
        {
          receiptId: "receipt-2",
          dispatchId: "dispatch-2",
          contextId: "ctx-room-1",
          commitId: "commit-retried",
          cycleId: 4,
          attemptIndex: 2,
          agentCallId: "agent-call-2",
          sessionModelCallId: 42,
          status: "accepted",
          providerEventKind: "text_delta",
          timestamp: 240,
        },
      ],
    });

    expect(kernel.getDeliveryProjection({ contextId: "ctx-room-1", commitId: "commit-pending" })?.state).toBe("pending");
    expect(kernel.getDeliveryProjection({ contextId: "ctx-room-1", commitId: "commit-retried" })).toEqual({
      contextId: "ctx-room-1",
      commitId: "commit-retried",
      state: "accepted",
      attemptCount: 2,
      latestDispatchId: "dispatch-2",
      latestReceiptId: "receipt-2",
      agentCallId: "agent-call-2",
      sessionModelCallId: 42,
      firstAcceptedAt: 240,
      latestReceiptAt: 240,
      latestError: null,
    });
    expect(kernel.queryAttentionDeliveryTimeline({ contextId: "ctx-room-1", commitId: "commit-retried" }).dispatches).toHaveLength(2);
  });
});
