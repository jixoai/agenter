import { describe, expect, test, vi } from "vitest";

import {
  ADAPTIVE_ICON_BUTTON_PARTS,
  ADAPTIVE_ICON_BUTTON_TAG,
  ASYNC_SURFACE_TAG,
  ASYNC_SURFACE_PARTS,
  DEFAULT_JSON_VIEWER_MODE,
  HELP_HINT_PARTS,
  HELP_HINT_TAG,
  JSON_VIEWER_PARTS,
  JSON_VIEWER_TAG,
  JSON_VIEWER_GLOBAL_MODE_STORAGE_KEY,
  MARKDOWN_DOCUMENT_PARTS,
  MARKDOWN_DOCUMENT_TAG,
  TOOL_INVOCATION_CARD_PARTS,
  TOOL_INVOCATION_CARD_TAG,
  defineAdaptiveIconButton,
  defineAsyncSurface,
  defineHelpHint,
  defineJsonViewer,
  defineMarkdownDocument,
  defineToolInvocationCard,
  dismissHelpHint,
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

  test("Scenario: Given a human-readable tool title in invocation metadata When the shared card renders Then the visible heading stays user-facing instead of collapsing to the raw tool id", async () => {
    defineToolInvocationCard();

    const element = document.createElement(TOOL_INVOCATION_CARD_TAG) as HTMLElement & {
      invocation: unknown;
      updateComplete?: Promise<unknown>;
      shadowRoot: ShadowRoot | null;
    };
    element.invocation = {
      invocationId: "invoke-1",
      toolName: "terminal.read",
      status: "success",
      meta: { title: "Terminal read" },
      call: { value: { mode: "snapshot" } },
    };
    document.body.append(element);

    await element.updateComplete;

    const shadowText = element.shadowRoot?.textContent?.replace(/\s+/gu, " ").trim() ?? "";
    expect(shadowText).toContain("Terminal read");
    expect(shadowText).toContain("terminal.read");
  });

  test("Scenario: Given help-hint host theming When the Lit atom renders and opens Then css-part slots and host-reflected presentation facts stay available to outer clients", async () => {
    defineHelpHint();

    const identity = {
      helpId: `help-hint-parts-${crypto.randomUUID()}`,
      textContext: "css-part contract",
    };
    await dismissHelpHint(identity);

    const element = document.createElement(HELP_HINT_TAG) as HTMLElement & {
      helpId: string;
      textContext: string;
      updateComplete?: Promise<unknown>;
      shadowRoot: ShadowRoot | null;
    };
    element.helpId = identity.helpId;
    element.textContext = identity.textContext;
    document.body.append(element);

    await element.updateComplete;

    const trigger = element.shadowRoot?.querySelector<HTMLButtonElement>(".trigger");
    const popup = element.shadowRoot?.querySelector<HTMLDivElement>(".popup");
    const content = popup?.querySelector<HTMLDivElement>('[part~="content"]');

    expect(trigger?.getAttribute("part")).toBe(HELP_HINT_PARTS.trigger);
    expect(popup?.getAttribute("part")).toBe(HELP_HINT_PARTS.popup);
    expect(content?.getAttribute("part")).toBe(HELP_HINT_PARTS.content);
    expect(element.getAttribute("data-presentation")).toBe("closed");
    expect(element.hasAttribute("open")).toBe(false);

    trigger?.click();
    await element.updateComplete;

    expect(element.getAttribute("data-presentation")).toBe("active-open");
    expect(element.hasAttribute("open")).toBe(true);
  });

  test("Scenario: Given shared Lit atoms When they render their primary surfaces Then css-part slots and host factual state stay externally themeable", async () => {
    defineAdaptiveIconButton();
    defineAsyncSurface();
    defineJsonViewer();
    defineMarkdownDocument();
    defineToolInvocationCard();

    const adaptive = document.createElement(ADAPTIVE_ICON_BUTTON_TAG) as HTMLElement & {
      label: string;
      labelPriority: string;
      updateComplete?: Promise<unknown>;
      shadowRoot: ShadowRoot | null;
    };
    adaptive.label = "Ops";
    adaptive.labelPriority = "icon-only";
    document.body.append(adaptive);
    await adaptive.updateComplete;
    expect(adaptive.getAttribute("data-icon-only")).toBe("true");
    expect(adaptive.shadowRoot?.querySelector(".root")?.getAttribute("part")).toBe(ADAPTIVE_ICON_BUTTON_PARTS.root);
    expect(adaptive.shadowRoot?.querySelector(".button")?.getAttribute("part")).toBe(ADAPTIVE_ICON_BUTTON_PARTS.button);
    expect(adaptive.shadowRoot?.querySelector(".icon")?.getAttribute("part")).toBe(ADAPTIVE_ICON_BUTTON_PARTS.icon);

    const asyncSurface = document.createElement(ASYNC_SURFACE_TAG) as HTMLElement & {
      state: string;
      updateComplete?: Promise<unknown>;
      shadowRoot: ShadowRoot | null;
    };
    asyncSurface.state = "ready-loading";
    document.body.append(asyncSurface);
    await asyncSurface.updateComplete;
    expect(asyncSurface.getAttribute("data-state")).toBe("ready-loading");
    expect(asyncSurface.shadowRoot?.querySelector(".root")?.getAttribute("part")).toBe(ASYNC_SURFACE_PARTS.root);
    expect(asyncSurface.shadowRoot?.querySelector(".content")?.getAttribute("part")).toBe(ASYNC_SURFACE_PARTS.content);
    expect(asyncSurface.shadowRoot?.querySelector(".overlay")?.getAttribute("part")).toBe(ASYNC_SURFACE_PARTS.overlay);

    const jsonViewer = document.createElement(JSON_VIEWER_TAG) as HTMLElement & {
      value: unknown;
      updateComplete?: Promise<unknown>;
      shadowRoot: ShadowRoot | null;
    };
    jsonViewer.value = { hello: "world" };
    document.body.append(jsonViewer);
    await jsonViewer.updateComplete;
    const menuTrigger = jsonViewer.shadowRoot?.querySelector<HTMLButtonElement>(".menu-trigger");
    menuTrigger?.click();
    await jsonViewer.updateComplete;
    expect(jsonViewer.getAttribute("data-mode")).toBeTruthy();
    expect(jsonViewer.hasAttribute("menu-open")).toBe(true);
    expect(jsonViewer.shadowRoot?.querySelector(".root")?.getAttribute("part")).toBe(JSON_VIEWER_PARTS.root);
    expect(menuTrigger?.getAttribute("part")).toBe(JSON_VIEWER_PARTS.menuTrigger);
    expect(jsonViewer.shadowRoot?.querySelector(".menu")?.getAttribute("part")).toBe(JSON_VIEWER_PARTS.menu);
    expect(jsonViewer.shadowRoot?.querySelector(".content")?.getAttribute("part")).toBe(JSON_VIEWER_PARTS.content);

    const markdown = document.createElement(MARKDOWN_DOCUMENT_TAG) as HTMLElement & {
      value: string;
      mode: string;
      surface: string;
      updateComplete?: Promise<unknown>;
      shadowRoot: ShadowRoot | null;
    };
    markdown.value = "**Hi**";
    markdown.mode = "raw";
    markdown.surface = "muted";
    document.body.append(markdown);
    await markdown.updateComplete;
    expect(markdown.getAttribute("data-mode")).toBe("raw");
    expect(markdown.getAttribute("data-surface")).toBe("muted");
    expect(markdown.shadowRoot?.querySelector(".surface")?.getAttribute("part")).toBe(MARKDOWN_DOCUMENT_PARTS.root);
    expect(markdown.shadowRoot?.querySelector(".viewport")?.getAttribute("part")).toContain(MARKDOWN_DOCUMENT_PARTS.viewport);
    expect(markdown.shadowRoot?.querySelector(".viewport")?.getAttribute("part")).toContain(MARKDOWN_DOCUMENT_PARTS.rawContent);

    const toolCard = document.createElement(TOOL_INVOCATION_CARD_TAG) as HTMLElement & {
      invocation: unknown;
      updateComplete?: Promise<unknown>;
      shadowRoot: ShadowRoot | null;
    };
    toolCard.invocation = {
      invocationId: "invoke-2",
      toolName: "terminal.write",
      status: "running",
      call: { value: { text: "echo hi" } },
    };
    document.body.append(toolCard);
    await toolCard.updateComplete;
    expect(toolCard.getAttribute("data-status")).toBe("running");
    expect(toolCard.shadowRoot?.querySelector(".card")?.getAttribute("part")).toBe(TOOL_INVOCATION_CARD_PARTS.card);
    expect(toolCard.shadowRoot?.querySelector(".header")?.getAttribute("part")).toBe(TOOL_INVOCATION_CARD_PARTS.header);
    expect(toolCard.shadowRoot?.querySelector(".badge")?.getAttribute("part")).toBe(TOOL_INVOCATION_CARD_PARTS.statusBadge);
    expect(toolCard.shadowRoot?.querySelector(".section")?.getAttribute("part")).toContain(TOOL_INVOCATION_CARD_PARTS.section);
  });
});
