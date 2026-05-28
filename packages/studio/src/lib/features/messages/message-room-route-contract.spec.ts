import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const messageRoomRouteSource = readFileSync(resolve(import.meta.dirname, "message-room-route.svelte"), "utf8");

describe("Feature: Room route hydration stability contract", () => {
  test("Scenario: Given room read progress mutates frequently When reading the route source Then room hydration depends on stable chatId and accessToken primitives instead of the whole projection object", () => {
    expect(messageRoomRouteSource).toContain(
      "const selectedRoomChatId = $derived(selectedRoomProjection?.chatId ?? '');",
    );
    expect(messageRoomRouteSource).toContain(
      "const selectedRoomAccessToken = $derived(selectedRoomProjection?.accessToken ?? null);",
    );
    expect(messageRoomRouteSource).toContain("const chatId = selectedRoomChatId;");
    expect(messageRoomRouteSource).toContain("const accessToken = selectedRoomAccessToken;");
    expect(messageRoomRouteSource).toContain(".hydrateGlobalRoomSnapshot({");
    expect(messageRoomRouteSource).toContain(".hydrateGlobalRoomGrants({");
    expect(messageRoomRouteSource).toContain(".hydrateGlobalRoomAssets({");
    expect(messageRoomRouteSource).toContain("accessToken,");
    expect(messageRoomRouteSource).toContain("limit: 120,");
  });

  test("Scenario: Given the viewer changes while the transcript stays on the same latest message When reading the route source Then the route caches that visibility fact and replays read-ack work from the warm snapshot", () => {
    expect(messageRoomRouteSource).toContain(
      "let latestVisibleMessageByRoomId = $state<Record<string, WebChatVisibleMessageFact | null>>({});",
    );
    expect(messageRoomRouteSource).toContain(
      "let latestVisibleReplayKeyByRoomId = $state<Record<string, string>>({});",
    );
    expect(messageRoomRouteSource).toContain(
      "const buildVisibleReplayKey = (viewerActorId: string, visibleMessage: WebChatVisibleMessageFact): string =>",
    );
    expect(messageRoomRouteSource).toContain("const resolveLatestReplayVisibleMessage = (");
    expect(messageRoomRouteSource).toContain("const selectedViewerAccessToken = $derived.by(() => {");
    expect(messageRoomRouteSource).toContain("const latestMessage = selectedRoomSnapshot?.items.at(-1) ?? null;");
    expect(messageRoomRouteSource).toContain("viewKey: String(latestMessage.messageId),");
    expect(messageRoomRouteSource).toContain("[room.chatId]: visibleMessage,");
    expect(messageRoomRouteSource).toContain("if (!room || !viewerActorId || !viewerAccessToken) {");
    expect(messageRoomRouteSource).toContain("void handleLatestVisibleMessageIdChange(latestVisibleMessage);");
  });

  test("Scenario: Given room viewer selection should survive refresh When reading the route source Then the route hydrates and replays viewer preferences through the shared source instead of duplicating pending state locally", () => {
    expect(messageRoomRouteSource).toContain(
      "import { MessageRoomViewerPreferenceSource } from './message-room-viewer-preference-source';",
    );
    expect(messageRoomRouteSource).toContain("import { resolveRoomViewerResolution } from './message-room-viewer';");
    expect(messageRoomRouteSource).toContain(
      "const roomViewerPreferenceSource = new MessageRoomViewerPreferenceSource();",
    );
    expect(messageRoomRouteSource).toContain("let viewerPreferenceHydrated = $state(false);");
    expect(messageRoomRouteSource).toContain("const roomViewerResolution = $derived.by(() => {");
    expect(messageRoomRouteSource).toContain("seatTruthLoaded: selectedRoomGrantsState.loaded,");
    expect(messageRoomRouteSource).toContain("const selectedViewerActorId = $derived(roomViewerResolution.actorId);");
    expect(messageRoomRouteSource).toContain(
      "const snapshot = await roomViewerPreferenceSource.hydrate(controller.runtimeStore, authId);",
    );
    expect(messageRoomRouteSource).toContain(
      "void roomViewerPreferenceSource.flushPending(controller.runtimeStore).then((nextSnapshot) => {",
    );
    expect(messageRoomRouteSource).toContain(
      "unsubscribe = roomViewerPreferenceSource.subscribe(controller.runtimeStore, (nextSnapshot) => {",
    );
    expect(messageRoomRouteSource).toContain(
      "const persistPromise = roomViewerPreferenceSource.setRoomViewerActorId(controller.runtimeStore, chatId, actorId);",
    );
    expect(messageRoomRouteSource).toContain("roomViewerResolution.storedViewerState !== 'invalid'");
    expect(messageRoomRouteSource).not.toContain("pendingViewerActorIdByRoomId");
    expect(messageRoomRouteSource).toContain(
      "void roomViewerPreferenceSource.setRoomViewerActorId(controller.runtimeStore, chatId, null).then((snapshot) => {",
    );
  });

  test("Scenario: Given the browser is not authenticated When reading the room route source Then stale room tokens cannot keep the room composer or room mutations active", () => {
    expect(messageRoomRouteSource).toContain("const AUTH_REQUIRED_MESSAGE = 'auth token required';");
    expect(messageRoomRouteSource).toContain("const authReady = $derived(!controller.initializing);");
    expect(messageRoomRouteSource).toContain("const isAuthenticated = $derived(Boolean(controller.authSession));");
    expect(messageRoomRouteSource).toContain("const authRequired = $derived(authReady && !isAuthenticated);");
    expect(messageRoomRouteSource).toContain(
      "const initialRoomSnapshotResolved = $derived(selectedRoomSnapshotState.loaded || authRequired);",
    );
    expect(messageRoomRouteSource).toContain("if (!isAuthenticated) {\n\t\t\treturn null;");
    expect(messageRoomRouteSource).toContain(
      "if (authRequired) {\n\t\t\treturn {\n\t\t\t\ttone: 'destructive',\n\t\t\t\tmessage: AUTH_REQUIRED_MESSAGE,",
    );
    expect(messageRoomRouteSource).toContain("const ensureAuthenticated = (): void => {");
    expect(messageRoomRouteSource).toContain("if (!isAuthenticated || !chatId || !accessToken) {");
    expect(messageRoomRouteSource).toContain("initialSnapshotResolved={initialRoomSnapshotResolved}");
    expect(messageRoomRouteSource).toContain("authenticated={isAuthenticated}");
  });

  test("Scenario: Given archiving is now a visibility lifecycle instead of a forced navigation away When reading the room route source Then archived rooms stay in detail truth and no longer redirect to a fallback room", () => {
    expect(messageRoomRouteSource).toContain("splitMessageWorkbenchRooms");
    expect(messageRoomRouteSource).toContain("const archivedRoomCount = $derived(splitMessageWorkbenchRooms(rooms).archivedRooms.length);");
    expect(messageRoomRouteSource).toContain("await controller.runtimeStore.archiveGlobalRoom({");
    expect(messageRoomRouteSource).toContain("const handleArchiveRoom = async (): Promise<void> => {");
    expect(messageRoomRouteSource).toContain("await controller.runtimeStore.archiveGlobalRoom({");
    expect(messageRoomRouteSource).toContain("routeNotice = null;");
    expect(messageRoomRouteSource).toContain("const handleDeleteRoom = async (): Promise<void> => {");
    expect(messageRoomRouteSource).toContain("await navigateToFallbackRoom(room.chatId);");
    expect(messageRoomRouteSource).toContain("{archivedRoomCount}");
  });

  test("Scenario: Given Studio must not forge a participant seat from bootstrap room control When reading the route source Then sending options and visible seats come only from durable room participants and grants", () => {
    expect(messageRoomRouteSource).toContain("grant.role !== 'readonly'");
    expect(messageRoomRouteSource).toContain("if (room.accessRole !== 'readonly' && isUserFacingRoomActorId(room.participantId))");
    expect(messageRoomRouteSource).not.toContain("!grantOptions.some((option) => option.participantId === currentAuthActorId)");
    expect(messageRoomRouteSource).not.toContain("!seats.has(currentAuthActorId)");
    expect(messageRoomRouteSource).toContain("roomSeatTruthLoaded={selectedRoomGrantsState.loaded}");
  });
});
