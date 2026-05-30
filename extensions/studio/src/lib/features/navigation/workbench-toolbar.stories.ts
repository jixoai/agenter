import type { Meta, StoryObj } from "@storybook/sveltekit";
import { expect, userEvent, waitFor, within } from "storybook/test";

import Harness from "./workbench-toolbar.story-harness.svelte";

const meta = {
  title: "Features/Navigation/WorkbenchToolbar",
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

export const WidePageTabsKeepsInlineGrid = {
  name: "Scenario: Given a wide page-tabs toolbar When the shared primitive renders Then page-tabs, identity, actions, and status stay inline across the two-row grid",
  args: {
    variant: "page-tabs",
    frameWidth: "72rem",
  },
  play: async ({ canvasElement }) => {
    const toolbar = canvasElement.querySelector<HTMLElement>("[data-workbench-page-toolbar]");
    expect(toolbar).not.toBeNull();
    if (!toolbar) {
      return;
    }
    const toolbarSurface = toolbar.querySelector<HTMLElement>("[data-workbench-toolbar]");
    await waitFor(() => {
      expect(toolbarSurface?.getAttribute("data-workbench-toolbar-layout")).toBe("structured");
      expect(toolbar.querySelector('[data-workbench-toolbar-region="identity-inline"]')).not.toBeNull();
      expect(toolbar.querySelector('[data-workbench-toolbar-region="overflow-trigger"]')).toBeNull();
    });

    await expect(within(toolbar).getByText("Reviewer runtime")).toBeInTheDocument();
    await expect(within(toolbar).getByText("workspace-alpha")).toBeInTheDocument();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="page-tabs"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="identity-inline"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="actions-inline"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="status-inline"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="overflow-trigger"]')).toBeNull();
  },
} satisfies Story;

export const WideIdentityKeepsAnchorInline = {
  name: "Scenario: Given a wide toolbar without page-tabs When the shared primitive renders Then identity remains the page-anchor while actions and status stay inline",
  args: {
    variant: "identity",
    frameWidth: "60rem",
  },
  play: async ({ canvasElement }) => {
    const toolbar = canvasElement.querySelector<HTMLElement>("[data-workbench-page-toolbar]");
    expect(toolbar).not.toBeNull();
    if (!toolbar) {
      return;
    }
    const toolbarSurface = toolbar.querySelector<HTMLElement>("[data-workbench-toolbar]");
    await waitFor(() => {
      expect(toolbarSurface?.getAttribute("data-workbench-toolbar-layout")).toBe("structured");
      expect(toolbar.querySelector('[data-workbench-toolbar-region="identity-inline"]')).not.toBeNull();
      expect(toolbar.querySelector('[data-workbench-toolbar-region="overflow-trigger"]')).toBeNull();
    });

    await expect(within(toolbar).getByText("Workspace roots")).toBeInTheDocument();
    await expect(
      within(toolbar).getByText("Choose one durable workspace root and open its dedicated detail surface."),
    ).toBeInTheDocument();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="page-tabs"]')).toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="identity-inline"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="actions-inline"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="status-inline"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="overflow-trigger"]')).toBeNull();
  },
} satisfies Story;

export const MediumPageTabsMovesSecondaryIntoOverflow = {
  name: "Scenario: Given a medium page-tabs toolbar When width tightens Then inline actions stay prioritized while status moves into the floating overflow panel",
  args: {
    variant: "page-tabs",
    frameWidth: "52rem",
  },
  play: async ({ canvasElement }) => {
    const toolbar = canvasElement.querySelector<HTMLElement>("[data-workbench-page-toolbar]");
    expect(toolbar).not.toBeNull();
    if (!toolbar) {
      return;
    }
    const toolbarSurface = toolbar.querySelector<HTMLElement>("[data-workbench-toolbar]");
    await waitFor(() => {
      expect(toolbarSurface?.getAttribute("data-workbench-toolbar-breakpoint")).toBe("compact");
      expect(toolbar.querySelector('[data-workbench-toolbar-region="overflow-trigger"]')).not.toBeNull();
    });

    expect(toolbar.querySelector('[data-workbench-toolbar-region="page-tabs"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="identity-inline"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="actions-inline"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="status-inline"]')).toBeNull();

    const trigger = within(toolbar).getByRole("button", { name: "Open page toolbar details" });
    await userEvent.click(trigger);
    expect(toolbar.querySelector('[data-workbench-toolbar-region="overflow-panel"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="overflow-actions"]')).toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="overflow-status"]')).not.toBeNull();
  },
} satisfies Story;

export const CompactPageTabsWithoutOmittedContentKeepsNoOverflowTrigger = {
  name: "Scenario: Given a constrained page-tabs toolbar without hidden identity, actions, or status When the shared primitive renders Then the overflow trigger stays absent",
  args: {
    variant: "page-tabs-minimal",
    frameWidth: "46rem",
  },
  play: async ({ canvasElement }) => {
    const toolbar = canvasElement.querySelector<HTMLElement>("[data-workbench-page-toolbar]");
    expect(toolbar).not.toBeNull();
    if (!toolbar) {
      return;
    }
    const toolbarSurface = toolbar.querySelector<HTMLElement>("[data-workbench-toolbar]");
    await waitFor(() => {
      expect(toolbarSurface?.getAttribute("data-workbench-toolbar-layout")).toBe("structured");
      expect(toolbar.querySelector('[data-workbench-toolbar-region="identity-inline"]')).not.toBeNull();
    });

    expect(toolbar.querySelector('[data-workbench-toolbar-region="page-tabs"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="identity-inline"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="actions-inline"]')).toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="status-inline"]')).toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="overflow-trigger"]')).toBeNull();
  },
} satisfies Story;

