import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, test } from "vitest";

import MarkdownPreviewContent from "../src/markdown-preview-content.svelte";

const mountMarkdownPreview = (value: string) => {
  const target = document.createElement("div");
  document.body.append(target);
  const component = mount(MarkdownPreviewContent, {
    target,
    props: {
      value,
      tone: "viewer",
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

describe("Feature: Markdown preview content", () => {
  test("Scenario: Given markdown content When it mounts Then it owns a readonly non-editable CodeMirror surface", () => {
    const harness = mountMarkdownPreview("Readonly note text");

    try {
      expect(harness.view.state.facet(EditorState.readOnly)).toBe(true);
      expect(harness.view.state.facet(EditorView.editable)).toBe(false);
    } finally {
      unmount(harness.component);
    }
  });

  test("Scenario: Given task list markdown When it renders Then task markers are projected as preview checkboxes", () => {
    const harness = mountMarkdownPreview("- [ ] Draft scope\n- [x] Verify behavior");

    try {
      const taskMarkers = harness.target.querySelectorAll(".cm-md-task");
      expect(taskMarkers).toHaveLength(2);
      expect(harness.target.querySelectorAll(".cm-md-task-checked")).toHaveLength(1);
      expect(harness.target.textContent).toContain("Draft scope");
      expect(harness.target.textContent).toContain("Verify behavior");
    } finally {
      unmount(harness.component);
    }
  });
});
