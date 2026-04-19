import type { Meta, StoryObj } from "@storybook/sveltekit";
import { expect, userEvent, waitFor, within } from "storybook/test";

import TerminalSystemSurfaceStoryHarness from "./terminal-system-surface.story-harness.svelte";

const meta = {
  title: "Features/Terminals/TerminalSystemSurface",
  component: TerminalSystemSurfaceStoryHarness,
  render: (args) => ({
    Component: TerminalSystemSurfaceStoryHarness,
    props: args,
  }),
} satisfies Meta<typeof TerminalSystemSurfaceStoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

const writeDraft = async (canvasElement: HTMLElement, text: string) => {
  const canvas = within(canvasElement);
  const draft = canvas.getByTestId("terminal-write-draft");
  const submit = canvas.getByTestId("terminal-write-submit");
  await waitFor(() => {
    expect(canvas.getByText("Absolute cwd: /repo/ops")).toBeInTheDocument();
    expect(draft).not.toBeDisabled();
  });
  await userEvent.clear(draft);
  await userEvent.type(draft, text);
  await waitFor(() => {
    expect(submit).not.toBeDisabled();
  });
  await userEvent.click(submit);
  return {
    canvas,
    draft,
  };
};

const openUsersTab = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  const usersTab = canvas.getByRole("tab", { name: "Users" });
  await userEvent.click(usersTab);
  await waitFor(() => {
    expect(usersTab).toHaveAttribute("aria-selected", "true");
    const grantTrigger = canvas.getByLabelText("Grant actor");
    expect(grantTrigger.closest("[inert]")).toBeNull();
  });
  return canvas;
};

export const WriteSuccessClearsDraft = {
  name: "Scenario: Given a successful terminal write When the tool call resolves Then the editor draft clears and the terminal facts stay visible",
  args: {
    writeBehavior: "success",
  },
  play: async ({ canvasElement }) => {
    const { canvas, draft } = await writeDraft(canvasElement, "echo shipped");
    await expect(draft).toHaveValue("");
    await expect(canvas.getByText("Absolute cwd: /repo/ops")).toBeInTheDocument();
  },
} satisfies Story;

export const UsersPaneWideActionsStayBehaviorallyAligned = {
  name: "Scenario: Given a wide users pane with an existing grant When focus and revoke actions run Then the shared seat behavior model stays consistent",
  args: {
    surfaceWidthPx: 1280,
    initialGrantedSeats: [{ participantId: "auth:observer", role: "readonly" }],
  },
  play: async ({ canvasElement }) => {
    const canvas = await openUsersTab(canvasElement);
    canvas.getByTestId("terminal-seat-focus-session:reviewer").click();
    await waitFor(() => {
      expect(canvas.getByTestId("terminal-seat-focus-session:reviewer")).toHaveTextContent("Unfocus");
    });
    await expect(canvas.getByTestId("terminal-seat-auth:observer")).toBeInTheDocument();
    canvas.getByTestId("terminal-seat-revoke-auth:observer").click();
    await waitFor(() => {
      expect(canvas.queryByTestId("terminal-seat-auth:observer")).not.toBeInTheDocument();
    });
  },
} satisfies Story;

export const UsersPaneCompactActionsStayBehaviorallyAligned = {
  name: "Scenario: Given a compact users pane When focus actions run Then the shared seat behavior model stays consistent",
  args: {
    surfaceWidthPx: 720,
  },
  play: async ({ canvasElement }) => {
    const canvas = await openUsersTab(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText("Grant access")).toBeInTheDocument();
    });
    canvas.getByTestId("terminal-seat-focus-session:reviewer").click();
    await waitFor(() => {
      expect(canvas.getByTestId("terminal-seat-focus-session:reviewer")).toHaveTextContent("Unfocus");
    });
  },
} satisfies Story;

export const ApprovalLifecycleStaysInUsersPane = {
  name: "Scenario: Given a pending write approval When the users pane approves it Then the requester lease surfaces without rebuilding local seat truth",
  args: {
    writeBehavior: "approval",
    initialCallerToken: "token:term-story:reviewer",
  },
  play: async ({ canvasElement }) => {
    const { canvas } = await writeDraft(canvasElement, "echo awaiting approval");
    await openUsersTab(canvasElement);
    const approveButton = await waitFor(() => {
      const button = canvasElement.querySelector<HTMLElement>('[data-testid^="terminal-approval-approve-"]');
      expect(button).not.toBeNull();
      return button!;
    });
    approveButton.click();
    await waitFor(() => {
      expect(
        within(canvas.getByTestId("terminal-seat-session:reviewer")).getByText(/Lease until/u),
      ).toBeInTheDocument();
    });
  },
} satisfies Story;

