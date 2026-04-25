import type { AttentionCommit, AttentionCommitHookResult, AttentionContextState } from "@agenter/attention-system";
import {
  LoopBusKernel,
  type AppendAttentionReceiptInput,
  type AttentionCommitRefRecord,
  type AttentionDeliveryProjection,
  type AttentionDispatchRecord,
  type AttentionReceiptRecord,
  type BindAttentionDispatchModelCallInput,
  type CreateAttentionDispatchInput,
  type LoopBusKernelDispatchResult,
  type LoopBusKernelEvent,
  type LoopBusKernelReceiptResult,
  type LoopBusKernelTimeline,
  type QueryAttentionDeliveryTimelineInput,
  type RestoreAttentionDeliveryTimelineInput,
} from "@agenter/loopbus-kernel";

import type { AttentionDispatchedInput, AttentionReceiptInput } from "./loopbus-plugin-runtime";
import type {
  RuntimeIngressCommitResult,
  RuntimeSystemIngressEnvelope,
  RuntimeSystemKernelAdapter,
  RuntimeSystemKernelHost,
} from "./runtime-system-kernel-adapters/types";

interface RuntimeKernelHostOptions {
  commitIngress: (
    envelope: RuntimeSystemIngressEnvelope,
    input: { notifyLoop: boolean },
  ) => Promise<RuntimeIngressCommitResult | null>;
  getAttentionCommit: (input: Pick<AttentionCommitRefRecord, "contextId" | "commitId">) => AttentionCommit | null;
  getAttentionContextState: (contextId: string) => AttentionContextState | null;
  notifyAttentionDispatched?: (
    input: AttentionDispatchedInput,
  ) => Promise<AttentionCommitHookResult[]> | AttentionCommitHookResult[];
  notifyAttentionReceipt?: (
    input: AttentionReceiptInput,
  ) => Promise<AttentionCommitHookResult[]> | AttentionCommitHookResult[];
  recordAttentionHook?: (contextId: string, commitId: string, result: AttentionCommitHookResult) => void;
  recordDispatch?: (dispatch: AttentionDispatchRecord) => void;
  recordReceipt?: (receipt: AttentionReceiptRecord) => void;
  publishAttentionDispatch?: (input: {
    reason: "created" | "bound";
    commitRef: AttentionCommitRefRecord;
    dispatch: AttentionDispatchRecord;
    projection: AttentionDeliveryProjection | null;
  }) => Promise<void> | void;
  publishAttentionReceipt?: (input: {
    commitRef: AttentionCommitRefRecord;
    dispatch: AttentionDispatchRecord;
    receipt: AttentionReceiptRecord;
    projection: AttentionDeliveryProjection | null;
  }) => Promise<void> | void;
  signalIngress?: () => void;
  onAdapterError?: (input: {
    adapterName: string;
    phase: "bootstrap" | "drainIngress" | "onKernelEvent";
    error: unknown;
  }) => void;
}

const flattenHookResults = (results: AttentionCommitHookResult[][]): AttentionCommitHookResult[] => results.flat();

export class RuntimeKernelHost implements RuntimeSystemKernelHost {
  private readonly kernel: LoopBusKernel<AttentionCommitHookResult[]>;
  private readonly adapters: RuntimeSystemKernelAdapter[] = [];
  private readonly cleanups: Array<() => void> = [];

  constructor(private readonly options: RuntimeKernelHostOptions) {
    this.kernel = new LoopBusKernel<AttentionCommitHookResult[]>({
      hooks: {
        attentionDispatched: [async ({ commitRef, dispatch }) => await this.runDispatchedHooks(commitRef, dispatch)],
        attentionReceipt: [
          async ({ commitRef, dispatch, receipt }) => await this.runReceiptHooks(commitRef, dispatch, receipt),
        ],
      },
    });
  }

  mountAdapter(adapter: RuntimeSystemKernelAdapter): void {
    const cleanup = adapter.mount(this);
    this.adapters.push(adapter);
    if (cleanup) {
      this.cleanups.push(cleanup);
    }
  }

  async bootstrap(): Promise<void> {
    for (const adapter of this.adapters) {
      try {
        await adapter.bootstrap?.();
      } catch (error) {
        this.options.onAdapterError?.({
          adapterName: adapter.name,
          phase: "bootstrap",
          error,
        });
      }
    }
  }

  dispose(): void {
    while (this.cleanups.length > 0) {
      this.cleanups.pop()?.();
    }
  }

  signalIngress(): void {
    this.options.signalIngress?.();
  }

  registerCommitRef(input: Pick<AttentionCommitRefRecord, "contextId" | "commitId">): AttentionCommitRefRecord {
    return this.kernel.registerCommitRef(input);
  }

  async commitIngress(
    envelope: RuntimeSystemIngressEnvelope,
    input: { notifyLoop?: boolean } = {},
  ): Promise<RuntimeIngressCommitResult | null> {
    const committed = await this.options.commitIngress(envelope, {
      notifyLoop: input.notifyLoop ?? false,
    });
    if (!committed) {
      return null;
    }
    this.kernel.registerCommitRef({
      contextId: committed.contextId,
      commitId: committed.commit.commitId,
    });
    return committed;
  }

  async drainIngress(): Promise<number> {
    let committed = 0;
    for (const adapter of this.adapters) {
      if (!adapter.drainIngress) {
        continue;
      }
      let envelopes: RuntimeSystemIngressEnvelope[] | undefined;
      try {
        envelopes = await adapter.drainIngress();
      } catch (error) {
        this.options.onAdapterError?.({
          adapterName: adapter.name,
          phase: "drainIngress",
          error,
        });
        continue;
      }
      for (const envelope of envelopes ?? []) {
        const result = await this.commitIngress(envelope, { notifyLoop: false });
        if (result) {
          committed += 1;
        }
      }
    }
    return committed;
  }

