import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { MarkdownDocument } from "../src/components/markdown/MarkdownDocument";

const flushMicrotasks = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("Feature: markdown document preview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("Scenario: Given a heading preview When the document becomes empty Then CodeMirror preview decorations stay in bounds", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<MarkdownDocument value="# Heading" mode="preview" usage="chat" />);

    await flushMicrotasks();

    rerender(<MarkdownDocument value="" mode="preview" usage="chat" />);

    await flushMicrotasks();

    const hasPluginCrash = errorSpy.mock.calls.some((call) =>
      call.some((value) => String(value).includes("CodeMirror plugin crashed")),
    );

    expect(hasPluginCrash).toBe(false);
  });
});
