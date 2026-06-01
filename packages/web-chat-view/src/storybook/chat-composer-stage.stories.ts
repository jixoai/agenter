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
    expect(bubbleHost?.querySelectorAll("[part='message-resource-token']")).toHaveLength(3);
    expect(
      Array.from(composerHost?.querySelectorAll<HTMLElement>("[part='message-resource-token']") ?? []).map(
        (element) => element.dataset.resourceNumber,
      ),
    ).toEqual(["1"]);
    expect(
      Array.from(bubbleHost?.querySelectorAll<HTMLElement>("[part='message-resource-token']") ?? []).map(
        (element) => element.dataset.resourceNumber,
      ),
    ).toEqual(["1", "1", "1"]);
    expect(bubbleHost?.textContent).not.toContain("[^Comment 1]:");
    const resourceBar = bubbleHost?.querySelector<HTMLElement>("[part='message-attachments']") ?? null;
    expect(resourceBar).not.toBeNull();
    expect(resourceBar?.scrollWidth ?? 0).toBeLessThanOrEqual((resourceBar?.clientWidth ?? 0) + 1);
    expect(resourceBar?.scrollHeight ?? 0).toBeLessThanOrEqual((resourceBar?.clientHeight ?? 0) + 1);

    const commentIcon = bubbleHost?.querySelector<HTMLElement>(
      '[part="resource-icon-with-number"][data-kind="comment"]',
    );
    const commentNumber = commentIcon?.querySelector<SVGTextElement>(".resource-icon-comment-number") ?? null;
    expect(commentNumber).not.toBeNull();
    expect(commentNumber?.getAttribute("x")).toBe("10.2");
    expect(commentNumber?.getAttribute("y")).toBe("11");

    const imageIcon = bubbleHost?.querySelector<HTMLElement>('[part="resource-icon-with-number"][data-kind="image"]');
    const imageBaseLayer = imageIcon?.querySelector<SVGElement>("svg[data-resource-icon-layer='base']") ?? null;
    const imageInfoLayer = imageIcon?.querySelector<SVGElement>("svg[data-resource-icon-layer='info']") ?? null;
    const imageBase = imageIcon?.querySelector<HTMLElement>(".resource-icon-image-base") ?? null;
    const imageBadgeCircle = imageIcon?.querySelector<SVGCircleElement>(".resource-icon-image-number-badge-fill") ?? null;
    const imageNumber = imageIcon?.querySelector<HTMLElement>(".resource-icon-image-number") ?? null;
    expect(imageBaseLayer).not.toBeNull();
    expect(imageInfoLayer).not.toBeNull();
    expect(imageBase).not.toBeNull();
    expect(imageBadgeCircle).not.toBeNull();
    expect(imageNumber).not.toBeNull();
    expect(imageIcon?.querySelectorAll("svg[data-resource-icon-layer]")).toHaveLength(2);
    expect(getComputedStyle(imageBaseLayer!).gridArea).toContain("resource-icon-layer");
    expect(getComputedStyle(imageInfoLayer!).gridArea).toContain("resource-icon-layer");
    expect(Number(getComputedStyle(imageInfoLayer!).zIndex)).toBeGreaterThan(
      Number(getComputedStyle(imageBaseLayer!).zIndex),
    );
    expect(getComputedStyle(imageBase!).color).toBe(getComputedStyle(imageNumber!).color);
    expect(imageBadgeCircle?.getAttribute("cx")).toBe("18");
    expect(imageBadgeCircle?.getAttribute("cy")).toBe("6");
    expect(imageBadgeCircle?.getAttribute("r")).toBe("4.2");
    expect(imageNumber?.getAttribute("x")).toBe("18");
    expect(imageNumber?.getAttribute("y")).toBe("5.8");

    const fileIcon = bubbleHost?.querySelector<HTMLElement>('[part="resource-icon-with-number"][data-kind="file"]');
    const tileFileIcon = bubbleHost?.querySelector<HTMLElement>(
      '[part="resource-icon-with-number"][data-kind="file"][data-size="tile"]',
    );
    const inlineFileIcon = bubbleHost?.querySelector<HTMLElement>(
      '[part="resource-icon-with-number"][data-kind="file"][data-size="inline"]',
    );
    const fileInfoLayer = fileIcon?.querySelector<SVGElement>("svg[data-resource-icon-layer='info']") ?? null;
    const fileNumber = fileIcon?.querySelector<HTMLElement>(".resource-icon-file-number") ?? null;
    const fileExtensionBadgeFill = fileIcon?.querySelector<SVGRectElement>(
      ".resource-icon-file-extension-badge-fill",
    ) ?? null;
    const fileExtensionBadge = fileIcon?.querySelector<HTMLElement>(".resource-icon-file-extension-badge") ?? null;
    const fileExtension = fileIcon?.querySelector<HTMLElement>(".resource-icon-file-extension") ?? null;
    expect(fileInfoLayer).not.toBeNull();
    expect(getComputedStyle(fileInfoLayer!).gridArea).toContain("resource-icon-layer");
    expect(fileNumber).not.toBeNull();
    expect(fileExtensionBadgeFill).not.toBeNull();
    expect(fileExtensionBadge).not.toBeNull();
    expect(fileExtension).not.toBeNull();
    expect(fileIcon?.querySelectorAll("svg[data-resource-icon-layer]")).toHaveLength(2);
    expect(fileExtensionBadgeFill?.getAttribute("x")).toBe("12");
    expect(fileExtensionBadgeFill?.getAttribute("y")).toBe("19.6");
    expect(fileExtensionBadgeFill?.getAttribute("width")).toBe("8.8");
    expect(fileExtensionBadgeFill?.getAttribute("height")).toBe("3.84");
    expect(fileExtensionBadgeFill?.getAttribute("rx")).toBe("0.84");
    expect(fileNumber?.getAttribute("y")).toBe("13.84");
    expect(fileExtension?.getAttribute("x")).toBe("16.4");
    expect(fileExtension?.getAttribute("y")).toBe("21.36");
    expect(getComputedStyle(fileExtensionBadge!).transform).toBe("none");
    expect(getComputedStyle(fileInfoLayer!).transform).toBe("none");
    expect(getComputedStyle(fileNumber!).fontSize).toBe("16px");
    expect(getComputedStyle(fileExtension!).fontSize).toBe("16px");

    const expectRadiusSafePadding = (icon: HTMLElement): void => {
      const iconStyle = getComputedStyle(icon);
      const expectedPadding =
        Math.min(
          Number.parseFloat(iconStyle.borderTopLeftRadius),
          Number.parseFloat(iconStyle.width),
          Number.parseFloat(iconStyle.height),
        ) / 4;
      expect(Number.parseFloat(iconStyle.paddingTop)).toBeCloseTo(expectedPadding, 1);
      expect(Number.parseFloat(iconStyle.paddingRight)).toBeCloseTo(expectedPadding, 1);
      expect(Number.parseFloat(iconStyle.paddingBottom)).toBeCloseTo(expectedPadding, 1);
      expect(Number.parseFloat(iconStyle.paddingLeft)).toBeCloseTo(expectedPadding, 1);
    };

    expect(tileFileIcon).not.toBeNull();
    expect(inlineFileIcon).not.toBeNull();
    expectRadiusSafePadding(tileFileIcon!);
    expectRadiusSafePadding(inlineFileIcon!);

    const palettePanel = canvas.getByTestId("resource-icon-palette-panel");
    expect(palettePanel.querySelectorAll("[part='resource-icon-with-number']")).toHaveLength(12);

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
