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
      const tableWidget = harness.target.querySelector<HTMLElement>('[data-markdown-structural="table"]');
      expect(tableWidget).not.toBeNull();
      expect(tableWidget?.querySelector(".cm-md-structural-table-scroll")).not.toBeNull();
      expect(tableWidget?.querySelectorAll("th")).toHaveLength(2);
      expect(tableWidget?.textContent).toContain("QAQ");
      expect(tableWidget?.textContent).toContain("owner");
    } finally {
      unmount(harness.component);
    }
  });

  test("Scenario: Given fenced code without lang When the component mounts Then the block uses block-code chrome and no inline-code capsule styling", () => {
    const harness = mountMarkdownContent("```\nplain text\n```");

    try {
      const codeWidget = harness.target.querySelector<HTMLElement>('[data-markdown-structural="fenced-code"]');
      expect(codeWidget).not.toBeNull();
      expect(codeWidget?.querySelector(".cm-md-structural-codeblock")).not.toBeNull();
      expect(codeWidget?.querySelector(".cm-md-inlinecode")).toBeNull();
      expect(codeWidget?.textContent).toContain("plain text");
    } finally {
      unmount(harness.component);
    }
  });

  test("Scenario: Given selection intersecting a projected code block When the projection recomputes Then raw markdown becomes visible", () => {
    const harness = mountMarkdownContent("```\nplain text\n```");

    try {
      const initialWidget = harness.target.querySelector<HTMLElement>('[data-markdown-structural="fenced-code"]');
      expect(initialWidget).not.toBeNull();

      flushSync(() => {
        initialWidget?.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            button: 0,
          }),
        );
      });

      expect(harness.target.querySelector('[data-markdown-structural="fenced-code"]')).toBeNull();
      expect(harness.target.querySelector(".cm-md-hidden")).toBeNull();
      expect(
        Array.from(harness.target.querySelectorAll(".cm-line")).some((line) => line.textContent?.includes("```") ?? false),
      ).toBe(true);
    } finally {
      unmount(harness.component);
    }
  });
});
