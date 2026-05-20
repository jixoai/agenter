import { describe, expect, test } from "vitest";

import {
  createLucideSlotId,
  getLucideIconBySlotId,
  loadLucideIconAsset,
  searchLucideIcons,
} from "./lucide-slot-catalog";

describe("Feature: Lucide slot catalog support", () => {
  test("Scenario: Given a search query When matching Lucide icons Then the catalog returns relevant canonical icons", () => {
    const results = searchLucideIcons("terminal", 5);
    expect(results.some((icon) => icon.id === "terminal")).toBe(true);
  });

  test("Scenario: Given a Lucide slot id When resolving metadata Then the canonical icon information is returned", () => {
    const icon = getLucideIconBySlotId(createLucideSlotId("search"));
    expect(icon?.id).toBe("search");
    expect(icon?.label).toBe("Search");
  });

  test("Scenario: Given a selected Lucide icon When loading runtime markup Then the renderer receives SVG-safe markup", async () => {
    const asset = await loadLucideIconAsset("search");
    expect(asset).not.toBeNull();
    expect(asset?.markup).toContain("<g");
    expect(asset?.markup).toContain('stroke="currentColor"');
    expect(asset?.viewBox[2]).toBeLessThan(24);
    expect(asset?.viewBox[3]).toBeLessThan(24);
  });
});
