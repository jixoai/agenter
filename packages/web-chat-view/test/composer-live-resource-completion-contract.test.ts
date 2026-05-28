import { describe, expect, test } from "vitest";

import {
  pendingAssetToResourceReference,
} from "../src/resource-contract";
import {
  resolveComposerCapabilities,
  resolveCompletionProviders,
} from "../src/composer/composer-contract";

describe("Feature: live resource completion law", () => {
  test("Scenario: Given pending resources in the composer When completion providers resolve suggestions Then @ and ^ can complete those pending resource tokens by file name", async () => {
    const pendingImage = pendingAssetToResourceReference(
      {
        id: "pending-image-1",
        kind: "image",
        file: new File(["image"], "src-img.png", { type: "image/png" }),
        previewUrl: "blob:pending-image-1",
      },
      0,
    );

    const capabilities = resolveComposerCapabilities(
      {
        resourceReferences: [pendingImage],
      },
      "Message room...",
    );
    const providers = resolveCompletionProviders(capabilities);
    const mentionProvider = providers.find((provider) => provider.trigger === "@");
    const resourceProvider = providers.find((provider) => provider.trigger === "^");
    if (!mentionProvider || !resourceProvider) {
      throw new Error("completion providers missing");
    }

    const mentionMatches = await mentionProvider.resolveSuggestions?.("src-img", { trigger: "@" });
    const resourceMatches = await resourceProvider.resolveSuggestions?.("src-img", { trigger: "^" });

    expect(mentionMatches?.some((item) => item.insertText === "[^Image 1]")).toBe(true);
    expect(resourceMatches?.some((item) => item.insertText === "[^Image 1]")).toBe(true);
  });
});
