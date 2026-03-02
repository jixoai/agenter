import { expect, test } from "bun:test";

import { mdxToMd } from "../src";

test("keeps plain markdown unchanged", async () => {
  const input = "# Title\n\n- a\n- b";
  const result = await mdxToMd(input);
  expect(result.markdown).toContain("# Title");
  expect(result.markdown).toContain("a");
  expect(result.markdown).toContain("b");
});

test("supports remove/text/allow policies", async () => {
  const input = `
<RemoveMe secret="1">abc</RemoveMe>

<TextMe enabled>xyz</TextMe>

<AllowMe>
**ok**
</AllowMe>
`.trim();

  const result = await mdxToMd(input, {
    defaultTagPolicy: "remove",
    tagPolicies: {
      TextMe: "text",
      AllowMe: "allow",
    },
  });

  expect(result.markdown).not.toContain("RemoveMe");
  expect(result.markdown).toContain("TextMe enabled");
  expect(result.markdown).toContain("xyz");
  expect(result.markdown).toContain("**ok**");
});

test("converts mdx expression to text when enabled", async () => {
  const input = "x {1 + 2} y";
  const removed = await mdxToMd(input, { expressionPolicy: "remove" });
  const kept = await mdxToMd(input, { expressionPolicy: "text" });

  expect(removed.markdown).toContain("x  y");
  expect(kept.markdown).toContain("{1 + 2}");
});
