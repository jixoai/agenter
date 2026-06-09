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
    await expect(canvas.getByTestId("mcp-new-global-form")).toHaveTextContent("New config");
    await expect(within(canvas.getByTestId("mcp-config-owner")).getByLabelText("Owner Avatar")).toBeInTheDocument();
    await expect(canvas.getByTestId("mcp-config-inspect")).toBeInTheDocument();
    await expect(canvas.getByTestId("mcp-config-inspect-connect")).toHaveTextContent("Connect");
    await userEvent.click(canvas.getByRole("button", { name: "Code" }));
    await expect(canvas.getByTestId("mcp-config-code-textarea")).toBeInTheDocument();
  },
} satisfies Story;

export const InspectVisualAndRaw = {
  name: "Scenario: Given inspect connects When capability cards are opened Then dialog keeps long interaction surfaces contained",
  args: {
    scenario: "configs-new",
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    const waitForCapabilityCard = async (testId: string): Promise<HTMLElement> =>
      waitFor(() => {
        expect(body.queryByTestId("mcp-config-inspect-capability-dialog")).toBeNull();
        expect(document.body.style.pointerEvents).not.toBe("none");
        expect(document.body.querySelector('[data-slot="dialog-overlay"][data-state="open"]')).toBeNull();
        const card = canvas.getByTestId(testId) as HTMLElement;
        const styles = getComputedStyle(card);
        expect(styles.pointerEvents).not.toBe("none");
        expect(styles.visibility).not.toBe("hidden");
        expect(styles.display).not.toBe("none");
        return card;
      });

    await userEvent.click(canvas.getByTestId("mcp-config-inspect-connect"));
    await expect(canvas.getByTestId("mcp-config-inspect-snapshot-visual")).toHaveTextContent("fixture-browser-tools");
    await expect(canvas.getByTestId("mcp-config-inspect-snapshot-visual")).toHaveTextContent("Workspace Memory");
    await userEvent.click(canvas.getByTestId("mcp-config-inspect-ping"));
    await expect(canvas.getByTestId("mcp-story-event")).toHaveTextContent("probe:ping:probe-story-1");
    await expect(canvas.getByTestId("mcp-config-inspect-capability-grid")).toBeInTheDocument();
    await expect(canvas.getByTestId("mcp-config-inspect-tool-card:echo")).toBeInTheDocument();
    await expect(canvas.getByTestId("mcp-config-inspect-tool-icon:echo")).toBeInTheDocument();
    await expect(canvas.getByTestId("mcp-config-inspect-resource-card:Workspace Memory")).toBeInTheDocument();
    await expect(canvas.getByTestId("mcp-config-inspect-template-card:Workspace Memory Template")).toBeInTheDocument();
    await expect(canvas.getByTestId("mcp-config-inspect-app-card:playground-link")).toBeInTheDocument();
    await expect(canvas.getByTestId("mcp-config-inspect-prompt-card:summarize")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("tab", { name: "Raw" }));
    await expect(canvas.getByText(/serverName/u)).toBeInTheDocument();
    await expect(canvas.getByTestId("mcp-config-inspect-cli-envelope")).toHaveTextContent("mcp probe");
    await userEvent.click(canvas.getByRole("tab", { name: "Visual" }));
    await userEvent.click(canvas.getByTestId("mcp-config-inspect-tool-card:echo"));
    const dialog = body.getByTestId("mcp-config-inspect-capability-dialog");
    await expect(dialog).toHaveTextContent("Echo one message back through the fixture transport.");
    await expect(within(dialog).getByTestId("mcp-config-inspect-capability-dialog-icon")).toBeInTheDocument();
    await expect(within(dialog).queryByLabelText("Tool")).toBeNull();
    await expect(within(dialog).getByRole("tab", { name: "Call" })).toBeInTheDocument();
    await expect(within(dialog).getByRole("tab", { name: "Raw" })).toBeInTheDocument();
    await expect(within(dialog).getByTestId("mcp-config-inspect-arguments")).toHaveValue(
      '{\n  "message": "hello",\n  "trace": false\n}',
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Call" }));
    await expect(within(dialog).getByTestId("mcp-config-inspect-result-preview")).toHaveTextContent("structuredContent");
    await expect(within(dialog).getByTestId("mcp-config-inspect-cli-result")).toHaveTextContent("mcp probe");
    await expect(within(dialog).getByText(/received/u)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("tab", { name: "Raw" }));
    await expect(within(dialog).getByText(/inputSchema/u)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByTestId("mcp-config-inspect-capability-dialog-close"));
    await userEvent.click(await waitForCapabilityCard("mcp-config-inspect-resource-card:Workspace Memory"));
    const resourceDialog = body.getByTestId("mcp-config-inspect-capability-dialog");
    await expect(within(resourceDialog).getByRole("tab", { name: "Read" })).toBeInTheDocument();
    await userEvent.click(within(resourceDialog).getByRole("button", { name: "Read" }));
    await expect(within(resourceDialog).getByTestId("mcp-config-inspect-result-preview")).toHaveTextContent("Workspace Memory");
    await expect(canvas.getByTestId("mcp-story-event")).toHaveTextContent("probe:read-resource:probe-story-1");
    await expect(within(resourceDialog).getByTestId("mcp-config-inspect-result-preview")).toHaveTextContent('"workspace": "fixture"');

    await userEvent.click(within(resourceDialog).getByTestId("mcp-config-inspect-capability-dialog-close"));
    await userEvent.click(await waitForCapabilityCard("mcp-config-inspect-prompt-card:summarize"));
    const promptDialog = body.getByTestId("mcp-config-inspect-capability-dialog");
    await expect(within(promptDialog).getByRole("tab", { name: "Get" })).toBeInTheDocument();
    await expect(within(promptDialog).getByTestId("mcp-config-inspect-arguments")).toHaveValue('{\n  "topic": ""\n}');
    await userEvent.click(within(promptDialog).getByRole("button", { name: "Get" }));
    await expect(within(promptDialog).getByTestId("mcp-config-inspect-result-preview")).toHaveTextContent("messages");
    await userEvent.click(within(promptDialog).getByTestId("mcp-config-inspect-capability-dialog-close"));
    await waitForCapabilityCard("mcp-config-inspect-tool-card:echo");
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
