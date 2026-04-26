import { EditorView } from "@codemirror/view";
import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, test } from "vitest";

import MessageMarkdownContent from "../src/components/message-markdown-content.svelte";

const mountMarkdownContent = (value: string) => {
  const target = document.createElement("div");
  document.body.append(target);
  const component = mount(MessageMarkdownContent, {
    target,
    props: { value },
  });
  flushSync();

  const editorElement = target.querySelector<HTMLElement>(".cm-editor");
  if (!editorElement) {
    throw new Error("Expected CodeMirror editor element");
  }

  const view = EditorView.findFromDOM(editorElement);
  if (!view) {
    throw new Error("Expected CodeMirror view instance");
  }

  return {
    component,
    target,
    view,
  };
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Feature: Message markdown content preview", () => {
  test("Scenario: Given a table message When the markdown component mounts Then it renders a scrollable table preview inside the bubble", () => {
    const harness = mountMarkdownContent(`| Name | Role |\n| --- | --- |\n| QAQ | owner |`);

    try {
      const tableOverlay = harness.target.querySelector<HTMLElement>('[data-markdown-structural="table"]');
      expect(tableOverlay).not.toBeNull();
      expect(tableOverlay?.querySelector(".cm-md-structural-table-scroll")).not.toBeNull();
      expect(tableOverlay?.querySelectorAll("th")).toHaveLength(2);
      expect(tableOverlay?.textContent).toContain("QAQ");
      expect(tableOverlay?.textContent).toContain("owner");
      expect(tableOverlay?.style.getPropertyValue("--md-structural-line-count")).toBe("3");
    } finally {
      unmount(harness.component);
    }
  });

  test("Scenario: Given fenced code without lang When the component mounts Then the block uses block-code chrome and no inline-code capsule styling", () => {
    const harness = mountMarkdownContent("```\nplain text\n```");

    try {
      const codeOverlay = harness.target.querySelector<HTMLElement>('[data-markdown-structural="fenced-code"]');
      expect(codeOverlay).not.toBeNull();
      expect(codeOverlay?.querySelector(".cm-md-structural-codeblock")).not.toBeNull();
      expect(codeOverlay?.querySelector(".cm-md-inlinecode")).toBeNull();
      expect(codeOverlay?.textContent).toContain("plain text");
      expect(codeOverlay?.style.getPropertyValue("--md-structural-line-count")).toBe("3");
    } finally {
      unmount(harness.component);
    }
  });

  test("Scenario: Given a table preview When the user focuses it Then raw markdown becomes visible without requiring a drag selection", () => {
    const harness = mountMarkdownContent(`| Name | Role |\n| --- | --- |\n| QAQ | owner |`);

    try {
      const tableOverlay = harness.target.querySelector<HTMLElement>('[data-markdown-structural="table"]');
      expect(tableOverlay).not.toBeNull();
      const tableSurface = tableOverlay?.querySelector<HTMLElement>(".cm-md-structural-table-surface");
      expect(tableSurface).not.toBeNull();

      flushSync(() => {
        tableSurface?.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            button: 0,
          }),
        );
      });

      expect(harness.target.querySelector('[data-markdown-structural="table"]')).toBeNull();
      expect(harness.target.querySelector(".cm-md-structural-source-hidden")).toBeNull();
      expect(
        Array.from(harness.target.querySelectorAll(".cm-line")).some((line) => line.textContent?.includes("| QAQ | owner |") ?? false),
      ).toBe(true);
    } finally {
      unmount(harness.component);
    }
  });

  test("Scenario: Given selection intersecting a projected code block When the projection recomputes Then raw markdown becomes visible", () => {
    const harness = mountMarkdownContent("```\nplain text\n```");

    try {
      const initialOverlay = harness.target.querySelector<HTMLElement>('[data-markdown-structural="fenced-code"]');
      expect(initialOverlay).not.toBeNull();

      flushSync(() => {
        harness.view.dispatch({
          selection: {
            anchor: 0,
            head: harness.view.state.doc.length,
          },
        });
      });

      expect(harness.target.querySelector('[data-markdown-structural="fenced-code"]')).toBeNull();
      expect(harness.target.querySelector(".cm-md-structural-source-hidden")).toBeNull();
      expect(
        Array.from(harness.target.querySelectorAll(".cm-line")).some((line) => line.textContent?.includes("```") ?? false),
      ).toBe(true);
    } finally {
      unmount(harness.component);
    }
  });

  test("Scenario: Given a code preview When the user focuses it Then raw markdown becomes visible without requiring a drag selection", () => {
    const harness = mountMarkdownContent("```\nplain text\n```");

    try {
      const codeOverlay = harness.target.querySelector<HTMLElement>('[data-markdown-structural="fenced-code"]');
      expect(codeOverlay).not.toBeNull();
      const codeSurface = codeOverlay?.querySelector<HTMLElement>(".cm-md-structural-code-surface");
      expect(codeSurface).not.toBeNull();

      flushSync(() => {
        codeSurface?.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            button: 0,
          }),
        );
      });

      expect(harness.target.querySelector('[data-markdown-structural="fenced-code"]')).toBeNull();
      expect(harness.target.querySelector(".cm-md-structural-source-hidden")).toBeNull();
      expect(
        Array.from(harness.target.querySelectorAll(".cm-line")).some((line) => line.textContent?.includes("```") ?? false),
      ).toBe(true);
    } finally {
      unmount(harness.component);
    }
  });
});
