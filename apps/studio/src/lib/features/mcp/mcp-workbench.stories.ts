import type { Meta, StoryObj } from "@storybook/sveltekit";
import { expect, waitFor, within } from "storybook/test";

import McpWorkbenchStoryHarness from "./mcp-workbench.story-harness.svelte";

const meta = {
  title: "Features/MCP/MCP Workbench",
  component: McpWorkbenchStoryHarness,
  render: (args) => ({
    Component: McpWorkbenchStoryHarness,
    props: args,
  }),
} satisfies Meta<typeof McpWorkbenchStoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AvatarAuthorityWithoutRunningRuntime = {
  name: "Scenario: Given no running AvatarRuntime When configs opens Then new config still chooses one owner Avatar",
  args: {
    scenario: "avatar-authority",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("mcp-story-avatar-authority")).toHaveTextContent("New config");
    await expect(canvas.getByTestId("mcp-new-global-form")).toBeInTheDocument();
    await expect(within(canvas.getByTestId("mcp-config-owner")).getByLabelText("Owner Avatar")).toBeInTheDocument();
  },
} satisfies Story;

export const ConfigsNewDraft = {
  name: "Scenario: Given configs tab When new draft is selected Then one detail form stays focused on install",
  args: {
    scenario: "configs-new",
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const inspectSurface = canvas.getByTestId("mcp-config-inspect");
    await expect(canvas.getByTestId("mcp-new-global-form")).toHaveTextContent("New config");
    await expect(within(canvas.getByTestId("mcp-config-owner")).getByLabelText("Owner Avatar")).toBeInTheDocument();
    await expect(canvas.getByLabelText("Project path")).toHaveValue("");
    await expect(canvas.getByLabelText("Name")).toHaveValue("");
    await expect(canvas.getByLabelText("Title")).toHaveValue("");
    await expect(canvas.getByLabelText("Command")).toHaveValue("bunx");
    await expect(canvas.getByLabelText("Args")).toHaveValue("");
    await expect(within(inspectSurface).queryByText("idle")).toBeNull();
    await expect(canvas.getByTestId("mcp-config-inspect-connect")).toHaveTextContent("Connect");
    await userEvent.type(canvas.getByLabelText("Args"), "@playwright/mcp@latest");
    await expect(canvas.getByLabelText("Name")).toHaveValue("playwright");
    await expect(canvas.getByLabelText("Title")).toHaveValue("Playwright");
    await expect(canvas.getByTestId("mcp-config-inspect")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Code" }));
    await expect(canvas.getByTestId("mcp-config-code-textarea")).toBeInTheDocument();
    await userEvent.click(canvas.getByTestId("mcp-config-inspect-connect"));
    const inspectDialog = within(canvasElement.ownerDocument.body).getByTestId("mcp-config-light-inspect-dialog");
    await waitFor(() => {
      expect(within(inspectDialog).getByTestId("mcp-config-inspect-capabilities-view")).toBeInTheDocument();
    });
    await expect(within(inspectDialog).queryByLabelText("Project path")).toBeNull();
    await expect(within(inspectDialog).queryByTestId("mcp-config-inspect-connect")).toBeNull();
    await expect(within(inspectDialog).getByTestId("mcp-config-inspect-ping")).toBeInTheDocument();
    await expect(within(inspectDialog).getByTestId("mcp-config-light-inspect-signal")).toHaveAttribute(
      "data-state",
      "live",
    );
  },
} satisfies Story;

export const InspectServerCapabilitiesAndRaw = {
  name: "Scenario: Given inspect connects When snapshot tabs are selected Then server, capabilities, and raw stay independently scrollable",
  args: {
    scenario: "configs-new",
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const bodyElement = canvasElement.ownerDocument.body;
    const body = within(bodyElement);
    await expect(within(canvas.getByTestId("mcp-config-inspect")).queryByText("idle")).toBeNull();
    await expect(canvas.getByTestId("mcp-config-inspect-connect")).toHaveTextContent("Connect");
    const getSnapshotTabs = () => within(within(dialog).getByRole("tablist", { name: "Inspect snapshot view" }));
    const waitForCapabilityItem = async (testId: string): Promise<HTMLElement> =>
      waitFor(() => {
        expect(document.body.style.pointerEvents).not.toBe("none");
        const item = within(dialog).getByTestId(testId) as HTMLElement;
        const styles = getComputedStyle(item);
        expect(styles.pointerEvents).not.toBe("none");
        expect(styles.visibility).not.toBe("hidden");
        expect(styles.display).not.toBe("none");
        return item;
      });

    await userEvent.click(canvas.getByTestId("mcp-config-inspect-connect"));
    const dialog = body.getByTestId("mcp-config-light-inspect-dialog");
    await waitFor(() => {
      expect(within(dialog).getByTestId("mcp-config-inspect-capabilities-view")).toBeInTheDocument();
    });
    await expect(within(dialog).queryByLabelText("Project path")).toBeNull();
    await expect(within(dialog).queryByTestId("mcp-config-inspect-connect")).toBeNull();
    await expect(within(dialog).getByTestId("mcp-config-light-inspect-signal")).toBeInTheDocument();
    await expect(within(dialog).getByTestId("mcp-config-inspect-ping")).toBeInTheDocument();
    await expect(within(dialog).getByTestId("mcp-config-light-inspect-signal")).toHaveAttribute(
      "data-state",
      "live",
    );
    await userEvent.click(within(dialog).getByTestId("mcp-config-light-inspect-close"));
    const closeConfirm = await waitFor(() => body.getByTestId("mcp-config-light-inspect-close-confirm"));
    await userEvent.click(within(closeConfirm).getByRole("button", { name: "Cancel" }));
    await expect(within(dialog).getByTestId("mcp-config-inspect-capabilities-view")).toBeInTheDocument();
    await userEvent.click(getSnapshotTabs().getByRole("tab", { name: "Server" }));
    await expect(within(dialog).getByTestId("mcp-config-inspect-server-view")).toHaveTextContent("fixture-browser-tools");
    await userEvent.click(within(dialog).getByTestId("mcp-config-inspect-ping"));
    await waitFor(() => {
      expect(within(dialog).getByTestId("mcp-config-inspect-ping")).toHaveAttribute("data-ping-state", "success");
    });
    await expect(canvas.getByTestId("mcp-story-event")).toHaveTextContent("probe:ping:probe-story-1");
    await expect(within(dialog).getByTestId("mcp-config-inspect-server-table")).toHaveTextContent("fixture-browser-tools");
    await userEvent.click(getSnapshotTabs().getByRole("tab", { name: "Capabilities" }));
    await expect(within(dialog).getByTestId("mcp-config-inspect-capabilities")).toBeInTheDocument();
    await expect(within(dialog).getByTestId("mcp-config-inspect-capabilities-view")).toHaveTextContent("Workspace Memory");
    await expect(within(dialog).getByRole("tab", { name: "Tools(2)" })).toBeInTheDocument();
    await expect(within(dialog).getByRole("tab", { name: "Resources(6)" })).toBeInTheDocument();
    await expect(within(dialog).getByRole("tab", { name: "Templates(1)" })).toBeInTheDocument();
    await expect(within(dialog).getByRole("tab", { name: "Prompts(1)" })).toBeInTheDocument();
    await expect(within(dialog).getByRole("tab", { name: "Apps(1)" })).toBeInTheDocument();
    await expect(within(dialog).getByTestId("mcp-config-inspect-capability-list")).toBeInTheDocument();
    await expect(within(dialog).getByTestId("mcp-config-inspect-capability-detail")).toBeInTheDocument();
    await expect(within(dialog).getByTestId("mcp-config-inspect-capability-list-scroll")).toBeInTheDocument();
    await expect(within(dialog).getByTestId("mcp-config-inspect-capability-detail-scroll")).toBeInTheDocument();
    await expect(within(dialog).getByTestId("mcp-config-inspect-tool-card:echo")).toBeInTheDocument();
    await expect(within(dialog).getByTestId("mcp-config-inspect-tool-title:echo")).toHaveTextContent("Echo");
    await expect(within(dialog).getByTestId("mcp-config-inspect-tool-description:echo")).toHaveTextContent(
      "Echo one message back through the fixture transport.",
    );
    await expect(within(dialog).getByTestId("mcp-config-inspect-tool-title:playground-link")).toHaveTextContent(
      "Playground Link UI",
    );
    await expect(within(dialog).getByTestId("mcp-config-inspect-tool-description:playground-link")).toHaveTextContent(
      "Returns a UI resource for playground links.",
    );
    await expect(within(dialog).getByTestId("mcp-config-inspect-tool-icon:echo")).toBeInTheDocument();
    await userEvent.click(getSnapshotTabs().getByRole("tab", { name: "Raw" }));
    await expect(within(dialog).getByText(/serverName/u)).toBeInTheDocument();
    await expect(within(dialog).getByTestId("mcp-config-inspect-cli-envelope")).toHaveTextContent("mcp probe");
    await userEvent.click(getSnapshotTabs().getByRole("tab", { name: "Capabilities" }));
    await userEvent.click(within(dialog).getByTestId("mcp-config-inspect-tool-card:echo"));
    const getCapabilityDetail = (): HTMLElement => within(dialog).getByTestId("mcp-config-inspect-capability-detail");
    await expect(getCapabilityDetail()).toHaveTextContent("Echo one message back through the fixture transport.");
    await expect(within(getCapabilityDetail()).getByTestId("mcp-config-inspect-capability-detail-icon")).toBeInTheDocument();
    await expect(within(getCapabilityDetail()).queryByLabelText("Tool")).toBeNull();
    await expect(within(getCapabilityDetail()).getByRole("tab", { name: "Call" })).toBeInTheDocument();
    await expect(within(getCapabilityDetail()).getByRole("tab", { name: "Raw" })).toBeInTheDocument();
    await expect(within(getCapabilityDetail()).getByTestId("mcp-config-inspect-arguments")).toHaveValue(
      '{\n  "message": "hello",\n  "trace": false\n}',
    );
    await userEvent.click(within(getCapabilityDetail()).getByRole("button", { name: "Call" }));
    await expect(within(getCapabilityDetail()).getByTestId("mcp-config-inspect-result-preview")).toHaveTextContent(
      "structuredContent",
    );
    await expect(within(getCapabilityDetail()).getByTestId("mcp-config-inspect-cli-result")).toHaveTextContent("mcp probe");
    await expect(within(getCapabilityDetail()).getByText(/received/u)).toBeInTheDocument();
    await userEvent.click(within(getCapabilityDetail()).getByRole("tab", { name: "Raw" }));
    await expect(within(getCapabilityDetail()).getByText(/inputSchema/u)).toBeInTheDocument();
    await expect(bodyElement.querySelector('[data-testid="mcp-config-inspect-capability-detail"]')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("tab", { name: "Resources(6)" }));
    await userEvent.click(await waitForCapabilityItem("mcp-config-inspect-resource-card:memory://workspace"));
    await expect(within(getCapabilityDetail()).getByRole("tab", { name: "Read" })).toBeInTheDocument();
    await expect(within(dialog).getByTestId("mcp-config-inspect-resource-icon:memory://workspace")).toBeInTheDocument();
    await userEvent.click(within(getCapabilityDetail()).getByRole("button", { name: "Read" }));
    await expect(within(getCapabilityDetail()).getByTestId("mcp-config-inspect-result-preview")).toHaveTextContent(
      "Workspace Memory",
    );
    await expect(canvas.getByTestId("mcp-story-event")).toHaveTextContent("probe:read-resource:probe-story-1");
    await expect(within(getCapabilityDetail()).getByTestId("mcp-config-inspect-result-preview")).toHaveTextContent(
      '"workspace": "fixture"',
    );

    await userEvent.click(within(dialog).getByRole("tab", { name: "Templates(1)" }));
    await userEvent.click(await waitForCapabilityItem("mcp-config-inspect-template-card:svelte://{/slug*}.md"));
    await expect(within(getCapabilityDetail()).getByRole("tab", { name: "Read Resource" })).toBeInTheDocument();
    await expect(within(getCapabilityDetail()).getByTestId("mcp-config-inspect-template-slug")).toBeInTheDocument();
    await userEvent.type(within(getCapabilityDetail()).getByTestId("mcp-config-inspect-template-slug"), "ai/instructions");
    await userEvent.click(within(getCapabilityDetail()).getByRole("button", { name: "Read Resource" }));
    await expect(within(getCapabilityDetail()).getByTestId("mcp-config-inspect-result-preview")).toHaveTextContent(
      "AI Instructions",
    );
    await expect(within(getCapabilityDetail()).getByTestId("mcp-config-inspect-result-preview")).toHaveTextContent(
      "CLI-shaped evidence",
    );

    await userEvent.click(within(dialog).getByRole("tab", { name: "Apps(1)" }));
    await userEvent.click(await waitForCapabilityItem("mcp-config-inspect-app-card:ui://svelte/playground-link"));
    await expect(within(getCapabilityDetail()).getByRole("tab", { name: "Open" })).toBeInTheDocument();
    await expect(within(dialog).getByTestId("mcp-config-inspect-app-icon:ui://svelte/playground-link")).toBeInTheDocument();
    await userEvent.click(within(getCapabilityDetail()).getByRole("button", { name: "Open" }));
    await expect(within(getCapabilityDetail()).getByTestId("mcp-config-inspect-app-preview")).toHaveTextContent("mcp-app");
    await waitFor(() => {
      expect(within(getCapabilityDetail()).getByTestId("mcp-config-inspect-app-preview")).toHaveTextContent("host");
    });
    await expect(within(getCapabilityDetail()).getByTestId("mcp-config-inspect-result-preview")).toHaveTextContent(
      "text/html;profile=mcp-app",
    );

    await userEvent.click(within(dialog).getByRole("tab", { name: "Prompts(1)" }));
    await userEvent.click(await waitForCapabilityItem("mcp-config-inspect-prompt-card:summarize"));
    await expect(within(getCapabilityDetail()).getByRole("tab", { name: "Get" })).toBeInTheDocument();
    await expect(within(dialog).getByTestId("mcp-config-inspect-prompt-icon:summarize")).toBeInTheDocument();
    await expect(within(getCapabilityDetail()).getByTestId("mcp-config-inspect-arguments")).toHaveValue('{\n  "topic": ""\n}');
    await userEvent.click(within(getCapabilityDetail()).getByRole("button", { name: "Get" }));
    await expect(within(getCapabilityDetail()).getByTestId("mcp-config-inspect-result-preview")).toHaveTextContent("messages");
    await userEvent.click(within(dialog).getByRole("tab", { name: "Tools(2)" }));
    await waitForCapabilityItem("mcp-config-inspect-tool-card:echo");
    await userEvent.click(within(dialog).getByTestId("mcp-config-light-inspect-close"));
    const releaseConfirm = await waitFor(() => body.getByTestId("mcp-config-light-inspect-close-confirm"));
    await userEvent.click(within(releaseConfirm).getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(canvas.getByTestId("mcp-story-event")).toHaveTextContent("probe:close:probe-story-1");
    });
  },
} satisfies Story;

