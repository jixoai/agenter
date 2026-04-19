import type { AnchoredVirtualListTransactionTerminalState } from "./anchored-virtual-list-scroll.types";

/**
 * 事务被用户输入或更高优先级流程打断时抛出的结构化错误。
 */
export class AnchoredVirtualListAbortError extends Error {
  readonly reason: Exclude<AnchoredVirtualListTransactionTerminalState, "completed" | "failed">;

  constructor(reason: Exclude<AnchoredVirtualListTransactionTerminalState, "completed" | "failed">) {
    super(`Anchored virtual list transaction aborted: ${reason}`);
    this.name = "AnchoredVirtualListAbortError";
    this.reason = reason;
  }
}

/**
 * 判断一个异常是否为共享滚动事务的结构化中断。
 */
export const isAnchoredVirtualListAbortError = (value: unknown): value is AnchoredVirtualListAbortError =>
  value instanceof AnchoredVirtualListAbortError;
