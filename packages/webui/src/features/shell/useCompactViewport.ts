import { useAdaptiveViewport } from "./useAdaptiveViewport";

export const COMPACT_VIEWPORT_QUERY = "(max-width: 1279px)";

export const useCompactViewport = () => useAdaptiveViewport().compact;
