/**
 * Trigger 成本等级。
 * `frame` 仅用于少数高成本观测；标准聊天路径默认不启用。
 */
export type ScrollTriggerCost = "event" | "observer" | "frame";

/**
 * 可见性 trigger 查询结构。
 */
export interface VisibilityTriggerQuery {
  visible: boolean;
  entered: boolean;
  exited: boolean;
  ratio: number;
  element: Element | null;
}

/**
 * 尺寸 trigger 查询结构。
 */
export interface ResizeTriggerQuery {
  resized: boolean;
  inlineSize: number;
  blockSize: number;
  grew: boolean;
  shrunk: boolean;
  element: Element | null;
}

/**
 * 动作 trigger 查询结构。
 */
export interface ActionTriggerQuery {
  fired: boolean;
  count: number;
  sourceElement: Element | null;
  lastFiredAt: number | null;
}

/**
 * 用户输入 trigger 查询结构。
 */
export interface UserInputTriggerQuery {
  active: boolean;
  entered: boolean;
  exited: boolean;
  kind: "idle" | "wheel" | "keyboard" | "direct-manipulation" | "momentum";
  pointerType: PointerEvent["pointerType"] | "unknown" | null;
  momentum: boolean;
  startedAt: number | null;
  lastEventAt: number | null;
}

/**
 * 逐帧滚动几何 trigger 查询结构。
 */
export interface ScrollMetricsTriggerQuery {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
  changed: boolean;
}

/**
 * 边界 trigger 查询结构。
 */
export interface EdgeTriggerQuery {
  atLatest: boolean;
  atStart: boolean;
  enteredLatest: boolean;
  leftLatest: boolean;
  enteredStart: boolean;
  leftStart: boolean;
  distanceToLatestPx: number;
  distanceToStartPx: number;
}

/**
 * 溢出 trigger 查询结构。
 */
export interface OverflowTriggerQuery {
  overflowing: boolean;
  becameOverflowing: boolean;
  becameContained: boolean;
  overflowPx: number;
  visibleExtentPx: number;
  contentExtentPx: number;
}

/**
 * 集合变化方向。
 */
export type CollectionDeltaDirection = "append" | "prepend" | "replace" | "unknown";

/**
 * 集合变化 trigger 查询结构。
 */
export interface CollectionDeltaTriggerQuery {
  changed: boolean;
  direction: CollectionDeltaDirection;
  insertedKeys: readonly string[];
  removedKeys: readonly string[];
  anchorKey: string | null;
}

/**
 * 物化 trigger 查询结构。
 */
export interface MaterializationTriggerQuery {
  materialized: boolean;
  enteredMaterialized: boolean;
  leftMaterialized: boolean;
  element: Element | null;
  selector: string;
}

/**
 * 插入批次动画类型。
 */
export type InsertBatchMotion = "latest" | "older";

/**
 * 插入批次 trigger 查询结构。
 */
export interface InsertBatchTriggerQuery {
  changed: boolean;
  motion: InsertBatchMotion;
  elements: readonly HTMLElement[];
  extentPx: number;
  nearestElement: HTMLElement | null;
}
