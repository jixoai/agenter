import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, test } from "vitest";

import SqlEditor from "../src/sql-editor.svelte";

const mountSqlEditor = (props: { value: string; disabled?: boolean }) => {
  const target = document.createElement("div");
  document.body.append(target);
  const component = mount(SqlEditor, {
    target,
    props: {
      ariaLabel: "Note SQL query",
      ...props,
    },
  });
  flushSync();

  const editorElement = target.querySelector<HTMLElement>(".cm-editor");
  if (!editorElement) {
    throw new Error("Expected CodeMirror SQL editor element");
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

describe("Feature: SQL editor content", () => {
  test("Scenario: Given SQL text When the editor mounts Then it owns an editable CodeMirror textbox", () => {
    const harness = mountSqlEditor({ value: "select page from note_pages_view" });

    try {
      expect(harness.view.state.facet(EditorState.readOnly)).toBe(false);
      expect(harness.view.state.facet(EditorView.editable)).toBe(true);
      expect(harness.target.querySelector('[role="textbox"]')?.getAttribute("aria-label")).toBe("Note SQL query");
      expect(harness.view.state.doc.toString()).toContain("note_pages_view");
    } finally {
      unmount(harness.component);
    }
  });

  test("Scenario: Given disabled SQL input When the editor mounts Then CodeMirror blocks edits through read-only state", () => {
    const harness = mountSqlEditor({ value: "select 1", disabled: true });

    try {
      expect(harness.view.state.facet(EditorState.readOnly)).toBe(true);
      expect(harness.view.state.facet(EditorView.editable)).toBe(false);
    } finally {
      unmount(harness.component);
    }
  });
});
