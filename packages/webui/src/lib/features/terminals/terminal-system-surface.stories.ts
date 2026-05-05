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
    expect(canvas.getByText("Launch cwd: /repo/ops")).toBeInTheDocument();
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

const resolvePageToolbarRoot = (canvasElement: HTMLElement): HTMLElement => {
  const toolbarRoot = canvasElement.querySelector<HTMLElement>("[data-workbench-page-toolbar]");
  if (!toolbarRoot) {
    throw new Error("Page toolbar root not found");
  }
  return toolbarRoot;
};

const resolveToolbarOverflowPanel = async (canvasElement: HTMLElement): Promise<HTMLElement> => {
  const toolbarRoot = resolvePageToolbarRoot(canvasElement);
  const panel = toolbarRoot.querySelector<HTMLElement>('[data-workbench-toolbar-region="overflow-panel"]');
  if (panel) {
    return panel;
  }
  const trigger = await waitFor(() => {
    const nextTrigger =
      findNamedToolbarButton(toolbarRoot, "Open terminal toolbar details") ??
      Array.from(
        toolbarRoot.querySelectorAll<HTMLElement>(
          '[data-workbench-toolbar-region="overflow-trigger"] button, [data-workbench-toolbar-region="overflow-trigger"] [role="button"]',
        ),
      ).find(isInteractableToolbarButton) ??
      null;
    expect(nextTrigger).not.toBeNull();
    return nextTrigger!;
  });
  await userEvent.click(trigger);
  return waitFor(() => {
    const nextPanel = toolbarRoot.querySelector<HTMLElement>('[data-workbench-toolbar-region="overflow-panel"]');
    expect(nextPanel).not.toBeNull();
    return nextPanel!;
  });
};

const isInteractableToolbarButton = (element: HTMLElement | null | undefined): element is HTMLElement => {
  if (!element) {
    return false;
  }
  if (element.closest("[hidden]")) {
    return false;
  }
  const styles = getComputedStyle(element);
  if (styles.pointerEvents === "none" || styles.visibility === "hidden" || styles.display === "none") {
    return false;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }
  return true;
};

const findNamedToolbarButton = (root: ParentNode | null | undefined, name: string): HTMLElement | null => {
  if (!root) {
    return null;
  }
  return (
    Array.from(root.querySelectorAll<HTMLElement>('button,[role="button"]')).find(
      (element) =>
        isInteractableToolbarButton(element) &&
        (element.getAttribute("aria-label") === name ||
          element.getAttribute("title") === name ||
          element.textContent?.trim() === name),
    ) ?? null
  );
};