export const HeavyInspectorDialog = {
  name: "Scenario: Given a draft MCP When heavyweight inspector opens Then logs become an iframe and close requires release confirmation",
  args: {
    scenario: "configs-new",
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const bodyElement = canvasElement.ownerDocument.body;
    const body = within(bodyElement);

    await userEvent.click(canvas.getByTestId("mcp-config-inspect-inspector"));
    const dialog = body.getByTestId("mcp-config-heavy-inspector-dialog");
    await expect(within(dialog).getByTestId("mcp-config-heavy-inspector-log")).toHaveTextContent(
      "@modelcontextprotocol/inspector",
    );
    await waitFor(() => {
      expect(within(dialog).getByTestId("mcp-config-heavy-inspector-iframe")).toBeInTheDocument();
    });
    await expect(within(dialog).getByTestId("mcp-config-heavy-inspector-signal")).toHaveAttribute("data-state", "live");
    await expect(dialog).toHaveAttribute("data-fullscreen", "false");
    await userEvent.click(within(dialog).getByTestId("mcp-config-heavy-inspector-fullscreen"));
    await expect(dialog).toHaveAttribute("data-fullscreen", "true");
    await userEvent.click(within(dialog).getByTestId("mcp-config-heavy-inspector-fullscreen"));
    await expect(dialog).toHaveAttribute("data-fullscreen", "false");
    const overlay = bodyElement.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay).not.toBeNull();
    await userEvent.click(overlay as HTMLElement);
    await expect(body.getByTestId("mcp-config-heavy-inspector-dialog")).toBeInTheDocument();
    await expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Close inspector" }));
    await expect(body.getByTestId("mcp-config-heavy-inspector-close-confirm")).toBeInTheDocument();
    await userEvent.click(body.getByTestId("mcp-config-heavy-inspector-release"));
    await waitFor(() => {
      expect(body.queryByTestId("mcp-config-heavy-inspector-dialog")).toBeNull();
    });
    await expect(canvas.getByTestId("mcp-story-event")).toHaveTextContent("inspector-close:inspector-story-1");
  },
} satisfies Story;

