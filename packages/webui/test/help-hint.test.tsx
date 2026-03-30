import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { Dialog } from "../src/components/ui/dialog";
import { HelpHint } from "../src/components/ui/help-hint";
import { __clearHelpHintPersistenceForTests } from "../src/components/ui/help-hint-store";

describe("Feature: native help-hint popover", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    await __clearHelpHintPersistenceForTests();
  });

  test("Scenario: Given a dialog help hint When it renders Then the help content uses native popover top-layer semantics", async () => {
    render(
      <Dialog
        open
        title="Create chat"
        description="Configure metadata, participants, and optional admin credentials before creation."
        descriptionHelpId="dialog:create-chat"
        onClose={() => undefined}
      >
        <div>Body</div>
      </Dialog>,
    );

    const trigger = screen.getByRole("button", { name: "Dialog help" });
    const popup = document.querySelector(".help-hint-popup");
    expect(popup).toBeInstanceOf(HTMLDivElement);

    await waitFor(() => {
      expect(popup).toHaveTextContent("Configure metadata, participants, and optional admin credentials before creation.");
      expect(popup).toBeVisible();
    });

    expect(popup).toHaveAttribute("popover", "manual");
    expect(trigger).toHaveAttribute("data-popup-open");

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(trigger).not.toHaveAttribute("data-popup-open");
    });
  });

  test("Scenario: Given an auto-opened help hint When it is manually reopened Then clicking the popup keeps the manual panel open", async () => {
    render(
      <div>
        <HelpHint
          helpId="dialog:create-chat-click"
          textContext="Configure metadata, participants, and optional admin credentials before creation."
          content="Configure metadata, participants, and optional admin credentials before creation."
          ariaLabel="Dialog help"
        />
      </div>,
    );

    const trigger = screen.getByRole("button", { name: "Dialog help" });
    const popup = document.querySelector(".help-hint-popup");
    expect(popup).toBeInstanceOf(HTMLDivElement);

    await waitFor(() => {
      expect(trigger).toHaveAttribute("data-popup-open");
      expect(popup).toHaveAttribute("data-help-hint-presentation", "passive-auto");
    });

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(trigger).not.toHaveAttribute("data-popup-open");
    });

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(trigger).toHaveAttribute("data-popup-open");
      expect(popup).toHaveAttribute("data-help-hint-presentation", "active-open");
    });

    fireEvent.click(popup!);
    await waitFor(() => {
      expect(trigger).toHaveAttribute("data-popup-open");
      expect(popup).toHaveAttribute("data-help-hint-presentation", "active-open");
    });
  });
});
