import type { CachedResourceState } from "./types";

export const createCachedResourceState = <T>(data: T): CachedResourceState<T> => ({
  data,
  loaded: false,
  loading: false,
  refreshing: false,
  error: null,
  refreshedAt: null,
});

export const beginCachedResourceLoad = <T>(resource: CachedResourceState<T>): CachedResourceState<T> => ({
  ...resource,
  loading: !resource.loaded,
  refreshing: resource.loaded,
  error: null,
});

export const completeCachedResourceLoad = <T>(
  resource: CachedResourceState<T>,
  data: T,
  now = Date.now(),
): CachedResourceState<T> => ({
  ...resource,
  data,
  loaded: true,
  loading: false,
  refreshing: false,
  error: null,
  refreshedAt: now,
});

export const failCachedResourceLoad = <T>(
  resource: CachedResourceState<T>,
  error: string,
): CachedResourceState<T> => ({
  ...resource,
  loading: false,
  refreshing: false,
  error,
});
