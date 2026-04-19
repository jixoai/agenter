import type {
  AnchoredVirtualListHostAdapter,
  AnchoredVirtualListInterruptionPolicy,
  AnchoredVirtualListScrollPriority,
  AnchoredVirtualListTransactionContext,
  AnchoredVirtualListTransactResult,
} from "./anchored-virtual-list-scroll.types";
import type { ScrollTriggerCost } from "./named-scroll-trigger.types";

/**
 * 触发器命名键。
 * 当前只支持单段 JS-safe identifier。
 */
export interface ScrollTriggerName<TQuery> {
  readonly key: string;
}

/**
 * 统一的 query tree 形态。
 * 每个名字映射到一个 trigger family 的 query 子树。
 */
export type ScrollQueryTree = Record<string, unknown>;

/**
 * Query 订阅监听器。
 */
export type ScrollQueryListener = (query: ScrollQueryTree) => void;

/**
 * 观察到的 DOM 句柄集合。
 * 不同 trigger 只读取自己关心的节点。
 */
export interface ScrollObservedDom {
  viewport?: HTMLElement | null;
  content?: HTMLElement | null;
  element?: Element | null;
}

/**
 * tx 选项。
 */
export interface ScrollTxOptions {
  priority?: AnchoredVirtualListScrollPriority;
  interruptionPolicy?: AnchoredVirtualListInterruptionPolicy;
  debugLabel?: string;
}

/**
 * 对外可见的 active tx 快照。
 */
export interface ScrollTxSnapshot {
  id: string;
  priority: AnchoredVirtualListScrollPriority;
  interruptionPolicy: AnchoredVirtualListInterruptionPolicy;
  startedAt: number;
  debugLabel?: string;
}

/**
 * 程序可用的 tx 结果。
 */
export type ScrollTxResult<T> = AnchoredVirtualListTransactResult<T>;

/**
 * Program controller。
 * 只有 program 内部能拿到 tx(...)。
 */
export interface ScrollProgramController {
  readonly query: ScrollQueryTree;
  tx<T>(
    effect: (tx: AnchoredVirtualListTransactionContext) => T | Promise<T>,
    options?: ScrollTxOptions,
  ): Promise<ScrollTxResult<T>>;
}

/**
 * 安装到 controller 上的 program。
 */
export type ScrollProgram = (controller: ScrollProgramController) => void | Promise<void>;

/**
 * Named trigger public controller。
 */
export interface ScrollController {
  connect(adapter: AnchoredVirtualListHostAdapter): void;
  disconnect(): void;
  install(program: ScrollProgram): () => void;
  getQuery(): ScrollQueryTree;
  subscribe(listener: ScrollQueryListener): () => void;
  getActiveTx(): ScrollTxSnapshot | null;
}

/**
 * Trigger 家族定义。
 */
export interface ScrollTrigger<TQuery> {
  readonly family: string;
  readonly cost: ScrollTriggerCost;
  observe(dom: ScrollObservedDom): ScrollTriggerBinding<TQuery>;
}

/**
 * Trigger 绑定。
 */
export interface ScrollTriggerBinding<TQuery> {
  connect(
    controller: ScrollController,
    options: { name: ScrollTriggerName<TQuery> },
  ): () => void;
}

/**
 * trigger runtime 对 controller 暴露的内部 registration 句柄。
 */
export interface ScrollTriggerRegistration {
  notify(): void;
  disconnect(): void;
}

/**
 * 每个 binding 注册到 controller 时提供的内部描述。
 */
export interface ScrollTriggerRegistrationInput {
  readonly family: string;
  readonly cost: ScrollTriggerCost;
  readQuery(): Record<string, unknown>;
  consume(): void;
}

/**
 * controller 私有扩展符号。
 * binding.connect(...) 通过它注册到 controller。
 */
export const SCROLL_CONTROLLER_INTERNALS = Symbol("ScrollControllerInternals");

/**
 * controller 内部接口。
 */
export interface ScrollControllerInternals {
  registerTrigger(name: string, input: ScrollTriggerRegistrationInput): ScrollTriggerRegistration;
}

/**
 * 让 binding 能安全读取 controller 内部接口。
 */
export type ScrollControllerWithInternals = ScrollController & {
  [SCROLL_CONTROLLER_INTERNALS]: ScrollControllerInternals;
};
