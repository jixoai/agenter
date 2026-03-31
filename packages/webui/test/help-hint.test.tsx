import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { Dialog } from "../src/components/ui/dialog";
import { HelpHint } from "../src/components/ui/help-hint";
import { __resetHelpHintRuntimeForTests } from "../src/components/ui/help-hint-runtime";
import {
  __clearHelpHintPersistenceForTests,
  dismissHelpHint,
  readHelpHintDismissed,
} from "../src/components/ui/help-hint-store";

describe("Feature: native help-hint popover", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    __resetHelpHintRuntimeForTests();
    await __clearHelpHintPersistenceForTests();
  });

  test("Scenario: Given a dialog help hint When it renders Then the help content uses native popover top-layer semantics", async () => {
    render(
      <Dialog
        open
        title="Create room"
        description="Configure room metadata, participants, and optional admin credentials before creation."
        descriptionHelpId="dialog:create-room"
        onClose={() => undefined}
      >
        <div>Body</div>
      </Dialog>,
    );

    const trigger = screen.getByRole("button", { name: "Dialog help" });
    const popup = document.querySelector(".help-hint-popup");
    expect(popup).toBeInstanceOf(HTMLDivElement);

    await waitFor(() => {
      expect(popup).toHaveTextContent("Configure room metadata, participants, and optional admin credentials before creation.");
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
          helpId="dialog:create-room-click"
          textContext="Configure room metadata, participants, and optional admin credentials before creation."
          content="Configure room metadata, participants, and optional admin credentials before creation."
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

  test("Scenario: Given all mounted help hints are closed When ? is pressed Then every help hint opens in passive mode and the same shortcut closes them again", async () => {
    const firstIdentity = {
      helpId: "global:one",
      textContext: "First global hint",
    };
    const secondIdentity = {
      helpId: "global:two",
      textContext: "Second global hint",
    };
    await dismissHelpHint(firstIdentity);
    await dismissHelpHint(secondIdentity);

    render(
      <div>
        <HelpHint {...firstIdentity} content="First global hint" ariaLabel="Global help one" />
        <HelpHint {...secondIdentity} content="Second global hint" ariaLabel="Global help two" />
      </div>,
    );

    const firstTrigger = screen.getByRole("button", { name: "Global help one" });
    const secondTrigger = screen.getByRole("button", { name: "Global help two" });

    await waitFor(() => {
      expect(firstTrigger).not.toHaveAttribute("data-popup-open");
      expect(secondTrigger).not.toHaveAttribute("data-popup-open");
    });

    fireEvent.keyDown(document, { key: "?", shiftKey: true });

    await waitFor(() => {
      expect(firstTrigger).toHaveAttribute("data-popup-open");
      expect(secondTrigger).toHaveAttribute("data-popup-open");
      expect(document.querySelectorAll('[data-help-hint-presentation="passive-auto"]').length).toBeGreaterThanOrEqual(2);
    });

    fireEvent.keyDown(document, { key: "?", shiftKey: true });

    await waitFor(() => {
      expect(firstTrigger).not.toHaveAttribute("data-popup-open");
      expect(secondTrigger).not.toHaveAttribute("data-popup-open");
    });

    await expect(readHelpHintDismissed(firstIdentity)).resolves.toBe(true);
    await expect(readHelpHintDismissed(secondIdentity)).resolves.toBe(true);
  });

  test("Scenario: Given any help hint is already open When ? is pressed Then the shortcut closes every mounted help hint", async () => {
    const identity = {
      helpId: "global:manual-open",
      textContext: "Manual help hint",
    };
    await dismissHelpHint(identity);

    render(<HelpHint {...identity} content="Manual help hint" ariaLabel="Manual help" />);

    const trigger = screen.getByRole("button", { name: "Manual help" });

    await waitFor(() => {
      expect(trigger).not.toHaveAttribute("data-popup-open");
    });

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(trigger).toHaveAttribute("data-popup-open");
      expect(trigger).toHaveAttribute("data-help-hint-presentation", "active-open");
    });

    fireEvent.keyDown(document, { key: "?", shiftKey: true });

    await waitFor(() => {
      expect(trigger).not.toHaveAttribute("data-popup-open");
    });
  });

  test("Scenario: Given focus is inside editable surfaces When ? is pressed Then the global help shortcut is ignored", async () => {
    const identity = {
      helpId: "global:editable-guard",
      textContext: "Editable guard hint",
    };
    await dismissHelpHint(identity);

    render(
      <div>
        <input aria-label="Plain input" />
        <div role="textbox" aria-label="Rich textbox" tabIndex={0} />
        <HelpHint {...identity} content="Editable guard hint" ariaLabel="Editable help" />
      </div>,
    );

    const trigger = screen.getByRole("button", { name: "Editable help" });
    const input = screen.getByRole("textbox", { name: "Plain input" });
    const richTextbox = screen.getByRole("textbox", { name: "Rich textbox" });

    await waitFor(() => {
      expect(trigger).not.toHaveAttribute("data-popup-open");
    });

    input.focus();
    fireEvent.keyDown(document, { key: "?", shiftKey: true });
    await waitFor(() => {
      expect(trigger).not.toHaveAttribute("data-popup-open");
    });

    richTextbox.focus();
    fireEvent.keyDown(document, { key: "?", shiftKey: true });
    await waitFor(() => {
      expect(trigger).not.toHaveAttribute("data-popup-open");
    });
  });
});
