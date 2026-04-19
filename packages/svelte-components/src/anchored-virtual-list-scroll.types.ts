import type { BottomAnchoredTimelineInsertMotionBatch } from "./bottom-anchored-timeline.types";

/**
 * 共享的锚定虚拟长列表滚动边界。
 * `latest` 对应最新流边缘，`start` 对应历史起点。
 */
export type AnchoredVirtualListScrollEdge = "latest" | "start";

/**
 * 共享滚动意图。
 * `seek` 表示直接去目标，`reveal` 表示尽量少滚动地暴露目标，
 * `pin` 表示保持对某个边界的吸附，`stabilize` 表示处理 prepend/resize/collapse 这类校正。
 */
export type AnchoredVirtualListScrollIntent = "seek" | "reveal" | "pin" | "stabilize";

/**
 * 元素 reveal 的滚动模式。
 */
export type AnchoredVirtualListScrollMode = "always" | "if-needed";

/**
 * 程序化滚动来源。
 * 只描述“谁发起了程序化请求”，不与用户输入状态混用。
 */
export type AnchoredVirtualListScrollRequestSource =
  | "api"
  | "navigation"
  | "mutation"
  | "reconcile"
  | "restore"
  | "shortcut";

/**
 * 程序化滚动优先级。
 * 越高越容易打断已有事务。
 */
export type AnchoredVirtualListScrollPriority = "background" | "default" | "user-blocking" | "critical";

/**
 * 程序化滚动被打断时的策略。
 * `cancel-on-user-input` 表示用户一介入就让出所有权。
 * `cancel-on-higher-priority` 表示只会被更高优先级事务打断。
 * `protected` 表示当前事务短时间内拥有更强的保护。
 */
export type AnchoredVirtualListInterruptionPolicy =
  | "cancel-on-user-input"
  | "cancel-on-higher-priority"
  | "protected";

/**
 * 请求完成边界。
 * `scroll-end` 对应视觉滚动结束，
 * `settle` 对应 observer / layout / virtualizer 进一步稳定完成。
 */
export type AnchoredVirtualListSettleBoundary = "scroll-end" | "settle";

/**
 * 公共滚动目标：流边界。
 */
export interface AnchoredVirtualListEdgeTarget {
  kind: "edge";
  edge: AnchoredVirtualListScrollEdge;
}

/**
 * 公共滚动目标：元素。
 * `selector` 用于延迟解析或虚拟化物化，
 * `element` 用于已经拿到真实 DOM 的场景。
 */
export interface AnchoredVirtualListElementTarget {
  kind: "element";
  selector?: string;
  element?: Element | null;
  block?: ScrollLogicalPosition;
  inline?: ScrollLogicalPosition;
  scrollMode?: AnchoredVirtualListScrollMode;
}

/**
 * 公共滚动目标：位置。
 * 该目标主要保留给 host reconcile / fallback，不鼓励 feature code 常规使用。
 */
export interface AnchoredVirtualListPositionTarget {
  kind: "position";
  top?: number;
  left?: number;
}

/**
 * 公共滚动目标联合类型。
 */
export type AnchoredVirtualListScrollTarget =
  | AnchoredVirtualListEdgeTarget
  | AnchoredVirtualListElementTarget
  | AnchoredVirtualListPositionTarget;

/**
 * 已解析后的元素目标。
 * 协调器内部总是拿真实 DOM 元素来做执行。
 */
export interface AnchoredVirtualListResolvedElementTarget
  extends Omit<AnchoredVirtualListElementTarget, "element"> {
  kind: "element";
  element: Element;
}

/**
 * 已解析后的位置目标。
 * `reason` 说明该位置是用户显式请求，还是协调器做的 fallback / reconcile。
 */
export interface AnchoredVirtualListResolvedPositionTarget {
  kind: "position";
  top: number;
  left: number;
  reason: "requested" | "materialized-fallback" | "reconcile";
}

/**
 * 已解析后的滚动目标联合类型。
 */
export type AnchoredVirtualListResolvedTarget =
  | AnchoredVirtualListEdgeTarget
  | AnchoredVirtualListResolvedElementTarget
  | AnchoredVirtualListResolvedPositionTarget;

/**
 * 规范化后的请求。
 * 外部可省略的默认值在进入协调器后都会被补齐为这个形态。
 */
