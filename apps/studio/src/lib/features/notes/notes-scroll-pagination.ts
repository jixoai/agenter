export interface NotesScrollPaginationMetrics {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
  scrollLeft?: number;
  clientWidth?: number;
  scrollWidth?: number;
}

export const NOTES_SCROLL_PAGINATION_THRESHOLD_PX = 192;

const hasScrollMetrics = (target: EventTarget | null): target is EventTarget & NotesScrollPaginationMetrics => {
  if (!target) {
    return false;
  }
  const candidate = target as {
    scrollTop?: unknown;
    clientHeight?: unknown;
    scrollHeight?: unknown;
    scrollLeft?: unknown;
    clientWidth?: unknown;
    scrollWidth?: unknown;
  };
  return (
    typeof candidate.scrollTop === "number" &&
    typeof candidate.clientHeight === "number" &&
    typeof candidate.scrollHeight === "number"
  );
};

export const shouldTriggerNotesScrollPagination = (
  metrics: NotesScrollPaginationMetrics,
  thresholdPx = NOTES_SCROLL_PAGINATION_THRESHOLD_PX,
): boolean => {
  if (
    !Number.isFinite(metrics.scrollTop) ||
    !Number.isFinite(metrics.clientHeight) ||
    !Number.isFinite(metrics.scrollHeight) ||
    metrics.clientHeight <= 0 ||
    metrics.scrollHeight <= 0
  ) {
    return false;
  }
  const threshold = Math.max(0, thresholdPx);
  if (
    typeof metrics.scrollLeft === "number" &&
    typeof metrics.clientWidth === "number" &&
    typeof metrics.scrollWidth === "number" &&
    Number.isFinite(metrics.scrollLeft) &&
    Number.isFinite(metrics.clientWidth) &&
    Number.isFinite(metrics.scrollWidth) &&
    metrics.clientWidth > 0 &&
    metrics.scrollWidth > metrics.clientWidth
  ) {
    return metrics.scrollLeft + metrics.clientWidth + threshold >= metrics.scrollWidth;
  }
  return metrics.scrollTop + metrics.clientHeight + threshold >= metrics.scrollHeight;
};

export const shouldTriggerNotesScrollPaginationFromEvent = (event: Event): boolean => {
  const target = hasScrollMetrics(event.currentTarget)
    ? event.currentTarget
    : hasScrollMetrics(event.target)
      ? event.target
      : null;
  return target ? shouldTriggerNotesScrollPagination(target) : false;
};
