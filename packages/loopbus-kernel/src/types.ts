import type { AttentionCommit } from "@agenter/attention-system";

export type AttentionReceiptStatus = "accepted" | "errored" | "aborted" | "completed";

export type AttentionDeliveryState = "pending" | "dispatching" | AttentionReceiptStatus;

export type AttentionReceiptProviderEventKind =
  | "text_delta"
  | "thinking_delta"
  | "tool_call_start"
  | "tool_call_args"
  | "tool_call_end"
  | "run_finished"
  | "run_error"
  | "transport_error"
  | "abort";

export interface AttentionCommitRefRecord {
  contextId: string;
  commitId: string;
  createdAt: number;
}

export interface AttentionDispatchRecord {
  dispatchId: string;
  contextId: string;
  commitId: string;
  cycleId: number;
  attemptIndex: number;
  agentCallId: string;
  sessionModelCallId: number | null;
  createdAt: number;
}

export interface AttentionReceiptUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AttentionReceiptRecord {
  receiptId: string;
  dispatchId: string;
  contextId: string;
  commitId: string;
  cycleId: number;
  attemptIndex: number;
  agentCallId: string;
  sessionModelCallId: number | null;
  status: AttentionReceiptStatus;
  providerEventKind: AttentionReceiptProviderEventKind;
  timestamp: number;
  finishReason?: string | null;
  usage?: AttentionReceiptUsage;
  errorCode?: string;
  errorMessage?: string;
  meta?: Record<string, unknown>;
}

export interface AttentionDeliveryProjection {
  contextId: string;
  commitId: string;
  state: AttentionDeliveryState;
  attemptCount: number;
  latestDispatchId: string | null;
  latestReceiptId: string | null;
  agentCallId: string | null;
  sessionModelCallId: number | null;
  firstAcceptedAt: number | null;
  latestReceiptAt: number | null;
  latestError: {
    code?: string;
    message: string;
  } | null;
}

export interface SystemIngressEnvelope {
  system: string;
  sourceId: string;
  contextKey: string;
  kind: string;
  summary: string;
  content: string;
  format?: string;
  score?: number;
  tags?: string[];
  createdAt: number;
  meta?: Record<string, unknown>;
}

export interface CreateAttentionDispatchInput {
  contextId: string;
  commitId: string;
  cycleId: number;
  agentCallId: string;
  sessionModelCallId?: number | null;
  createdAt?: number;
}

export interface BindAttentionDispatchModelCallInput {
  dispatchId: string;
  sessionModelCallId: number;
}

export interface AppendAttentionReceiptInput {
  dispatchId: string;
  status: AttentionReceiptStatus;
  providerEventKind: AttentionReceiptProviderEventKind;
  timestamp?: number;
  finishReason?: string | null;
  usage?: AttentionReceiptUsage;
  errorCode?: string;
  errorMessage?: string;
  meta?: Record<string, unknown>;
}

export interface QueryAttentionDeliveryTimelineInput {
  contextId?: string;
  commitId?: string;
  cycleId?: number;
  sessionModelCallId?: number;
  limit?: number;
}

export interface LoopBusKernelHookContext {
  contextId?: string;
  commitId?: string;
  dispatchId?: string;
  cycleId?: number;
  agentCallId?: string;
  sessionModelCallId?: number | null;
  signal?: AbortSignal;
}

export interface AttentionDispatchHookInput {
  commitRef: AttentionCommitRefRecord;
  dispatch: AttentionDispatchRecord;
}

export interface AttentionReceiptHookInput {
  commitRef: AttentionCommitRefRecord;
  dispatch: AttentionDispatchRecord;
  receipt: AttentionReceiptRecord;
}

export type LoopBusKernelHook<TInput, TResult = void> = (
  input: TInput,
  context: LoopBusKernelHookContext,
) => Promise<TResult> | TResult;

export interface LoopBusKernelHooks<TResult = void> {
  attentionDispatched?: Array<LoopBusKernelHook<AttentionDispatchHookInput, TResult>>;
  attentionReceipt?: Array<LoopBusKernelHook<AttentionReceiptHookInput, TResult>>;
}

export interface LoopBusKernelOptions<TResult = void> {
  hooks?: LoopBusKernelHooks<TResult>;
  now?: () => number;
  createDispatchId?: () => string;
  createReceiptId?: () => string;
}

export interface LoopBusKernelDispatchResult<TResult = void> {
  commitRef: AttentionCommitRefRecord;
  dispatch: AttentionDispatchRecord;
  hookResults: TResult[];
}

export interface LoopBusKernelReceiptResult<TResult = void> {
  commitRef: AttentionCommitRefRecord;
  dispatch: AttentionDispatchRecord;
  receipt: AttentionReceiptRecord;
  hookResults: TResult[];
}

export interface LoopBusKernelTimeline {
  dispatches: AttentionDispatchRecord[];
  receipts: AttentionReceiptRecord[];
}

export interface RestoreAttentionDeliveryTimelineInput {
  commitRefs?: AttentionCommitRefRecord[];
  dispatches?: AttentionDispatchRecord[];
  receipts?: AttentionReceiptRecord[];
}

export interface SystemKernelAdapter {
  mount(host: SystemKernelHost): void | (() => void);
  bootstrap?(): Promise<void> | void;
  drainIngress?(): Promise<SystemIngressEnvelope[] | undefined> | SystemIngressEnvelope[] | undefined;
  onKernelEvent?(event: LoopBusKernelEvent): Promise<void> | void;
}

export interface SystemKernelHost {
  registerCommitRef(input: Pick<AttentionCommitRefRecord, "contextId" | "commitId">): AttentionCommitRefRecord;
  getDeliveryProjection(input: Pick<AttentionCommitRefRecord, "contextId" | "commitId">): AttentionDeliveryProjection | null;
}

export type LoopBusKernelEvent =
  | {
      kind: "attentionDispatched";
      commitRef: AttentionCommitRefRecord;
      dispatch: AttentionDispatchRecord;
    }
  | {
      kind: "attentionReceipt";
      commitRef: AttentionCommitRefRecord;
      dispatch: AttentionDispatchRecord;
      receipt: AttentionReceiptRecord;
    };

export interface AttentionCommitCarrier {
  contextId: string;
  commitId: string;
}

export const toAttentionCommitRefRecord = (
  input: AttentionCommitCarrier | AttentionCommit,
  createdAt: number,
): AttentionCommitRefRecord => ({
  contextId: input.contextId,
  commitId: input.commitId,
  createdAt,
});
