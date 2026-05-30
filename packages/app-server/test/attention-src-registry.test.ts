import { describe, expect, test } from "bun:test";

import {
  appAttentionSourceRegistry,
  formatMessageContactAttentionSrc,
  formatRoomAttentionSrc,
  parseMessageContactAttentionSrc,
  parseRoomAttentionSrc,
} from "../src/attention-src";

describe("Feature: attention source namespace ownership", () => {
  test("Scenario: Given room namespace refs When formatting and parsing Then room entries stay room-fragment sources", () => {
    const roomSrc = formatRoomAttentionSrc({ roomId: "room-13" });
    const entrySrc = formatRoomAttentionSrc({ roomId: "room-13", entryId: 155 });

    expect(roomSrc).toBe("room:room-13");
    expect(entrySrc).toBe("room:room-13#155");
    expect(parseRoomAttentionSrc(roomSrc)).toEqual({ roomId: "room-13" });
    expect(parseRoomAttentionSrc(entrySrc)).toEqual({ roomId: "room-13", entryId: "155" });
    expect(appAttentionSourceRegistry.bucket(entrySrc)).toBe(roomSrc);
    expect(appAttentionSourceRegistry.sourceId(entrySrc)).toBe("room-13");
  });

  test("Scenario: Given message namespace refs When formatting and parsing Then msg identifies a contact locator rather than a room row", () => {
    const contactSrc = formatMessageContactAttentionSrc({
      superadminAddress: "root-superadmin",
      contact: "auth:kzf",
    });

    expect(contactSrc).toBe("msg:root-superadmin/auth:kzf");
    expect(parseMessageContactAttentionSrc(contactSrc)).toEqual({
      superadminAddress: "root-superadmin",
      contact: "auth:kzf",
    });
    expect(appAttentionSourceRegistry.bucket(contactSrc)).toBe("msg:root-superadmin");
    expect(appAttentionSourceRegistry.sourceId(contactSrc)).toBe("auth:kzf");
  });
});
