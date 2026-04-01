import { beforeEach, describe, expect, test } from "vitest";

import {
  __clearHelpHintPersistenceForTests,
  dismissHelpHint,
  readHelpHintDismissed,
  resolveHelpHintDismissedKey,
} from "../src/components/ui/help-hint-store";

describe("Feature: persistent help-hint dismissal", () => {
  beforeEach(async () => {
    await __clearHelpHintPersistenceForTests();
  });

  test("Scenario: Given equivalent text context with formatting differences When generating storage keys Then the key remains stable", async () => {
    const firstKey = await resolveHelpHintDismissedKey({
      textContext: "Cycles are attention reduction passes.",
      helpId: "cycle-help",
    });
    const secondKey = await resolveHelpHintDismissedKey({
      textContext: "  Cycles are    attention reduction passes.  ",
      helpId: "cycle-help",
    });

    expect(firstKey).toMatch(/^agenter:webui:help:dismissed:v1:/);
    expect(secondKey).toBe(firstKey);
  });

  test("Scenario: Given a dismissed hint When reading it again Then the dismissed state persists through IndexedDB storage", async () => {
    const identity = {
      helpId: "composer-help",
      textContext: "Composer shortcuts",
    };

    expect(await readHelpHintDismissed(identity)).toBe(false);

    await dismissHelpHint(identity);
    expect(await readHelpHintDismissed(identity)).toBe(true);
  });
});
