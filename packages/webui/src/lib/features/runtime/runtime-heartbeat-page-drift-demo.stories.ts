import type { Meta, StoryObj } from "@storybook/sveltekit";
import { expect, userEvent, waitFor, within } from "storybook/test";

import Harness from "./runtime-heartbeat-page-drift-demo.story-harness.svelte";

type DemoMode = "projection-rekey" | "stable-append";
type IdentityProbe = {
  mode: DemoMode;
  beforeKey: string | null;
  afterKey: string | null;
  oldKeyStillMounted: boolean | null;
  afterKeyMounted: boolean | null;
  sameRowShell: boolean | null;
  sameGroupNode: boolean | null;
  note: string;
};

const readState = (canvas: ReturnType<typeof within>): IdentityProbe =>
  JSON.parse(canvas.getByTestId("runtime-heartbeat-page-drift-state").textContent ?? "{}") as IdentityProbe;

const meta = {
  title: "Features/Runtime/Heartbeat Page Drift Demo",
  component: Harness,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Contrast between the stable Storybook append path and the page-level projection path. Stable append keeps the same display key, while the runtime page can reproject a pending group into durable before-call/call keys and therefore remount that card.",
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

export const StableAppendKeepsExistingCardMounted = {
  name: "Scenario: Given a stable latest append When the existing group key stays the same Then the Heartbeat card DOM is reused",
  args: {
    mode: "stable-append",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId("runtime-heartbeat-page-drift-run"));

    await waitFor(() => {
      const state = readState(canvas);
      expect(state.beforeKey).toBe(state.afterKey);
      expect(state.sameRowShell).toBe(true);
      expect(state.sameGroupNode).toBe(true);
    });
  },
} satisfies Story;

export const ProjectionRefreshRekeysAndRemounts = {
  name: "Scenario: Given a page-level projection refresh When pending context rekeys into durable groups Then the previous Heartbeat card remounts",
  args: {
    mode: "projection-rekey",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId("runtime-heartbeat-page-drift-run"));

    await waitFor(() => {
      const state = readState(canvas);
      expect(state.beforeKey).not.toBe(state.afterKey);
      expect(state.oldKeyStillMounted).toBe(false);
      expect(state.afterKeyMounted).toBe(true);
      expect(state.sameRowShell).toBe(false);
      expect(state.sameGroupNode).toBe(false);
    });
  },
} satisfies Story;
