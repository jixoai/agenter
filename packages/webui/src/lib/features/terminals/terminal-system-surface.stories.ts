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

const resolveToolbarOverflowPanel = async (canvasElement: HTMLElement): Promise<HTMLElement> => {
  const panel = canvasElement.querySelector<HTMLElement>('[data-workbench-toolbar-region="overflow-panel"]');
  if (panel) {
    return panel;
  }
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "Open terminal toolbar details" }));
  return waitFor(() => {
    const nextPanel = canvasElement.querySelector<HTMLElement>('[data-workbench-toolbar-region="overflow-panel"]');
    expect(nextPanel).not.toBeNull();
    return nextPanel!;
  });
};

const findToolbarActionButton = async (canvasElement: HTMLElement, name: string): Promise<HTMLElement> => {
  const canvas = within(canvasElement);
  const inlineButton = canvas.queryByRole("button", { name });
  if (inlineButton) {
    return inlineButton;
  }
  const overflowPanel = await resolveToolbarOverflowPanel(canvasElement);
  return within(overflowPanel).getByRole("button", { name });
};

const findToolbarActionsToggle = async (canvasElement: HTMLElement): Promise<HTMLElement> => {
  const canvas = within(canvasElement);
  const inlineToggle =
    canvas.queryByRole("radio", { name: "Actions" }) ??
    canvas.queryByRole("button", { name: "Actions" });
  if (inlineToggle) {
    return inlineToggle;
  }
  const overflowPanel = await resolveToolbarOverflowPanel(canvasElement);
  return (
    within(overflowPanel).queryByRole("radio", { name: "Actions" }) ??
    within(overflowPanel).getByRole("button", { name: "Actions" })
  );
};

const openUsersDialog = async (canvasElement: HTMLElement) => {
  await userEvent.click(await findToolbarActionButton(canvasElement, "Users"));
  const body = within(canvasElement.ownerDocument.body);
  await waitFor(() => {
    expect(body.getByTestId("terminal-users-dialog")).toBeInTheDocument();
    expect(body.getByTestId("terminal-seat-grant")).toBeInTheDocument();
  });
  return body;
};

const triggerReadAction = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  const readTab = canvas.getByRole("tab", { name: "Read" });
  readTab.focus();
  await userEvent.keyboard("{Enter}");
  await waitFor(() => {
    expect(readTab).toHaveAttribute("aria-selected", "true");
  });
  const submit = canvas.getByRole("button", { name: "Call read" });
  await waitFor(() => {
    expect(submit).not.toBeDisabled();
  });
  await userEvent.click(submit);
  return canvas;
};

const openActionsDetail = async (canvasElement: HTMLElement) => {
  await userEvent.click(await findToolbarActionsToggle(canvasElement));
  await waitFor(() => {
    expect(canvasElement.querySelector('[data-terminal-detail-panel-view="actions"]')).not.toBeNull();
  });
  return within(canvasElement);
};

const findInvocationCard = async (canvasElement: HTMLElement, toolName: string): Promise<HTMLElement> =>
  waitFor(() => {
    const cards = Array.from(
      canvasElement.querySelectorAll<HTMLElement>('[data-testid^="terminal-action-card-"]'),
    );
    const match = cards.find((card) => card.textContent?.includes(toolName));
    expect(match).toBeDefined();
    return match!;
  });

const findSplitRoot = async (canvasElement: HTMLElement): Promise<HTMLElement> =>
  waitFor(() => {
    const root = canvasElement.querySelector<HTMLElement>('[data-layout-role="workbench-split-detail-root"]');
    expect(root).not.toBeNull();
    return root!;
  });

