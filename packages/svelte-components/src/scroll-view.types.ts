import type { Range, SvelteVirtualizer, VirtualItem, Virtualizer } from "@tanstack/svelte-virtual";

export type ScrollOrientation = "vertical" | "horizontal" | "both";
export type ScrollViewVirtualizer = SvelteVirtualizer<HTMLDivElement, HTMLDivElement>;
export type ScrollVirtualKey = VirtualItem["key"];

export interface ScrollVirtualMeasureInput<TItem> {
  element: HTMLDivElement;
  entry: ResizeObserverEntry | undefined;
  index: number;
  item: TItem;
  virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>;
}

export type ScrollVirtualMeasureHandler<TItem> = (input: ScrollVirtualMeasureInput<TItem>) => number;
export type ScrollVirtualOnChangeHandler = (
  instance: Virtualizer<HTMLDivElement, HTMLDivElement>,
  sync: boolean,
) => void;
export type ScrollVirtualItemSizeAdjustHandler = (
  item: VirtualItem,
  delta: number,
  instance: Virtualizer<HTMLDivElement, HTMLDivElement>,
) => boolean;

export interface ScrollVirtualConfig<TItem> {
  items: readonly TItem[];
  estimateSize: (index: number, item: TItem) => number;
  overscan?: number;
  getItemKey?: (index: number, item: TItem) => ScrollVirtualKey;
  measureElement?: true | ScrollVirtualMeasureHandler<TItem>;
  paddingStart?: number;
  paddingEnd?: number;
  scrollPaddingStart?: number;
  scrollPaddingEnd?: number;
  initialOffset?: number | (() => number);
  rangeExtractor?: (range: Range) => Array<number>;
  gap?: number;
  debug?: boolean;
  enabled?: boolean;
  initialMeasurementsCache?: VirtualItem[];
  isScrollingResetDelay?: number;
  useScrollendEvent?: boolean;
  useAnimationFrameWithResizeObserver?: boolean;
  onChange?: ScrollVirtualOnChangeHandler;
  shouldAdjustScrollPositionOnItemSizeChange?: ScrollVirtualItemSizeAdjustHandler;
}

export interface ScrollViewProps<TItem> {
  class?: string;
  viewportClass?: string;
  contentClass?: string;
  orientation?: ScrollOrientation;
  viewportRef?: HTMLDivElement | null;
  contentRef?: HTMLDivElement | null;
  viewportTestId?: string;
  onViewportScroll?: (event: Event) => void;
  onVirtualSizeChange?: (size: number) => void;
  virtual?: ScrollVirtualConfig<TItem>;
  virtualizerRef?: ScrollViewVirtualizer | null;
  children?: import("svelte").Snippet;
  item?: import("svelte").Snippet<[TItem, number, VirtualItem]>;
  empty?: import("svelte").Snippet;
  before?: import("svelte").Snippet;
  after?: import("svelte").Snippet;
}
