import {
  toAttentionCommitRefRecord,
  type AppendAttentionReceiptInput,
  type AttentionCommitCarrier,
  type AttentionCommitRefRecord,
  type AttentionDeliveryProjection,
  type AttentionDispatchRecord,
  type AttentionReceiptRecord,
  type BindAttentionDispatchModelCallInput,
  type CreateAttentionDispatchInput,
  type LoopBusKernelDispatchResult,
  type LoopBusKernelOptions,
  type LoopBusKernelReceiptResult,
  type LoopBusKernelTimeline,
  type QueryAttentionDeliveryTimelineInput,
  type RestoreAttentionDeliveryTimelineInput,
} from "./types";

interface CommitState {
  ref: AttentionCommitRefRecord;
  dispatchIds: string[];
}

const makeKey = (contextId: string, commitId: string): string => `${contextId}:${commitId}`;

export class LoopBusKernel<TResult = void> {
  private readonly commits = new Map<string, CommitState>();
  private readonly dispatches = new Map<string, AttentionDispatchRecord>();
  private readonly dispatchIdsByCommit = new Map<string, string[]>();
  private readonly receipts = new Map<string, AttentionReceiptRecord>();
  private readonly receiptIdsByDispatch = new Map<string, string[]>();
  private readonly now: () => number;
  private readonly createDispatchId: () => string;
  private readonly createReceiptId: () => string;

  constructor(private readonly options: LoopBusKernelOptions<TResult> = {}) {
    this.now = options.now ?? Date.now;
    this.createDispatchId =
      options.createDispatchId ?? (() => `dispatch-${this.now()}-${Math.random().toString(36).slice(2, 8)}`);
    this.createReceiptId =
      options.createReceiptId ?? (() => `receipt-${this.now()}-${Math.random().toString(36).slice(2, 8)}`);
  }

  registerCommitRef(input: AttentionCommitCarrier | AttentionCommitRefRecord): AttentionCommitRefRecord {
    const createdAt = "createdAt" in input ? input.createdAt : this.now();
    const ref = toAttentionCommitRefRecord(input, createdAt);
    const key = makeKey(ref.contextId, ref.commitId);
    const existing = this.commits.get(key);
    if (existing) {
      return existing.ref;
    }
    this.commits.set(key, { ref, dispatchIds: [] });
    this.dispatchIdsByCommit.set(key, []);
    return ref;
  }

  restoreTimeline(input: RestoreAttentionDeliveryTimelineInput): void {
    for (const ref of input.commitRefs ?? []) {
      this.registerCommitRef(ref);
    }

    const sortedDispatches = [...(input.dispatches ?? [])].sort(
      (left, right) => left.createdAt - right.createdAt || left.attemptIndex - right.attemptIndex,
    );
    for (const dispatch of sortedDispatches) {
      const commitRef = this.registerCommitRef({
        contextId: dispatch.contextId,
        commitId: dispatch.commitId,
      });
      const key = makeKey(commitRef.contextId, commitRef.commitId);
      const dispatchIds = this.dispatchIdsByCommit.get(key) ?? [];
      if (!dispatchIds.includes(dispatch.dispatchId)) {
        dispatchIds.push(dispatch.dispatchId);
      }
      dispatchIds.sort((leftId, rightId) => {
        const leftDispatch = this.dispatches.get(leftId) ?? (leftId === dispatch.dispatchId ? dispatch : null);
        const rightDispatch = this.dispatches.get(rightId) ?? (rightId === dispatch.dispatchId ? dispatch : null);
        if (!leftDispatch || !rightDispatch) {
          return leftId.localeCompare(rightId);
        }
        return (
          leftDispatch.createdAt - rightDispatch.createdAt ||
          leftDispatch.attemptIndex - rightDispatch.attemptIndex ||
          leftDispatch.dispatchId.localeCompare(rightDispatch.dispatchId)
        );
      });
      this.dispatches.set(dispatch.dispatchId, { ...dispatch });
      this.dispatchIdsByCommit.set(key, dispatchIds);
      const commitState = this.commits.get(key);
      if (commitState) {
        commitState.dispatchIds = [...dispatchIds];
      }
      this.receiptIdsByDispatch.set(dispatch.dispatchId, this.receiptIdsByDispatch.get(dispatch.dispatchId) ?? []);
    }

    const sortedReceipts = [...(input.receipts ?? [])].sort((left, right) => left.timestamp - right.timestamp);
    for (const receipt of sortedReceipts) {
      if (!this.dispatches.has(receipt.dispatchId)) {
        throw new Error(`unknown dispatchId during restore: ${receipt.dispatchId}`);
      }
      this.receipts.set(receipt.receiptId, { ...receipt });
      const receiptIds = this.receiptIdsByDispatch.get(receipt.dispatchId) ?? [];
      if (!receiptIds.includes(receipt.receiptId)) {
        receiptIds.push(receipt.receiptId);
      }
      receiptIds.sort((leftId, rightId) => {
        const leftReceipt = this.receipts.get(leftId) ?? (leftId === receipt.receiptId ? receipt : null);
        const rightReceipt = this.receipts.get(rightId) ?? (rightId === receipt.receiptId ? receipt : null);
        if (!leftReceipt || !rightReceipt) {
          return leftId.localeCompare(rightId);
        }
        return (
          leftReceipt.timestamp - rightReceipt.timestamp || leftReceipt.receiptId.localeCompare(rightReceipt.receiptId)
        );
      });
      this.receiptIdsByDispatch.set(receipt.dispatchId, receiptIds);
    }
  }

