import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, test } from "vitest";

import MessageMarkdownContent from "../src/components/message-markdown-content.svelte";
import type { WebChatResourceReference } from "../src/types";

const mountMarkdownContent = (
  value: string,
  options?: {
    resources?: readonly WebChatResourceReference[];
    tone?: "assistant" | "participant" | "viewer";
  },
) => {
  const target = document.createElement("div");
  document.body.append(target);
  const component = mount(MessageMarkdownContent, {
    target,
    props: {
      value,
      resources: options?.resources ?? [],
      tone: options?.tone ?? "participant",
    },
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
  test("Scenario: Given a message bubble When the markdown component mounts Then it owns a readonly non-editable CodeMirror surface", () => {
    const harness = mountMarkdownContent("Readonly bubble text");

    try {
      expect(harness.view.state.facet(EditorState.readOnly)).toBe(true);
      expect(harness.view.state.facet(EditorView.editable)).toBe(false);
    } finally {
      unmount(harness.component);
    }
  });

  test("Scenario: Given a bare URL line When the markdown component mounts Then the URL remains visible in the bubble projection", () => {
    const url = "https://support.claude.com/en/articles/14328960-identity-verification-on-claude";
    const harness = mountMarkdownContent(
      [
        "1. Claude 身份验证  ⭐ 690",
        "   Claude 开始要求用户进行身份验证",
        `   ${url}`,
      ].join("\n"),
    );

    try {
      expect(harness.target.textContent).toContain(url);
      const hiddenUrlFragments = Array.from(harness.target.querySelectorAll(".cm-md-hidden")).filter((element) =>
        element.textContent?.includes(url),
      );
      expect(hiddenUrlFragments).toHaveLength(0);
    } finally {
      unmount(harness.component);
    }
  });

  test("Scenario: Given an inline markdown link When the markdown component mounts Then the destination remains syntax chrome", () => {
    const harness = mountMarkdownContent(
      "[Claude 身份验证](https://support.claude.com/en/articles/14328960-identity-verification-on-claude)",
    );

    try {
      const hiddenLinkSyntax = Array.from(harness.target.querySelectorAll(".cm-md-hidden"))
        .map((element) => element.textContent ?? "")
        .join("");
      expect(hiddenLinkSyntax).toContain("https://support.claude.com/");
      expect(harness.target.textContent).toContain("Claude 身份验证");
    } finally {
      unmount(harness.component);
    }
  });

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
        Array.from(harness.target.querySelectorAll(".cm-line")).some(
          (line) => line.textContent?.includes("| QAQ | owner |") ?? false,
        ),
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
        Array.from(harness.target.querySelectorAll(".cm-line")).some(
          (line) => line.textContent?.includes("```") ?? false,
        ),
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
        Array.from(harness.target.querySelectorAll(".cm-line")).some(
          (line) => line.textContent?.includes("```") ?? false,
        ),
      ).toBe(true);
    } finally {
      unmount(harness.component);
    }
  });

  test("Scenario: Given footnote resource references When the message preview mounts Then inline tokens are replaced and the in-bubble resource bar renders aggregated resource tiles", () => {
    const resources = [
      {
        id: "asset-image-1",
        label: "Image 1",
        tokenText: "[^Image 1]",
        kind: "image",
        detailText: "image resource",
        fileName: "ios26-thread.png",
        url: "https://assets.example/ios26-thread.png",
        previewUrl: "https://assets.example/ios26-thread.png",
        extension: "png",
      },
      {
        id: "comment-1",
        label: "Comment 1",
        tokenText: "[^Comment 1]",
        kind: "comment",
        detailText: "Line scoped note",
        commentText: "Line scoped note",
        extension: "cmt",
      },
    ] satisfies WebChatResourceReference[];
    const harness = mountMarkdownContent(
      [
        "Body stays light with [^Image 1] and [^Comment 1].",
        "",
        "[^Image 1]: [!ios26-thread.png](https://assets.example/ios26-thread.png)",
        "[^Comment 1]: [Line scoped note](msg://room-1/1#L1)",
      ].join("\n"),
      { resources },
    );

    try {
      const tokenButtons = harness.target.querySelectorAll("[part='message-resource-token']");
      expect(tokenButtons).toHaveLength(2);
      expect(Array.from(tokenButtons).map((element) => (element as HTMLElement).dataset.resourceNumber)).toEqual([
        "1",
        "1",
      ]);
      const tokenText = Array.from(tokenButtons)
        .map((element) => element.textContent ?? "")
        .join(" ");
      expect(tokenText).not.toContain("[^Image 1]");
      expect(tokenText).not.toContain("[^Comment 1]");
      expect(harness.target.textContent).not.toContain("[^Image 1]:");
      expect(harness.target.textContent).not.toContain("[^Comment 1]:");

      const resourceBar = harness.target.querySelector("[part='message-attachments']");
      expect(resourceBar).not.toBeNull();
      const resourceIcons = resourceBar?.querySelectorAll("[part='resource-icon-with-number']");
      expect(resourceIcons).toHaveLength(2);
      expect(
        Array.from(resourceIcons ?? []).map((element) => (element as HTMLElement).dataset.resourceNumber),
      ).toEqual(["1", "1"]);
    } finally {
      unmount(harness.component);
    }
  });
});
