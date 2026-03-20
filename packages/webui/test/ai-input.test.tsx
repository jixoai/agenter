import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AIInput } from "../src/features/chat/AIInput";

const { captureDisplayScreenshotMock } = vi.hoisted(() => ({
  captureDisplayScreenshotMock: vi.fn(async () => new File([new Uint8Array([4, 5, 6])], "screen.png", { type: "image/png" })),
}));

vi.mock("@uiw/react-codemirror", () => {
  return {
    default: ({ value, onChange, onCreateEditor, onKeyDown, placeholder, readOnly }: Record<string, unknown>) => {
      const handleCreateEditor =
        typeof onCreateEditor === "function"
          ? (onCreateEditor as (view: {
              dispatch: () => void;
              focus: () => void;
              state: { doc: { length: number } };
            }) => void)
          : null;
      const handleChange =
        typeof onChange === "function"
          ? (onChange as (
              value: string,
              viewUpdate: { state: { selection: { main: { head: number } } } },
            ) => void)
          : null;

      React.useEffect(() => {
        handleCreateEditor?.({
          dispatch: () => {},
          focus: () => {},
          state: {
            doc: { length: 4096 },
          },
        });
      }, [handleCreateEditor]);

      return (
        <textarea
          data-testid="ai-input-editor"
          value={String(value ?? "")}
          placeholder={typeof placeholder === "string" ? placeholder : undefined}
          readOnly={Boolean(readOnly)}
          onChange={(event) =>
            handleChange?.(event.target.value, {
              state: {
                selection: {
                  main: {
                    head: event.target.selectionStart ?? event.target.value.length,
                  },
                },
              },
            })
          }
          onKeyDown={onKeyDown as React.KeyboardEventHandler<HTMLTextAreaElement> | undefined}
        />
      );
    },
  };
});

vi.mock("../src/features/chat/capture-display-screenshot", () => ({
  canCaptureDisplayScreenshot: () => true,
  captureDisplayScreenshot: captureDisplayScreenshotMock,
}));

const createObjectUrlMock = vi.fn(() => "blob:mock-image");
const revokeObjectUrlMock = vi.fn();

beforeEach(() => {
  captureDisplayScreenshotMock.mockClear();
  createObjectUrlMock.mockClear();
  revokeObjectUrlMock.mockClear();
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: createObjectUrlMock,
      revokeObjectURL: revokeObjectUrlMock,
    }),
  );
});

afterEach(() => {
  cleanup();
});

describe("Feature: AI input interactions", () => {
  test("Scenario: Given a draft When pressing Enter or Shift+Enter Then Enter submits while Shift+Enter keeps the draft", async () => {
    const onSubmit = vi.fn(async () => {});

    render(<AIInput workspacePath="/repo/demo" onSubmit={onSubmit} onSearchPaths={async () => []} />);

    const editor = screen.getByTestId("ai-input-editor");
    fireEvent.change(editor, { target: { value: "Ship it", selectionStart: 7 } });
    fireEvent.keyDown(editor, { key: "Enter" });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ text: "Ship it", assets: [] });
    });
    await waitFor(() => {
      expect(screen.getByTestId("ai-input-editor")).toHaveValue("");
    });
    await waitFor(() => {
      expect(screen.getByTestId("ai-input-editor")).not.toHaveAttribute("readonly");
    });

    const refreshedEditor = screen.getByTestId("ai-input-editor");
    fireEvent.change(refreshedEditor, { target: { value: "Keep drafting", selectionStart: 13 } });
    fireEvent.keyDown(refreshedEditor, { key: "Enter", shiftKey: true });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("ai-input-editor")).toHaveValue("Keep drafting");
  });

  test("Scenario: Given a pending image When previewing it Then the preview dialog opens", async () => {
    const image = new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" });

    const { container } = render(
      <AIInput workspacePath="/repo/demo" imageEnabled onSubmit={async () => {}} onSearchPaths={async () => []} />,
    );

    const fileInput = container.querySelector('input[type="file"]');
    if (!fileInput) {
      throw new Error("file input not found");
    }
    fireEvent.change(fileInput, { target: { files: [image] } });

    fireEvent.click(await screen.findByAltText("photo.png"));

    expect(screen.getByRole("dialog", { name: "photo.png" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  });

  test("Scenario: Given a pending image and failed send When retrying Then the draft and pending image are restored", async () => {
    const image = new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" });
    const onSubmit = vi.fn(async () => {
      throw new Error("network");
    });

    const { container } = render(
      <AIInput workspacePath="/repo/demo" imageEnabled onSubmit={onSubmit} onSearchPaths={async () => []} />,
    );

    const fileInput = container.querySelector('input[type="file"]');
    if (!fileInput) {
      throw new Error("file input not found");
    }
    fireEvent.change(fileInput, { target: { files: [image] } });
    fireEvent.change(screen.getByTestId("ai-input-editor"), { target: { value: "Review this", selectionStart: 11 } });

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ text: "Review this", assets: [image] });
    });
    await waitFor(() => {
      expect(screen.getByTestId("ai-input-editor")).toHaveValue("Review this");
    });
    expect(screen.getByAltText("photo.png")).toBeInTheDocument();
  });

  test("Scenario: Given a slash command draft When pressing Enter Then the command callback runs without sending a chat payload", async () => {
    const onSubmit = vi.fn(async () => {});
    const onCommand = vi.fn(async () => {});

    render(<AIInput workspacePath="/repo/demo" onSubmit={onSubmit} onCommand={onCommand} onSearchPaths={async () => []} />);

    const editor = screen.getByTestId("ai-input-editor");
    fireEvent.change(editor, { target: { value: "/start", selectionStart: 6 } });
    fireEvent.keyDown(editor, { key: "Enter" });

    await waitFor(() => {
      expect(onCommand).toHaveBeenCalledWith("/start");
    });
    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId("ai-input-editor")).toHaveValue("");
    });
  });

  test("Scenario: Given screenshot capture is supported When using /screenshot Then a pending image attachment is added without sending chat", async () => {
    const onSubmit = vi.fn(async () => {});

    render(<AIInput workspacePath="/repo/demo" imageEnabled onSubmit={onSubmit} onSearchPaths={async () => []} />);

    const editor = screen.getByTestId("ai-input-editor");
    fireEvent.change(editor, { target: { value: "/screenshot", selectionStart: 11 } });
    fireEvent.keyDown(editor, { key: "Enter" });

    await waitFor(() => {
      expect(captureDisplayScreenshotMock).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId("ai-input-editor")).toHaveValue("");
    });
    expect(await screen.findByAltText("screen.png")).toBeInTheDocument();
  });
});