export const ConfigsDuplicateConflict = {
  name: "Scenario: Given one owner Avatar already has the same config id When install is submitted Then Studio asks for override or cancel",
  args: {
    scenario: "configs-new",
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    await waitFor(() => {
      expect(document.body.style.pointerEvents).not.toBe("none");
      expect(document.body.querySelector('[data-slot="dialog-overlay"][data-state="open"]')).toBeNull();
    });
    const nameInput = canvas.getByLabelText("Name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "filesystem");
    await expect(canvas.getByTestId("mcp-config-name-conflict")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Install" }));
    await expect(body.getByRole("dialog")).toBeInTheDocument();
    await expect(body.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    await expect(body.getByRole("button", { name: "Override" })).toBeInTheDocument();
  },
} satisfies Story;

export const ConfigDetailEdit = {
  name: "Scenario: Given one config row When it is selected Then edit detail and instance actions stay together",
  args: {
    scenario: "config-detail",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("mcp-config-detail")).toHaveTextContent("Edit config");
    await expect(canvas.getByTestId("mcp-config-detail")).toHaveTextContent("Instances");
    await expect(canvas.getByRole("button", { name: "Add" })).toBeInTheDocument();
    await expect(canvas.getByTestId("mcp-config-owner-readonly")).toHaveTextContent("Default Avatar");
    await expect(canvas.getByTestId("mcp-config-inspect")).toBeInTheDocument();
  },
} satisfies Story;

export const ConfigRunningSummary = {
  name: "Scenario: Given one config has running rows When detail renders Then config and instance summary stay separate",
  args: {
    scenario: "config-running",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("mcp-config-detail")).toHaveTextContent("Instances");
    await expect(canvas.getByTestId("mcp-config-detail")).toHaveTextContent("/repo/app");
    await expect(canvas.getByTestId("mcp-config-detail")).toHaveTextContent("running");
  },
} satisfies Story;

export const EmptyLoadingSkeletons = {
  name: "Scenario: Given MCP has no data yet When projection loads Then list and detail render data-shaped skeletons",
  args: {
    scenario: "loading-empty",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("mcp-config-list-skeleton")).toBeInTheDocument();
    await expect(canvas.getByTestId("mcp-config-detail-skeleton")).toBeInTheDocument();
    await expect(canvas.getByTestId("mcp-server-list-skeleton")).toBeInTheDocument();
    await expect(canvas.getByTestId("mcp-server-detail-skeleton")).toBeInTheDocument();
    await expect(canvas.getByTestId("mcp-config-list")).toHaveTextContent("New config");
  },
} satisfies Story;

