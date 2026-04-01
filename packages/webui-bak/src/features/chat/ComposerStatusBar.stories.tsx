import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";

import { __clearHelpHintPersistenceForTests } from "../../components/ui/help-hint-store";
import { ComposerStatusBar } from "./ComposerStatusBar";

const meta = {
  title: "Features/Chat/ComposerStatusBar",
  component: ComposerStatusBar,
  loaders: [
    async () => {
      await __clearHelpHintPersistenceForTests();
      return {};
    },
  ],
  args: {
    disabled: false,
    submitting: false,
    imageEnabled: true,
    screenshotSupported: true,
  },
} satisfies Meta<typeof ComposerStatusBar>;

export default meta;

type Story = StoryObj<typeof meta>;

const getHelpHintPopup = (titleNode: HTMLElement) => {
  const popup = titleNode.closest("[data-help-hint-presentation]");
  if (!(popup instanceof HTMLElement)) {
    throw new Error("Expected help hint popup container.");
  }
  return popup;
};

const dismissAutoOpenedHelpHint = (popup: HTMLElement) => {
  const rect = popup.getBoundingClientRect();
  fireEvent.pointerDown(document.body, {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  });
};

export const WideStatusBarAutoOpensHelpHint: Story = {
  render: (args) => (
    <div className="w-[720px] bg-white p-6">
      <ComposerStatusBar {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    const statusBar = canvas.getByTestId("composer-status-bar");
    const helpTrigger = canvas.getByRole("button", { name: "Composer help" });

    await expect(canvas.getByTestId("composer-local-status")).toHaveTextContent("Attachments ready");
    await expect(helpTrigger).toHaveTextContent("?");
    await waitFor(async () => {
      await expect(portal.getByText("Composer help")).toBeVisible();
      await expect(portal.getByText("path")).toBeVisible();
      await expect(portal.getByText("newline")).toBeVisible();
    });

    await waitFor(() => {
      const popup = getHelpHintPopup(portal.getByText("Composer help"));
      expect(helpTrigger).toHaveAttribute("data-popup-open");
      expect(popup).toHaveAttribute("data-help-hint-presentation", "passive-auto");
      expect(window.getComputedStyle(popup).animationName).toBe("help-hint-breathe");
    });

    const popup = getHelpHintPopup(portal.getByText("Composer help"));
    await waitFor(() => {
      expect(popup).toHaveAttribute("data-help-hint-presentation", "passive-auto");
    });

    dismissAutoOpenedHelpHint(popup);
    await waitFor(() => {
      expect(helpTrigger).not.toHaveAttribute("data-popup-open");
    });

    await userEvent.click(helpTrigger);
    await waitFor(() => {
      expect(helpTrigger).toHaveAttribute("data-popup-open");
      expect(popup).toHaveAttribute("data-help-hint-presentation", "active-open");
    });

    await userEvent.click(popup);
    await userEvent.hover(helpTrigger);
    await waitFor(() => {
      expect(helpTrigger).toHaveAttribute("data-popup-open");
      expect(popup).toHaveAttribute("data-help-hint-presentation", "active-open");
      expect(window.getComputedStyle(popup).animationName).toBe("none");
    });

    await waitFor(() => {
      expect(statusBar.getBoundingClientRect().height).toBeLessThan(36);
    });
  },
};

export const CompactStatusBarCollapsesHelpIntoMenu: Story = {
  render: (args) => (
    <div className="w-[375px] bg-white p-4">
      <ComposerStatusBar {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    const helpTrigger = canvas.getByRole("button", { name: "Composer help" });

    await waitFor(() => {
      expect(helpTrigger).toHaveTextContent("?");
      expect(helpTrigger.querySelector("svg")).toBeNull();
      expect(canvas.getByTestId("composer-status-bar").getBoundingClientRect().height).toBeLessThan(36);
    });

    await waitFor(() => {
      expect(portal.getByText("Composer help")).toBeInTheDocument();
      expect(portal.getByText("path")).toBeInTheDocument();
      expect(portal.getByText("files")).toBeInTheDocument();
    });

    await waitFor(() => {
      const popup = getHelpHintPopup(portal.getByText("Composer help"));
      expect(helpTrigger).toHaveAttribute("data-popup-open");
      expect(popup).toHaveAttribute("data-help-hint-presentation", "passive-auto");
    });

    const openBackgroundColor = window.getComputedStyle(helpTrigger).backgroundColor;
    await userEvent.click(helpTrigger);
    await waitFor(() => {
      expect(helpTrigger).not.toHaveAttribute("data-popup-open");
    });

    const closedBackgroundColor = window.getComputedStyle(helpTrigger).backgroundColor;
    expect(closedBackgroundColor).not.toBe(openBackgroundColor);

    await userEvent.click(helpTrigger);
    await waitFor(() => {
      const popup = getHelpHintPopup(portal.getByText("Composer help"));
      expect(helpTrigger).toHaveAttribute("data-popup-open");
      expect(popup).toHaveAttribute("data-help-hint-presentation", "active-open");
      expect(portal.getByText("Composer help")).toBeInTheDocument();
    });
  },
};

export const SubmittingStatusBarShowsBusySignal: Story = {
  args: {
    submitting: true,
  },
  render: (args) => (
    <div className="w-[520px] bg-white p-4">
      <ComposerStatusBar {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("composer-local-status")).toHaveTextContent("Sending");
  },
};
