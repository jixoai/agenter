import { describe, expect, test } from "vitest";

import { deriveMcpConfigIdentityFromArgs, parseMcpDraftJson } from "./mcp-draft-codec";

describe("Feature: MCP draft codec", () => {
  test("Scenario: Given stdio args When deriving config identity Then package noise is stripped into name and title", () => {
    expect(deriveMcpConfigIdentityFromArgs("@playwright/mcp@latest")).toEqual({
      name: "playwright",
      title: "Playwright",
    });
    expect(deriveMcpConfigIdentityFromArgs("-y @upstash/context7-mcp@latest")).toEqual({
      name: "context7",
      title: "Context7",
    });
    expect(deriveMcpConfigIdentityFromArgs("bunx @upstash/context7-mcp@latest")).toEqual({
      name: "context7",
      title: "Context7",
    });
    expect(deriveMcpConfigIdentityFromArgs("bunx @modelcontextprotocol/server-filesystem .")).toEqual({
      name: "filesystem",
      title: "Filesystem",
    });
    expect(deriveMcpConfigIdentityFromArgs("--flag-only --another-flag")).toBeNull();
  });

  test("Scenario: Given an editable blank draft When parsing JSON Then code mode keeps the empty form state", () => {
    expect(
      parseMcpDraftJson(
        JSON.stringify(
          {
            avatarNickname: "default",
            name: "",
            description: "",
            transport: {
              kind: "stdio",
              command: "bunx",
              args: [],
            },
          },
          null,
          2,
        ),
        { defaultAvatarNickname: "default" },
      ),
    ).toEqual({
      avatarNickname: "default",
      name: "",
      title: undefined,
      description: undefined,
      transport: {
        kind: "stdio",
        command: "bunx",
        args: [],
        env: undefined,
      },
      env: undefined,
    });
  });
});
