import { describe, expect, test } from "vitest";

import { buildShareQuery, parseImportedProfile } from "../src/lib/review-example.query";

describe("Feature: Framework7 review shell query profile contract", () => {
  test("Scenario: Given a seeded review profile When the shell builds a share query Then the transport facts stay explicit for future review URLs", () => {
	    const query = buildShareQuery({
	      name: "QA review room",
	      transportUrl: "ws://127.0.0.1:4601/room/demo?token=abc",
	      accessToken: "abc",
	      viewerContactId: "0xviewer",
	    });

    expect(query).toContain("name=QA+review+room");
	    expect(query).toContain("url=ws%3A%2F%2F127.0.0.1%3A4601%2Froom%2Fdemo%3Ftoken%3Dabc");
	    expect(query).toContain("token=abc");
	    expect(query).toContain("viewer=0xviewer");
	    expect(query).not.toContain("viewerActorId");
	  });

	  test("Scenario: Given a seeded review URL When the shell parses query parameters Then it restores the imported profile without guessing hidden transport state", () => {
	    const url = new URL(
	      "http://127.0.0.1:4292/?name=Imported+room&url=ws%3A%2F%2F127.0.0.1%3A4601%2Froom%2Fdemo&token=secret&viewer=0xabc",
	    );

    expect(parseImportedProfile(url)).toEqual({
      id: "imported-profile",
      appViewMode: "full",
	      name: "Imported room",
	      transportUrl: "ws://127.0.0.1:4601/room/demo",
	      accessToken: "secret",
	      viewerContactId: "0xabc",
	    });
	  });

  test("Scenario: Given an embedded app-view room URL When the shell parses query parameters Then room, viewer, and token facts select partial room mode without a host event bridge", () => {
    const url = new URL(
      "http://127.0.0.1:4292/?mode=room&room=room-demo&url=ws%3A%2F%2F127.0.0.1%3A4601%2Froom%2Froom-demo&token=viewer-token&viewer=auth%3Akai&name=Studio+room",
    );

    expect(parseImportedProfile(url)).toEqual({
      id: "embedded-room-profile",
      appViewMode: "room",
	      name: "Studio room",
	      transportUrl: "ws://127.0.0.1:4601/room/room-demo?token=viewer-token",
	      accessToken: "viewer-token",
	      viewerContactId: "auth:kai",
	    });
	  });
});
