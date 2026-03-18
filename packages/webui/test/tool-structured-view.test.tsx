import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { ToolStructuredView } from "../src/features/chat/tool-structured-view";

afterEach(() => {
  cleanup();
});

describe("Feature: structured yaml payload rendering", () => {
  test("Scenario: Given mixed yaml scalars and multiline text When rendering Then values stay compact and multiline content is preserved", () => {
    render(
      <ToolStructuredView
        value={{
          tool: "terminal_read",
          ok: true,
          seq: 30,
          error: null,
          note: ["first line", "second line with spaces"],
          detail: "line 1\nline 2\nline 3",
          tail: "alpha\nbeta\ngamma",
        }}
      />,
    );

    expect(screen.getByText("tool")).toBeInTheDocument();
    expect(screen.getAllByText((_, element) => element?.textContent === '"terminal_read"').length).toBeGreaterThan(0);
    expect(screen.getByText("true")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("null")).toBeInTheDocument();
    expect(screen.getAllByText((_, element) => element?.textContent === '"first line"').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText((_, element) => element?.textContent === '"second line with spaces"').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("[2]")).toBeInTheDocument();
    expect(
      screen.getAllByText((_, element) => element?.textContent === "line 1\nline 2\nline 3").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === "alpha\nbeta\ngamma").length).toBeGreaterThan(
      0,
    );
  });
});
