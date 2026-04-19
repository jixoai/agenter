import type { VirtualItem } from "@tanstack/svelte-virtual";

import type { BottomAnchoredInsertMotionBatchEntry } from "./bottom-anchored-insert-motion";
import type { ScrollViewVirtualizer, ScrollVirtualConfig } from "./scroll-view.types";

export interface BottomAnchoredTimelineViewportSnapshot {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
  virtualOffset: number;
  atLatest: boolean;
  atStart: boolean;
}

export type BottomAnchoredTimelineScrollCommand =
  | {
      kind: "edge";
      edge: "latest" | "start";
      behavior: ScrollBehavior;
      source: "imperative";
    }
  | {
      kind: "position";
      top: number;
      left: number;
      behavior: ScrollBehavior;
      source: "imperative" | "virtualizer";
    };

export interface BottomAnchoredTimelineInsertMotionBatch {
  entries: readonly BottomAnchoredInsertMotionBatchEntry[];
  snapshot: BottomAnchoredTimelineViewportSnapshot;
}

export interface BottomAnchoredTimelineHandle {
  scrollToLatest: (behavior?: ScrollBehavior) => void;
  scrollToStart: (behavior?: ScrollBehavior) => void;
  scrollTowardStart: (deltaPx: number, behavior?: ScrollBehavior) => void;
  driver: {
    scrollToEdge: (edge: "latest" | "start", behavior?: ScrollBehavior) => void;
    scrollToPosition: (
      top: number,
      left: number,
      behavior?: ScrollBehavior,
      intentKind?: "latest" | "toward-start" | null,
    ) => void;
  };
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
  onInsertMotionPrepare?: (batch: BottomAnchoredTimelineInsertMotionBatch) => void;
  onScrollCommand?: (command: BottomAnchoredTimelineScrollCommand) => void;
  onInsertMotionBatch?: (batch: BottomAnchoredTimelineInsertMotionBatch) => void;
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
  key: string;
  value: TItem;
  sourceIndex: number;
  displayIndex: number;
  virtualItem: VirtualItem;
}
