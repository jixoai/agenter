import type { ScrollViewVirtualizer, ScrollVirtualConfig } from "./scroll-view.types";
import type {
  AnchoredVirtualListResolvedRequest,
  AnchoredVirtualListResolvedTarget,
  AnchoredVirtualListScrollControllerOptions,
  AnchoredVirtualListScrollHandle,
  AnchoredVirtualListScrollStateSnapshot,
} from "./anchored-virtual-list-scroll.types";
import type { ScrollController } from "./named-scroll-controller.types";

/**
 * 让 host 在虚拟化或延迟挂载场景下补充 target 物化逻辑。
 */
export type AnchoredVirtualListTargetResolver = (
  request: AnchoredVirtualListResolvedRequest,
  snapshot: AnchoredVirtualListScrollStateSnapshot,
) => AnchoredVirtualListResolvedTarget | null | Promise<AnchoredVirtualListResolvedTarget | null>;

/**
 * 新的语义化 anchored virtual list 组件 props。
 * 它暂时复用 BottomAnchoredTimeline 的渲染能力，但把 scroll ownership 升级为 shared contract。
 */
export interface AnchoredVirtualListProps<TItem> {
  class?: string;
  viewportClass?: string;
  contentClass?: string;
  viewportRef?: HTMLDivElement | null;
  contentRef?: HTMLDivElement | null;
  viewportTestId?: string;
  onViewportScroll?: (event: Event) => void;
  items: readonly TItem[];
  virtual?: Omit<ScrollVirtualConfig<TItem>, "items" | "initialOffset">;
  virtualizerRef?: ScrollViewVirtualizer | null;
  scrollHandleRef?: AnchoredVirtualListScrollHandle | null;
  scrollControllerRef?: ScrollController | null;
  scrollState?: AnchoredVirtualListScrollStateSnapshot;
  controllerOptions?: AnchoredVirtualListScrollControllerOptions;
  resolveScrollTarget?: AnchoredVirtualListTargetResolver;
  atLatest?: boolean;
  atStart?: boolean;
  latestThreshold?: number;
  startThreshold?: number;
  item?: import("svelte").Snippet<[TItem, number]>;
  empty?: import("svelte").Snippet;
  start?: import("svelte").Snippet;
  end?: import("svelte").Snippet;
}
