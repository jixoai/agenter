import { EditorView } from "@codemirror/view";
import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, test } from "vitest";

import MessageMarkdownContent from "../src/components/message-markdown-content.svelte";
import { collectMarkdownStructuralProjectionState } from "../src/components/message-markdown-hybrid-projection";

const readProjectionState = (
  value: string,
  options?: {
    selection?: {
      anchor: number;
      head?: number;
    };
    revealRanges?: readonly {
      from: number;
      to: number;
    }[];
  },
) => {
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

  const selection = options?.selection;
  if (selection) {
    flushSync(() => {
      view.dispatch({
        selection: {
          anchor: selection.anchor,
          head: selection.head ?? selection.anchor,
        },
      });
    });
  }

  return {
    component,
    projectionState: collectMarkdownStructuralProjectionState(view.state, {
      revealRanges: options?.revealRanges,
    }),
    target,
  };
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Feature: Hybrid markdown projection", () => {
  test("Scenario: Given GFM table markdown When projection descriptors are built Then a table block is emitted instead of a plain paragraph", () => {
    const harness = readProjectionState(`| Name | Role |\n| --- | --- |\n| QAQ | owner |\n| XIHA | member |`);

    try {
      expect(harness.projectionState.projected).toHaveLength(1);
      expect(harness.projectionState.projected[0]).toMatchObject({
        kind: "table",
        sourceLineCount: 4,
        rows: [
          { kind: "header", cells: ["Name", "Role"] },
          { kind: "body", cells: ["QAQ", "owner"] },
          { kind: "body", cells: ["XIHA", "member"] },
        ],
      });
    } finally {
      unmount(harness.component);
    }
  });

  test("Scenario: Given fenced code without lang When projection descriptors are built Then the block is classified as fenced code and not inline code", () => {
    const harness = readProjectionState("```\nplain text\n```");

    try {
      expect(harness.projectionState.projected).toHaveLength(1);
      expect(harness.projectionState.projected[0]).toMatchObject({
        kind: "fenced-code",
        codeLineCount: 1,
        language: "",
        rawInfo: "",
        sourceLineCount: 3,
        code: "plain text",
      });
    } finally {
      unmount(harness.component);
    }
  });

  test("Scenario: Given a structural block When only a collapsed selection exists Then the collector keeps the preview projection until structural focus is explicit", () => {
    const harness = readProjectionState("```\nplain text\n```", {
      selection: { anchor: 0 },
    });

    try {
      expect(harness.projectionState.projected).toHaveLength(1);
      expect(harness.projectionState.revealedRanges).toEqual([]);
    } finally {
      unmount(harness.component);
    }
  });

  test("Scenario: Given a structural block When structural focus explicitly targets it Then the collector reveals raw source without requiring a drag selection", () => {
    const value = "```\nplain text\n```";
    const harness = readProjectionState(value, {
      selection: { anchor: 0 },
      revealRanges: [{ from: 0, to: value.length }],
    });

    try {
      expect(harness.projectionState.projected).toHaveLength(0);
      expect(harness.projectionState.revealedRanges).toEqual([{ from: 0, to: value.length }]);
    } finally {
      unmount(harness.component);
    }
  });

  test("Scenario: Given a structural block When a non-empty selection intersects it Then the collector reveals raw source instead of keeping the overlay projection", () => {
    const value = `| a | b |\n| - | - |\n| 1 | 2 |`;
    const harness = readProjectionState(value, {
      selection: { anchor: 0, head: value.length },
    });

    try {
      expect(harness.projectionState.projected).toHaveLength(0);
      expect(harness.projectionState.revealedRanges).toEqual([{ from: 0, to: value.length }]);
    } finally {
      unmount(harness.component);
    }
  });
});
