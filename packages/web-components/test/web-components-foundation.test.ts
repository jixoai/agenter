import { describe, expect, test, vi } from "vitest";

import {
  ASYNC_SURFACE_TAG,
  DEFAULT_JSON_VIEWER_MODE,
  JSON_VIEWER_GLOBAL_MODE_STORAGE_KEY,
  MARKDOWN_DOCUMENT_TAG,
  defineAsyncSurface,
  defineMarkdownDocument,
  getGlobalJsonViewerModeSnapshot,
  normalizeMarkdownCodeLanguage,
  resolveAsyncSurfaceState,
  resolveJsonViewerMode,
  resolveMarkdownDocumentProfile,
  setGlobalJsonViewerMode,
} from "../src";

describe("Feature: web-components foundation", () => {
  test("Scenario: Given async surface loading and data flags When the shared helper resolves state Then empty and ready surfaces stay behaviorally distinct", () => {
    expect(resolveAsyncSurfaceState({ loading: true, hasData: false })).toBe("empty-loading");
    expect(resolveAsyncSurfaceState({ loading: false, hasData: false })).toBe("empty-idle");
    expect(resolveAsyncSurfaceState({ loading: true, hasData: true })).toBe("ready-loading");
    expect(resolveAsyncSurfaceState({ loading: false, hasData: true })).toBe("ready-idle");
  });

  test("Scenario: Given global and local JSON viewer preferences When mode resolution runs Then invalid values fall back without breaking the global snapshot", () => {
    window.localStorage.removeItem(JSON_VIEWER_GLOBAL_MODE_STORAGE_KEY);
    expect(getGlobalJsonViewerModeSnapshot()).toBe(DEFAULT_JSON_VIEWER_MODE);

    setGlobalJsonViewerMode("fmt-highlight-json");
    expect(window.localStorage.getItem(JSON_VIEWER_GLOBAL_MODE_STORAGE_KEY)).toBe("fmt-highlight-json");
    expect(resolveJsonViewerMode({ localMode: null, globalMode: "fmt-highlight-json" })).toBe("fmt-highlight-json");
    expect(resolveJsonViewerMode({ localMode: "highlight-yaml", globalMode: "fmt-highlight-json" })).toBe("highlight-yaml");
    expect(resolveJsonViewerMode({ localMode: "invalid" as never, globalMode: null })).toBe(DEFAULT_JSON_VIEWER_MODE);
  });

  test("Scenario: Given chat markdown and repeated custom-element registration When the package resolves profile and defines tags Then the defaults stay compact and registration remains idempotent", () => {
    const chatProfile = resolveMarkdownDocumentProfile({ usage: "chat" });
    expect(chatProfile).toMatchObject({
      usage: "chat",
      surface: "plain",
      density: "compact",
      padding: "none",
      syntaxTone: "inherit",
    });
    expect(normalizeMarkdownCodeLanguage("zsh title=terminal")).toBe("bash");

    defineAsyncSurface();
    defineAsyncSurface();
    defineMarkdownDocument();
    defineMarkdownDocument();

    expect(customElements.get(ASYNC_SURFACE_TAG)).toBeDefined();
    expect(customElements.get(MARKDOWN_DOCUMENT_TAG)).toBeDefined();
  });
});