const findToolbarActionButton = async (canvasElement: HTMLElement, name: string): Promise<HTMLElement> => {
  const toolbarRoot = resolvePageToolbarRoot(canvasElement);
  const toolbarState = await waitFor(() => {
    const nextInlineButton = findNamedToolbarButton(
      toolbarRoot.querySelector('[data-workbench-toolbar-region="actions-inline"]') ?? toolbarRoot,
      name,
    );
    const nextOverflowTrigger =
      findNamedToolbarButton(toolbarRoot, "Open terminal toolbar details") ??
      Array.from(
        toolbarRoot.querySelectorAll<HTMLElement>(
          '[data-workbench-toolbar-region="overflow-trigger"] button, [data-workbench-toolbar-region="overflow-trigger"] [role="button"]',
        ),
      ).find(isInteractableToolbarButton) ??
      null;
    expect(nextInlineButton || nextOverflowTrigger).not.toBeNull();
    return {
      inlineButton: nextInlineButton,
      overflowTrigger: nextOverflowTrigger,
    };
  });
  if (toolbarState.inlineButton) {
    return toolbarState.inlineButton;
  }
  if (!toolbarState.overflowTrigger) {
    throw new Error(`Toolbar action button not found: ${name}`);
  }
  await userEvent.click(toolbarState.overflowTrigger);
  const overflowPanel = await waitFor(() => {
    const nextPanel = toolbarRoot.querySelector<HTMLElement>('[data-workbench-toolbar-region="overflow-panel"]');
    expect(nextPanel).not.toBeNull();
    return nextPanel!;
  });
  const overflowButton = findNamedToolbarButton(
    overflowPanel.querySelector('[data-workbench-toolbar-region="overflow-actions"]') ?? overflowPanel,
    name,
  );
  if (!overflowButton) {
    throw new Error(`Toolbar action button not found: ${name}`);
  }
  return overflowButton;
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
  readTab.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  await waitFor(() => {
    expect(readTab).toHaveAttribute("aria-selected", "true");
  });
  const submit = canvas.getByRole("button", { name: "Call read" });
  await waitFor(() => {
    expect(submit).not.toBeDisabled();
  });
  submit.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
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

const openTerminalConfigDialog = async (trigger: HTMLElement) => {
  await userEvent.click(trigger);
  return waitFor(() => {
    const overlay = within(document.body);
    expect(overlay.getByTestId("terminal-window-config-dialog")).toBeInTheDocument();
    return overlay;
  });
};

const waitForTerminalConfigDialogToClose = async (): Promise<void> => {
  await waitFor(() => {
    expect(within(document.body).queryByTestId("terminal-window-config-dialog")).toBeNull();
  });
  await waitFor(() => {
    expect(document.body.style.pointerEvents).not.toBe("none");
  });
};

const selectConfigValue = async (overlay: ReturnType<typeof within>, triggerTestId: string, optionName: string) => {
  await userEvent.click(overlay.getByTestId(triggerTestId));
  const option = await waitFor(() => {
    const nextOption =
      within(document.body).queryByRole("option", { name: optionName }) ??
      within(document.body).queryByText(optionName);
    expect(nextOption).not.toBeNull();
    return nextOption!;
  });
  await userEvent.click(option);
};

const setConfigRangeValue = async (overlay: ReturnType<typeof within>, inputTestId: string, value: string) => {
  const input = overlay.getByTestId(inputTestId) as HTMLInputElement;
  await userEvent.click(input);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
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
    await expect(canvas.getByText("Launch cwd: /repo/ops")).toBeInTheDocument();
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
    terminalRunning: false,
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
    await expect(within(canvasElement).getByText("Launch cwd: /repo/ops")).toBeInTheDocument();
    await expect(within(canvasElement).getByText("Transport: Transport discoverable while stopped")).toBeInTheDocument();
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
  name: "Scenario: Given a terminal window chrome When the maximize control toggles Then fit-cover changes the window geometry instead of scaling the titlebar",
  args: {
    surfaceWidthPx: 920,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const windowSurface = canvasElement.querySelector<HTMLElement>('[data-terminal-window-surface="true"]');
    const terminalView = canvasElement.querySelector<HTMLElement>('[data-terminal-host-root="true"]') as
      | (HTMLElement & { projectionScale?: number; shadowRoot: ShadowRoot | null })
      | null;
    const scrollViewport = canvas.getByTestId("terminal-window-scroll-viewport");
    expect(windowSurface).not.toBeNull();
    expect(terminalView).not.toBeNull();
    await expect(scrollViewport).toBeInTheDocument();
	    const fitShellWidth = Number(windowSurface?.dataset.terminalWindowShellWidth ?? "0");
	    const fitShellHeight = Number(windowSurface?.dataset.terminalWindowShellHeight ?? "0");
	    const fitBodyWidth = Number(windowSurface?.dataset.terminalWindowBodyWidth ?? "0");
	    const fitBodyHeight = Number(windowSurface?.dataset.terminalWindowBodyHeight ?? "0");
	    const fitFrameWidth = Number(windowSurface?.dataset.terminalWindowFrameWidth ?? "0");
    const fitTitlebar = canvas.getByTestId("terminal-window-fit-titlebar");
    const fitHeaderHeight = fitTitlebar.getBoundingClientRect().height ?? 0;
    await waitFor(() => {
      expect(windowSurface?.dataset.terminalWindowMode).toBe("fit");
      expect(terminalView?.shadowRoot?.querySelector('[data-terminal-view-root="true"]')).not.toBeNull();
    });
    const fitProjectionScale = Number(terminalView?.projectionScale ?? 0);
    expect(fitProjectionScale).toBeGreaterThan(0);
    expect(fitProjectionScale).toBeLessThanOrEqual(1);
    expect(fitTitlebar.textContent).not.toContain("/repo/ops");
    expect(canvas.getByTestId("terminal-window-size-info").textContent?.trim()).toBe("80x24");
    const fitBody = windowSurface?.querySelector<HTMLElement>('[data-terminal-window-body="true"]');
    const fitBodyContent = windowSurface?.querySelector<HTMLElement>('[data-terminal-window-body-content="true"]');
    const fitInsetX = Number(fitBody?.dataset.terminalWindowBodyInsetX ?? "0");
    const fitInsetY = Number(fitBody?.dataset.terminalWindowBodyInsetY ?? "0");
    expect(fitInsetX).toBeGreaterThanOrEqual(2);
    expect(fitInsetY).toBeGreaterThanOrEqual(2);
    const fitBodyRect = fitBody?.getBoundingClientRect();
    const fitTerminalHostRect = terminalView?.getBoundingClientRect();
    expect((fitTerminalHostRect?.left ?? 0) - (fitBodyRect?.left ?? 0)).toBeCloseTo(fitInsetX, 1);
    expect((fitTerminalHostRect?.top ?? 0) - (fitBodyRect?.top ?? 0)).toBeCloseTo(fitInsetY, 1);
    expect(getComputedStyle(fitBodyContent ?? fitBody!).paddingLeft).toBe(`${fitInsetX}px`);
    expect(getComputedStyle(fitBodyContent ?? fitBody!).paddingTop).toBe(`${fitInsetY}px`);
	    canvas.getByTestId("terminal-window-zoom-control").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
	    await waitFor(() => {
	      expect(windowSurface?.dataset.terminalWindowMode).toBe("cover");
	      expect(getComputedStyle(scrollViewport).overflowX).not.toBe("hidden");
	    });
	    const coverTitlebar = canvas.getByTestId("terminal-window-cover-titlebar");
	    expect(coverTitlebar.parentElement).not.toBe(windowSurface);
	    expect(coverTitlebar.getBoundingClientRect().height).toBeCloseTo(fitHeaderHeight, 0);
	    expect(canvas.queryByTestId("terminal-window-live-resize-handle")).toBeNull();
	    expect(Number(terminalView?.projectionScale ?? 0)).toBe(1);
	    const body = windowSurface?.querySelector<HTMLElement>('[data-terminal-window-body="true"]');
	    const bodyContent = windowSurface?.querySelector<HTMLElement>('[data-terminal-window-body-content="true"]');
	    const coverBodyWidth = Number(windowSurface?.dataset.terminalWindowBodyWidth ?? "0");
	    const coverBodyHeight = Number(windowSurface?.dataset.terminalWindowBodyHeight ?? "0");
	    const coverShellWidth = Number(windowSurface?.dataset.terminalWindowShellWidth ?? "0");
	    const coverShellHeight = Number(windowSurface?.dataset.terminalWindowShellHeight ?? "0");
	    const coverContentBoxWidth = Number(body?.dataset.terminalWindowContentBoxWidth ?? "0");
	    const coverContentBoxHeight = Number(body?.dataset.terminalWindowContentBoxHeight ?? "0");
	    expect(coverShellWidth !== fitShellWidth || coverShellHeight !== fitShellHeight).toBe(true);
	    expect(coverBodyWidth !== fitBodyWidth || coverBodyHeight !== fitBodyHeight).toBe(true);
	    expect(coverBodyWidth).toBeGreaterThan(coverContentBoxWidth);
	    expect(coverBodyHeight).toBeGreaterThan(coverContentBoxHeight);
    const runningBodyAnimations = body?.getAnimations().filter((animation) => animation.playState !== "idle") ?? [];
    expect(runningBodyAnimations.length).toBeGreaterThan(0);
    const animatedProperties = runningBodyAnimations.flatMap((animation) => {
      const effect = animation.effect;
      if (!effect || !("getKeyframes" in effect) || typeof effect.getKeyframes !== "function") {
        return [];
      }
      return effect.getKeyframes().flatMap((keyframe: Keyframe) => Object.keys(keyframe));
    });
    expect(animatedProperties).toContain("transform");
    expect(animatedProperties).toContain("opacity");
    expect(animatedProperties).not.toContain("width");
    expect(animatedProperties).not.toContain("height");
    await Promise.allSettled(runningBodyAnimations.map((animation) => animation.finished));
    const terminalViewport = terminalView?.shadowRoot?.querySelector<HTMLElement>("[data-terminal-viewport]");
    const bodyRect = body?.getBoundingClientRect();
    const terminalHostRect = terminalView?.getBoundingClientRect();
    const coverInsetX = Number(body?.dataset.terminalWindowBodyInsetX ?? "0");
    const coverInsetY = Number(body?.dataset.terminalWindowBodyInsetY ?? "0");
    expect(terminalHostRect?.left ?? 0).toBeCloseTo((bodyRect?.left ?? 0) + coverInsetX, 1);
    expect(terminalHostRect?.top ?? 0).toBeCloseTo((bodyRect?.top ?? 0) + coverInsetY, 1);
    expect(terminalHostRect?.right ?? 0).toBeCloseTo((bodyRect?.right ?? 0) - coverInsetX, 1);
    expect(terminalHostRect?.bottom ?? 0).toBeCloseTo((bodyRect?.bottom ?? 0) - coverInsetY, 1);
    expect(terminalHostRect?.width ?? 0).toBeCloseTo(coverContentBoxWidth, 0);
    expect(terminalHostRect?.height ?? 0).toBeCloseTo(coverContentBoxHeight, 0);
    canvas.getByTestId("terminal-window-zoom-control").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await waitFor(() => {
      expect(windowSurface?.dataset.terminalWindowMode).toBe("fit");
      expect(Number(windowSurface?.dataset.terminalWindowShellWidth ?? "0")).toBeLessThanOrEqual(
        Number(windowSurface?.dataset.terminalWindowFrameWidth ?? "0"),
      );
    });
    expect(canvas.queryByTestId("terminal-window-cover-titlebar")).toBeNull();
    await expect(canvas.getByTestId("terminal-window-live-resize-handle")).toBeInTheDocument();
  },
} satisfies Story;

export const WindowChromeLiveResizeUpdatesFrameHint = {
  name: "Scenario: Given a terminal window live resize handle When the operator drags it Then the drag is committed as terminal rows and cols and the frame returns to content-owned layout",
  args: {
    surfaceWidthPx: 920,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("tab", { name: "Resize" }).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(canvas.queryByTestId("terminal-live-resize-hint")).toBeNull();
    const windowSurface = canvasElement.querySelector<HTMLElement>('[data-terminal-window-surface="true"]');
    expect(windowSurface).not.toBeNull();
    const beforeFrameWidth = Number(windowSurface?.dataset.terminalWindowFrameWidth ?? "0");
    const beforeFrameHeight = Number(windowSurface?.dataset.terminalWindowFrameHeight ?? "0");
    const resizeColsInput = canvas.getByTestId("terminal-resize-cols") as HTMLInputElement;
    const resizeRowsInput = canvas.getByTestId("terminal-resize-rows") as HTMLInputElement;
    const handle = canvas.getByTestId("terminal-window-live-resize-handle");
    expect(handle).toHaveAttribute("data-terminal-window-native-resize-handle", "true");
    expect(handle.children.length).toBe(0);
    expect(getComputedStyle(handle).cursor).toBe("se-resize");
    expect(getComputedStyle(handle).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    const handleRect = handle.getBoundingClientRect();
    const startX = handleRect.left + handleRect.width / 2;
    const startY = handleRect.top + handleRect.height / 2;
    handle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 1,
        clientX: startX,
        clientY: startY,
      }),
    );
    await waitFor(() => {
      expect(document.documentElement.style.cursor).toBe("se-resize");
      expect(document.documentElement.style.userSelect).toBe("none");
    });
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        clientX: startX - 72,
        clientY: startY - 40,
      }),
    );
    const resizeHint = await waitFor(() => {
      const hint = canvas.getByTestId("terminal-live-resize-hint");
      expect(hint).toBeInTheDocument();
      return hint;
    });
    await waitFor(() => {
      expect(Number(windowSurface?.dataset.terminalWindowFrameWidth ?? "0")).toBeLessThan(beforeFrameWidth);
      expect(Number(windowSurface?.dataset.terminalWindowFrameHeight ?? "0")).toBeLessThan(beforeFrameHeight);
      expect(resizeHint.textContent?.trim() ?? "").toMatch(/Live frame:\s*\d+x\d+px/u);
    });
    const movedText = resizeHint.textContent?.trim() ?? "";
    const movedGeometry = within(windowSurface!).getByTestId("terminal-window-size-info").textContent?.trim() ?? "";
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 1,
        clientX: startX - 72,
        clientY: startY - 40,
      }),
    );
    await waitFor(() => {
      expect(resizeHint.textContent?.trim()).toBe(movedText);
      expect(document.documentElement.style.cursor).not.toBe("se-resize");
      expect(document.documentElement.style.userSelect).not.toBe("none");
      const releasedFrameWidth = Number(windowSurface?.dataset.terminalWindowFrameWidth ?? "0");
      const releasedFrameHeight = Number(windowSurface?.dataset.terminalWindowFrameHeight ?? "0");
      expect(releasedFrameWidth).not.toBe(beforeFrameWidth - 72);
      expect(releasedFrameHeight).not.toBe(beforeFrameHeight - 40);
      expect(releasedFrameWidth).toBeGreaterThan(320);
      expect(releasedFrameHeight).toBeGreaterThan(220);
      expect(within(windowSurface!).getByTestId("terminal-window-size-info").textContent?.trim()).toBe(
        movedGeometry,
      );
      expect(`${resizeColsInput.value}x${resizeRowsInput.value}`).toBe(movedGeometry);
    });
  },
} satisfies Story;

