import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, test } from "vitest";

import {
  markdownResourceTokenProjection,
  refreshMarkdownResourceTokenProjectionEffect,
} from "../src/components/message-markdown-resource-token-projection";
import type { WebChatResourceReference } from "../src/types";

const commentResource = {
  id: "comment-1",
  label: "Comment 1",
  tokenText: "[^Comment 1]",
  kind: "comment",
  detailText: "Line scoped note",
  commentText: "Line scoped note",
  extension: "cmt",
} satisfies WebChatResourceReference;

let mountedViews: EditorView[] = [];

const mountEditor = (input: {
  doc: string;
  resolveResources: () => readonly WebChatResourceReference[];
  onOpenResource?: ((resource: WebChatResourceReference) => void) | undefined;
}): HTMLDivElement => {
  const target = document.createElement("div");
  document.body.append(target);
  const view = new EditorView({
    state: EditorState.create({
      doc: input.doc,
      extensions: [
        markdown(),
        markdownResourceTokenProjection({
          resolveResources: input.resolveResources,
          tone: "participant",
          onOpenResource: input.onOpenResource,
        }),
      ],
    }),
    parent: target,
  });
  mountedViews.push(view);
  return target;
};

afterEach(() => {
  for (const view of mountedViews) {
    view.destroy();
  }
  mountedViews = [];
  document.body.innerHTML = "";
});

describe("Feature: Shared CodeMirror resource token projection", () => {
  test("Scenario: Given resources resolve after editor mount When projection refreshes Then the same markdown token becomes an openable resource node", () => {
    let resources: readonly WebChatResourceReference[] = [];
    let openedResourceId: string | null = null;
    const target = mountEditor({
      doc: "Review [^Comment 1] before sending.",
      resolveResources: () => resources,
      onOpenResource: (resource) => {
        openedResourceId = resource.id;
      },
    });
    const editorElement = target.querySelector<HTMLElement>(".cm-editor");
    expect(editorElement).not.toBeNull();
    const view = EditorView.findFromDOM(editorElement!);
    expect(view).not.toBeNull();
    expect(target.querySelector("[part='message-resource-token']")).toBeNull();

    resources = [commentResource];
    view!.dispatch({
      effects: refreshMarkdownResourceTokenProjectionEffect.of(null),
    });

    const token = target.querySelector<HTMLElement>("[part='message-resource-token']");
    expect(token).not.toBeNull();
    expect(token?.dataset.resourceNumber).toBe("1");
    expect(token?.textContent).not.toContain("[^Comment 1]");
    token?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(openedResourceId).toBe("comment-1");
  });

  test("Scenario: Given the cursor enters a projected resource token When selection changes Then writable mode reveals the markdown source text", () => {
    const target = mountEditor({
      doc: "Review [^Comment 1] before sending.",
      resolveResources: () => [commentResource],
    });
    const editorElement = target.querySelector<HTMLElement>(".cm-editor");
    expect(editorElement).not.toBeNull();
    const view = EditorView.findFromDOM(editorElement!);
    expect(view).not.toBeNull();
    expect(target.querySelector("[part='message-resource-token']")).not.toBeNull();

    view!.dispatch({
      selection: {
        anchor: "Review [^".length,
      },
    });

    expect(target.querySelector("[part='message-resource-token']")).toBeNull();
    expect(target.textContent).toContain("[^Comment 1]");
  });
});