export interface AnchoredVirtualListResolvedRequest {
  id: string;
  intent: AnchoredVirtualListScrollIntent;
  target: AnchoredVirtualListScrollTarget;
  source: AnchoredVirtualListScrollRequestSource;
  priority: AnchoredVirtualListScrollPriority;
  behavior: ScrollBehavior;
  interruptionPolicy: AnchoredVirtualListInterruptionPolicy;
  settle: AnchoredVirtualListSettleBoundary;
  debugLabel?: string;
}

/**
 * 外部发起滚动时使用的请求。
 */
export interface AnchoredVirtualListScrollRequest {
  id?: string;
  intent: AnchoredVirtualListScrollIntent;
  target: AnchoredVirtualListScrollTarget;
  source?: AnchoredVirtualListScrollRequestSource;
  priority?: AnchoredVirtualListScrollPriority;
  behavior?: ScrollBehavior;
  interruptionPolicy?: AnchoredVirtualListInterruptionPolicy;
  settle?: AnchoredVirtualListSettleBoundary;
  debugLabel?: string;
}

/**
 * 变更通知类型。
 * 这些都是长列表常见的结构性变化。
 */
export type AnchoredVirtualListMutationKind =
  | "append"
  | "prepend"
  | "replace"
  | "resize"
  | "collapse"
  | "expand";

/**
 * 外部把 DOM / virtualizer 变更通知给协调器时使用的记录。
 * `request` 允许 caller 明确指定这次变更后的语义滚动动作。
 */
export interface AnchoredVirtualListMutationRecord {
  kind: AnchoredVirtualListMutationKind;
  request?: AnchoredVirtualListScrollRequest;
  debugLabel?: string;
}

/**
 * 用户输入大类。
 * 这里显式区分桌面与移动端常见输入路径。
 */
export type AnchoredVirtualListUserInputKind =
  | "idle"
  | "direct-manipulation"
  | "wheel"
  | "keyboard"
  | "momentum";

/**
 * 用户输入状态快照。
 */
export interface AnchoredVirtualListUserInputState {
  kind: AnchoredVirtualListUserInputKind;
  active: boolean;
  pointerType: PointerEvent["pointerType"] | "unknown" | null;
  startedAt: number | null;
  lastEventAt: number | null;
}

/**
 * 流边界状态快照。
 */
export interface AnchoredVirtualListEdgeState {
  atLatest: boolean;
  atStart: boolean;
}

/**
 * 事务当前阶段。
 */
export type AnchoredVirtualListScrollPhase =
  | "idle"
  | "deferred"
  | "planning"
  | "materializing"
  | "scrolling"
  | "settling";

/**
 * 事务终态。
 */
export type AnchoredVirtualListTransactionTerminalState =
  | "completed"
  | "cancelled"
  | "superseded"
  | "interrupted"
  | "failed";

/**
 * 对“最终应当落到哪里”的预期描述。
 * 对 edge / element 这种语义目标，数值坐标可以为空。
 */
export interface AnchoredVirtualListEventualScrollPosition {
  target: AnchoredVirtualListScrollTarget | AnchoredVirtualListResolvedTarget | null;
  top: number | null;
  left: number | null;
  behavior: ScrollBehavior;
}

/**
 * 事务快照。
 */
export interface AnchoredVirtualListScrollTransactionSnapshot {
  id: string;
  request: AnchoredVirtualListResolvedRequest;
  phase: Exclude<AnchoredVirtualListScrollPhase, "idle" | "deferred">;
  startedAt: number;
  resolvedTarget: AnchoredVirtualListResolvedTarget | null;
  terminalState: AnchoredVirtualListTransactionTerminalState | null;
  errorMessage: string | null;
}

/**
 * 协调器对外暴露的状态快照。
 */
export interface AnchoredVirtualListScrollStateSnapshot {
  phase: AnchoredVirtualListScrollPhase;
  edge: AnchoredVirtualListEdgeState;
  currentScrollTarget: AnchoredVirtualListScrollTarget | AnchoredVirtualListResolvedTarget | null;
  eventualScrollPosition: AnchoredVirtualListEventualScrollPosition;
  userInput: AnchoredVirtualListUserInputState;
  activeTransaction: AnchoredVirtualListScrollTransactionSnapshot | null;
  pendingTransaction: AnchoredVirtualListResolvedRequest | null;
  lastTerminalState: AnchoredVirtualListTransactionTerminalState | null;
}