export const DeniedApprovalLeavesSeatWithoutLease = {
  name: "Scenario: Given a pending write approval When the users pane denies it Then the requester seat stays lease-free and the denial remains visible",
  args: {
    writeBehavior: "approval",
    initialCallerToken: "token:term-story:reviewer",
  },
  play: async ({ canvasElement }) => {
    const { canvas } = await writeDraft(canvasElement, "echo denied approval");
    await openUsersTab(canvasElement);
    const denyButton = await waitFor(() => {
      const button = canvasElement.querySelector<HTMLElement>('[data-testid^="terminal-approval-deny-"]');
      expect(button).not.toBeNull();
      return button!;
    });
    denyButton.click();
    await waitFor(() => {
      expect(canvas.getByText(/Denied approval-/u)).toBeInTheDocument();
    });
    expect(within(canvas.getByTestId("terminal-seat-session:reviewer")).queryByText(/Lease until/u)).toBeNull();
  },
} satisfies Story;

export const AuthoritativeProjectionOmitsBootstrapSeat = {
  name: "Scenario: Given a terminal surface projection without a system actor seat When the users pane renders Then the route does not fabricate a bootstrap seat row",
  args: {
    includeBootstrapSeat: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = await openUsersTab(canvasElement);
    await waitFor(() => {
      expect(canvas.getByTestId("terminal-seat-session:reviewer")).toBeInTheDocument();
    });
    expect(canvas.queryByTestId("terminal-seat-system:trusted-terminal-bootstrap")).toBeNull();
    expect(canvas.queryByText("System seat")).toBeNull();
  },
} satisfies Story;

export const SnapshotHydratesViewportBeforeTransportReconnect = {
  name: "Scenario: Given durable snapshot truth When the terminal route hydrates before transport reconnect Then the viewport renders without product chrome and stays readable",
  args: {
    surfaceWidthPx: 1280,
  },
  play: async ({ canvasElement }) => {
    const terminalView = canvasElement.querySelector<HTMLElement>('[data-terminal-host-root="true"]') as
      | (HTMLElement & { connectionState?: string; shadowRoot: ShadowRoot | null })
      | null;
    expect(terminalView).not.toBeNull();
    await waitFor(() => {
      expect(terminalView?.connectionState).toBe("idle");
      expect(terminalView?.shadowRoot?.querySelector('[data-terminal-view-root="true"]')).not.toBeNull();
      expect(terminalView?.shadowRoot?.querySelector("[data-terminal-viewport]")).not.toBeNull();
    });
    expect(terminalView?.shadowRoot?.querySelector(".terminal-toolbar")).toBeNull();
    expect(terminalView?.shadowRoot?.querySelector(".terminal-footer")).toBeNull();
    expect(terminalView?.shadowRoot?.querySelector("[data-terminal-viewport]")?.getAttribute("style")).toMatch(
      /width:\d+px;height:\d+px/u,
    );
    await expect(within(canvasElement).getByText("Absolute cwd: /repo/ops")).toBeInTheDocument();
  },
} satisfies Story;

