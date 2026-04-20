import type { Meta, StoryObj } from "@storybook/sveltekit";
import { expect, userEvent, waitFor, within } from "storybook/test";

import Harness from "./anchored-virtual-list-identity.story-harness.svelte";

type HarnessState = {
  itemCount: number;
  latestRowId: number | null;
  mode: "direct" | "wrapped";
  renderMode: "component" | "markup";
  virtualConfigMode: "inline" | "stable";
};

const readHarnessState = (canvas: ReturnType<typeof within>): HarnessState =>
  JSON.parse(canvas.getByTestId("avl-identity-state").textContent ?? "{}") as HarnessState;

const readAnchoredRowShell = (root: HTMLElement, rowId: number): HTMLElement =>
  root.querySelector<HTMLElement>(`[data-anchored-row-key="${rowId}"]`) ??
  (() => {
    throw new Error(`Unable to find anchored row shell for ${rowId}.`);
  })();

const readRowNode = (root: HTMLElement, rowId: number): HTMLElement =>
  root.querySelector<HTMLElement>(`[data-testid="identity-row-${rowId}"]`) ??
  (() => {
    throw new Error(`Unable to find identity row ${rowId}.`);
  })();

const readSectionNode = (root: HTMLElement, rowId: number): HTMLElement =>
  root.querySelector<HTMLElement>(`[data-testid="identity-row-section-${rowId}"]`) ??
  (() => {
    throw new Error(`Unable to find identity row section ${rowId}.`);
  })();

const readLeafNode = (root: HTMLElement, rowId: number): HTMLElement =>
  root.querySelector<HTMLElement>(`[data-testid="identity-row-leaf-${rowId}"]`) ??
  (() => {
    throw new Error(`Unable to find identity row leaf ${rowId}.`);
  })();

const expectAppendPreservesRowIdentity = async (canvasElement: HTMLElement, anchoredRowId: number): Promise<void> => {
  const canvas = within(canvasElement);
  await waitFor(() => {
    const state = readHarnessState(canvas);
    expect(state.itemCount).toBe(8);
    expect(state.latestRowId).toBe(8);
  });

  const rowShellBefore = readAnchoredRowShell(canvasElement, anchoredRowId);
  const rowBefore = readRowNode(canvasElement, anchoredRowId);
  const sectionBefore = readSectionNode(canvasElement, anchoredRowId);
  const leafBefore = readLeafNode(canvasElement, anchoredRowId);

  await userEvent.click(canvas.getByTestId("avl-identity-append-latest"));

  await waitFor(() => {
    const state = readHarnessState(canvas);
    expect(state.itemCount).toBe(9);
    expect(state.latestRowId).toBe(9);
    expect(readLeafNode(canvasElement, 9)).toBeTruthy();
  });

  expect(readAnchoredRowShell(canvasElement, anchoredRowId).isSameNode(rowShellBefore)).toBe(true);
  expect(readRowNode(canvasElement, anchoredRowId).isSameNode(rowBefore)).toBe(true);
  expect(readSectionNode(canvasElement, anchoredRowId).isSameNode(sectionBefore)).toBe(true);
  expect(readLeafNode(canvasElement, anchoredRowId).isSameNode(leafBefore)).toBe(true);
};

const meta = {
  title: "Primitives/Scroll/AnchoredVirtualList Identity",
  component: Harness,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Identity-focused contract lab for pinned latest append. It compares direct AnchoredVirtualList rendering against the VirtualConversation wrapper, plus stable versus inline virtual config objects.",
      },
    },
  },
  render: (args) => ({
    Component: Harness,
    props: args,
  }),
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DirectStableAppendPreservesExistingRowDomIdentity = {
  name: "Scenario: Given direct AnchoredVirtualList with stable virtual config When latest is appended Then the visible row shell and inner subtree keep DOM identity",
  args: {
    mode: "direct",
    renderMode: "markup",
    virtualConfigMode: "stable",
  },
  play: async ({ canvasElement }) => {
    await expectAppendPreservesRowIdentity(canvasElement, 7);
  },
} satisfies Story;

export const DirectInlineAppendPreservesExistingRowDomIdentity = {
  name: "Scenario: Given direct AnchoredVirtualList with inline virtual config When latest is appended Then the visible row shell and inner subtree keep DOM identity",
  args: {
    mode: "direct",
    renderMode: "markup",
    virtualConfigMode: "inline",
  },
  play: async ({ canvasElement }) => {
    await expectAppendPreservesRowIdentity(canvasElement, 7);
  },
} satisfies Story;

export const WrappedStableAppendPreservesExistingRowDomIdentity = {
  name: "Scenario: Given VirtualConversation with stable virtual config When latest is appended Then the visible row shell and inner subtree keep DOM identity",
  args: {
    mode: "wrapped",
    renderMode: "markup",
    virtualConfigMode: "stable",
  },
  play: async ({ canvasElement }) => {
    await expectAppendPreservesRowIdentity(canvasElement, 7);
  },
} satisfies Story;

export const WrappedInlineAppendPreservesExistingRowDomIdentity = {
  name: "Scenario: Given VirtualConversation with inline virtual config When latest is appended Then the visible row shell and inner subtree keep DOM identity",
  args: {
    mode: "wrapped",
    renderMode: "markup",
    virtualConfigMode: "inline",
  },
  play: async ({ canvasElement }) => {
    await expectAppendPreservesRowIdentity(canvasElement, 7);
  },
} satisfies Story;

export const DirectStableComponentAppendPreservesExistingRowDomIdentity = {
  name: "Scenario: Given direct AnchoredVirtualList with a child component row When latest is appended Then the visible row shell and inner subtree keep DOM identity",
  args: {
    mode: "direct",
    renderMode: "component",
    virtualConfigMode: "stable",
  },
  play: async ({ canvasElement }) => {
    await expectAppendPreservesRowIdentity(canvasElement, 7);
  },
} satisfies Story;

export const WrappedStableComponentAppendPreservesExistingRowDomIdentity = {
  name: "Scenario: Given VirtualConversation with a child component row When latest is appended Then the visible row shell and inner subtree keep DOM identity",
  args: {
    mode: "wrapped",
    renderMode: "component",
    virtualConfigMode: "stable",
  },
  play: async ({ canvasElement }) => {
    await expectAppendPreservesRowIdentity(canvasElement, 7);
  },
} satisfies Story;