export const CompactPageTabsWithoutStatusKeepsActionsInline = {
  name: "Scenario: Given a compact page-tabs toolbar without status When the shared primitive renders Then local actions stay inline instead of collapsing too early",
  args: {
    variant: "page-tabs-actions-only",
    frameWidth: "52rem",
  },
  play: async ({ canvasElement }) => {
    const toolbar = canvasElement.querySelector<HTMLElement>("[data-workbench-page-toolbar]");
    expect(toolbar).not.toBeNull();
    if (!toolbar) {
      return;
    }
    const toolbarSurface = toolbar.querySelector<HTMLElement>("[data-workbench-toolbar]");
    await waitFor(() => {
      expect(toolbarSurface?.getAttribute("data-workbench-toolbar-breakpoint")).toBe("compact");
      expect(toolbar.querySelector('[data-workbench-toolbar-region="identity-inline"]')).not.toBeNull();
    });

    expect(toolbar.querySelector('[data-workbench-toolbar-region="actions-inline"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="status-inline"]')).toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="overflow-trigger"]')).toBeNull();
  },
} satisfies Story;

export const NarrowPageTabsLeavesOnlyAnchorAndOverflow = {
  name: "Scenario: Given a narrow page-tabs toolbar When width reaches the tightest stage Then inline identity collapses away and the floating panel preserves the full detail stack without pushing page content",
  args: {
    variant: "page-tabs",
    frameWidth: "31rem",
  },
  play: async ({ canvasElement }) => {
    const toolbar = canvasElement.querySelector<HTMLElement>("[data-workbench-page-toolbar]");
    const body = canvasElement.querySelector<HTMLElement>('[data-testid="workbench-toolbar-story-body"]');
    expect(toolbar).not.toBeNull();
    expect(body).not.toBeNull();
    if (!toolbar || !body) {
      return;
    }
    const toolbarSurface = toolbar.querySelector<HTMLElement>("[data-workbench-toolbar]");
    await waitFor(() => {
      expect(toolbarSurface?.getAttribute("data-workbench-toolbar-breakpoint")).toBe("narrow");
      expect(toolbarSurface?.getAttribute("data-workbench-toolbar-layout")).toBe("structured");
    });

    expect(toolbar.querySelector('[data-workbench-toolbar-region="page-tabs"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="identity-inline"]')).toBeNull();
    const trigger = within(toolbar).getByRole("button", { name: "Open page toolbar details" });
    const bodyTopBefore = Math.round(body.getBoundingClientRect().top);
    await userEvent.click(trigger);
    const bodyTopAfter = Math.round(body.getBoundingClientRect().top);
    expect(Math.abs(bodyTopAfter - bodyTopBefore)).toBeLessThanOrEqual(1);
    expect(toolbar.querySelector('[data-workbench-toolbar-region="overflow-identity"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="overflow-actions"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="overflow-status"]')).not.toBeNull();

    const overflowViewport = canvasElement.querySelector<HTMLElement>(".workbench-toolbar__overflow-viewport");
    const overflowPanel = toolbar.querySelector<HTMLElement>('[data-workbench-toolbar-region="overflow-panel"]');
    expect(overflowViewport).not.toBeNull();
    expect(overflowPanel).not.toBeNull();
    expect(getComputedStyle(overflowViewport!).overflowY).not.toBe("hidden");
    await expect(within(overflowPanel!).getByText("Overflow action 24")).toBeInTheDocument();
  },
} satisfies Story;

export const NarrowIdentityKeepsIdentityInline = {
  name: "Scenario: Given a narrow toolbar without page-tabs When width tightens Then identity and actions stay inline while status alone moves into the floating overflow panel",
  args: {
    variant: "identity",
    frameWidth: "33rem",
  },
  play: async ({ canvasElement }) => {
    const toolbar = canvasElement.querySelector<HTMLElement>("[data-workbench-page-toolbar]");
    const body = canvasElement.querySelector<HTMLElement>('[data-testid="workbench-toolbar-story-body"]');
    expect(toolbar).not.toBeNull();
    expect(body).not.toBeNull();
    if (!toolbar || !body) {
      return;
    }
    const toolbarSurface = toolbar.querySelector<HTMLElement>("[data-workbench-toolbar]");
    await waitFor(() => {
      expect(toolbarSurface?.getAttribute("data-workbench-toolbar-breakpoint")).toBe("narrow");
    });

    expect(toolbar.querySelector('[data-workbench-toolbar-region="identity-inline"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="actions-inline"]')).not.toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="status-inline"]')).toBeNull();

    const trigger = within(toolbar).getByRole("button", { name: "Open workspace toolbar details" });
    const bodyTopBefore = Math.round(body.getBoundingClientRect().top);
    await userEvent.click(trigger);
    const bodyTopAfter = Math.round(body.getBoundingClientRect().top);
    expect(Math.abs(bodyTopAfter - bodyTopBefore)).toBeLessThanOrEqual(1);
    expect(toolbar.querySelector('[data-workbench-toolbar-region="overflow-identity"]')).toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="overflow-actions"]')).toBeNull();
    expect(toolbar.querySelector('[data-workbench-toolbar-region="overflow-status"]')).not.toBeNull();
  },
} satisfies Story;
