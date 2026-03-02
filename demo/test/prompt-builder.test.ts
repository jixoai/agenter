import { expect, test } from "bun:test";

import { PromptBuilder, mdx } from "@agenter/app-server";

test("prompt builder resolves Slot with compact builtin transforms", async () => {
  const builder = new PromptBuilder();
  const template = mdx`
line-1
<Slot name="HELLO" />
`.content;

  const markdown = await builder.buildMd(
    {
      syntax: "mdx",
      content: template,
    },
    {
      slots: { HELLO: "world" },
    },
  );

  expect(markdown).toContain("line-1");
  expect(markdown).toContain("world");
});
