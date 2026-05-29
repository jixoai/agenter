import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const chatAvatarSource = readFileSync(resolve(import.meta.dirname, "../src/chat-avatar.svelte"), "utf8");

describe("Feature: embedded web chat avatar style ownership", () => {
  test("Scenario: Given Studio embeds the shared chat view When avatar images render Then the package owns avatar geometry without host Tailwind utilities", () => {
    expect(chatAvatarSource).toContain('class={cn("chat-avatar", className)}');
    expect(chatAvatarSource).toContain(".chat-avatar {");
    expect(chatAvatarSource).toContain("inline-size: var(--web-chat-avatar-size, 1.625rem);");
    expect(chatAvatarSource).toContain("block-size: var(--web-chat-avatar-size, 1.625rem);");
    expect(chatAvatarSource).toContain(".chat-avatar-image {");
    expect(chatAvatarSource).toContain("object-fit: cover;");
    expect(chatAvatarSource).not.toContain("size-[1.625rem]");
    expect(chatAvatarSource).not.toContain("h-full w-full object-cover");
  });
});