  async createDispatch(input: CreateAttentionDispatchInput): Promise<LoopBusKernelDispatchResult<TResult>> {
    const commitRef = this.registerCommitRef({
      contextId: input.contextId,
      commitId: input.commitId,
    });
    const key = makeKey(input.contextId, input.commitId);
    const dispatchIds = this.dispatchIdsByCommit.get(key) ?? [];
    const dispatch: AttentionDispatchRecord = {
      dispatchId: this.createDispatchId(),
      contextId: input.contextId,
      commitId: input.commitId,
      cycleId: input.cycleId,
      attemptIndex: dispatchIds.length + 1,
      agentCallId: input.agentCallId,
      sessionModelCallId: input.sessionModelCallId ?? null,
      createdAt: input.createdAt ?? this.now(),
    };
    this.dispatches.set(dispatch.dispatchId, dispatch);
    dispatchIds.push(dispatch.dispatchId);
    this.dispatchIdsByCommit.set(key, dispatchIds);
    const commitState = this.commits.get(key);
    if (commitState) {
      commitState.dispatchIds = [...dispatchIds];
    }
    this.receiptIdsByDispatch.set(dispatch.dispatchId, []);

    const hookResults = await this.runDispatchHooks(commitRef, dispatch);
    return { commitRef, dispatch, hookResults };
  }

  bindDispatchModelCall(input: BindAttentionDispatchModelCallInput): AttentionDispatchRecord {
    const dispatch = this.dispatches.get(input.dispatchId);
    if (!dispatch) {
      throw new Error(`unknown dispatchId: ${input.dispatchId}`);
    }
    const updated: AttentionDispatchRecord = {
      ...dispatch,
      sessionModelCallId: input.sessionModelCallId,
    };
    this.dispatches.set(updated.dispatchId, updated);

    const receiptIds = this.receiptIdsByDispatch.get(updated.dispatchId) ?? [];
    for (const receiptId of receiptIds) {
      const receipt = this.receipts.get(receiptId);
      if (!receipt) {
        continue;
      }
      this.receipts.set(receiptId, {
        ...receipt,
        sessionModelCallId: input.sessionModelCallId,
      });
    }

    return updated;
  }

  async appendReceipt(input: AppendAttentionReceiptInput): Promise<LoopBusKernelReceiptResult<TResult>> {
    const dispatch = this.dispatches.get(input.dispatchId);
    if (!dispatch) {
      throw new Error(`unknown dispatchId: ${input.dispatchId}`);
    }
    const commitRef = this.registerCommitRef({
      contextId: dispatch.contextId,
      commitId: dispatch.commitId,
    });
    const receipt: AttentionReceiptRecord = {
      receiptId: this.createReceiptId(),
      dispatchId: dispatch.dispatchId,
      contextId: dispatch.contextId,
      commitId: dispatch.commitId,
      cycleId: dispatch.cycleId,
      attemptIndex: dispatch.attemptIndex,
      agentCallId: dispatch.agentCallId,
      sessionModelCallId: dispatch.sessionModelCallId,
      status: input.status,
      providerEventKind: input.providerEventKind,
      timestamp: input.timestamp ?? this.now(),
      finishReason: input.finishReason,
      usage: input.usage,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      meta: input.meta ? { ...input.meta } : undefined,
    };
    this.receipts.set(receipt.receiptId, receipt);
    const receiptIds = this.receiptIdsByDispatch.get(dispatch.dispatchId) ?? [];
    receiptIds.push(receipt.receiptId);
    this.receiptIdsByDispatch.set(dispatch.dispatchId, receiptIds);

    const hookResults = await this.runReceiptHooks(commitRef, dispatch, receipt);
    return { commitRef, dispatch, receipt, hookResults };
  }

  getDispatch(dispatchId: string): AttentionDispatchRecord | null {
    return this.dispatches.get(dispatchId) ?? null;
  }

