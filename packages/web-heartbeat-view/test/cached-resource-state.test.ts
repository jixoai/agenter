import { describe, expect, test } from "vitest";

import {
  beginCachedResourceLoad,
  completeCachedResourceLoad,
  createCachedResourceState,
  failCachedResourceLoad,
} from "../src";

describe("Feature: Heartbeat cached resource state is explicit", () => {
  test("Scenario: Given a cold resource When loading starts Then loaded empty is not inferred from data length", () => {
    const cold = createCachedResourceState<string[]>([]);
    const loading = beginCachedResourceLoad(cold);

    expect(loading.data).toEqual([]);
    expect(loading.loaded).toBe(false);
    expect(loading.loading).toBe(true);
    expect(loading.refreshing).toBe(false);
  });

  test("Scenario: Given loaded rows When refresh starts Then warm rows are preserved", () => {
    const loaded = completeCachedResourceLoad(createCachedResourceState(["a"]), ["a"], 100);
    const refreshing = beginCachedResourceLoad(loaded);

    expect(refreshing.data).toEqual(["a"]);
    expect(refreshing.loaded).toBe(true);
    expect(refreshing.loading).toBe(false);
    expect(refreshing.refreshing).toBe(true);
  });

  test("Scenario: Given loaded empty and loaded rows When completed Then data length never replaces the loaded fact", () => {
    const loadedEmpty = completeCachedResourceLoad(createCachedResourceState<string[]>([]), [], 100);
    const loadedRows = completeCachedResourceLoad(createCachedResourceState<string[]>([]), ["a"], 200);

    expect(loadedEmpty.data).toEqual([]);
    expect(loadedEmpty.loaded).toBe(true);
    expect(loadedEmpty.loading).toBe(false);
    expect(loadedRows.data).toEqual(["a"]);
    expect(loadedRows.loaded).toBe(true);
    expect(loadedRows.refreshedAt).toBe(200);
  });

  test("Scenario: Given loaded rows When refresh fails Then rows remain mounted with an error fact", () => {
    const loaded = completeCachedResourceLoad(createCachedResourceState(["a"]), ["a"], 100);
    const failed = failCachedResourceLoad(beginCachedResourceLoad(loaded), "network down");

    expect(failed.data).toEqual(["a"]);
    expect(failed.loaded).toBe(true);
    expect(failed.error).toBe("network down");
    expect(failed.refreshing).toBe(false);
  });
});
