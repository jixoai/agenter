import type { Meta, StoryObj } from "@storybook/sveltekit";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import WorkspaceShellStoryHarness from "./workspace-shell.story-harness.svelte";

const getCanvas = (canvasElement: HTMLElement) => within(canvasElement);
const getContentHeader = (canvasElement: HTMLElement) =>
  within(within(canvasElement).getByTestId("workspace-content-header"));
const isVisibleToolbarControl = (element: HTMLElement): boolean =>
  element.closest("[hidden]") === null && element.getClientRects().length > 0;
const getVisibleToolbarControl = (testId: string): HTMLElement => {
  const control = screen
    .getAllByTestId(testId)
    .find((element): element is HTMLElement => element instanceof HTMLElement && isVisibleToolbarControl(element));
  expect(control).toBeDefined();
  return control!;
};
const getSrcDirectoryButton = (canvasElement: HTMLElement): HTMLElement => {
  const button = canvasElement.querySelector<HTMLElement>('[data-workspace-tree-path="/src"]');
  expect(button).not.toBeNull();
  return button!;
};

const meta = {
  title: "Features/Workspaces/Workspace Shell",
  component: WorkspaceShellStoryHarness,
  render: (args) => ({
    Component: WorkspaceShellStoryHarness,
    props: args,
  }),
} satisfies Meta<typeof WorkspaceShellStoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ModeSwitchingKeepsSharedShell = {
  name: "Scenario: Given workspace page-tabs When switching between explorer rules and private Then the shared shell swaps page bodies without losing header chrome",
  args: {
    initialMode: "explorer",
  },
  play: async ({ canvasElement }) => {
    const canvas = getCanvas(canvasElement);

    await userEvent.click(canvas.getByRole("tab", { name: "rules" }));
    await expect(canvas.getByText("Rule priority follows row order.")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("tab", { name: "private" }));
    await expect(canvas.getByText("Private assets reuse the same tree mental model.")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("tab", { name: "explorer" }));
    await expect(canvas.getByText("Explorer preview")).toBeInTheDocument();
  },
} satisfies Story;

export const AvatarLensKeepsRootContext = {
  name: "Scenario: Given the shared page-toolbar When switching avatar lens Then the selected root context stays fixed while View as remains live",
  args: {
    initialMode: "explorer",
  },
  play: async ({ canvasElement }) => {
    const canvas = getCanvas(canvasElement);
    const contentHeader = getContentHeader(canvasElement);

    await expect(contentHeader.getAllByText("/repo/agenter")[0]).toBeInTheDocument();
    await expect(contentHeader.getByText("Persistent")).toBeInTheDocument();
    const overflowTrigger = canvas.queryByRole("button", {
      name: /^Open workspace toolbar details$/u,
    });
    if (overflowTrigger) {
      await userEvent.click(overflowTrigger);
    }
    const avatarSelect = getVisibleToolbarControl("workspace-avatar-select");
    await userEvent.click(avatarSelect);
    await userEvent.click(
      await screen.findByRole("option", {
        name: /^reviewer$/u,
      }),
    );

    await waitFor(() => {
      expect(getVisibleToolbarControl("workspace-avatar-select")).toHaveTextContent("reviewer");
    });
    await expect(contentHeader.getAllByText("/repo/agenter")[0]).toBeInTheDocument();
  },
} satisfies Story;

export const TreeDisclosureStaysInSurface = {
  name: "Scenario: Given a tree directory When disclosure is toggled Then child rows stay inside the same virtualized surface",
  args: {
    initialMode: "explorer",
  },
  play: async ({ canvasElement }) => {
    const canvas = getCanvas(canvasElement);
    await waitFor(() => {
      expect(getSrcDirectoryButton(canvasElement)).toBeInTheDocument();
    });

    await expect(canvas.queryByText("/src/app.ts")).not.toBeInTheDocument();
    await userEvent.click(getSrcDirectoryButton(canvasElement));
    await expect(canvas.getByText("/src/app.ts")).toBeInTheDocument();
    await userEvent.click(getSrcDirectoryButton(canvasElement));
    await expect(canvas.queryByText("/src/app.ts")).not.toBeInTheDocument();
  },
} satisfies Story;

export const RootWorkspaceSemanticsStayVisible = {
  name: "Scenario: Given a root-workspace header When the shared shell renders on desktop Then env and CLI semantics stay explicit without implying a no-sharing rule",
  args: {
    initialMode: "explorer",
    surfaceKind: "root-workspace",
    surfaceSummary:
      "Avatar-private env and runtime CLI live here by default. Sharing still depends on mounts and grants.",
  },
  play: async ({ canvasElement }) => {
    const contentHeader = getContentHeader(canvasElement);

    await expect(contentHeader.getByTestId("workspace-surface-kind")).toHaveTextContent("Root workspace");
    await expect(contentHeader.getByTestId("workspace-surface-profile")).toHaveTextContent("Root-exclusive env + CLI");
    await expect(contentHeader.getByTestId("workspace-surface-summary")).toHaveTextContent(
      "Sharing still depends on mounts and grants.",
    );
  },
} satisfies Story;

export const CompactShellPreservesPrimaryViewport = {
  name: "Scenario: Given a compact workspace shell When the shared header and bottom dock render Then the tree keeps the dominant viewport budget",
  args: {
    initialMode: "explorer",
    frameClass: "h-[58rem] w-[390px] max-w-full",
  },
  play: async ({ canvasElement }) => {
    const canvas = getCanvas(canvasElement);
    const contentHeader = canvas.getByTestId("workspace-content-header");
    const treeViewport = canvas.getByTestId("workspace-shell-story-tree");

    await waitFor(() => {
      const headerRect = contentHeader.getBoundingClientRect();
      const treeRect = treeViewport.getBoundingClientRect();
      expect(Math.round(headerRect.height)).toBeLessThanOrEqual(184);
      expect(Math.round(treeRect.height)).toBeGreaterThanOrEqual(260);
    });
  },
} satisfies Story;

export const CompactPublicWorkspaceSemanticsStayVisible = {
  name: "Scenario: Given a public-workspace header When the compact shell renders Then collaboration semantics stay visible in the mobile chrome",
  args: {
    initialMode: "explorer",
    frameClass: "h-[58rem] w-[390px] max-w-full",
    surfaceKind: "public-workspace",
    surfaceSummary: "Collaboration surface. Root-exclusive env and CLI stay out by default.",
  },
  play: async ({ canvasElement }) => {
    const contentHeader = getContentHeader(canvasElement);

    await expect(contentHeader.getByTestId("workspace-surface-kind")).toHaveTextContent("Public workspace");
    await expect(contentHeader.getByTestId("workspace-surface-profile")).toHaveTextContent("Collaboration env surface");
    await expect(contentHeader.getByTestId("workspace-surface-summary")).toHaveTextContent(
      "Root-exclusive env and CLI stay out by default.",
    );
  },
} satisfies Story;
