import { describe, expect, test } from "vitest";

import {
  findCompletionToken,
  padInsertedCompletion,
  resolveComposerCapabilities,
  resolveCompletionProviders,
} from "../src/composer/composer-contract";

describe("Feature: trigger-provider composer completion", () => {
  test("Scenario: Given prose without a manual leading space When @ or ^ appears inside the current token Then embedded providers still resolve the active token", () => {
    const capabilities = resolveComposerCapabilities(
      {
        resourceReferences: [
          {
            id: "img-1",
            label: "Image 1",
            tokenText: "[^Image 1]",
            kind: "image",
            fileName: "src-img.png",
            aliases: ["src-img"],
          },
        ],
      },
      "Message room...",
    );
    const providers = resolveCompletionProviders(capabilities);
    const mentionProvider = providers.find((provider) => provider.trigger === "@");
    const resourceProvider = providers.find((provider) => provider.trigger === "^");
    if (!mentionProvider || !resourceProvider) {
      throw new Error("completion providers missing");
    }

    const mentionValue = "hello@Iri";
    const mentionToken = findCompletionToken(mentionValue, mentionValue.length, mentionProvider);
    expect(mentionToken?.raw).toBe("@Iri");
    expect(mentionToken?.from).toBe(5);

    const resourceValue = "token^src-img";
    const resourceToken = findCompletionToken(resourceValue, resourceValue.length, resourceProvider);
    expect(resourceToken?.raw).toBe("^src-img");
    expect(resourceToken?.query).toBe("src-img");
  });

  test("Scenario: Given slash commands When the trigger is not at a token boundary Then boundary providers stay inactive", () => {
    const capabilities = resolveComposerCapabilities({}, "Message room...");
    const providers = resolveCompletionProviders(capabilities);
    const commandProvider = providers.find((provider) => provider.trigger === "/");
    if (!commandProvider) {
      throw new Error("command provider missing");
    }

    const embedded = "notes/scre";
    expect(findCompletionToken(embedded, embedded.length, commandProvider)).toBeNull();

    const boundary = "/scre";
    expect(findCompletionToken(boundary, boundary.length, commandProvider)?.raw).toBe("/scre");
  });

  test("Scenario: Given help triggers When ASCII or fullwidth question marks start a token Then the help provider resolves shortcut guidance for both forms", async () => {
    const capabilities = resolveComposerCapabilities({}, "Message room...");
    const providers = resolveCompletionProviders(capabilities);
    const asciiHelpProvider = providers.find((provider) => provider.trigger === "?");
    const fullwidthHelpProvider = providers.find((provider) => provider.trigger === "？");
    if (!asciiHelpProvider || !fullwidthHelpProvider) {
      throw new Error("help providers missing");
    }

    const asciiValue = "?scr";
    expect(findCompletionToken(asciiValue, asciiValue.length, asciiHelpProvider)?.raw).toBe("?scr");

    const fullwidthValue = "？cap";
    expect(findCompletionToken(fullwidthValue, fullwidthValue.length, fullwidthHelpProvider)?.raw).toBe("？cap");

    const suggestions = await asciiHelpProvider.resolveSuggestions?.("scr", { trigger: "?" });
    expect(suggestions?.some((item) => item.label === "/screenshot")).toBe(true);
  });

  test("Scenario: Given a completion confirmation When adjacent text would collapse Then inserted completion pads surrounding whitespace", () => {
    const value = "prefix@resSuffix";
    const token = {
      from: 6,
      to: 10,
      query: "res",
      raw: "@res",
      trigger: "@" as const,
    };

    expect(padInsertedCompletion(value, token, "[^Image 1]")).toBe(" [^Image 1] ");
  });
});