  getDeliveryProjection(input: Pick<AttentionCommitRefRecord, "contextId" | "commitId">): AttentionDeliveryProjection | null {
    return this.kernel.getDeliveryProjection(input);
  }

  listDeliveryProjections(): AttentionDeliveryProjection[] {
    return this.kernel.listDeliveryProjections();
  }

  queryAttentionDeliveryTimeline(input: QueryAttentionDeliveryTimelineInput): LoopBusKernelTimeline {
    return this.kernel.queryAttentionDeliveryTimeline(input);
  }

  restoreTimeline(input: RestoreAttentionDeliveryTimelineInput): void {
    this.kernel.restoreTimeline(input);
  }

  async createDispatch(
    input: CreateAttentionDispatchInput,
  ): Promise<LoopBusKernelDispatchResult<AttentionCommitHookResult[]>> {
    const result = await this.kernel.createDispatch(input);
    this.options.recordDispatch?.(result.dispatch);
    this.recordHookResults(result.commitRef, flattenHookResults(result.hookResults));
    await this.options.publishAttentionDispatch?.({
      reason: "created",
      commitRef: result.commitRef,
      dispatch: result.dispatch,
      projection: this.kernel.getDeliveryProjection(result.commitRef),
    });
    await this.publishKernelEvent({
      kind: "attentionDispatched",
      commitRef: result.commitRef,
      dispatch: result.dispatch,
    });
    return result;
  }

  bindDispatchModelCall(input: BindAttentionDispatchModelCallInput): AttentionDispatchRecord {
    const dispatch = this.kernel.bindDispatchModelCall(input);
    this.options.recordDispatch?.(dispatch);
    void this.options.publishAttentionDispatch?.({
      reason: "bound",
      commitRef: {
        contextId: dispatch.contextId,
        commitId: dispatch.commitId,
        createdAt: dispatch.createdAt,
      },
      dispatch,
      projection: this.kernel.getDeliveryProjection({
        contextId: dispatch.contextId,
        commitId: dispatch.commitId,
      }),
    });
    return dispatch;
  }

  async appendReceipt(
    input: AppendAttentionReceiptInput,
  ): Promise<LoopBusKernelReceiptResult<AttentionCommitHookResult[]>> {
    const result = await this.kernel.appendReceipt(input);
    this.options.recordReceipt?.(result.receipt);
    this.recordHookResults(result.commitRef, flattenHookResults(result.hookResults));
    await this.options.publishAttentionReceipt?.({
      commitRef: result.commitRef,
      dispatch: result.dispatch,
      receipt: result.receipt,
      projection: this.kernel.getDeliveryProjection(result.commitRef),
    });
    await this.publishKernelEvent({
      kind: "attentionReceipt",
      commitRef: result.commitRef,
      dispatch: result.dispatch,
      receipt: result.receipt,
    });
    return result;
  }

  private recordHookResults(
    commitRef: Pick<AttentionCommitRefRecord, "contextId" | "commitId">,
    results: AttentionCommitHookResult[],
  ): void {
    for (const result of results) {
      this.options.recordAttentionHook?.(commitRef.contextId, commitRef.commitId, result);
    }
  }

  private async publishKernelEvent(event: LoopBusKernelEvent): Promise<void> {
    for (const adapter of this.adapters) {
      if (!adapter.onKernelEvent) {
        continue;
      }
      try {
        await adapter.onKernelEvent(event);
      } catch (error) {
        this.options.onAdapterError?.({
          adapterName: adapter.name,
          phase: "onKernelEvent",
          error,
        });
      }
    }
  }

  private async runDispatchedHooks(
    commitRef: AttentionCommitRefRecord,
    dispatch: AttentionDispatchRecord,
  ): Promise<AttentionCommitHookResult[]> {
    if (!this.options.notifyAttentionDispatched) {
      return [];
    }
    const commit = this.options.getAttentionCommit(commitRef);
    const context = this.options.getAttentionContextState(commitRef.contextId);
    if (!commit || !context) {
      return [];
    }
    return await this.options.notifyAttentionDispatched({
      contextId: commitRef.contextId,
      context,
      commit,
      dispatch: {
        dispatchId: dispatch.dispatchId,
        cycleId: dispatch.cycleId,
        attemptIndex: dispatch.attemptIndex,
        agentCallId: dispatch.agentCallId,
        sessionModelCallId: dispatch.sessionModelCallId,
        createdAt: dispatch.createdAt,
      },
    });
  }

  private async runReceiptHooks(
    commitRef: AttentionCommitRefRecord,
    dispatch: AttentionDispatchRecord,
    receipt: AttentionReceiptRecord,
  ): Promise<AttentionCommitHookResult[]> {
    if (!this.options.notifyAttentionReceipt) {
      return [];
    }
    const commit = this.options.getAttentionCommit(commitRef);
    const context = this.options.getAttentionContextState(commitRef.contextId);
    if (!commit || !context) {
      return [];
    }
    return await this.options.notifyAttentionReceipt({
      contextId: commitRef.contextId,
      context,
      commit,
      dispatch: {
        dispatchId: dispatch.dispatchId,
        cycleId: dispatch.cycleId,
        attemptIndex: dispatch.attemptIndex,
        agentCallId: dispatch.agentCallId,
        sessionModelCallId: dispatch.sessionModelCallId,
        createdAt: dispatch.createdAt,
      },
      receipt: {
        receiptId: receipt.receiptId,
        status: receipt.status,
        providerEventKind: receipt.providerEventKind,
        timestamp: receipt.timestamp,
        finishReason: receipt.finishReason,
        errorCode: receipt.errorCode,
        errorMessage: receipt.errorMessage,
      },
    });
  }
}