export const WindowTitlebarConfigPanelUpdatesPresentation = {
  name: "Scenario: Given terminal titlebar config controls When the operator stages and applies presentation changes Then durable truth updates only after Apply across fit and cover chrome",
  args: {
    surfaceWidthPx: 920,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const terminalView = canvasElement.querySelector<HTMLElement>('[data-terminal-host-root="true"]') as
      | (HTMLElement & {
          rendererPreference?: string;
          theme?: string;
          font?: { family?: string; sizePx?: number };
        })
      | null;
    const windowSurface = canvasElement.querySelector<HTMLElement>('[data-terminal-window-surface="true"]');
    expect(terminalView).not.toBeNull();
    expect(windowSurface).not.toBeNull();

    const fitTitlebar = canvas.getByTestId("terminal-window-fit-titlebar");
    const fitConfigControl = within(fitTitlebar).getByTestId("terminal-window-config-control");
    const fitOverlay = await openTerminalConfigDialog(fitConfigControl);
    await selectConfigValue(fitOverlay, "terminal-config-theme-select", "Default Light");
    await waitFor(() => {
      expect(terminalView?.theme).toBe("default-dark");
    });
    await userEvent.click(fitOverlay.getByTestId("terminal-config-apply"));
    await waitFor(() => {
      expect(terminalView?.theme).toBe("default-light");
    });
    await waitForTerminalConfigDialogToClose();
    expect(
      getComputedStyle(windowSurface?.querySelector<HTMLElement>('[data-terminal-window-body="true"]')!).backgroundColor,
    ).toBe("rgb(248, 250, 252)");

    const fitOverlayRenderer = await openTerminalConfigDialog(fitConfigControl);
    await selectConfigValue(fitOverlayRenderer, "terminal-config-renderer-select", "XTerm");
    await userEvent.click(fitOverlayRenderer.getByTestId("terminal-config-apply"));
    await waitFor(() => {
      expect(terminalView?.rendererPreference).toBe("xterm");
    });
    await waitForTerminalConfigDialogToClose();

    const fitOverlayFontFamily = await openTerminalConfigDialog(fitConfigControl);
    await selectConfigValue(fitOverlayFontFamily, "terminal-config-font-family-select", "Cascadia Mono");
    await userEvent.click(fitOverlayFontFamily.getByTestId("terminal-config-apply"));
    await waitFor(() => {
      expect(terminalView?.font?.family).toContain("Cascadia Mono");
    });
    await waitForTerminalConfigDialogToClose();

    const fitOverlayFontSize = await openTerminalConfigDialog(fitConfigControl);
    await setConfigRangeValue(fitOverlayFontSize, "terminal-config-font-size-range", "16");
    await userEvent.click(fitOverlayFontSize.getByTestId("terminal-config-apply"));
    await waitFor(() => {
      expect(terminalView?.font?.sizePx).toBe(16);
    });
    await waitForTerminalConfigDialogToClose();

    canvas.getByTestId("terminal-window-zoom-control").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    const coverTitlebar = await waitFor(() => {
      const titlebar = canvas.getByTestId("terminal-window-cover-titlebar");
      expect(titlebar.getAttribute("data-terminal-window-titlebar-owner")).toBe("window-container");
      return titlebar;
    });
    expect(canvas.queryByTestId("terminal-window-fit-titlebar")).toBeNull();
    expect(within(coverTitlebar).getByTestId("terminal-window-size-info").textContent?.trim()).toBe("80x24");

    const coverConfigControl = within(coverTitlebar).getByTestId("terminal-window-config-control");
    const overlay = await openTerminalConfigDialog(coverConfigControl);
    expect(overlay.getByText("Theme")).toBeInTheDocument();
    expect(overlay.getByText("Renderer")).toBeInTheDocument();
    expect(overlay.getByText("Font family")).toBeInTheDocument();
    expect(overlay.getByText("Font size")).toBeInTheDocument();
    await selectConfigValue(overlay, "terminal-config-renderer-select", "WTerm (Experimental)");
    await userEvent.click(overlay.getByTestId("terminal-config-apply"));
    await waitFor(() => {
      expect(terminalView?.rendererPreference).toBe("wterm");
      expect(terminalView?.theme).toBe("default-light");
      expect(terminalView?.font?.sizePx).toBe(16);
    });
    await waitForTerminalConfigDialogToClose();
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
    await expect(canvas.getByText("Launch cwd: /repo/ops")).toBeInTheDocument();
    await expect(canvas.getByRole("tab", { name: "Write" })).toBeInTheDocument();
  },
} satisfies Story;

