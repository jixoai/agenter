import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, waitFor, within } from "storybook/test";

import Harness from "./chat-composer-stage-harness.svelte";
import ResourceProjectionHarness from "./chat-resource-projection-harness.svelte";

const meta = {
  title: "WebChatView/Composites/ChatComposerStage",
  component: Harness,
  parameters: {
    layout: "fullscreen",
  },
  render: (args) => ({
    Component: Harness,
    props: args,
  }),
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CompactComposer = {
  args: {
    width: 390,
    height: 300,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Transcript stage")).toBeInTheDocument();
    await expect(canvas.getByRole("group", { name: "Message composer" })).toBeInTheDocument();
    await expect(canvas.getByTitle("Attach files")).toBeInTheDocument();
    await expect(canvas.getByTitle("Capture screenshot")).toBeInTheDocument();
    await expect(canvas.getByTitle("Send message")).toBeInTheDocument();
    await expect(canvas.getByText("@")).toBeInTheDocument();
    await expect(canvas.getByText("^")).toBeInTheDocument();
  },
} satisfies Story;

export const CodeMirrorResourceProjection = {
  args: {
    width: 820,
    height: 620,
  },
  render: (args) => ({
    Component: ResourceProjectionHarness,
    props: args,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const composerHost = canvasElement.querySelector<HTMLElement>(
      "[data-testid='writable-composer-panel'] [data-testid='web-chat-draft-editor']",
    );
    const bubbleHost = canvasElement.querySelector<HTMLElement>(
      "[data-testid='readonly-bubble-panel'] .message-markdown-content",
    );
    expect(composerHost).not.toBeNull();
    expect(bubbleHost).not.toBeNull();

    const composerEditor = composerHost?.querySelector<HTMLElement>(".cm-editor") ?? null;
    const bubbleEditor = bubbleHost?.querySelector<HTMLElement>(".cm-editor") ?? null;
    expect(composerEditor).not.toBeNull();
    expect(bubbleEditor).not.toBeNull();

    const composerView = composerEditor ? EditorView.findFromDOM(composerEditor) : null;
    const bubbleView = bubbleEditor ? EditorView.findFromDOM(bubbleEditor) : null;
    expect(composerView).not.toBeNull();
    expect(bubbleView).not.toBeNull();
    expect(composerView?.state.facet(EditorState.readOnly)).toBe(false);
    expect(composerView?.state.facet(EditorView.editable)).toBe(true);
    expect(bubbleView?.state.facet(EditorState.readOnly)).toBe(true);
    expect(bubbleView?.state.facet(EditorView.editable)).toBe(false);

    expect(composerHost?.querySelectorAll("[part='message-resource-token']")).toHaveLength(1);
    expect(bubbleHost?.querySelectorAll("[part='message-resource-token']")).toHaveLength(2);
    expect(bubbleHost?.textContent).not.toContain("[^Comment 1]:");
    expect(bubbleHost?.querySelector("[part='message-attachments']")).not.toBeNull();

    composerHost
      ?.querySelector<HTMLElement>("[part='message-resource-token']")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitFor(() => {
      expect(canvas.getByTestId("opened-resource")).toHaveTextContent("Comment 1");
    });

    composerView?.dispatch({
      changes: {
        from: composerView.state.doc.length,
        insert: " Ship it.",
      },
    });
    await waitFor(() => {
      expect(canvas.getByTestId("draft-value")).toHaveTextContent("Ship it.");
    });

    composerView?.focus();
    composerView?.contentDOM.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    await waitFor(() => {
      expect(canvas.getByTestId("submitted-draft")).toHaveTextContent("Ship it.");
    });
  },
} satisfies Story;
