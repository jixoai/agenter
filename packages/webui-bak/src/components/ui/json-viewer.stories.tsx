import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";

import {
  DEFAULT_JSON_VIEWER_MODE,
  JSONViewer,
  type JsonViewerMode,
  setGlobalJsonViewerMode,
} from "./json-viewer";

const ResetGlobalMode = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    setGlobalJsonViewerMode(DEFAULT_JSON_VIEWER_MODE);
    return () => {
      setGlobalJsonViewerMode(DEFAULT_JSON_VIEWER_MODE);
    };
  }, []);
  return <>{children}</>;
};

const meta = {
  title: "Components/JSONViewer",
  component: JSONViewer,
  args: {
    value: {
      a1b2c3: 100,
      terminal: {
        id: "iflow",
        status: "IDLE",
      },
    },
  },
} satisfies Meta<typeof JSONViewer>;

export default meta;

type Story = StoryObj<typeof meta>;

const getViewerRoot = (container: HTMLElement): HTMLElement => {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) {
    throw new Error("JSONViewer root element not found");
  }
  return root;
};

const getModeMenuItem = async (
  body: HTMLElement,
  scope: "local" | "global",
  mode: JsonViewerMode,
): Promise<HTMLElement> => {
  let activeItem: HTMLElement | null = null;
  await waitFor(() => {
    const items = Array.from(
      body.querySelectorAll<HTMLElement>(`[data-json-viewer-scope="${scope}"][data-json-viewer-option="${mode}"]`),
    );
    activeItem =
      items.findLast((candidate) => {
        const style = candidate.ownerDocument.defaultView?.getComputedStyle(candidate);
        return style?.pointerEvents !== "none" && style?.display !== "none" && style?.visibility !== "hidden";
      }) ?? null;
    expect(activeItem).not.toBeNull();
  });
  return activeItem!;
};

export const YamlPreviewKeepsQuotedKeys: Story = {
  render: (args) => (
    <ResetGlobalMode>
      <div className="w-[32rem] p-6">
        <div data-testid="json-viewer-single">
          <JSONViewer {...args} menuLabel="Primary viewer options" />
        </div>
      </div>
    </ResetGlobalMode>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewer = canvas.getByTestId("json-viewer-single");
    await expect(canvas.getByText("YAML preview")).toBeInTheDocument();
    await expect(viewer).toHaveTextContent("a1b2c3");
    await expect(viewer).toHaveTextContent("100");
  },
};

export const MenuSwitchesViewerModes: Story = {
  render: () => (
    <ResetGlobalMode>
      <div className="grid gap-4 p-6 md:grid-cols-2">
        <div data-testid="json-viewer-primary">
          <JSONViewer
            value={{
              a1b2c3: 100,
              status: "idle",
            }}
            menuLabel="Primary viewer options"
          />
        </div>
        <div data-testid="json-viewer-secondary">
          <JSONViewer
            value={{
              f0a1b2: 50,
              seq: 7,
            }}
            menuLabel="Secondary viewer options"
          />
        </div>
      </div>
    </ResetGlobalMode>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = canvasElement.ownerDocument.body;

    await userEvent.click(canvas.getByLabelText("Primary viewer options"));
    await userEvent.click(await getModeMenuItem(body, "local", "raw-text-json"));
    await expect(getViewerRoot(canvas.getByTestId("json-viewer-primary"))).toHaveAttribute("data-json-viewer-mode", "raw-text-json");

    await userEvent.click(canvas.getByLabelText("Secondary viewer options"));
    await userEvent.click(await getModeMenuItem(body, "global", "fmt-highlight-json"));
    await expect(getViewerRoot(canvas.getByTestId("json-viewer-primary"))).toHaveAttribute(
      "data-json-viewer-mode",
      "raw-text-json",
    );
    await expect(getViewerRoot(canvas.getByTestId("json-viewer-secondary"))).toHaveAttribute(
      "data-json-viewer-mode",
      "fmt-highlight-json",
    );
  },
};

export const ContextMenuOpensOptions: Story = {
  render: () => (
    <ResetGlobalMode>
      <div className="w-[32rem] p-6">
        <div data-testid="json-viewer-context-menu">
          <JSONViewer
            value={{
              c9d8e7: 100,
              output: { ok: true },
            }}
            menuLabel="Context menu viewer options"
          />
        </div>
      </div>
    </ResetGlobalMode>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = canvasElement.ownerDocument.body;

    fireEvent.contextMenu(canvas.getByLabelText("Context menu viewer options"));
    await expect(await getModeMenuItem(body, "local", "highlight-yaml")).toBeInTheDocument();
  },
};
