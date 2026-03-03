import { describe, expect, test } from "bun:test";

import { createWebUiHtml } from "../src/index";

describe("Feature: web ui html shell", () => {
  test("Scenario: Given generated html When bootstrapping client Then include viewport and websocket workflow markers", () => {
    const html = createWebUiHtml({ title: "x" });
    expect(html).toContain("<meta name=\"viewport\"");
    expect(html).toContain("/ws");
    expect(html).toContain("instance.list");
  });
});
