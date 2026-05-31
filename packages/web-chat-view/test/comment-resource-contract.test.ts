import { describe, expect, test } from "vitest";

import {
  buildCommentResourceSourceUri,
  commentResourceToReference,
  createCommentResourcePayload,
  formatCommentResourceDefinition,
  normalizeCommentResourcePayload,
  parseCommentFootnoteDefinition,
  resolveMessageResourceReferences,
} from "../src";

describe("Feature: comment resource serialization contract", () => {
  test("Scenario: Given a selected range When a comment resource payload is created Then the token label and carrier stay consistent with resource law", () => {
    const payload = createCommentResourcePayload({
      index: 2,
      commentText: "Need a more compact mobile composer",
      sourceViewKey: "msg-42",
      sourceLineNumber: 3,
      selectedText: "compact mobile composer",
      sourceActorLabel: "Kai",
      sourceUri: "msg://room-1/msg-42#L3",
    });

    expect(payload.label).toBe("Comment 2");
    expect(payload.tokenText).toBe("[^Comment 2]");

    const reference = commentResourceToReference(payload);
    expect(reference.kind).toBe("comment");
    expect(reference.commentText).toBe("Need a more compact mobile composer");
    expect(reference.commentAnchor?.selectedText).toBe("compact mobile composer");
  });

  test("Scenario: Given a comment resource When the durable footnote line is formatted and parsed Then the markdown carrier remains round-trippable", () => {
    const line = formatCommentResourceDefinition({
      label: "Comment 1",
      commentText: "Tighten the header density",
      sourceUri: "msg://room-1/42#L2",
    });

    expect(line).toBe("[^Comment 1]: [Tighten the header density](msg://room-1/42#L2)");
    expect(parseCommentFootnoteDefinition(line)).toEqual({
      label: "Comment 1",
      commentText: "Tighten the header density",
      sourceUri: "msg://room-1/42#L2",
    });
  });

  test("Scenario: Given pure Markdown comment footnotes When resolving sent resources Then comment detail is reconstructed without metadata", () => {
    const resources = resolveMessageResourceReferences({
      content: [
        "Review [^Comment 1] before shipping.",
        "",
        '[^Comment 1]: [Tighten the header density](msg://room-1/42#L2 "header density")',
      ].join("\n"),
      metadata: {
        webChatCommentResources: [
          {
            id: "legacy-comment-1",
            label: "Comment 1",
            tokenText: "[^Comment 1]",
            commentText: "Wrong hidden payload",
            sourceViewKey: "legacy",
            sourceLineNumber: 1,
            selectedText: "legacy",
          },
        ],
      },
    });

    expect(resources).toHaveLength(1);
    expect(resources[0]).toMatchObject({
      id: "comment-1",
      label: "Comment 1",
      tokenText: "[^Comment 1]",
      kind: "comment",
      commentText: "Tighten the header density",
    });
    expect(resources[0]?.commentAnchor).toMatchObject({
      sourceMessageId: 42,
      sourceViewKey: "room-1:42",
      sourceLineNumber: 2,
      selectedText: "header density",
      sourceUri: "msg://room-1/42#L2",
    });
  });

  test("Scenario: Given a room id and source anchor When the source uri is derived Then comments point back to the originating message line", () => {
    expect(
      buildCommentResourceSourceUri({
        roomId: "room-1",
        sourceMessageId: 42,
        sourceViewKey: "msg-42",
        sourceLineNumber: 7,
      }),
    ).toBe("msg://room-1/42#L7");
  });

  test("Scenario: Given an empty comment draft When a comment resource is normalized or created Then no visible comment resource is produced", () => {
    const emptyPayload = {
      id: "comment-1",
      label: "Comment 1",
      tokenText: "[^Comment 1]",
      commentText: "   ",
      sourceViewKey: "msg-42",
      sourceLineNumber: 3,
      selectedText: "compact mobile composer",
    };

    expect(normalizeCommentResourcePayload(emptyPayload)).toBeNull();
    expect(() =>
      createCommentResourcePayload({
        index: 1,
        commentText: "   ",
        sourceViewKey: "msg-42",
        sourceLineNumber: 3,
        selectedText: "compact mobile composer",
      }),
    ).toThrow("comment resource body must be non-empty");
  });
});
