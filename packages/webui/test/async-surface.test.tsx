import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { AsyncSurface } from "../src/components/ui/async-surface";

afterEach(() => {
  cleanup();
});

describe("Feature: async surface loading contracts", () => {
  test("Scenario: Given an empty loading state When rendering Then the surface shows the loading label instead of empty copy", () => {
    render(
      <AsyncSurface state="empty-loading" empty={<div>Empty state</div>} emptyLoadingLabel="Loading timeline..." />,
    );

    expect(screen.getByText("Loading timeline...")).toBeInTheDocument();
    expect(screen.queryByText("Empty state")).not.toBeInTheDocument();
  });

  test("Scenario: Given an empty idle state When rendering Then the surface shows the empty copy without a loading overlay", () => {
    render(<AsyncSurface state="empty-idle" empty={<div>Nothing loaded yet</div>} />);

    expect(screen.getByText("Nothing loaded yet")).toBeInTheDocument();
    expect(screen.queryByText("Refreshing timeline...")).not.toBeInTheDocument();
  });

  test("Scenario: Given ready data while loading When rendering Then the surface keeps data visible and adds a restrained loading overlay", () => {
    render(
      <AsyncSurface
        state="ready-loading"
        empty={<div>Nothing loaded yet</div>}
        loadingOverlayLabel="Refreshing timeline..."
      >
        <div>Timeline content</div>
      </AsyncSurface>,
    );

    expect(screen.getByText("Timeline content")).toBeInTheDocument();
    expect(screen.getByText("Refreshing timeline...")).toBeInTheDocument();
  });

  test("Scenario: Given ready data without loading When rendering Then the surface shows content without loading chrome", () => {
    render(
      <AsyncSurface state="ready-idle" empty={<div>Nothing loaded yet</div>}>
        <div>Timeline content</div>
      </AsyncSurface>,
    );

    expect(screen.getByText("Timeline content")).toBeInTheDocument();
    expect(screen.queryByText("Refreshing…")).not.toBeInTheDocument();
  });
});