export const WindowCloseRequiresConfirmation = {
  name: "Scenario: Given a terminal toolbar delete action When deletion is confirmed Then the surface removes the terminal only after the confirmation dialog accepts it",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(document.body.style.pointerEvents).not.toBe("none");
    });
    await userEvent.click(canvas.getByRole("button", { name: "Delete terminal" }));
    const dialog = await within(document.body).findByTestId("terminal-delete-confirm-dialog");
    expect(dialog).toBeInTheDocument();
    await userEvent.click(within(document.body).getByTestId("terminal-delete-confirm-submit"));
    await waitFor(() => {
      expect(canvas.queryByRole("button", { name: "Delete terminal" })).not.toBeInTheDocument();
      expect(canvas.getByText("Select a terminal tab.")).toBeInTheDocument();
    });
  },
} satisfies Story;

export const KillPtyRequiresConfirmation = {
  name: "Scenario: Given terminal lifecycle kill is requested When the operator confirms the warning Then the PTY stops only after the confirmation dialog accepts it",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await findToolbarActionButton(canvasElement, "Kill PTY"));
    const dialog = await within(document.body).findByTestId("terminal-stop-confirm-dialog");
    expect(dialog).toBeInTheDocument();
    await userEvent.click(within(document.body).getByTestId("terminal-stop-confirm-submit"));
    await waitFor(() => {
      expect(canvas.getByRole("button", { name: "Bootstrap PTY" })).toBeInTheDocument();
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
