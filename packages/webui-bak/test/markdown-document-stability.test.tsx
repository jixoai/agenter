import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";

const codeMirrorRenderSpy = vi.fn(({ value }: { value: string }) => (
  <div data-testid="codemirror-surface">{value}</div>
));

vi.mock("@uiw/react-codemirror", () => ({
  default: (props: { value: string }) => codeMirrorRenderSpy(props),
}));

import { MarkdownDocument } from "../src/components/markdown/MarkdownDocument";

const Host = () => {
  const [tick, setTick] = useState(0);

  return (
    <div>
      <button type="button" onClick={() => setTick((current) => current + 1)}>
        rerender
      </button>
      <span>{tick}</span>
      <MarkdownDocument value="## Stable" mode="preview" usage="chat" />
    </div>
  );
};

describe("Feature: markdown document stability", () => {
  test("Scenario: Given unchanged markdown props When the parent rerenders Then the CodeMirror surface is not recreated", () => {
    render(<Host />);

    expect(codeMirrorRenderSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "rerender" }));

    expect(codeMirrorRenderSpy).toHaveBeenCalledTimes(1);
  });
});
