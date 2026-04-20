import type { Meta, StoryObj } from "@storybook/sveltekit";
import { expect, userEvent, waitFor, within } from "storybook/test";

import Harness from "./runtime-heartbeat-virtual-group-identity.contract-harness.svelte";

type HarnessState = {
  itemCount: number;
  latestGroupId: string | null;
  mode: "direct" | "wrapped";
};

const readHarnessState = (canvas: ReturnType<typeof within>): HarnessState =>
  JSON.parse(canvas.getByTestId("runtime-heartbeat-virtual-state").textContent ?? "{}") as HarnessState;

const readGroupNode = (root: HTMLElement, groupId: number): HTMLElement =>
  root.querySelector<HTMLElement>(`[data-testid="runtime-heartbeat-group-${groupId}"]`) ??
  (() => {
    throw new Error(`RuntimeHeartbeatGroup root ${groupId} is missing.`);
  })();

const readEntryNode = (root: HTMLElement, groupId: number): HTMLElement =>
  root.querySelector<HTMLElement>(`[data-testid="runtime-heartbeat-entry-${groupId}"]`) ??
  (() => {
    throw new Error(`RuntimeHeartbeatEntry ${groupId} is missing.`);
  })();

const readSectionNode = (root: HTMLElement, groupId: number): HTMLElement =>
  readGroupNode(root, groupId).querySelector<HTMLElement>('[data-testid^="runtime-heartbeat-section-"]') ??
  (() => {
    throw new Error(`RuntimeHeartbeat section ${groupId} is missing.`);
  })();

const readRowShell = (root: HTMLElement, groupId: number): HTMLElement =>
  root.querySelector<HTMLElement>(`[data-anchored-row-key="runtime-heartbeat-virtual-group:${groupId}"]`) ??
  (() => {
    throw new Error(`Anchored row shell ${groupId} is missing.`);
  })();

const expectAppendPreservesHeartbeatGroupIdentity = async (
  canvasElement: HTMLElement,
  anchoredGroupId: number,
): Promise<void> => {
  const canvas = within(canvasElement);
  await waitFor(() => {
    const state = readHarnessState(canvas);
    expect(state.itemCount).toBe(8);
    expect(state.latestGroupId).toBe("runtime-heartbeat-virtual-group:8");
  });

  const rowShellBefore = readRowShell(canvasElement, anchoredGroupId);
  const groupBefore = readGroupNode(canvasElement, anchoredGroupId);
  const entryBefore = readEntryNode(canvasElement, anchoredGroupId);
  const sectionBefore = readSectionNode(canvasElement, anchoredGroupId);

  await userEvent.click(canvas.getByTestId("runtime-heartbeat-virtual-append-latest"));

  await waitFor(() => {
    const state = readHarnessState(canvas);
    expect(state.itemCount).toBe(9);
    expect(state.latestGroupId).toBe("runtime-heartbeat-virtual-group:9");
    expect(readEntryNode(canvasElement, 9)).toBeTruthy();
  });

  const rowShellPreserved = readRowShell(canvasElement, anchoredGroupId).isSameNode(rowShellBefore);
  const groupPreserved = readGroupNode(canvasElement, anchoredGroupId).isSameNode(groupBefore);
  const entryPreserved = readEntryNode(canvasElement, anchoredGroupId).isSameNode(entryBefore);
  const sectionPreserved = readSectionNode(canvasElement, anchoredGroupId).isSameNode(sectionBefore);

  if (!rowShellPreserved || !groupPreserved || !entryPreserved || !sectionPreserved) {
    throw new Error(
      `Runtime heartbeat virtual identity drift for group ${anchoredGroupId}: row=${String(rowShellPreserved)} group=${String(groupPreserved)} section=${String(sectionPreserved)} entry=${String(entryPreserved)}`,
    );
  }
};

const meta = {
  title: "Features/Runtime/Heartbeat Virtual Group Identity",
  component: Harness,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Integration contract between the anchored virtual list render protocol and RuntimeHeartbeatGroup. This isolates the group card from RuntimeStageHeartbeat chrome while keeping the real Heartbeat row component.",
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

export const DirectAppendPreservesRuntimeHeartbeatGroupDomIdentity = {
  name: "Scenario: Direct AVL keeps heartbeat row subtree identity on append",
  args: {
    mode: "direct",
  },
  play: async ({ canvasElement }) => {
    await expectAppendPreservesHeartbeatGroupIdentity(canvasElement, 7);
  },
} satisfies Story;

export const WrappedAppendPreservesRuntimeHeartbeatGroupDomIdentity = {
  name: "Scenario: Wrapped conversation keeps heartbeat row subtree identity on append",
  args: {
    mode: "wrapped",
  },
  play: async ({ canvasElement }) => {
    await expectAppendPreservesHeartbeatGroupIdentity(canvasElement, 7);
  },
} satisfies Story;
