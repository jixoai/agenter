import type { VirtualItem } from "@tanstack/svelte-virtual";

import type { ScrollViewVirtualizer, ScrollVirtualConfig } from "./scroll-view.types";

export interface BottomAnchoredTimelineHandle {
  scrollToLatest: (behavior?: ScrollBehavior) => void;
  scrollToStart: (behavior?: ScrollBehavior) => void;
  scrollTowardStart: (deltaPx: number, behavior?: ScrollBehavior) => void;
  readonly atLatest: boolean;
  readonly atStart: boolean;
  readonly viewport: HTMLDivElement | null;
}

export interface BottomAnchoredTimelineProps<TItem> {
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
  timelineRef?: BottomAnchoredTimelineHandle | null;
  atLatest?: boolean;
  atStart?: boolean;
  latestThreshold?: number;
  startThreshold?: number;
  item?: import("svelte").Snippet<[TItem, number]>;
  empty?: import("svelte").Snippet;
  start?: import("svelte").Snippet;
  end?: import("svelte").Snippet;
}

export interface BottomAnchoredTimelineVirtualRow<TItem> {
  value: TItem;
  sourceIndex: number;
  displayIndex: number;
  virtualItem: VirtualItem;
}