export const InspectPendingSkeleton = {
  name: "Scenario: Given lightweight inspect has no snapshot yet When connect is pending Then the dialog body renders a data-shaped skeleton",
  args: {
    scenario: "inspect-pending",
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByTestId("mcp-config-inspect-connect"));
    const dialog = body.getByTestId("mcp-config-light-inspect-dialog");
    await expect(within(dialog).getByTestId("mcp-config-inspect-skeleton")).toBeInTheDocument();
    await expect(within(dialog).queryByTestId("mcp-config-inspect-capabilities-view")).toBeNull();
    await expect(within(dialog).getByTestId("mcp-config-light-inspect-signal")).toHaveAttribute(
      "data-state",
      "connecting",
    );
  },
} satisfies Story;

export const AvatarsOverview = {
  name: "Scenario: Given MCP is Avatar-owned When avatars tab opens Then each Avatar shows configs and project instances",
  args: {
    scenario: "avatars-overview",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("mcp-avatar-overview")).toHaveTextContent("Avatar ownership");
    await expect(canvas.getByTestId("mcp-avatar-detail")).toHaveTextContent("Configs");
    await expect(canvas.getByTestId("mcp-avatar-detail")).toHaveTextContent("Instances");
    await expect(canvas.getByTestId("mcp-avatar-profile-default")).toBeInTheDocument();
  },
} satisfies Story;