const assertStructuredValuePreviewLine = (viewer: HTMLElement, expectedText: string): void => {
  const preview = viewer.querySelector("pre");
  expect(preview).not.toBeNull();
  const lines = (preview?.textContent ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const line = lines.find((candidate) => candidate.startsWith(`${expectedText}:`));
  expect(line).toBeDefined();
  expect(line).toContain(expectedText);
};

export const WriteSuccessClearsDraft = {
  name: "Scenario: Given a successful terminal write When the tool call resolves Then the editor draft clears and the terminal facts stay visible",
  args: {
    writeBehavior: "success",
  },
  play: async ({ canvasElement }) => {
    const { canvas, draft } = await writeDraft(canvasElement, "echo shipped");
    await expect(canvas.getByTestId("terminal-actions-panel")).toBeInTheDocument();
    await expect(canvas.getByTestId("terminal-write-input-group")).toBeInTheDocument();
    await expect(draft).toHaveValue("");
    await expect(canvas.getByText("Absolute cwd: /repo/ops")).toBeInTheDocument();
  },
} satisfies Story;

export const UsersPaneWideActionsStayBehaviorallyAligned = {
  name: "Scenario: Given a wide terminal route When the users dialog updates focus and revoke actions Then the shared seat behavior model stays consistent",
  args: {
    surfaceWidthPx: 1280,
    initialGrantedSeats: [{ participantId: "auth:observer", role: "readonly" }],
  },
  play: async ({ canvasElement }) => {
    const dialog = await openUsersDialog(canvasElement);
    await userEvent.click(dialog.getByTestId("terminal-seat-actions-session:reviewer"));
    await userEvent.click(dialog.getByTestId("terminal-seat-focus-session:reviewer"));
    await waitFor(() => {
      expect(within(dialog.getByTestId("terminal-seat-session:reviewer")).getByText("Focused")).toBeInTheDocument();
    });
    await expect(dialog.getByTestId("terminal-seat-auth:observer")).toBeInTheDocument();
    await userEvent.click(dialog.getByTestId("terminal-seat-actions-auth:observer"));
    await userEvent.click(dialog.getByTestId("terminal-seat-revoke-auth:observer"));
    await waitFor(() => {
      expect(dialog.queryByTestId("terminal-seat-auth:observer")).not.toBeInTheDocument();
    });
  },
} satisfies Story;

export const UsersPaneCompactActionsStayBehaviorallyAligned = {
  name: "Scenario: Given a compact terminal toolbar When opening Users Then the settings dialog still keeps seat management reachable",
  args: {
    surfaceWidthPx: 720,
  },
  play: async ({ canvasElement }) => {
    const dialog = await openUsersDialog(canvasElement);
    await waitFor(() => {
      expect(dialog.getByTestId("terminal-seat-grant")).toBeInTheDocument();
    });
    await userEvent.click(dialog.getByTestId("terminal-seat-actions-session:reviewer"));
    await userEvent.click(dialog.getByTestId("terminal-seat-focus-session:reviewer"));
    await waitFor(() => {
      expect(within(dialog.getByTestId("terminal-seat-session:reviewer")).getByText("Focused")).toBeInTheDocument();
    });
  },
} satisfies Story;

export const ApprovalLifecycleStaysInUsersPane = {
  name: "Scenario: Given a pending write approval When the users dialog approves it Then the requester lease surfaces without rebuilding local seat truth",
  args: {
    writeBehavior: "approval",
    initialCallerToken: "token:term-story:reviewer",
  },
  play: async ({ canvasElement }) => {
    await writeDraft(canvasElement, "echo awaiting approval");
    const dialog = await openUsersDialog(canvasElement);
    const approveButton = await waitFor(() => {
      const button = canvasElement.ownerDocument.body.querySelector<HTMLElement>(
        '[data-testid^="terminal-approval-approve-"]',
      );
      expect(button).not.toBeNull();
      return button!;
    });
    await userEvent.click(approveButton);
    await waitFor(() => {
      expect(
        within(dialog.getByTestId("terminal-seat-session:reviewer")).getByText(/Lease until/u),
      ).toBeInTheDocument();
    });
  },
} satisfies Story;

export const DeniedApprovalLeavesSeatWithoutLease = {
  name: "Scenario: Given a pending write approval When the users dialog denies it Then the requester seat stays lease-free and the denial remains visible",
  args: {
    writeBehavior: "approval",
    initialCallerToken: "token:term-story:reviewer",
  },
  play: async ({ canvasElement }) => {
    await writeDraft(canvasElement, "echo denied approval");
    const dialog = await openUsersDialog(canvasElement);
    const denyButton = await waitFor(() => {
      const button = canvasElement.ownerDocument.body.querySelector<HTMLElement>(
        '[data-testid^="terminal-approval-deny-"]',
      );
      expect(button).not.toBeNull();
      return button!;
    });
    await userEvent.click(denyButton);
    await waitFor(() => {
      expect(within(canvasElement).getByText(/Denied approval-/u)).toBeInTheDocument();
    });
    expect(within(dialog.getByTestId("terminal-seat-session:reviewer")).queryByText(/Lease until/u)).toBeNull();
  },
} satisfies Story;

export const AuthoritativeProjectionOmitsBootstrapSeat = {
  name: "Scenario: Given a terminal surface projection without a system actor seat When the users dialog renders Then the route does not fabricate a bootstrap seat row",
  args: {
    includeBootstrapSeat: false,
  },
  play: async ({ canvasElement }) => {
    const dialog = await openUsersDialog(canvasElement);
    await waitFor(() => {
      expect(dialog.getByTestId("terminal-seat-session:reviewer")).toBeInTheDocument();
    });
    expect(dialog.queryByTestId("terminal-seat-system:trusted-terminal-bootstrap")).toBeNull();
    expect(dialog.queryByText("System seat")).toBeNull();
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

export const ToolbarStatusReflectsBusyRuntimeFacts = {
  name: "Scenario: Given a running busy terminal When the selected route renders Then the page-toolbar status reflects authoritative runtime facts",
  args: {
    surfaceWidthPx: 1280,
    terminalRunning: true,
    terminalStatus: "BUSY",
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const statuses = Array.from(
        canvasElement.querySelectorAll<HTMLElement>("[data-workbench-toolbar-status]"),
      );
      expect(statuses).toHaveLength(2);
      const running = statuses.find((item) => item.textContent?.trim() === "Running");
      const busy = statuses.find((item) => item.textContent?.trim() === "Busy");
      expect(running?.dataset.workbenchToolbarStatusTone).toBe("positive");
      expect(busy?.dataset.workbenchToolbarStatusTone).toBe("accent");
    });
  },
} satisfies Story;

export const WideSurfaceUsesResizableDetailSplit = {
  name: "Scenario: Given a wide terminal surface When the shared split-detail shell renders Then the activity rail stays in a persistent resizable right pane",
  args: {
    surfaceWidthPx: 1280,
  },
  play: async ({ canvasElement }) => {
    const splitRoot = await findSplitRoot(canvasElement);
    await waitFor(() => {
      expect(splitRoot.dataset.compact).toBe("false");
    });
    await expect(within(canvasElement).getByRole("separator", { name: "Resize detail panel" })).toBeInTheDocument();
    await waitFor(() => {
      expect(
        canvasElement.querySelector('[data-terminal-detail-panel-view="actions"]'),
      ).not.toBeNull();
    });
  },
} satisfies Story;

export const CompactSurfaceKeepsDetailReachable = {
  name: "Scenario: Given a narrow terminal surface When the shared split-detail shell collapses Then the actions rail opens through the shared right sheet instead of stacking below the stage",
  args: {
    surfaceWidthPx: 560,
    surfaceHeightPx: 780,
  },
  play: async ({ canvasElement }) => {
    const splitRoot = await findSplitRoot(canvasElement);
    await waitFor(() => {
      expect(splitRoot.dataset.compact).toBe("true");
      expect(canvasElement.querySelector('[data-terminal-detail-layout="sheet"]')).not.toBeNull();
    });
    expect(canvasElement.querySelector('[data-layout-role="workbench-split-detail-handle"]')).toBeNull();
    await expect(within(canvasElement).getByTestId("terminal-stage-pane")).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-terminal-detail-panel-view="actions"]')).toBeNull();
    await openActionsDetail(canvasElement);
  },
} satisfies Story;

