import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { dispatchClipboardImage, dispatchDropImage, focusEditorSurface } from "./ai-input-story-utils";
import { AIInput, type AIInputProps } from "./AIInput";

const searchPaths = fn(async ({ query }: { cwd: string; query: string; limit?: number }) => {
  if (query === "@") {
    return [
      {
        label: "src/",
        path: "src/",
        isDirectory: true,
      },
      {
        label: "README.md",
        path: "README.md",
        isDirectory: false,
      },
    ];
  }
  if (query === "@src/") {
    return [
      {
        label: "src/index.ts",
        path: "src/index.ts",
        isDirectory: false,
      },
    ];
  }
  return [];
});

const refinedSearchPaths = fn(async ({ query }: { cwd: string; query: string; limit?: number }) => {
  if (query === "@") {
    return [
      {
        label: "src/",
        path: "src/",
        isDirectory: true,
      },
      {
        label: "docs/",
        path: "docs/",
        isDirectory: true,
      },
    ];
  }
  if (query === "@r" || query === "@re" || query === "@rea") {
    return [
      {
        label: "README.md",
        path: "README.md",
        isDirectory: false,
      },
    ];
  }
  return [];
});

const ignoredSearchPaths = fn(async ({ query }: { cwd: string; query: string; limit?: number }) => {
  if (query === "@node_") {
    return [
      {
        label: "node_modules/",
        path: "node_modules/",
        isDirectory: true,
        ignored: true,
      },
      {
        label: "node_tools.md",
        path: "node_tools.md",
        isDirectory: false,
      },
    ];
  }
  return [];
});

const meta = {
  title: "Features/Chat/AIInput",
  component: AIInput,
  args: {
    workspacePath: "/repo/demo",
    imageEnabled: false,
    onSubmit: fn(async () => undefined),
    onSearchPaths: searchPaths,
  },
  render: (args) => (
    <div className="mx-auto w-[min(720px,100vw)] p-6">
      <AIInput {...args} />
    </div>
  ),
} satisfies Meta<typeof AIInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SubmitDraft: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await focusEditorSurface(canvasElement, async (target) => {
      await userEvent.click(target);
    });

    await userEvent.keyboard("Ship it");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(args.onSubmit).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(canvas.getByRole("button", { name: "Send" })).toBeDisabled();
    });
  },
};

export const SubmitRapidDraftsSeparately: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const sendButton = canvas.getByRole("button", { name: "Send" });

    await focusEditorSurface(canvasElement, async (target) => {
      await userEvent.click(target);
    });
    await userEvent.keyboard("first rapid draft");
    await userEvent.click(sendButton);

    await waitFor(() => {
      expect(args.onSubmit).toHaveBeenNthCalledWith(1, { text: "first rapid draft", assets: [] });
    });

    await focusEditorSurface(canvasElement, async (target) => {
      await userEvent.click(target);
    });
    await userEvent.keyboard("second rapid draft");
    await userEvent.click(sendButton);

    await waitFor(() => {
      expect(args.onSubmit).toHaveBeenNthCalledWith(2, { text: "second rapid draft", assets: [] });
    });
    const currentEditor = within(canvasElement).getByRole("textbox");
    await waitFor(() => {
      expect((currentEditor.textContent ?? "").replace("Message Agenter...", "").trim()).toBe("");
    });
  },
};

export const CompleteWorkspacePath: Story = {
  args: {
    onSearchPaths: searchPaths,
  } satisfies Partial<AIInputProps>,
  play: async ({ args, canvasElement }) => {
    const portal = within(canvasElement.ownerDocument.body);
    const editor = await focusEditorSurface(canvasElement, async (target) => {
      await userEvent.click(target);
    });

    await userEvent.keyboard("Open @");

    await waitFor(() => {
      expect(args.onSearchPaths).toHaveBeenCalledWith({ cwd: "/repo/demo", query: "@", limit: 8 });
    });

    await userEvent.click(await portal.findByText("src/"));

    await waitFor(() => {
      expect(editor.textContent ?? "").toContain("Open @src/");
    });
    await waitFor(() => {
      expect(args.onSearchPaths).toHaveBeenCalledWith({ cwd: "/repo/demo", query: "@src/", limit: 8 });
    });

    await userEvent.click(await portal.findByText("src/index.ts"));

    await waitFor(() => {
      expect(editor.textContent ?? "").toContain("Open @src/index.ts");
    });
  },
};

export const RefreshWorkspacePathResults: Story = {
  args: {
    onSearchPaths: refinedSearchPaths,
  } satisfies Partial<AIInputProps>,
  play: async ({ args, canvasElement }) => {
    const portal = within(canvasElement.ownerDocument.body);
    await focusEditorSurface(canvasElement, async (target) => {
      await userEvent.click(target);
    });

    await userEvent.keyboard("Open @");

    await waitFor(() => {
      expect(args.onSearchPaths).toHaveBeenCalledWith({ cwd: "/repo/demo", query: "@", limit: 8 });
    });
    await expect(portal.getByText("src/")).toBeInTheDocument();
    await expect(portal.getByText("docs/")).toBeInTheDocument();

    await userEvent.keyboard("rea");

    await waitFor(() => {
      expect(args.onSearchPaths).toHaveBeenCalledWith({ cwd: "/repo/demo", query: "@rea", limit: 8 });
    });
    await expect(await portal.findByText("README.md")).toBeInTheDocument();
    await waitFor(() => {
      expect(portal.queryByText("src/")).not.toBeInTheDocument();
      expect(portal.queryByText("docs/")).not.toBeInTheDocument();
    });
  },
};

export const ShowIgnoredWorkspacePath: Story = {
  args: {
    onSearchPaths: ignoredSearchPaths,
  } satisfies Partial<AIInputProps>,
  play: async ({ args, canvasElement }) => {
    const portal = within(canvasElement.ownerDocument.body);
    await focusEditorSurface(canvasElement, async (target) => {
      await userEvent.click(target);
    });

    await userEvent.keyboard("Install @node_");

    await waitFor(() => {
      expect(args.onSearchPaths).toHaveBeenCalledWith({ cwd: "/repo/demo", query: "@node_", limit: 8 });
    });
    await expect(await portal.findByText("node_modules/")).toBeInTheDocument();
    await expect(await portal.findByText("ignored")).toBeInTheDocument();
    await expect(await portal.findByText("node_tools.md")).toBeInTheDocument();
  },
};

export const PastePendingImage: Story = {
  args: {
    imageEnabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await focusEditorSurface(canvasElement, async (target) => {
      await userEvent.click(target);
    });
    const image = new File([new Uint8Array([1, 2, 3, 4])], "pasted-diagram.png", { type: "image/png" });

    dispatchClipboardImage(editor, image);

    const thumbnail = await canvas.findByAltText("pasted-diagram.png");
    await userEvent.click(thumbnail);

    await expect(
      within(canvasElement.ownerDocument.body).getByRole("dialog", { name: "pasted-diagram.png" }),
    ).toBeInTheDocument();
  },
};

export const DropPendingImage: Story = {
  args: {
    imageEnabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const surface = canvasElement.querySelector("section");
    if (!(surface instanceof HTMLElement)) {
      throw new Error("AIInput surface not found");
    }
    const image = new File([new Uint8Array([5, 6, 7, 8])], "dropped-reference.png", { type: "image/png" });

    dispatchDropImage(surface, image);

    await expect(await canvas.findByAltText("dropped-reference.png")).toBeInTheDocument();
  },
};
