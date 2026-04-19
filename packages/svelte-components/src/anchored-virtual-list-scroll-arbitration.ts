import type {
  AnchoredVirtualListInterruptionPolicy,
  AnchoredVirtualListResolvedRequest,
  AnchoredVirtualListScrollPriority,
  AnchoredVirtualListUserInputKind,
  AnchoredVirtualListUserInputPolicy,
  AnchoredVirtualListUserInputState,
} from "./anchored-virtual-list-scroll.types";

/**
 * 默认输入空闲策略。
 * 数值偏保守，用来明确区分 wheel / keyboard / momentum 的生命周期。
 */
export const DEFAULT_ANCHORED_VIRTUAL_LIST_USER_INPUT_POLICY: AnchoredVirtualListUserInputPolicy = {
  wheelIdleMs: 120,
  keyboardIdleMs: 140,
  directManipulationIdleMs: 96,
  momentumIdleMs: 220,
};

/**
 * 键盘滚动相关按键集合。
 */
export const ANCHORED_VIRTUAL_LIST_SCROLL_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "PageDown",
  "PageUp",
  "Home",
  "End",
  "Space",
]);

const PRIORITY_RANK: Record<AnchoredVirtualListScrollPriority, number> = {
  background: 0,
  default: 1,
  "user-blocking": 2,
  critical: 3,
};

/**
 * 返回 idle 输入状态。
 */
export const createIdleAnchoredVirtualListUserInputState =
  (): AnchoredVirtualListUserInputState => ({
    kind: "idle",
    active: false,
    pointerType: null,
    startedAt: null,
    lastEventAt: null,
  });

/**
 * 合并用户输入策略。
 */
export const resolveAnchoredVirtualListUserInputPolicy = (
  policy?: Partial<AnchoredVirtualListUserInputPolicy>,
): AnchoredVirtualListUserInputPolicy => ({
  ...DEFAULT_ANCHORED_VIRTUAL_LIST_USER_INPUT_POLICY,
  ...policy,
});

/**
 * 判断键盘事件是否属于典型滚动输入。
 */
export const isAnchoredVirtualListKeyboardScrollEvent = (event: KeyboardEvent): boolean =>
  ANCHORED_VIRTUAL_LIST_SCROLL_KEYS.has(event.code) || ANCHORED_VIRTUAL_LIST_SCROLL_KEYS.has(event.key);

/**
 * 比较优先级。
 * 正数表示左侧更高，负数表示右侧更高。
 */
export const compareAnchoredVirtualListScrollPriority = (
  left: AnchoredVirtualListScrollPriority,
  right: AnchoredVirtualListScrollPriority,
): number => PRIORITY_RANK[left] - PRIORITY_RANK[right];

/**
 * 判断当前事务是否应该被用户输入打断。
 */
export const shouldInterruptAnchoredVirtualListRequestForUserInput = (
  request: AnchoredVirtualListResolvedRequest,
): boolean => request.interruptionPolicy === "cancel-on-user-input";

/**
 * 判断当前事务是否可以被更高优先级事务抢占。
 * 同优先级 reconcile 也允许后到的请求取代先到的请求，因为新的几何事实会让旧的 reconcile 失效。
 */
export const shouldInterruptAnchoredVirtualListRequestForPriority = (
  active: AnchoredVirtualListResolvedRequest,
  incoming: AnchoredVirtualListResolvedRequest,
): boolean => {
  if (active.interruptionPolicy === "protected") {
    return false;
  }
  const priorityDelta = compareAnchoredVirtualListScrollPriority(incoming.priority, active.priority);
  if (priorityDelta > 0) {
    return true;
  }
  if (priorityDelta < 0) {
    return false;
  }
  return active.source === "reconcile" && incoming.source === "reconcile";
};

/**
 * 根据输入种类返回对应的空闲延迟。
 */
export const getAnchoredVirtualListUserInputIdleDelay = (
  kind: AnchoredVirtualListUserInputKind,
  policy: AnchoredVirtualListUserInputPolicy,
): number => {
  switch (kind) {
    case "wheel":
      return policy.wheelIdleMs;
    case "keyboard":
      return policy.keyboardIdleMs;
    case "direct-manipulation":
      return policy.directManipulationIdleMs;
    case "momentum":
      return policy.momentumIdleMs;
    case "idle":
      return 0;
  }
};

/**
 * 开始某一类输入。
 */
export const beginAnchoredVirtualListUserInput = (
  current: AnchoredVirtualListUserInputState,
  kind: Exclude<AnchoredVirtualListUserInputKind, "idle">,
  now: number,
  pointerType: AnchoredVirtualListUserInputState["pointerType"] = current.pointerType,
): AnchoredVirtualListUserInputState => ({
  kind,
  active: true,
  pointerType,
  startedAt: current.kind === kind && current.startedAt !== null ? current.startedAt : now,
  lastEventAt: now,
});

/**
 * 把当前输入状态推进到 momentum。
 */
export const promoteAnchoredVirtualListUserInputToMomentum = (
  current: AnchoredVirtualListUserInputState,
  now: number,
): AnchoredVirtualListUserInputState => ({
  kind: "momentum",
  active: true,
  pointerType: current.pointerType,
  startedAt: current.startedAt ?? now,
  lastEventAt: now,
});

/**
 * 清空输入状态。
 */
export const clearAnchoredVirtualListUserInput = (): AnchoredVirtualListUserInputState =>
  createIdleAnchoredVirtualListUserInputState();

/**
 * 判断当前是否处在会阻止低优先级 reconcile 的用户输入阶段。
 */
export const isAnchoredVirtualListUserInputBlocking = (
  state: AnchoredVirtualListUserInputState,
): boolean => state.active && state.kind !== "idle";

/**
 * 根据策略判断请求是否应该在用户输入期间延迟。
 */
export const shouldDeferAnchoredVirtualListRequestForUserInput = (
  request: AnchoredVirtualListResolvedRequest,
  input: AnchoredVirtualListUserInputState,
): boolean => {
  if (!isAnchoredVirtualListUserInputBlocking(input)) {
    return false;
  }
  if (request.priority === "critical") {
    return false;
  }
  return request.source === "reconcile" || request.source === "mutation" || request.intent === "stabilize";
};

/**
 * 把 interruption policy 补齐为更明确的行为语义。
 */
export const resolveAnchoredVirtualListInterruptionPolicy = (
  request: Pick<AnchoredVirtualListResolvedRequest, "priority" | "interruptionPolicy">,
): AnchoredVirtualListInterruptionPolicy => {
  if (request.interruptionPolicy === "protected") {
    return "protected";
  }
  if (request.priority === "critical") {
    return "cancel-on-higher-priority";
  }
  return request.interruptionPolicy;
};
