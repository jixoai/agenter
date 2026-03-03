import { expect, test } from "bun:test";

import { createWebUiHtml } from "../src/index";

test("createWebUiHtml contains ws endpoint and mobile viewport", () => {
  const html = createWebUiHtml({ title: "x" });
  expect(html).toContain("<meta name=\"viewport\"");
  expect(html).toContain("/ws");
  expect(html).toContain("instance.list");
});
