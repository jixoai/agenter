#!/usr/bin/env bun
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix as posixPath } from "node:path";

import {
  MessageControlPlane,
  resolveMessageControlDbPath,
  type MessageAttachment,
  type MessageAuthorizedWriteInput,
  type MessageChannelAccessRole,
  type MessageContactId,
  type MessageControlPlaneEntry,
  type MessageIssuedGrant,
} from "@agenter/message-system";
import { generatePrincipalKeyPair, type PrincipalId } from "@agenter/principal-crypto";

type ReviewSeat = {
  actorId: PrincipalId;
  name: string;
  role: MessageChannelAccessRole;
  iconUrl: string;
  token: string;
};

type HarnessState = {
  rootDir: string;
  plane: MessageControlPlane;
  room: MessageControlPlaneEntry;
  assetStore: ReviewAssetStore;
  seats: ReviewSeat[];
};

type ReviewAssetRecord = {
  assetId: string;
  roomId: string;
  kind: "image" | "video" | "file";
  name: string;
  mimeType: string;
  sizeBytes: number;
  relativePath: string;
  createdAt: number;
  updatedAt: number;
  uploadedByActorId?: PrincipalId;
};

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_HTTP_PORT = 4600;
const DEFAULT_WS_PORT = 4601;
const ROOM_TITLE = "Canonical review room";
const OWNER_NAME = "Iris";
const ROOM_ASSET_INDEX_FILENAME = "index.json";

const readPort = (envName: string, fallback: number): number => {
  const raw = process.env[envName]?.trim() || `${fallback}`;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`invalid ${envName}: ${raw}`);
  }
  return value;
};

const HTTP_PORT = readPort("WEB_CHAT_VIEW_REVIEW_HARNESS_PORT", DEFAULT_HTTP_PORT);
const WS_PORT = readPort("WEB_CHAT_VIEW_REVIEW_WS_PORT", DEFAULT_WS_PORT);

const createSeatSeed = (name: string): Omit<ReviewSeat, "token"> => {
  const actorId = generatePrincipalKeyPair().principalId;
  return {
    actorId,
    name,
    role: "member",
    iconUrl: buildAvatarDataUrl(name),
  };
};

