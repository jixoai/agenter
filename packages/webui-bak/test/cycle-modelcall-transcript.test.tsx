import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { CycleModelCallTranscript } from "../src/features/process/CycleModelCallTranscript";
import type { CycleModelCallTranscriptRow } from "../src/features/process/cycle-modelcall-workbench";

afterEach(() => {
  cleanup();
});

const rows: CycleModelCallTranscriptRow[] = Array.from({ length: 40 }, (_, index) => ({
  key: `message:${index}`,
  index,
  type: "message" as const,
  lane: index % 2 === 0 ? ("input" as const) : ("output" as const),
  role: index % 2 === 0 ? "user" : "assistant",
  label: `message #${index + 1}`,
  content: `Transcript row ${index + 1}`,
  presentation: index % 2 === 0 ? ("input" as const) : ("assistant" as const),
  timestamp: 1000 + index,
}));

describe("Feature: cycle detail transcript viewport", () => {
  test("Scenario: Given a long transcript When the viewport renders Then one scroll owner virtualizes the visible rows", async () => {
    const { container } = render(
      <div className="h-[420px]">
        <CycleModelCallTranscript rows={rows} emptyMessage="No model-call messages captured for this cycle." />
      </div>,
    );

    expect(screen.getByRole("log", { name: "Model conversation transcript" })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-overflow-role='scroll-viewport']")).toHaveLength(1);

    await waitFor(() => {
      expect(screen.getByTestId("cycle-modelcall-transcript")).toHaveAttribute(
        "data-cycle-transcript-virtualized",
        "true",
      );
    });
  });
});