export const WindowChromeTogglesProjectionMode = {
  name: "Scenario: Given a terminal window chrome When the maximize control toggles Then the projection switches between fit and cover inside the shared scroll container",
  args: {
    surfaceWidthPx: 920,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const windowSurface = canvasElement.querySelector<HTMLElement>('[data-terminal-window-surface="true"]');
    const terminalView = canvasElement.querySelector<HTMLElement>('[data-terminal-host-root="true"]') as
      | (HTMLElement & { shadowRoot: ShadowRoot | null })
      | null;
    const scrollViewport = canvas.getByTestId("terminal-window-scroll-viewport");
    expect(windowSurface).not.toBeNull();
    expect(terminalView).not.toBeNull();
    await expect(scrollViewport).toBeInTheDocument();
    await waitFor(() => {
      expect(windowSurface?.dataset.terminalWindowMode).toBe("fit");
      expect(
        terminalView?.shadowRoot?.querySelector('[data-terminal-view-root="true"]')?.getAttribute("data-viewport-mode"),
      ).toBe("fit");
    });
    expect(windowSurface?.querySelector("header")?.textContent).not.toContain("/repo/ops");
    await userEvent.click(canvas.getByTestId("terminal-window-zoom-control"));
    await waitFor(() => {
      expect(windowSurface?.dataset.terminalWindowMode).toBe("cover");
      expect(
        terminalView?.shadowRoot?.querySelector('[data-terminal-view-root="true"]')?.getAttribute("data-viewport-mode"),
      ).toBe("cover");
      expect(
        terminalView?.shadowRoot?.querySelector('[data-terminal-stage]')?.getAttribute("style"),
      ).toContain("align-items:flex-start");
      expect(
        terminalView?.shadowRoot?.querySelector('[data-terminal-stage]')?.getAttribute("style"),
      ).toContain("justify-content:flex-start");
      expect(getComputedStyle(scrollViewport).overflowX).not.toBe("hidden");
      expect(scrollViewport.scrollWidth).toBeGreaterThan(scrollViewport.clientWidth);
    });
    await userEvent.click(canvas.getByTestId("terminal-window-zoom-control"));
    await waitFor(() => {
      expect(windowSurface?.dataset.terminalWindowMode).toBe("fit");
    });
  },
} satisfies Story;

export const StagePaneBodyOwnsScrollWhenProjectionOverflows = {
  name: "Scenario: Given a tall projected terminal in a short route pane When the stage content exceeds the viewport Then the pane body owns vertical scrolling instead of the outer chrome clipping it",
  args: {
    surfaceWidthPx: 920,
    surfaceHeightPx: 520,
    snapshotRows: 42,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const stagePane = canvas.getByTestId("terminal-stage-pane");
    const stageScrollViewport = stagePane.querySelector<HTMLElement>(
      '[data-workbench-surface-body="scroll"] [data-scroll-view-viewport]',
    );
    expect(stageScrollViewport).not.toBeNull();
    await waitFor(() => {
      expect(getComputedStyle(stageScrollViewport!).overflowY).not.toBe("hidden");
      expect(stageScrollViewport!.scrollHeight).toBeGreaterThan(stageScrollViewport!.clientHeight);
    });
    await expect(canvas.getByText("Absolute cwd: /repo/ops")).toBeInTheDocument();
    await expect(canvas.getByRole("tab", { name: "Write" })).toBeInTheDocument();
  },
} satisfies Story;

export const WindowCloseRequiresConfirmation = {
  name: "Scenario: Given a terminal window close control When deletion is confirmed Then the surface removes the terminal only after the confirmation dialog accepts it",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId("terminal-window-close-control"));
    const dialog = await within(document.body).findByTestId("terminal-delete-confirm-dialog");
    expect(dialog).toBeInTheDocument();
    await userEvent.click(within(document.body).getByTestId("terminal-delete-confirm-submit"));
    await waitFor(() => {
      expect(canvas.queryByTestId("terminal-window-close-control")).not.toBeInTheDocument();
      expect(canvas.getByText("Select a terminal tab.")).toBeInTheDocument();
    });
  },
} satisfies Story;

export const ApprovalRequestedKeepsDraft = {
  name: "Scenario: Given a terminal write requires approval When the tool call resolves Then the draft stays in the editor and the approval notice is visible",
  args: {
    writeBehavior: "approval",
  },
  play: async ({ canvasElement }) => {
    const { canvas, draft } = await writeDraft(canvasElement, "echo pending approval");
    await expect(draft).toHaveValue("echo pending approval");
    await expect(await canvas.findByText(/Write approval requested:/)).toBeInTheDocument();
  },
} satisfies Story;

export const FailedWriteKeepsDraft = {
  name: "Scenario: Given a terminal write fails When the tool call resolves Then the draft stays in the editor and the error notice remains visible",
  args: {
    writeBehavior: "failure",
  },
  play: async ({ canvasElement }) => {
    const { canvas, draft } = await writeDraft(canvasElement, "echo failure");
    await expect(draft).toHaveValue("echo failure");
    await expect(await canvas.findByText("Terminal write failed: mock rejection")).toBeInTheDocument();
  },
} satisfies Story;
