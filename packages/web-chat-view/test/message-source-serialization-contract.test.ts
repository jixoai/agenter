import { describe, expect, test } from "vitest";

import {
  serializeMessageSourceMarkdown,
  type WebChatCommentResourcePayload,
} from "../src";

describe("Feature: canonical message source serialization", () => {
  test("Scenario: Given a message with attachments and comment metadata When serializing source Then the popup source includes durable resource definitions", () => {
    const source = serializeMessageSourceMarkdown({
      chatId: "room-1",
      content: "Body stays light with [^Image 1] and [^Comment 1].",
      attachments: [
        {
          assetId: "asset-image-1",
          kind: "image",
          name: "ios26-thread.png",
          mimeType: "image/png",
          sizeBytes: 2048,
          url: "https://assets.example/ios26-thread.png",
        },
        {
          assetId: "asset-file-1",
          kind: "file",
          name: "resource-map.pdf",
          mimeType: "application/pdf",
          sizeBytes: 4096,
          url: "https://assets.example/resource-map.pdf",
        },
      ],
      metadata: {
        webChatCommentResources: [
          {
            id: "comment-1",
            label: "Comment 1",
            tokenText: "[^Comment 1]",
            commentText: "Expose comment detail in view mode by default.",
            sourceMessageId: 12,
            sourceViewKey: "room-1:12",
            sourceLineNumber: 1,
            selectedText: "Body stays light with [^Image 1]",
            sourceActorId: "actor:kai",
            sourceActorLabel: "Kai",
            sourceUri: "msg://room-1/12#L1",
          } satisfies WebChatCommentResourcePayload,
        ],
      },
      messageId: 42,
      viewKey: "room-1:42",
      senderActorId: "actor:kai",
      from: "Kai",
    });

    expect(source).toContain("Body stays light with [^Image 1] and [^Comment 1].");
    expect(source).toContain("[^Image 1]: [!ios26-thread.png](https://assets.example/ios26-thread.png)");
    expect(source).toContain("[^File 2]: [!resource-map.pdf](https://assets.example/resource-map.pdf)");
    expect(source).toContain("[^Comment 1]: [Expose comment detail in view mode by default.](msg://room-1/12#L1)");
  });

  test("Scenario: Given a message that already contains footnote definitions When serializing source Then definitions are not duplicated", () => {
    const source = serializeMessageSourceMarkdown({
      chatId: "room-1",
      content: [
        "Use [^Image 1] in the body.",
        "",
        "[^Image 1]: [!ios26-thread.png](https://assets.example/ios26-thread.png)",
      ].join("\n"),
      attachments: [
        {
          assetId: "asset-image-1",
          kind: "image",
          name: "ios26-thread.png",
          mimeType: "image/png",
          sizeBytes: 2048,
          url: "https://assets.example/ios26-thread.png",
        },
      ],
      viewKey: "room-1:42",
      from: "Kai",
    });

    expect(source.match(/\[\^Image 1\]:/gu)).toHaveLength(1);
  });
});