  getDeliveryProjection(input: Pick<AttentionCommitRefRecord, "contextId" | "commitId">): AttentionDeliveryProjection | null {
    const key = makeKey(input.contextId, input.commitId);
    const commitState = this.commits.get(key);
    if (!commitState) {
      return null;
    }
    const dispatches = commitState.dispatchIds
      .map((dispatchId) => this.dispatches.get(dispatchId))
      .filter((dispatch): dispatch is AttentionDispatchRecord => dispatch !== undefined);
    if (dispatches.length === 0) {
      return {
        contextId: input.contextId,
        commitId: input.commitId,
        state: "pending",
        attemptCount: 0,
        latestDispatchId: null,
        latestReceiptId: null,
        agentCallId: null,
        sessionModelCallId: null,
        firstAcceptedAt: null,
        latestReceiptAt: null,
        latestError: null,
      };
    }

    const latestDispatch = dispatches[dispatches.length - 1]!;
    const latestDispatchReceiptIds = this.receiptIdsByDispatch.get(latestDispatch.dispatchId) ?? [];
    const latestDispatchReceipts = latestDispatchReceiptIds
      .map((receiptId) => this.receipts.get(receiptId))
      .filter((receipt): receipt is AttentionReceiptRecord => receipt !== undefined);
    const latestReceipt = latestDispatchReceipts[latestDispatchReceipts.length - 1] ?? null;
    const allReceipts = dispatches.flatMap((dispatch) =>
      (this.receiptIdsByDispatch.get(dispatch.dispatchId) ?? [])
        .map((receiptId) => this.receipts.get(receiptId))
        .filter((receipt): receipt is AttentionReceiptRecord => receipt !== undefined),
    );
    const firstAccepted = allReceipts.find((receipt) => receipt.status === "accepted") ?? null;

    return {
      contextId: input.contextId,
      commitId: input.commitId,
      state: latestReceipt?.status ?? "dispatching",
      attemptCount: dispatches.length,
      latestDispatchId: latestDispatch.dispatchId,
      latestReceiptId: latestReceipt?.receiptId ?? null,
      agentCallId: latestDispatch.agentCallId,
      sessionModelCallId: latestDispatch.sessionModelCallId,
      firstAcceptedAt: firstAccepted?.timestamp ?? null,
      latestReceiptAt: latestReceipt?.timestamp ?? null,
      latestError:
        latestReceipt?.status === "errored"
          ? {
              ...(latestReceipt.errorCode ? { code: latestReceipt.errorCode } : {}),
              message: latestReceipt.errorMessage ?? "delivery errored",
            }
          : null,
    };
  }

  queryAttentionDeliveryTimeline(input: QueryAttentionDeliveryTimelineInput): LoopBusKernelTimeline {
    const dispatches = [...this.dispatches.values()]
      .filter((dispatch) => {
        if (input.contextId && dispatch.contextId !== input.contextId) {
          return false;
        }
        if (input.commitId && dispatch.commitId !== input.commitId) {
          return false;
        }
        if (typeof input.cycleId === "number" && dispatch.cycleId !== input.cycleId) {
          return false;
        }
        if (typeof input.sessionModelCallId === "number" && dispatch.sessionModelCallId !== input.sessionModelCallId) {
          return false;
        }
        return true;
      })
      .sort((left, right) => left.createdAt - right.createdAt || left.attemptIndex - right.attemptIndex);
    const limitedDispatches =
      typeof input.limit === "number" && input.limit >= 0 ? dispatches.slice(-input.limit) : dispatches;
    const dispatchIdSet = new Set(limitedDispatches.map((dispatch) => dispatch.dispatchId));
    const receipts = [...this.receipts.values()]
      .filter((receipt) => dispatchIdSet.has(receipt.dispatchId))
      .sort((left, right) => left.timestamp - right.timestamp);
    return {
      dispatches: limitedDispatches,
      receipts,
    };
  }

  listDeliveryProjections(): AttentionDeliveryProjection[] {
    return [...this.commits.values()]
      .map((state) => this.getDeliveryProjection(state.ref))
      .filter((projection): projection is AttentionDeliveryProjection => projection !== null);
  }

  private async runDispatchHooks(
    commitRef: AttentionCommitRefRecord,
    dispatch: AttentionDispatchRecord,
  ): Promise<TResult[]> {
    const hooks = this.options.hooks?.attentionDispatched ?? [];
    const results: TResult[] = [];
    for (const hook of hooks) {
      results.push(
        await hook(
          { commitRef, dispatch },
          {
            contextId: commitRef.contextId,
            commitId: commitRef.commitId,
            dispatchId: dispatch.dispatchId,
            cycleId: dispatch.cycleId,
            agentCallId: dispatch.agentCallId,
            sessionModelCallId: dispatch.sessionModelCallId,
          },
        ),
      );
    }
    return results;
  }

  private async runReceiptHooks(
    commitRef: AttentionCommitRefRecord,
    dispatch: AttentionDispatchRecord,
    receipt: AttentionReceiptRecord,
  ): Promise<TResult[]> {
    const hooks = this.options.hooks?.attentionReceipt ?? [];
    const results: TResult[] = [];
    for (const hook of hooks) {
      results.push(
        await hook(
          { commitRef, dispatch, receipt },
          {
            contextId: commitRef.contextId,
            commitId: commitRef.commitId,
            dispatchId: dispatch.dispatchId,
            cycleId: dispatch.cycleId,
            agentCallId: dispatch.agentCallId,
            sessionModelCallId: dispatch.sessionModelCallId,
          },
        ),
      );
    }
    return results;
  }
}