/**
 * 执行计划：直接跳到边界。
 */
export interface AnchoredVirtualListEdgeScrollPlan {
  kind: "edge";
  edge: AnchoredVirtualListScrollEdge;
  behavior: ScrollBehavior;
}

/**
 * 执行计划：使用浏览器元素语义滚动。
 */
export interface AnchoredVirtualListElementScrollPlan {
  kind: "element";
  element: Element;
  behavior: ScrollBehavior;
  block: ScrollLogicalPosition;
  inline: ScrollLogicalPosition;
  scrollMode: AnchoredVirtualListScrollMode;
}

/**
 * 执行计划：使用坐标兜底。
 */
export interface AnchoredVirtualListPositionScrollPlan {
  kind: "position";
  top: number;
  left: number;
  behavior: ScrollBehavior;
  reason: AnchoredVirtualListResolvedPositionTarget["reason"];
}

/**
 * 执行计划：当前无需滚动。
 */
export interface AnchoredVirtualListNoopScrollPlan {
  kind: "none";
  reason: "missing-target" | "already-visible";
}

/**
 * 协调器内部执行计划联合类型。
 */
export type AnchoredVirtualListScrollPlan =
  | AnchoredVirtualListEdgeScrollPlan
  | AnchoredVirtualListElementScrollPlan
  | AnchoredVirtualListPositionScrollPlan
  | AnchoredVirtualListNoopScrollPlan;

/**
 * host adapter 的解析返回值支持同步或异步。
 */
export type AnchoredVirtualListMaybePromise<T> = T | Promise<T>;

/**
 * host adapter：把公共语义目标映射到具体平台能力。
 * 这里既承接底层 viewport，也承接虚拟化物化逻辑。
 */
export interface AnchoredVirtualListHostAdapter {
  getViewport(): HTMLDivElement | null;
  getContentRoot(): HTMLElement | null;
  getEdgeState(): AnchoredVirtualListEdgeState;
  readPosition(): { top: number; left: number };
  resolveEdgePosition?(edge: AnchoredVirtualListScrollEdge): { top: number | null; left: number | null };
  resolveTarget(
    request: AnchoredVirtualListResolvedRequest,
    snapshot: AnchoredVirtualListScrollStateSnapshot,
  ): AnchoredVirtualListMaybePromise<AnchoredVirtualListResolvedTarget | null>;
  scrollToEdge(edge: AnchoredVirtualListScrollEdge, behavior: ScrollBehavior): void;
  scrollToPosition(position: AnchoredVirtualListResolvedPositionTarget, behavior: ScrollBehavior): void;
  awaitDomSettle?(signal: AbortSignal): Promise<void>;
}

/**
 * 事务结束后的返回值。
 */
export interface AnchoredVirtualListScrollTransactionResult {
  transactionId: string;
  request: AnchoredVirtualListResolvedRequest;
  resolvedTarget: AnchoredVirtualListResolvedTarget | null;
  terminalState: AnchoredVirtualListTransactionTerminalState;
  errorMessage: string | null;
}

/**
 * 事务前滚动快照。
 * 用于在闭包事务里基于稳定前态做决策。
 */
export interface AnchoredVirtualListTransactionBeforeSnapshot {
  atLatest: boolean;
  atStart: boolean;
  distanceToLatestPx: number;
  distanceToStartPx: number;
  isNearEdge(edge: AnchoredVirtualListScrollEdge, maxDistancePx: number): boolean;
}

/**
 * 事务里引用新增/变更元素时使用的锚点描述。
 */
export interface AnchoredVirtualListMutationAnchor {
  selector?: string;
  element?: Element | null;
}

/**
 * append 事务描述。
 */
export interface AnchoredVirtualListAppendMutation {
  inserted?: readonly AnchoredVirtualListMutationAnchor[];
}

/**
 * prepend 事务描述。
 */
export interface AnchoredVirtualListPrependMutation {
  inserted?: readonly AnchoredVirtualListMutationAnchor[];
}

/**
 * 结构变化事务描述。
 */
export interface AnchoredVirtualListStructuralMutation {
  target?: AnchoredVirtualListMutationAnchor | null;
}

/**
 * 事务内的语义滚动控制器。
 */
