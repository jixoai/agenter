import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { buildMessageAppViewRoomUrl } from "./message-app-view-url";

const messageSystemSurfaceSource = readFileSync(resolve(import.meta.dirname, "message-system-surface.svelte"), "utf8");

describe("Feature: Studio message app-view iframe boundary", () => {
  test("Scenario: Given a selected room and viewer token When building the app-view URL Then Studio selects partial room mode with viewer-scoped transport facts", () => {
		const url = buildMessageAppViewRoomUrl({
			appViewBaseUrl: "http://127.0.0.1:4292/",
			room: {
				chatId: "room-demo",
				title: "Design review",
				transportUrl: "ws://127.0.0.1:4601/room/room-demo?token=room-admin",
			},
			viewerContactId: "auth:kai",
			viewerAccessToken: "viewer-token",
		});

		expect(url).toBe(
			"http://127.0.0.1:4292/?mode=room&room=room-demo&url=ws%3A%2F%2F127.0.0.1%3A4601%2Froom%2Froom-demo%3Ftoken%3Dviewer-token&token=viewer-token&viewer=auth%3Akai&name=Design+review",
		);
	});

  test("Scenario: Given Studio embeds the app-view When reading the surface source Then the chat body is an iframe boundary instead of a direct WebChatViewHost mount", () => {
    expect(messageSystemSurfaceSource).toContain("message-room-app-view-frame");
    expect(messageSystemSurfaceSource).toContain("<iframe");
    expect(messageSystemSurfaceSource).not.toContain("<WebChatViewHost");
  });
});
