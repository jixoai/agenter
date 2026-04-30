import type { AttentionCommit } from "@agenter/attention-system";
import type {
  AttentionCommitRefRecord,
  AttentionDeliveryProjection,
  LoopBusKernelEvent,
  LoopBusKernelTimeline,
  QueryAttentionDeliveryTimelineInput,
  SystemIngressEnvelope,
  SystemKernelHost,
} from "@agenter/loopbus-kernel";

export type RuntimeBoundaryChannel =
  | "world_fact"
  | "capability_projection"
  | "scheduler_signal"
  | "agent_action"
  | "effect_ledger";

export interface RuntimeSystemIngressEnvelope extends SystemIngressEnvelope {
  author: string;
  boundaryChannel: RuntimeBoundaryChannel;
  ingressType?: "commit" | "push";
  changeType?: "update" | "diff";
  target?: string;
  commitMode?: "commit" | "system";
  supersedeActiveSrc?: string;
}

export interface RuntimeIngressCommitResult {
  contextId: string;
  commit: AttentionCommit;
}

export interface RuntimeSystemKernelHost extends SystemKernelHost {
  commitIngress(
    envelope: RuntimeSystemIngressEnvelope,
    input?: { notifyLoop?: boolean },
  ): Promise<RuntimeIngressCommitResult | null>;
  signalIngress(): void;
  queryAttentionDeliveryTimeline(input: QueryAttentionDeliveryTimelineInput): LoopBusKernelTimeline;
  listDeliveryProjections(): AttentionDeliveryProjection[];
}

export interface RuntimeSystemKernelAdapter {
  readonly name: string;
  mount(host: RuntimeSystemKernelHost): void | (() => void);
  bootstrap?(): Promise<void> | void;
  drainIngress?(): Promise<RuntimeSystemIngressEnvelope[] | undefined> | RuntimeSystemIngressEnvelope[] | undefined;
  onKernelEvent?(event: LoopBusKernelEvent): Promise<void> | void;
}

export type RuntimeSystemCommitRef = Pick<AttentionCommitRefRecord, "contextId" | "commitId">;