export interface AnchoredVirtualListTransactionScrollController {
  pinLatest(options?: { behavior?: ScrollBehavior; debugLabel?: string }): Promise<void>;
  seekStart(options?: { behavior?: ScrollBehavior; debugLabel?: string }): Promise<void>;
  revealElement(
    target: {
      selector?: string;
      element?: Element | null;
      block?: ScrollLogicalPosition;
      inline?: ScrollLogicalPosition;
    },
    options?: { behavior?: ScrollBehavior; ifNeeded?: boolean; debugLabel?: string },
  ): Promise<void>;
}

/**
 * 闭包事务上下文。
 * 允许在事务拥有的挂起点上 await；一旦事务失效，这些 await 会抛出中断错误。
 */
export interface AnchoredVirtualListTransactionContext {
  readonly before: AnchoredVirtualListTransactionBeforeSnapshot;
  readonly signal: AbortSignal;
  readonly scroll: AnchoredVirtualListTransactionScrollController;
  mutation: {
    append(input?: AnchoredVirtualListAppendMutation): void;
    prepend(input?: AnchoredVirtualListPrependMutation): void;
    resize(input?: AnchoredVirtualListStructuralMutation): void;
    collapse(input?: AnchoredVirtualListStructuralMutation): void;
    expand(input?: AnchoredVirtualListStructuralMutation): void;
  };
  anchor: {
    preserve(): void;
  };
  commit(): Promise<void>;
  settled(): Promise<void>;
  guard<T>(promise: Promise<T>): Promise<T>;
  throwIfAborted(): void;
}

/**
 * 闭包事务返回值。
 * `finished` 会在事务完成或被中断时 settle。
 */
export interface AnchoredVirtualListTransactResult<T> {
  signal: AbortSignal;
  finished: Promise<T>;
}

/**
 * 闭包事务自身的优先级与打断策略。
 * 这是 program.tx(...) 与兼容 handle.transact(...) 共用的内核选项。
 */
export interface AnchoredVirtualListTransactionOptions {
  id?: string;
  priority?: AnchoredVirtualListScrollPriority;
  interruptionPolicy?: AnchoredVirtualListInterruptionPolicy;
  debugLabel?: string;
}

/**
 * 外部订阅状态变化时使用的监听器。
 */
export type AnchoredVirtualListScrollStateListener = (
  snapshot: AnchoredVirtualListScrollStateSnapshot,
) => void;

/**
 * 对外暴露的语义化滚动句柄。
 */
export interface AnchoredVirtualListScrollHandle {
  request(request: AnchoredVirtualListScrollRequest): Promise<AnchoredVirtualListScrollTransactionResult>;
  notifyMutation(
    mutation: AnchoredVirtualListMutationRecord,
  ): Promise<AnchoredVirtualListScrollTransactionResult | null>;
  transact<T>(
    update: (transaction: AnchoredVirtualListTransactionContext) => T | Promise<T>,
    options?: AnchoredVirtualListTransactionOptions,
  ): AnchoredVirtualListTransactResult<T>;
  interrupt(reason?: AnchoredVirtualListTransactionTerminalState): void;
  getState(): AnchoredVirtualListScrollStateSnapshot;
  subscribe(listener: AnchoredVirtualListScrollStateListener): () => void;
  awaitScrollEnd(): Promise<void>;
  awaitSettle(): Promise<void>;
}

/**
 * 内部控制器：在 public handle 外，再增加 connect/disconnect 这类宿主生命周期入口。
 */
export interface AnchoredVirtualListScrollController {
  handle: AnchoredVirtualListScrollHandle;
  connect(adapter: AnchoredVirtualListHostAdapter): void;
  disconnect(): void;
  publishInsertMotionBatch(batch: BottomAnchoredTimelineInsertMotionBatch): void;
}

/**
 * 用户输入分类的节流/空闲策略。
 */
export interface AnchoredVirtualListUserInputPolicy {
  wheelIdleMs: number;
  keyboardIdleMs: number;
  directManipulationIdleMs: number;
  momentumIdleMs: number;
}

/**
 * 纯浏览器 planner / driver 的可配置项。
 */
export interface AnchoredVirtualListScrollControllerOptions {
  now?: () => number;
  userInputPolicy?: Partial<AnchoredVirtualListUserInputPolicy>;
  debugLabel?: string;
}
