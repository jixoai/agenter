import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix as posixPath } from "node:path";

import type { MessageContactId, MessageAttachmentKind } from "@agenter/message-system";

import { buildSessionAssetRelativePath, resolveSessionAssetKind } from "./session-assets";
import type { ChatSessionAsset } from "./types";

export interface RoomAssetRecord {
  assetId: string;
  roomId: string;
  kind: MessageAttachmentKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  relativePath: string;
  createdAt: number;
  updatedAt: number;
  uploadedByActorId?: MessageContactId;
}

const ROOM_ASSET_INDEX_FILENAME = "index.json";
const roomPathToken = (roomId: string): string => encodeURIComponent(roomId);

const isRoomAssetKind = (value: unknown): value is MessageAttachmentKind =>
  value === "image" || value === "video" || value === "file";

const isRoomAssetRecord = (value: unknown): value is RoomAssetRecord => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<RoomAssetRecord>;
  return (
    typeof candidate.assetId === "string" &&
    typeof candidate.roomId === "string" &&
    isRoomAssetKind(candidate.kind) &&
    typeof candidate.name === "string" &&
    typeof candidate.mimeType === "string" &&
    typeof candidate.sizeBytes === "number" &&
    typeof candidate.relativePath === "string" &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.updatedAt === "number" &&
    (candidate.uploadedByActorId === undefined || typeof candidate.uploadedByActorId === "string")
  );
};

const parseRoomAssetIndex = (raw: string): RoomAssetRecord[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRoomAssetRecord) : [];
  } catch {
    return [];
  }
};

export const buildRoomAssetRelativePath = (
  roomId: string,
  assetId: string,
  name: string,
  mimeType: string,
): string => {
  return posixPath.join(
    "assets",
    "rooms",
    roomPathToken(roomId),
    buildSessionAssetRelativePath(assetId, name, mimeType),
  );
};

export const buildRoomAssetUrl = (roomId: string, assetId: string): string =>
  `/media/rooms/${encodeURIComponent(roomId)}/assets/${encodeURIComponent(assetId)}`;

export const toChatRoomAsset = (roomId: string, asset: RoomAssetRecord): ChatSessionAsset => ({
  assetId: asset.assetId,
  kind: asset.kind,
  name: asset.name,
  mimeType: asset.mimeType,
  sizeBytes: asset.sizeBytes,
  url: buildRoomAssetUrl(roomId, asset.assetId),
});

export class RoomAssetStore {
  constructor(private readonly rootDir: string) {}

  private getRoomDir(roomId: string): string {
    return join(this.rootDir, "assets", "rooms", roomPathToken(roomId));
  }

  private getIndexPath(roomId: string): string {
    return join(this.getRoomDir(roomId), ROOM_ASSET_INDEX_FILENAME);
  }

  resolveAbsolutePath(relativePath: string): string {
    return join(this.rootDir, relativePath);
  }

  private readIndex(roomId: string): RoomAssetRecord[] {
    const indexPath = this.getIndexPath(roomId);
    if (!existsSync(indexPath)) {
      return [];
    }
    return parseRoomAssetIndex(readFileSync(indexPath, "utf8"));
  }

  private writeIndex(roomId: string, records: RoomAssetRecord[]): void {
    const indexPath = this.getIndexPath(roomId);
    mkdirSync(dirname(indexPath), { recursive: true });
    writeFileSync(indexPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }

  uploadAssets(
    roomId: string,
    files: Array<{ name: string; mimeType: string; bytes: Uint8Array }>,
    input: { uploadedByActorId?: MessageContactId } = {},
  ): RoomAssetRecord[] {
    const current = this.readIndex(roomId);
    const created: RoomAssetRecord[] = [];
    for (const file of files) {
      const assetId = `asset-${randomUUID()}`;
      const createdAt = Date.now();
      const record: RoomAssetRecord = {
        assetId,
        roomId,
        kind: resolveSessionAssetKind(file.mimeType),
        name: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.bytes.byteLength,
        relativePath: buildRoomAssetRelativePath(roomId, assetId, file.name, file.mimeType),
        createdAt,
        updatedAt: createdAt,
        uploadedByActorId: input.uploadedByActorId,
      };
      const filePath = this.resolveAbsolutePath(record.relativePath);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, file.bytes);
      created.push(record);
    }
    if (created.length > 0) {
      this.writeIndex(
        roomId,
        [...current, ...created].sort((left, right) =>
          left.createdAt === right.createdAt ? left.assetId.localeCompare(right.assetId) : left.createdAt - right.createdAt,
        ),
      );
    }
    return created;
  }

  listAssets(roomId: string): RoomAssetRecord[] {
    return [...this.readIndex(roomId)].sort((left, right) =>
      left.createdAt === right.createdAt ? right.assetId.localeCompare(left.assetId) : right.createdAt - left.createdAt,
    );
  }

  listAssetsByIds(roomId: string, assetIds: string[]): RoomAssetRecord[] {
    if (assetIds.length === 0) {
      return [];
    }
    const byId = new Map(this.readIndex(roomId).map((asset) => [asset.assetId, asset]));
    return assetIds.flatMap((assetId) => {
      const asset = byId.get(assetId);
      return asset ? [asset] : [];
    });
  }

  getAssetById(roomId: string, assetId: string): RoomAssetRecord | null {
    return this.readIndex(roomId).find((asset) => asset.assetId === assetId) ?? null;
  }
}
