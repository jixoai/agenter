import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const sidebarSource = readFileSync(resolve(import.meta.dirname, "sidebar.svelte"), "utf8");

describe("Feature: Sidebar mobile presentation law", () => {
  test("Scenario: Given a docked mobile sidebar consumer When reading the shared source Then compact viewports can stay docked without opening a sheet", () => {
    expect(sidebarSource).toContain('mobileMode = "sheet"');
    expect(sidebarSource).toContain('mobileMode?: "sheet" | "docked";');
    expect(sidebarSource).toContain("sidebar.setMobileMode(mobileMode);");
    expect(sidebarSource).toContain("lastNavigationHref && lastNavigationHref !== href");
    expect(sidebarSource).toContain("{:else if sidebar.usesMobileSheet}");
    expect(sidebarSource).toContain('mobileMode === "docked" ? "block" : "hidden md:block"');
    expect(sidebarSource).toContain('mobileMode === "docked" ? "flex" : "hidden md:flex"');
  });

  test("Scenario: Given compact docked navigation When the route changes Then the shared sidebar returns to the icon rail instead of squeezing the page body", () => {
    expect(sidebarSource).toContain('else if (sidebar.isMobile && mobileMode === "docked")');
    expect(sidebarSource).toContain("sidebar.setOpen(false);");
  });
});