const buildAvatarDataUrl = (label: string): string => {
  const hue = hashString(label) % 360;
  const accentHue = (hue + 42) % 360;
  const jacketHue = (hue + 205) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(${hue} 72% 88%)" />
        <stop offset="100%" stop-color="hsl(${accentHue} 62% 72%)" />
      </linearGradient>
      <radialGradient id="skin" cx="42%" cy="34%" r="62%">
        <stop offset="0%" stop-color="#ffe1c4" />
        <stop offset="100%" stop-color="#d89a75" />
      </radialGradient>
      <filter id="s" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#1f2937" flood-opacity=".18"/>
      </filter>
    </defs>
    <rect width="64" height="64" rx="22" fill="url(#g)" />
    <circle cx="48" cy="14" r="10" fill="rgba(255,255,255,.28)" />
    <path d="M12 61c2.8-13.4 12.4-21.2 20-21.2S49.2 47.6 52 61" fill="hsl(${jacketHue} 48% 34%)" filter="url(#s)" />
    <path d="M20.2 18.8c1.8-8.4 8.2-12.2 14.5-11.2 8.2 1.3 12.2 7.5 11.4 16.4-.7 7.5-5.8 15.2-14.2 15.2-8.8 0-13.4-8.7-11.7-20.4Z" fill="#2f2630" />
    <ellipse cx="32" cy="26.8" rx="13.4" ry="14.8" fill="url(#skin)" filter="url(#s)" />
    <path d="M19.8 25.4c2.1-8.4 8.9-13 17.2-12 5 .6 8.2 3.2 9.4 7.4-5.4-.8-9.3-2.5-11.7-5.2-2.6 4.2-7.5 7.4-14.9 9.8Z" fill="#2f2630" />
    <circle cx="27.4" cy="27.4" r="1.3" fill="#111827" />
    <circle cx="37.4" cy="27.4" r="1.3" fill="#111827" />
    <path d="M28.4 33.8c2.3 1.7 5.1 1.7 7.4 0" fill="none" stroke="#8a4f3a" stroke-width="1.8" stroke-linecap="round" />
    <path d="M24 44.2c4.6 3.4 11.8 3.4 16.4 0" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2.8" stroke-linecap="round" />
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const hashString = (value: string): number => {
  let seed = 0;
  for (const char of value) {
    seed = (seed * 33 + char.charCodeAt(0)) >>> 0;
  }
  return seed;
};

const rewriteTransportToken = (transportUrl: string, accessToken: string): string => {
  const url = new URL(transportUrl);
  url.searchParams.set("token", accessToken);
  return url.toString();
};

const createHarnessState = async (): Promise<HarnessState> => {
  const rootDir = mkdtempSync(join(tmpdir(), "web-chat-view-review-harness-"));
  const dbPath = resolveMessageControlDbPath(join(rootDir, ".message"));
  const plane = new MessageControlPlane({ dbPath });
  await plane.startTransport({ host: DEFAULT_HOST, port: WS_PORT });

  const roomId = generatePrincipalKeyPair().principalId;
  const ownerSeed = createSeatSeed(OWNER_NAME);
  const reviewerSeed = createSeatSeed("Kai");
  const designerSeed = createSeatSeed("Lena");

  const room = plane.createChannel({
    chatId: roomId,
    kind: "room",
    title: ROOM_TITLE,
    owner: OWNER_NAME,
    participants: [
      { id: ownerSeed.actorId, label: OWNER_NAME },
      { id: reviewerSeed.actorId, label: reviewerSeed.name },
      { id: designerSeed.actorId, label: designerSeed.name },
    ],
    bootstrapContactId: ownerSeed.actorId,
    initialUsers: [
      { contactId: ownerSeed.actorId, label: OWNER_NAME, role: "admin", focused: true },
      { contactId: reviewerSeed.actorId, label: reviewerSeed.name, role: "member", focused: true },
      { contactId: designerSeed.actorId, label: designerSeed.name, role: "member", focused: false },
    ],
  });

  const reviewerGrant = issueSeatGrant(plane, room, reviewerSeed);
  const designerGrant = issueSeatGrant(plane, room, designerSeed);
  const seats: ReviewSeat[] = [
    { ...ownerSeed, role: "admin", token: room.accessToken },
    { ...reviewerSeed, token: reviewerGrant.accessToken },
    { ...designerSeed, token: designerGrant.accessToken },
  ];

  const assetStore = new ReviewAssetStore(rootDir);
  seedMessages(plane, assetStore, room.chatId, seats);
  seedPeople(plane, room, seats);

  return {
    rootDir,
    plane,
    room,
    assetStore,
    seats,
  };
};

const issueSeatGrant = (
  plane: MessageControlPlane,
  room: MessageControlPlaneEntry,
  seat: Omit<ReviewSeat, "token">,
): MessageIssuedGrant => {
  return plane.issueChannelGrantAuthorized({
    chatId: room.chatId,
    accessToken: room.accessToken,
    role: seat.role,
    label: seat.name,
    participantId: seat.actorId,
  });
};

const seedMessages = (
  plane: MessageControlPlane,
  assetStore: ReviewAssetStore,
  chatId: string,
  seats: readonly ReviewSeat[],
): void => {
  const owner = seats[0];
  const reviewer = seats[1];
  const designer = seats[2];
  if (!owner || !reviewer || !designer) {
    throw new Error("seed seats missing");
  }

  const uploaded = assetStore.uploadAssets(
    chatId,
    [
      {
        name: "ios26-thread.png",
        mimeType: "image/png",
        bytes: pngPlaceholder(),
      },
      {
        name: "resource-map.pdf",
        mimeType: "application/pdf",
        bytes: new TextEncoder().encode("%PDF-1.4\n% web-chat-view review shell placeholder\n"),
      },
    ],
    { uploadedByActorId: owner.actorId },
  );
  const attachments: MessageAttachment[] = uploaded.map((asset) => toChatRoomAsset(chatId, asset));
  const image = attachments[0];
  const file = attachments[1];

  const first = plane.sendAuthorized({
    chatId,
    accessToken: owner.token,
    senderContactId: owner.actorId,
    content: [
      "I grouped the north entry items here before we send the note out.",
      "The dusk photo is in [^Image 1], and the circulation markup is in [^File 2].",
    ].join("\n"),
    attachments: [image, file].filter((value): value is MessageAttachment => Boolean(value)),
  });
  plane.sendAuthorized({
    chatId,
    accessToken: owner.token,
    senderContactId: owner.actorId,
    content: "The vestibule feels much calmer now. I would keep the note this short and let the supporting material sit underneath.",
  });
  plane.sendAuthorized({
    chatId,
    accessToken: reviewer.token,
    senderContactId: reviewer.actorId,
    content: "This reads better. The sequence is easier to follow, and the backup files are still easy to reach if anyone needs them.",
    ref: first.messageId,
  });
  plane.sendAuthorized({
    chatId,
    accessToken: owner.token,
    senderContactId: owner.actorId,
    content: "I left one line note on the lighting sentence so the warmer pendant callout stays attached to the right line.",
    metadata: {
      webChatCommentResources: [
        {
          id: "seed-comment-1",
          label: "Comment 1",
          tokenText: "[^Comment 1]",
          commentText: "Keep the pendant row warmer than the stair landing so the entry still reads as one continuous threshold.",
          sourceMessageId: first.messageId,
          sourceViewKey: typeof first.messageId === "number" ? `message-${first.messageId}` : "seed-message-1",
          sourceLineNumber: 2,
          selectedText: "The dusk photo is in [^Image 1], and the circulation markup is in [^File 2].",
          sourceActorId: owner.actorId,
          sourceActorLabel: owner.name,
          sourceUri: typeof first.messageId === "number" ? `msg://${chatId}/${first.messageId}#L4` : undefined,
        },
      ],
    },
  });
  plane.sendAuthorized({
    chatId,
    accessToken: designer.token,
    senderContactId: designer.actorId,
    content: "The stair threshold also reads better in this export. I do not think the room note needs anything else.",
  });
  plane.sendAuthorized({
    chatId,
    accessToken: reviewer.token,
    senderContactId: reviewer.actorId,
    content: "Agreed. I will keep the follow-up short in the thread and only pull the full source if someone asks for it.",
  });
  plane.sendAuthorized({
    chatId,
    accessToken: owner.token,
    senderContactId: owner.actorId,
    content: "Perfect. Send it after dinner with the same wording and the same supporting files.",
  });
  plane.sendAuthorized({
    chatId,
    accessToken: designer.token,
    senderContactId: designer.actorId,
    content: "One last note before I log off: the bench finish in the image is the approved one, so I would not add another swatch.",
  });
  plane.sendAuthorized({
    chatId,
    accessToken: reviewer.token,
    senderContactId: reviewer.actorId,
    content: "Received. I will send the wrap-up after dinner and leave the attachments where they are.",
  });
}

const seedPeople = (
  plane: MessageControlPlane,
  room: MessageControlPlaneEntry,
  seats: readonly ReviewSeat[],
): void => {
  for (const seat of seats) {
    plane.upsertSourceSubscription({
      ownerContactId: seat.actorId,
      sourceId: "local-review",
      label: "Local review",
      endpoint: `http://${DEFAULT_HOST}:${HTTP_PORT}`,
      callbackSourceId: "local-review",
      callbackEndpoint: `http://${DEFAULT_HOST}:${HTTP_PORT}/api/review/people`,
      metadata: {
        health: "online",
      },
    });
    plane.upsertSourceSubscription({
      ownerContactId: seat.actorId,
      sourceId: "remote-lab",
      label: "Remote lab",
      endpoint: "https://remote-lab.example.invalid/message-system",
      authToken: `remote-lab-token-${seat.name.toLowerCase()}`,
      callbackSourceId: "local-review",
      callbackEndpoint: `http://${DEFAULT_HOST}:${HTTP_PORT}/api/review/people`,
      metadata: {
        health: "ready",
      },
    });
    plane.upsertSourceSubscription({
      ownerContactId: seat.actorId,
      sourceId: "main-office",
      label: "Main office",
      endpoint: "https://main-office.example.invalid/message-system",
      authToken: `main-office-token-${seat.name.toLowerCase()}`,
      callbackSourceId: "local-review",
      callbackEndpoint: `http://${DEFAULT_HOST}:${HTTP_PORT}/api/review/people`,
      metadata: {
        health: "ready",
      },
    });

    for (const contactSeat of seats) {
      if (contactSeat.actorId === seat.actorId) {
        continue;
      }
      plane.upsertContact({
        ownerContactId: seat.actorId,
        sourceId: "local-review",
        remoteContactId: contactSeat.actorId,
        label: contactSeat.name,
        subtitle: "Local review room",
        iconUrl: contactSeat.iconUrl,
        localDirectChatId: room.chatId,
        metadata: {
          relationship: "review-seat",
        },
      });
    }

    plane.upsertContact({
      ownerContactId: seat.actorId,
      sourceId: "remote-lab",
      remoteContactId: "auth:kai",
      label: "Kai",
      subtitle: "Remote lab reviewer",
      iconUrl: buildAvatarDataUrl("Kai remote"),
      metadata: {
        role: "reviewer",
      },
    });
    plane.upsertContact({
      ownerContactId: seat.actorId,
      sourceId: "remote-lab",
      remoteContactId: "auth:mira",
      label: "Mira",
      subtitle: "Remote lab product reviewer",
      iconUrl: buildAvatarDataUrl("Mira remote"),
      metadata: {
        role: "reviewer",
      },
    });
    plane.upsertContact({
      ownerContactId: seat.actorId,
      sourceId: "remote-lab",
      remoteContactId: "auth:enzo",
      label: "Enzo",
      subtitle: "Remote lab design engineer",
      iconUrl: buildAvatarDataUrl("Enzo remote"),
      metadata: {
        role: "design-engineer",
      },
    });
    plane.upsertContact({
      ownerContactId: seat.actorId,
      sourceId: "main-office",
      remoteContactId: "auth:kai",
      label: "Kai",
      subtitle: "Main office design owner",
      iconUrl: buildAvatarDataUrl("Kai office"),
      metadata: {
        role: "design-owner",
      },
    });
    plane.upsertContact({
      ownerContactId: seat.actorId,
      sourceId: "main-office",
      remoteContactId: "auth:nora",
      label: "Nora",
      subtitle: "Main office systems lead",
      iconUrl: buildAvatarDataUrl("Nora office"),
      metadata: {
        role: "systems-lead",
      },
    });

    plane.createContactRequest({
      ownerContactId: seat.actorId,
      requestId: `inbound-${seat.actorId}`,
      direction: "inbound",
      sourceId: "remote-lab",
      remoteContactId: "auth:mira",
      remoteLabel: "Mira",
      remoteSubtitle: "remote-lab · product reviewer",
      remoteIconUrl: buildAvatarDataUrl("Mira"),
      message: "Requesting access to the mobile review room.",
      callbackSourceId: "local-review",
      callbackEndpoint: `http://${DEFAULT_HOST}:${HTTP_PORT}/api/review/people`,
    });
    plane.createContactRequest({
      ownerContactId: seat.actorId,
      requestId: `outbound-${seat.actorId}`,
      direction: "outbound",
      sourceId: "main-office",
      remoteContactId: "auth:nora",
      remoteLabel: "Nora",
      remoteSubtitle: "main-office · system designer",
      remoteIconUrl: buildAvatarDataUrl("Nora"),
      message: "Can we keep source management outside the room surface?",
      callbackSourceId: "local-review",
      callbackEndpoint: `http://${DEFAULT_HOST}:${HTTP_PORT}/api/review/people`,
    });
  }
};

const pngPlaceholder = (): Uint8Array =>
  Uint8Array.from(
    Buffer.from(
      "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",
      "base64",
    ),
  );

const resolveReviewAssetKind = (mimeType: string): "image" | "video" | "file" => {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  return "file";
};

const buildRoomAssetRelativePath = (roomId: string, assetId: string, name: string): string =>
  posixPath.join("assets", "rooms", encodeURIComponent(roomId), `${assetId}-${name.replace(/[^a-zA-Z0-9._-]+/gu, "-")}`);

const buildRoomAssetUrl = (roomId: string, assetId: string): string =>
  `/media/rooms/${encodeURIComponent(roomId)}/assets/${encodeURIComponent(assetId)}`;

const toChatRoomAsset = (roomId: string, asset: ReviewAssetRecord): MessageAttachment => ({
  assetId: asset.assetId,
  kind: asset.kind,
  name: asset.name,
  mimeType: asset.mimeType,
  sizeBytes: asset.sizeBytes,
  url: buildRoomAssetUrl(roomId, asset.assetId),
});

class ReviewAssetStore {
  constructor(private readonly rootDir: string) {}

  private getRoomDir(roomId: string): string {
    return join(this.rootDir, "assets", "rooms", encodeURIComponent(roomId));
  }

  private getIndexPath(roomId: string): string {
    return join(this.getRoomDir(roomId), ROOM_ASSET_INDEX_FILENAME);
  }

  resolveAbsolutePath(relativePath: string): string {
    return join(this.rootDir, relativePath);
  }

  private readIndex(roomId: string): ReviewAssetRecord[] {
    const indexPath = this.getIndexPath(roomId);
    if (!existsSync(indexPath)) {
      return [];
    }
    try {
      const parsed = JSON.parse(readFileSync(indexPath, "utf8")) as unknown;
      return Array.isArray(parsed) ? (parsed.filter(isReviewAssetRecord) as ReviewAssetRecord[]) : [];
    } catch {
      return [];
    }
  }

  private writeIndex(roomId: string, records: ReviewAssetRecord[]): void {
    const indexPath = this.getIndexPath(roomId);
    mkdirSync(dirname(indexPath), { recursive: true });
    writeFileSync(indexPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }

  uploadAssets(
    roomId: string,
    files: Array<{ name: string; mimeType: string; bytes: Uint8Array }>,
    input: { uploadedByActorId?: PrincipalId } = {},
  ): ReviewAssetRecord[] {
    const current = this.readIndex(roomId);
    const created = files.map((file) => {
      const assetId = `asset-${crypto.randomUUID()}`;
      const now = Date.now();
      const record: ReviewAssetRecord = {
        assetId,
        roomId,
        kind: resolveReviewAssetKind(file.mimeType),
        name: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.bytes.byteLength,
        relativePath: buildRoomAssetRelativePath(roomId, assetId, file.name),
        createdAt: now,
        updatedAt: now,
        uploadedByActorId: input.uploadedByActorId,
      };
      const absolutePath = this.resolveAbsolutePath(record.relativePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, file.bytes);
      return record;
    });
    if (created.length > 0) {
      this.writeIndex(roomId, [...current, ...created]);
    }
    return created;
  }

  getAssetById(roomId: string, assetId: string): ReviewAssetRecord | null {
    return this.readIndex(roomId).find((asset) => asset.assetId === assetId) ?? null;
  }
}

const isReviewAssetRecord = (value: unknown): value is ReviewAssetRecord => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<ReviewAssetRecord>;
  return (
    typeof candidate.assetId === "string" &&
    typeof candidate.roomId === "string" &&
    (candidate.kind === "image" || candidate.kind === "video" || candidate.kind === "file") &&
    typeof candidate.name === "string" &&
    typeof candidate.mimeType === "string" &&
    typeof candidate.sizeBytes === "number" &&
    typeof candidate.relativePath === "string" &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.updatedAt === "number"
  );
};

const resolveChatIdFromTransportUrl = (transportUrl: string): string => {
  const url = new URL(transportUrl);
  const match = url.pathname.match(/\/room\/([^/]+)$/u);
  if (!match?.[1]) {
    throw new Error("transport URL must include /room/<chatId>");
  }
  return decodeURIComponent(match[1]);
};

const buildActorDirectory = (state: HarnessState): Record<string, { actorId: string; label: string; iconUrl: string }> =>
  Object.fromEntries(
    state.seats.map((seat) => [
      seat.actorId,
      {
        actorId: seat.actorId,
        label: seat.name,
        iconUrl: seat.iconUrl,
      },
    ]),
  );

const readMultipartFiles = async (
  request: Request,
): Promise<Array<{ name: string; mimeType: string; bytes: Uint8Array }>> => {
  const form = await request.formData();
  return await Promise.all(
    form.getAll("files").flatMap((value) => {
      if (!(value instanceof File)) {
        return [];
      }
      return [
        (async () => ({
          name: value.name || "asset",
          mimeType: value.type || "application/octet-stream",
          bytes: new Uint8Array(await value.arrayBuffer()),
        }))(),
      ];
    }),
  );
};

const readJsonBody = async <T>(request: Request): Promise<T> => {
  return (await request.json()) as T;
};

const state = await createHarnessState();

const server = Bun.serve({
  hostname: DEFAULT_HOST,
  port: HTTP_PORT,
  fetch: async (request) => {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, httpPort: HTTP_PORT, wsPort: WS_PORT });
    }

    if (url.pathname === "/api/review/bootstrap") {
      const transportUrl = state.room.transportUrl;
      if (!transportUrl) {
        return Response.json({ error: "missing room transport URL" }, { status: 500 });
      }
      return Response.json({
        profiles: state.seats.map((seat, index) => ({
          id: `seed-${index + 1}`,
          name: `${seat.name} review`,
          transportUrl: rewriteTransportToken(transportUrl, seat.token),
          accessToken: seat.token,
          viewerActorId: seat.actorId,
        })),
        recommendedProfileId: "seed-2",
      });
    }

    if (url.pathname === "/api/review/channel") {
      const transportUrl = url.searchParams.get("transportUrl")?.trim() ?? "";
      const accessToken = url.searchParams.get("accessToken")?.trim() ?? "";
      const viewerActorId = url.searchParams.get("viewerActorId")?.trim() ?? "";
      if (!transportUrl || !accessToken || !viewerActorId) {
        return Response.json({ error: "transportUrl, accessToken, and viewerActorId are required" }, { status: 400 });
      }
      const chatId = resolveChatIdFromTransportUrl(transportUrl);
      if (chatId !== state.room.chatId) {
        return Response.json({ error: "unknown room" }, { status: 404 });
      }
      const projected = state.plane.getChannelForActor(chatId, viewerActorId as PrincipalId, {
        includeArchived: false,
        touchPresence: false,
      });
      if (!projected) {
        return Response.json({ error: "viewer seat not found" }, { status: 404 });
      }
      const snapshot = state.plane.snapshotAuthorized({ chatId, accessToken, limit: 80 });
      return Response.json({
        channel: {
          ...projected,
          accessToken,
          transportUrl,
        },
        initialMessages: snapshot.items,
        actorDirectory: buildActorDirectory(state),
      });
    }

    if (url.pathname === "/api/review/people") {
      const viewerActorId = url.searchParams.get("viewerActorId")?.trim() ?? "";
      if (!viewerActorId) {
        return Response.json({ error: "viewerActorId is required" }, { status: 400 });
      }
      const actorDirectory = buildActorDirectory(state);
      const currentActor = actorDirectory[viewerActorId] ?? {
        actorId: viewerActorId,
        label: viewerActorId,
        iconUrl: buildAvatarDataUrl(viewerActorId),
      };
      return Response.json({
        currentActor,
        sources: state.plane.listSourceSubscriptions(viewerActorId as MessageContactId),
        contacts: state.plane.listContacts(viewerActorId as MessageContactId),
        contactRequests: state.plane.listContactRequests(viewerActorId as MessageContactId),
      });
    }

    const roomUploadMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/assets$/u);
    if (request.method === "POST" && roomUploadMatch?.[1]) {
      const chatId = decodeURIComponent(roomUploadMatch[1]);
      const accessToken = request.headers.get("x-agenter-room-access-token")?.trim() ?? "";
      if (chatId !== state.room.chatId) {
        return Response.json({ error: "unknown room" }, { status: 404 });
      }
      state.plane.snapshotAuthorized({ chatId, accessToken });
      const files = await readMultipartFiles(request);
      if (files.length === 0) {
        return Response.json({ error: "asset file is required" }, { status: 400 });
      }
      const uploaded = state.assetStore.uploadAssets(chatId, files);
      return Response.json({
        ok: true,
        items: uploaded.map((asset) => toChatRoomAsset(chatId, asset)),
      });
    }

    const roomMessageMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/messages$/u);
    if (request.method === "POST" && roomMessageMatch?.[1]) {
      const chatId = decodeURIComponent(roomMessageMatch[1]);
      const accessToken = request.headers.get("x-agenter-room-access-token")?.trim() ?? "";
      if (chatId !== state.room.chatId) {
        return Response.json({ error: "unknown room" }, { status: 404 });
      }
      const body = await readJsonBody<MessageAuthorizedWriteInput>(request);
      const content = body.content.trim();
      if (content.length === 0 && (body.attachments?.length ?? 0) === 0) {
        return Response.json({ error: "message content or attachments required" }, { status: 400 });
      }
      state.plane.sendAuthorized({
        chatId,
        accessToken,
        senderContactId: body.senderContactId,
        from: body.from,
        content,
        kind: body.kind,
        ref: body.ref,
        attachments: body.attachments,
        metadata: body.metadata,
        payload: body.payload,
      });
      return Response.json({ ok: true });
    }

    const roomMediaMatch = url.pathname.match(/^\/media\/rooms\/([^/]+)\/assets\/([^/]+)$/u);
    if (request.method === "GET" && roomMediaMatch?.[1] && roomMediaMatch?.[2]) {
      const chatId = decodeURIComponent(roomMediaMatch[1]);
      const assetId = decodeURIComponent(roomMediaMatch[2]);
      const asset = state.assetStore.getAssetById(chatId, assetId);
      if (!asset) {
        return Response.json({ error: "asset not found" }, { status: 404 });
      }
      return new Response(Bun.file(state.assetStore.resolveAbsolutePath(asset.relativePath)), {
        headers: {
          "content-type": asset.mimeType,
        },
      });
    }

    return Response.json({ error: "not found" }, { status: 404 });
  },
});

console.log(`review harness listening at http://${server.hostname}:${server.port}`);
console.log(`room websocket: ${state.room.transportUrl ?? `ws://${DEFAULT_HOST}:${WS_PORT}/room/${state.room.chatId}`}`);
for (const seat of state.seats) {
  console.log(`seat ${seat.name}: actor=${seat.actorId} token=${seat.token}`);
}
