import { expect, test } from "bun:test";

import { DeepseekClient, type TextOnlyModelMessage } from "@agenter/app-server";

test("deepseek client uses fallback when api key missing", async () => {
  const client = new DeepseekClient(undefined, "deepseek-chat");
  const messages: TextOnlyModelMessage[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          content: JSON.stringify({
            name: "User",
            text: "请给出下一步",
          }),
        },
      ],
    },
  ];
  const result = await client.respondWithMeta({
    systemPrompt: "sys",
    messages,
    tools: [],
  });

  expect(result.thinking).toBe("");
  expect(result.finishReason).toBe("stop");
  expect(result.text).toContain("DEEPSEEK_API_KEY");
});
