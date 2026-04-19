import type {
  AnchoredVirtualListEdgeState,
  AnchoredVirtualListEventualScrollPosition,
  AnchoredVirtualListMutationRecord,
  AnchoredVirtualListResolvedRequest,
  AnchoredVirtualListResolvedTarget,
  AnchoredVirtualListScrollPlan,
  AnchoredVirtualListScrollRequest,
  AnchoredVirtualListScrollStateSnapshot,
} from "./anchored-virtual-list-scroll.types";

/**
 * 生成稳定事务 id。
 */
export const createAnchoredVirtualListRequestId = (): string =>
  `anchored-scroll:${Math.random().toString(36).slice(2, 10)}`;

/**
 * 根据 intent / source 给请求补默认值。
 */
export const normalizeAnchoredVirtualListScrollRequest = (
  request: AnchoredVirtualListScrollRequest,
): AnchoredVirtualListResolvedRequest => {
  const source = request.source ?? "api";
  const priority =
    request.priority ??
    (request.intent === "stabilize" || source === "reconcile"
      ? "background"
      : request.intent === "seek"
        ? "user-blocking"
        : "default");
  const interruptionPolicy =
    request.interruptionPolicy ?? (priority === "critical" ? "cancel-on-higher-priority" : "cancel-on-user-input");
  return {
    id: request.id ?? createAnchoredVirtualListRequestId(),
    intent: request.intent,
    target: request.target,
    source,
    priority,
    behavior: request.behavior ?? "auto",
    interruptionPolicy,
    settle: request.settle ?? (request.intent === "stabilize" ? "settle" : "scroll-end"),
    debugLabel: request.debugLabel,
  };
};

/**
 * 生成默认 mutation -> request 映射。
 * append 交给 host/native anchoring 处理，避免把新增内容强制解释成 pin latest。
 * 第一版默认只在 pinned/latest 场景下，为 resize / collapse / expand 生成 latest-edge stabilize。
 */
export const deriveAnchoredVirtualListMutationRequest = (
  mutation: AnchoredVirtualListMutationRecord,
  edge: AnchoredVirtualListEdgeState,
): AnchoredVirtualListScrollRequest | null => {
  if (mutation.request) {
    return mutation.request;
  }
  switch (mutation.kind) {
    case "append":
      return null;
    case "replace":
    case "resize":
    case "collapse":
    case "expand":
      if (!edge.atLatest) {
        return null;
      }
      return {
        intent: "stabilize",
        target: { kind: "edge", edge: "latest" },
        source: "reconcile",
        priority: "background",
        behavior: "auto",
        settle: "settle",
        debugLabel: mutation.debugLabel,
      };
    case "prepend":
      return null;
  }
};

/**
 * 计划滚动执行路径。
 * 设计目标是优先保留 edge / element 语义，position 只作为 reconcile/fallback。
 */
export const planAnchoredVirtualListScroll = (
  request: AnchoredVirtualListResolvedRequest,
  resolvedTarget: AnchoredVirtualListResolvedTarget | null,
): AnchoredVirtualListScrollPlan => {
  if (!resolvedTarget) {
    return {
      kind: "none",
      reason: "missing-target",
    };
  }
  switch (resolvedTarget.kind) {
    case "edge":
      return {
        kind: "edge",
        edge: resolvedTarget.edge,
        behavior: request.behavior,
      };
    case "element":
      return {
        kind: "element",
        element: resolvedTarget.element,
        behavior: request.behavior,
        block: resolvedTarget.block ?? (request.intent === "seek" ? "nearest" : "nearest"),
        inline: resolvedTarget.inline ?? "nearest",
        scrollMode: resolvedTarget.scrollMode ?? (request.intent === "reveal" ? "if-needed" : "always"),
      };
    case "position":
      return {
        kind: "position",
        top: resolvedTarget.top,
        left: resolvedTarget.left,
        behavior: request.behavior,
        reason: resolvedTarget.reason,
      };
  }
};

/**
 * 把计划映射为 eventual scroll position。
 */
export const resolveAnchoredVirtualListEventualScrollPosition = (
  plan: AnchoredVirtualListScrollPlan,
  request: AnchoredVirtualListResolvedRequest,
  snapshot: AnchoredVirtualListScrollStateSnapshot,
  edgePosition?: { top: number | null; left: number | null },
): AnchoredVirtualListEventualScrollPosition => {
  switch (plan.kind) {
    case "edge":
      return {
        target: { kind: "edge", edge: plan.edge },
        top: edgePosition?.top ?? null,
        left: edgePosition?.left ?? null,
        behavior: plan.behavior,
      };
    case "element":
      return {
        target: {
          kind: "element",
          element: plan.element,
          block: plan.block,
          inline: plan.inline,
          scrollMode: plan.scrollMode,
        },
        top: null,
        left: null,
        behavior: plan.behavior,
      };
    case "position":
      return {
        target: {
          kind: "position",
          top: plan.top,
          left: plan.left,
        },
        top: plan.top,
        left: plan.left,
        behavior: plan.behavior,
      };
    case "none":
      return snapshot.eventualScrollPosition;
  }
};
