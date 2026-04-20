import type { HeartbeatGroupItem } from "@agenter/client-sdk";
import type { Meta, StoryObj } from "@storybook/sveltekit";
import { expect, userEvent, within } from "storybook/test";

import RuntimeHeartbeatGroupContractHarness from "./runtime-heartbeat-group.contract-harness.svelte";

const baseTimestamp = Date.UTC(2026, 3, 12, 14, 25, 0);

const contractGroup = {
  id: 2048,
  groupId: "heartbeat-group:contract:2048",
  kind: "call",
  aiCallId: 2048,
  createdAt: baseTimestamp,
  updatedAt: baseTimestamp + 5_000,
  isComplete: false,
  items: [
    {
      id: 2048,
      messageId: "heartbeat-part:contract:2048",
      windowId: null,
      aiCallId: 2048,
      roundIndex: 9,
      scope: "heartbeat_part",
      role: "assistant",
      createdAt: baseTimestamp,
      updatedAt: baseTimestamp + 5_000,
      isComplete: false,
      text: 'echo "contract harness";',
      parts: [
        {
          partId: 2048,
          partIndex: 0,
          messageId: "heartbeat-part:contract:2048",
          windowId: null,
          aiCallId: 2048,
          roundIndex: 9,
          scope: "heartbeat_part",
          role: "assistant",
          partType: "tool_call",
          mimeType: null,
          payload: {
            invocationId: "contract-tool-call",
            tool: "root_workspace_bash",
            input: {
              command: 'echo "contract harness";',
              stdin: JSON.stringify({ mode: "contract-harness" }, null, 2),
            },
            startedAt: baseTimestamp,
          },
          createdAt: baseTimestamp,
          updatedAt: baseTimestamp + 5_000,
          isComplete: false,
        },
      ],
    },
  ],
} satisfies HeartbeatGroupItem;

const readGroupNode = (root: HTMLElement): HTMLElement =>
  root.querySelector<HTMLElement>('[data-testid="runtime-heartbeat-group-2048"]') ??
  (() => {
    throw new Error("RuntimeHeartbeatGroup root is missing.");
  })();

const readSectionNode = (root: HTMLElement): HTMLElement =>
  root.querySelector<HTMLElement>('[data-testid^="runtime-heartbeat-section-"]') ??
  (() => {
    throw new Error("RuntimeHeartbeatGroup section wrapper is missing.");
  })();

const readEntryNode = (root: HTMLElement): HTMLElement =>
  root.querySelector<HTMLElement>('[data-testid="runtime-heartbeat-entry-2048"]') ??
  (() => {
    throw new Error("RuntimeHeartbeatGroup entry node is missing.");
  })();

const meta = {
  title: "Features/Runtime/Heartbeat Group Contract",
  component: RuntimeHeartbeatGroupContractHarness,
  render: (args) => ({
    Component: RuntimeHeartbeatGroupContractHarness,
    props: args,
  }),
} satisfies Meta<typeof RuntimeHeartbeatGroupContractHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ParentRerenderKeepsSectionDomIdentity = {
  name: "Scenario: Given one heartbeat group When an unrelated parent state changes Then the section and entry DOM nodes stay mounted",
  args: {
    group: contractGroup,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bumpButton = canvas.getByTestId("runtime-heartbeat-group-harness-bump-parent");

    const groupBefore = readGroupNode(canvasElement);
    const sectionBefore = readSectionNode(canvasElement);
    const entryBefore = readEntryNode(canvasElement);

    await userEvent.click(bumpButton);

    expect(canvas.getByTestId("runtime-heartbeat-group-harness-parent-tick").textContent).toBe("1");
    expect(readGroupNode(canvasElement).isSameNode(groupBefore)).toBe(true);
    expect(readSectionNode(canvasElement).isSameNode(sectionBefore)).toBe(true);
    expect(readEntryNode(canvasElement).isSameNode(entryBefore)).toBe(true);
  },
} satisfies Story;

export const EquivalentGroupRefreshKeepsSectionDomIdentity = {
  name: "Scenario: Given one heartbeat group When an equivalent cloned group prop replaces the previous object Then the section and entry DOM nodes stay mounted",
  args: ParentRerenderKeepsSectionDomIdentity.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const refreshButton = canvas.getByTestId("runtime-heartbeat-group-harness-refresh-group");

    const groupBefore = readGroupNode(canvasElement);
    const sectionBefore = readSectionNode(canvasElement);
    const entryBefore = readEntryNode(canvasElement);

    await userEvent.click(refreshButton);

    expect(readGroupNode(canvasElement).isSameNode(groupBefore)).toBe(true);
    expect(readSectionNode(canvasElement).isSameNode(sectionBefore)).toBe(true);
    expect(readEntryNode(canvasElement).isSameNode(entryBefore)).toBe(true);
  },
} satisfies Story;
