export type ScrollOrientation = "vertical" | "horizontal" | "both";

export interface ScrollVirtualConfig<TItem> {
  items: TItem[];
  itemSize: number;
  overscan?: number;
}

export interface ScrollViewProps<TItem> {
  class?: string;
  viewportClass?: string;
  contentClass?: string;
  orientation?: ScrollOrientation;
  viewportRef?: HTMLElement | null;
  contentRef?: HTMLElement | null;
  viewportTestId?: string;
  onViewportScroll?: (event: Event) => void;
  virtual?: ScrollVirtualConfig<TItem>;
  children?: import("svelte").Snippet;
  item?: import("svelte").Snippet<[TItem, number]>;
  empty?: import("svelte").Snippet;
}
