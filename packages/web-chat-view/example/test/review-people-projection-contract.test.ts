import type {
  MessageContactId,
  MessageControlPlaneEntry,
  MessageSourceSubscriptionRecord,
} from "@agenter/message-system";
import { describe, expect, test } from "vitest";

import type { ReviewPeopleEnvelope, ReviewProfile } from "../src/lib/review-example.types";
import {
  buildReviewPeopleProjection,
  createContactIdentity,
  createContactMentionSuggestions,
} from "../src/lib/review-people.projection";

const NOW = 1_773_000_000_000;
const TEST_SYSTEM_ID = "0x0000000000000000000000000000000000000a11";

const source = (
  sourceId: string,
  label: string,
  ownerContactId: MessageContactId = "auth:owner",
): MessageSourceSubscriptionRecord => ({
  ownerContactId,
  sourceId,
  label,
  endpoint: `https://${sourceId}.example.invalid/message-system`,
  createdAt: NOW,
  updatedAt: NOW,
  metadata: {
    health: "ready",
  },
});

const peopleEnvelope = (): ReviewPeopleEnvelope => ({
  currentActor: {
    actorId: "auth:owner",
    label: "Iris",
  },
  sources: [
    source("local-review", "Local review"),
    source("remote-lab", "Remote lab"),
    source("main-office", "Main office"),
  ],
  contacts: [
    {
      ownerContactId: "auth:owner",
      sourceId: "remote-lab",
      remoteContactId: "auth:kai",
      label: "Kai",
      subtitle: "Remote lab reviewer",
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      ownerContactId: "auth:owner",
      sourceId: "main-office",
      remoteContactId: "auth:kai",
      label: "Kai",
      subtitle: "Main office owner",
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      ownerContactId: "auth:owner",
      sourceId: "local-review",
      remoteContactId: "auth:lena",
      label: "Lena",
      subtitle: "Local review room",
      localDirectChatId: "room-direct-lena",
      createdAt: NOW,
      updatedAt: NOW,
    },
  ],
  contactRequests: [
    {
      ownerContactId: "auth:owner",
      requestId: "request-mira",
      direction: "inbound",
      sourceId: "remote-lab",
      remoteContactId: "auth:mira",
      remoteLabel: "Mira",
      remoteSubtitle: "Product reviewer",
      message: "Requesting access to the mobile review room.",
      state: "pending",
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      ownerContactId: "auth:owner",
      requestId: "request-nora",
      direction: "outbound",
      sourceId: "main-office",
      remoteContactId: "auth:nora",
      remoteLabel: "Nora",
      state: "accepted",
      createdAt: NOW,
      updatedAt: NOW,
    },
  ],
});

const profile: ReviewProfile = {
  id: "profile-review",
  name: "Iris review",
  transportUrl: "ws://127.0.0.1:4601/room/room-main",
  accessToken: "token",
  viewerActorId: "auth:owner",
};

const activeChannel: MessageControlPlaneEntry = {
  chatId: "room-main",
  kind: "room",
  title: "Canonical review room",
  owner: "Iris",
  superKey: TEST_SYSTEM_ID,
  createdBySystemId: TEST_SYSTEM_ID,
  participants: [],
  createdAt: NOW,
  updatedAt: NOW,
  roomRevision: "1",
  transcriptRevision: "1",
  focused: true,
  accessRole: "member",
  accessToken: "token",
};

const projectPeople = () =>
  buildReviewPeopleProjection({
    people: peopleEnvelope(),
    activeProfile: profile,
    activeChannel,
    initialMessages: [],
  });

describe("Feature: Framework7 people shell projection contract", () => {
  test("Scenario: Given same-name contacts from different sources When projection builds contact keys Then source-scoped identities do not merge", () => {
    const projection = projectPeople();
    const kaiKeys = projection.contacts.filter((contact) => contact.label === "Kai").map((contact) => contact.key);

    expect(kaiKeys).toEqual([
      "auth:owner::main-office::auth:kai",
      "auth:owner::remote-lab::auth:kai",
    ]);
    expect(new Set(kaiKeys).size).toBe(2);
    expect(createContactIdentity(projection.contacts[0]?.record ?? peopleEnvelope().contacts[0])).toContain("::");
  });

  test("Scenario: Given contacts and requests from multiple sources When source rows are projected Then counts stay source-local", () => {
    const projection = projectPeople();

    expect(
      projection.sources.map((sourceProjection) => ({
        sourceId: sourceProjection.sourceId,
        contactCount: sourceProjection.contactCount,
        pendingRequestCount: sourceProjection.pendingRequestCount,
      })),
    ).toEqual([
      { sourceId: "local-review", contactCount: 1, pendingRequestCount: 0 },
      { sourceId: "remote-lab", contactCount: 1, pendingRequestCount: 1 },
      { sourceId: "main-office", contactCount: 1, pendingRequestCount: 0 },
    ]);
    expect(projection.pendingRequestCount).toBe(1);
  });

  test("Scenario: Given an active room and a direct contact When conversations are projected Then the Messages tab can show both entries", () => {
    const projection = projectPeople();

    expect(projection.conversations.map((conversation) => conversation.kind)).toEqual(["room", "direct"]);
    expect(projection.conversations[0]).toMatchObject({
      id: "room:room-main",
      title: "Canonical review room",
      openableRoom: true,
    });
    expect(projection.conversations[1]).toMatchObject({
      id: "direct:auth:owner::local-review::auth:lena",
      title: "Lena",
      chatId: "room-direct-lena",
    });
  });

  test("Scenario: Given projected contacts When composer suggestions are derived Then mentions carry source provenance", () => {
    const projection = projectPeople();

    expect(createContactMentionSuggestions(projection.contacts)).toEqual([
      {
        id: "auth:owner::local-review::auth:lena",
        label: "Lena",
        apply: "@Lena",
        detail: "Local review · auth:lena",
        iconUrl: undefined,
      },
      {
        id: "auth:owner::main-office::auth:kai",
        label: "Kai",
        apply: "@Kai",
        detail: "Main office · auth:kai",
        iconUrl: undefined,
      },
      {
        id: "auth:owner::remote-lab::auth:kai",
        label: "Kai",
        apply: "@Kai",
        detail: "Remote lab · auth:kai",
        iconUrl: undefined,
      },
    ]);
  });
});
