import { afterEach, describe, expect, test, vi } from "vitest";

import type { WebChatComposerSubmitPayload } from "@agenter/web-chat-view";
import { submitReviewMessage } from "../src/lib/review-example.api";
import type { ReviewProfile } from "../src/lib/review-example.types";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Feature: review app-view Markdown send contract", () => {
  test("Scenario: Given pending source-comment state When app-view sends Then content is canonical Markdown and WebChat metadata is absent", async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({
          url: String(input),
          body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
        });
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    const profile = {
      id: "kai",
      name: "Kai",
      transportUrl: "ws://127.0.0.1/room/shell-1",
      accessToken: "room-token",
      viewerContactId: "auth:kai",
    } satisfies ReviewProfile;
    const payload = {
      text: "Please inspect [^Comment 1]",
      assets: [],
      commentResources: [
        {
          id: "comment-1",
          label: "Comment 1",
          tokenText: "[^Comment 1]",
          commentText: "Use the compact layout",
          sourceViewKey: "msg-source",
          sourceLineNumber: 2,
          selectedText: "compact layout",
          sourceUri: "msg://shell-1/msg-source#L2",
        },
      ],
    } satisfies WebChatComposerSubmitPayload;

    await submitReviewMessage(profile, payload);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("/api/rooms/shell-1/messages");
    expect(requests[0]?.body.content).toBe(
      'Please inspect [^Comment 1]\n\n[^Comment 1]: [Use the compact layout](msg://shell-1/msg-source#L2 "compact layout")',
    );
    expect(requests[0]?.body).not.toHaveProperty("metadata");
  });
});
