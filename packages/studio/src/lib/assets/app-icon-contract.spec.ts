import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..", "..", "..");
const staticDir = resolve(packageRoot, "static");
const layoutSource = readFileSync(resolve(packageRoot, "src/routes/+layout.svelte"), "utf8");
const manifest = JSON.parse(readFileSync(resolve(staticDir, "site.webmanifest"), "utf8")) as {
  icons: Array<{ purpose?: string; sizes: string; src: string; type: string }>;
  name: string;
  short_name: string;
};

describe("Feature: App icon asset pipeline", () => {
  test("Scenario: Given generated Studio static assets When checking the filesystem Then favicon and PWA outputs stay present at canonical paths", () => {
    const missing = [
      "favicon.ico",
      "icons/favicon-16.png",
      "icons/favicon-32.png",
      "icons/favicon-light-16.png",
      "icons/favicon-light-32.png",
      "icons/favicon-dark-16.png",
      "icons/favicon-dark-32.png",
      "icons/apple-touch-icon.png",
      "icons/icon-192.png",
      "icons/icon-512.png",
      "icons/icon-maskable-192.png",
      "icons/icon-maskable-512.png",
      "site.webmanifest",
    ].filter((relativePath) => !existsSync(resolve(staticDir, relativePath)));

    expect(missing).toEqual([]);
  });

  test("Scenario: Given the site manifest When reading icon entries Then the Studio exposes both any and maskable icon contracts", () => {
    expect(manifest.name).toBe("Agenter");
    expect(manifest.short_name).toBe("Agenter");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "./icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }),
        expect.objectContaining({ src: "./icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }),
        expect.objectContaining({
          src: "./icons/icon-maskable-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable",
        }),
        expect.objectContaining({
          src: "./icons/icon-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        }),
      ]),
    );
  });

  test("Scenario: Given the root layout head When reading the source Then favicon imports are served from static assets instead of a route-local SVG file", () => {
    expect(layoutSource).toContain("import { asset } from '$app/paths';");
    expect(layoutSource).toContain("const faviconHref = asset('/favicon.ico');");
    expect(layoutSource).toContain("const manifestHref = asset('/site.webmanifest');");
    expect(layoutSource).toContain("const faviconLight16Href = asset('/icons/favicon-light-16.png');");
    expect(layoutSource).toContain("const faviconDark32Href = asset('/icons/favicon-dark-32.png');");
    expect(layoutSource).toContain('<link rel="apple-touch-icon" sizes="180x180" href={appleTouchIconHref} />');
    expect(layoutSource).toContain('media="(prefers-color-scheme: light)"');
    expect(layoutSource).toContain('media="(prefers-color-scheme: dark)"');
    expect(layoutSource).toContain(
      '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f3f0ea" />',
    );
    expect(layoutSource).toContain(
      '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#2d3239" />',
    );
    expect(layoutSource).not.toContain("$lib/assets/favicon.svg");
  });
});