export const ReadActionStructuredPreviewStaysCompact = {
  name: "Scenario: Given a terminal read action When the shared tool invocation card renders YAML previews Then the read parameter panel stays above a compact actor row and each mapping line stays compact",
  args: {
    surfaceWidthPx: 1280,
  },
  play: async ({ canvasElement }) => {
    const canvas = await triggerReadAction(canvasElement);
    const readGroup = canvas.getByTestId("terminal-read-input-group");
    await expect(readGroup).toBeInTheDocument();
    await expect(canvas.getByTestId("terminal-read-parameter-panel")).toBeInTheDocument();
    await expect(canvas.getByTestId("terminal-read-parameter-mode")).toBeInTheDocument();
    const actorTrigger = within(readGroup).getByRole("button", { name: "Call tool as" });
    expect(actorTrigger.textContent ?? "").toContain("Bootstrap admin");
    expect(actorTrigger.textContent ?? "").not.toContain("system:trusted-terminal-bootstrap");
    await userEvent.click(actorTrigger);
    await waitFor(() => {
      expect(within(canvasElement.ownerDocument.body).getByText("/repo/reviewer")).toBeInTheDocument();
    });
    await userEvent.keyboard("{Escape}");
    const card = await findInvocationCard(canvasElement, "terminal.read");
    expect(card.querySelector("agenter-tool-invocation-card")).toBeNull();
    const viewers = Array.from(card.querySelectorAll<HTMLElement>('[data-testid="structured-value-viewer"]'));
    expect(viewers).toHaveLength(2);
    expect(card.querySelector('[aria-label="Structured value options"]')).toBeNull();
    assertStructuredValuePreviewLine(viewers[0]!, "mode");
    assertStructuredValuePreviewLine(viewers[1]!, "representation");
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
      expect(terminalView?.shadowRoot?.querySelector("[data-terminal-stage]")?.getAttribute("style")).toContain(
        "align-items:flex-start",
      );
      expect(terminalView?.shadowRoot?.querySelector("[data-terminal-stage]")?.getAttribute("style")).toContain(
        "justify-content:flex-start",
      );
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
