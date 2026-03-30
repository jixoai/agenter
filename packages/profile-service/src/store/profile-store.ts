import { blobValue, type DuckDBConnection } from "@duckdb/node-api";
import type {
  IconAssetRecord,
  IconOwnerKind,
  ProfileIdentifier,
  ProfileMetadata,
  ProfileProjection,
  WebAuthnCredentialRecord,
  WebAuthnFlowKind,
  WebAuthnTicketRecord,
} from "../types";
import { isDurableIdentifierKind, normalizeIdentifier, toIdentifierKey } from "../identifiers";
import { buildProfileIconUrl } from "../render/fallback-icons";
import { PROFILE_SERVICE_SCHEMA_SQL } from "./schema";

interface ProfileRow {
  profile_id: string;
  nickname: string | null;
  display_name: string | null;
  phone: string | null;
  address: string | null;
  metadata_json: string;
}

interface TokenRow {
  profile_id: string;
  expires_at: string;
}

interface WebAuthnTicketRow {
  ticket_id: string;
  profile_id: string;
  flow_kind: string;
  challenge: string;
  expires_at: string;
}

interface WebAuthnCredentialRow {
  credential_id: string;
  profile_id: string;
  public_key: Uint8Array | null;
  counter: number;
  transports_json: string;
  device_type: string;
  backed_up: boolean;
  created_at: string;
  updated_at: string;
}

interface SessionSeedRow {
  session_id: string;
  workspace_path: string;
  label: string | null;
}

const nowIso = (): string => new Date().toISOString();

const asRows = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : [];

const parseMetadata = (row: ProfileRow): ProfileMetadata => {
  const extra = JSON.parse(row.metadata_json) as Record<string, unknown>;
  return {
    nickname: row.nickname ?? undefined,
    displayName: row.display_name ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    extra,
  };
};

export class ProfileStore {
  constructor(private readonly connection: DuckDBConnection, private readonly publicBaseUrl: string) {}

  async initialize(): Promise<void> {
    await this.connection.run(PROFILE_SERVICE_SCHEMA_SQL);
  }

  private async readRows(sql: string, values?: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
    const reader = await this.connection.runAndReadAll(sql, values as Record<string, never> | undefined);
    return asRows(reader.getRowObjectsJS());
  }

  private async getProfileRow(profileId: string): Promise<ProfileRow | null> {
    const rows = await this.readRows(
      `select profile_id, nickname, display_name, phone, address, cast(metadata_json as varchar) as metadata_json
       from profile
       where profile_id = $profileId
       limit 1`,
      { profileId },
    );
    const row = rows[0];
    return row ? (row as unknown as ProfileRow) : null;
  }

  private async toProjection(profileRow: ProfileRow): Promise<ProfileProjection> {
    const identifiers = await this.listIdentifiers(profileRow.profile_id);
    return {
      profileId: profileRow.profile_id,
      identifiers,
      metadata: parseMetadata(profileRow),
      isVirtual: false,
      iconUrl: `${this.publicBaseUrl}${buildProfileIconUrl(profileRow.profile_id)}`,
    };
  }

  async listProfiles(): Promise<ProfileProjection[]> {
    const rows = await this.readRows(
      `select profile_id, nickname, display_name, phone, address, cast(metadata_json as varchar) as metadata_json
       from profile
       order by updated_at desc`,
    );
    return await Promise.all(rows.map((row) => this.toProjection(row as unknown as ProfileRow)));
  }

  async listIdentifiers(profileId: string): Promise<ProfileIdentifier[]> {
    const rows = await this.readRows(
      `select kind, value
       from profile_identifier
       where profile_id = $profileId
       order by created_at asc`,
      { profileId },
    );
    return rows.map((row) =>
      normalizeIdentifier({
        kind: String(row.kind) as ProfileIdentifier["kind"],
        value: String(row.value),
      }),
    );
  }

  async getProfileById(profileId: string): Promise<ProfileProjection | null> {
    const row = await this.getProfileRow(profileId);
    return row ? await this.toProjection(row) : null;
  }

  async resolveProfile(identifier: ProfileIdentifier): Promise<ProfileProjection> {
    const normalized = normalizeIdentifier(identifier);
    const identifierKey = toIdentifierKey(normalized);
    const rows = await this.readRows(
      `select p.profile_id, p.nickname, p.display_name, p.phone, p.address, cast(p.metadata_json as varchar) as metadata_json
       from profile_identifier i
       join profile p on p.profile_id = i.profile_id
       where i.identifier_key = $identifierKey
       limit 1`,
      { identifierKey },
    );
    const row = rows[0];
    if (!row) {
      return {
        profileId: null,
        identifiers: [normalized],
        metadata: {},
        isVirtual: true,
        iconUrl: `${this.publicBaseUrl}${buildProfileIconUrl(identifierKey)}`,
      };
    }
    return await this.toProjection(row as unknown as ProfileRow);
  }

  async createOrBindProfile(identifier: ProfileIdentifier): Promise<ProfileProjection> {
    const normalized = normalizeIdentifier(identifier);
    if (!isDurableIdentifierKind(normalized.kind)) {
      return await this.resolveProfile(normalized);
    }
    const existing = await this.resolveProfile(normalized);
    if (existing.profileId) {
      return existing;
    }
    const profileId = crypto.randomUUID();
    const createdAt = nowIso();
    await this.connection.run(
      `insert into profile(profile_id, nickname, display_name, phone, address, metadata_json, created_at, updated_at)
       values ($profileId, $nickname, $displayName, null, null, json('{}'), $createdAt, $createdAt)`,
      {
        profileId,
        nickname: normalized.value.slice(0, 48),
        displayName: normalized.value.slice(0, 48),
        createdAt,
      },
    );
    await this.connection.run(
      `insert into profile_identifier(identifier_key, profile_id, kind, value, created_at)
       values ($identifierKey, $profileId, $kind, $value, $createdAt)`,
      {
        identifierKey: toIdentifierKey(normalized),
        profileId,
        kind: normalized.kind,
        value: normalized.value,
        createdAt,
      },
    );
    const projection = await this.getProfileById(profileId);
    if (!projection) {
      throw new Error(`failed to read created profile: ${profileId}`);
    }
    return projection;
  }

  async linkIdentifier(profileId: string, identifier: ProfileIdentifier): Promise<ProfileProjection> {
    const normalized = normalizeIdentifier(identifier);
    const identifierKey = toIdentifierKey(normalized);
    const existingRows = await this.readRows(
      `select profile_id
       from profile_identifier
       where identifier_key = $identifierKey
       limit 1`,
      { identifierKey },
    );
    const existingProfileId = existingRows[0] ? String(existingRows[0].profile_id) : null;
    if (existingProfileId && existingProfileId !== profileId) {
      throw new Error(`identifier already bound: ${identifierKey}`);
    }
    if (!existingProfileId) {
      await this.connection.run(
        `insert into profile_identifier(identifier_key, profile_id, kind, value, created_at)
         values ($identifierKey, $profileId, $kind, $value, $createdAt)`,
        {
          identifierKey,
          profileId,
          kind: normalized.kind,
          value: normalized.value,
          createdAt: nowIso(),
        },
      );
    }
    const projection = await this.getProfileById(profileId);
    if (!projection) {
      throw new Error(`profile not found: ${profileId}`);
    }
    return projection;
  }

  async updateProfileMetadata(profileId: string, metadata: ProfileMetadata): Promise<void> {
    await this.connection.run(
      `update profile
       set nickname = $nickname,
           display_name = $displayName,
           phone = $phone,
           address = $address,
           metadata_json = json($metadataJson),
           updated_at = $updatedAt
       where profile_id = $profileId`,
      {
        profileId,
        nickname: metadata.nickname ?? null,
        displayName: metadata.displayName ?? null,
        phone: metadata.phone ?? null,
        address: metadata.address ?? null,
        metadataJson: JSON.stringify(metadata.extra ?? {}),
        updatedAt: nowIso(),
      },
    );
  }

  async putIconAsset(record: IconAssetRecord): Promise<void> {
    await this.connection.run(
      `insert or replace into icon_asset(owner_kind, owner_key, mime_type, asset_bytes, updated_at)
       values ($ownerKind, $ownerKey, $mimeType, $assetBytes, $updatedAt)`,
      {
        ownerKind: record.ownerKind,
        ownerKey: record.ownerKey,
        mimeType: record.mimeType,
        assetBytes: blobValue(record.bytes),
        updatedAt: record.updatedAt,
      },
    );
  }

  async putSessionSeed(input: { sessionId: string; workspacePath: string; label?: string }): Promise<void> {
    await this.connection.run(
      `insert or replace into session_seed(session_id, workspace_path, label, updated_at)
       values ($sessionId, $workspacePath, $label, $updatedAt)`,
      {
        sessionId: input.sessionId,
        workspacePath: input.workspacePath,
        label: input.label ?? null,
        updatedAt: nowIso(),
      },
    );
  }

  async getSessionSeed(sessionId: string): Promise<{ sessionId: string; workspacePath: string; label?: string } | null> {
    const rows = await this.readRows(
      `select session_id, workspace_path, label
       from session_seed
       where session_id = $sessionId
       limit 1`,
      { sessionId },
    );
    const row = rows[0] as unknown as SessionSeedRow | undefined;
    if (!row) {
      return null;
    }
    return {
      sessionId: row.session_id,
      workspacePath: row.workspace_path,
      label: row.label ?? undefined,
    };
  }

  async getIconAsset(ownerKind: IconOwnerKind, ownerKey: string): Promise<IconAssetRecord | null> {
    const rows = await this.readRows(
      `select mime_type, asset_bytes, updated_at
       from icon_asset
       where owner_kind = $ownerKind and owner_key = $ownerKey
       limit 1`,
      { ownerKind, ownerKey },
    );
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      ownerKind,
      ownerKey,
      mimeType: String(row.mime_type),
      bytes: row.asset_bytes instanceof Uint8Array ? row.asset_bytes : new Uint8Array(),
      updatedAt: String(row.updated_at),
    };
  }

  async createEmailChallenge(email: string, code: string, expiresAt: string): Promise<string> {
    const challengeId = crypto.randomUUID();
    await this.connection.run(
      `insert into email_challenge(challenge_id, email, code, expires_at, consumed_at, created_at)
       values ($challengeId, $email, $code, $expiresAt, null, $createdAt)`,
      { challengeId, email, code, expiresAt, createdAt: nowIso() },
    );
    return challengeId;
  }

  async consumeEmailChallenge(email: string, code: string): Promise<boolean> {
    const rows = await this.readRows(
      `select challenge_id
       from email_challenge
       where email = $email and code = $code and consumed_at is null and expires_at >= $now
       order by created_at desc
       limit 1`,
      { email, code, now: nowIso() },
    );
    const row = rows[0];
    if (!row) {
      return false;
    }
    await this.connection.run(
      `update email_challenge
       set consumed_at = $consumedAt
       where challenge_id = $challengeId`,
      { challengeId: String(row.challenge_id), consumedAt: nowIso() },
    );
    return true;
  }

  async createWalletChallenge(identifierKey: string, challengeText: string, expiresAt: string): Promise<string> {
    const challengeId = crypto.randomUUID();
    await this.connection.run(
      `insert into wallet_challenge(challenge_id, identifier_key, challenge_text, expires_at, consumed_at, created_at)
       values ($challengeId, $identifierKey, $challengeText, $expiresAt, null, $createdAt)`,
      { challengeId, identifierKey, challengeText, expiresAt, createdAt: nowIso() },
    );
    return challengeId;
  }

  async getWalletChallenge(challengeId: string): Promise<{ identifierKey: string; challengeText: string } | null> {
    const rows = await this.readRows(
      `select identifier_key, challenge_text
       from wallet_challenge
       where challenge_id = $challengeId and consumed_at is null and expires_at >= $now
       limit 1`,
      { challengeId, now: nowIso() },
    );
    const row = rows[0];
    return row ? { identifierKey: String(row.identifier_key), challengeText: String(row.challenge_text) } : null;
  }

  async consumeWalletChallenge(challengeId: string): Promise<void> {
    await this.connection.run(
      `update wallet_challenge
       set consumed_at = $consumedAt
       where challenge_id = $challengeId`,
      {
        challengeId,
        consumedAt: nowIso(),
      },
    );
  }

  async createWebAuthnTicket(
    profileId: string,
    flowKind: WebAuthnFlowKind,
    challenge: string,
    expiresAt: string,
  ): Promise<string> {
    const ticketId = crypto.randomUUID();
    await this.connection.run(
      `insert into webauthn_ticket(ticket_id, profile_id, flow_kind, challenge, expires_at, consumed_at, created_at)
       values ($ticketId, $profileId, $flowKind, $challenge, $expiresAt, null, $createdAt)`,
      {
        ticketId,
        profileId,
        flowKind,
        challenge,
        expiresAt,
        createdAt: nowIso(),
      },
    );
    return ticketId;
  }

  async getWebAuthnTicket(ticketId: string): Promise<WebAuthnTicketRecord | null> {
    const rows = await this.readRows(
      `select ticket_id, profile_id, flow_kind, challenge, expires_at
       from webauthn_ticket
       where ticket_id = $ticketId and consumed_at is null and expires_at >= $now
       limit 1`,
      { ticketId, now: nowIso() },
    );
    const row = rows[0] as unknown as WebAuthnTicketRow | undefined;
    return row
      ? {
          ticketId: row.ticket_id,
          profileId: row.profile_id,
          flowKind: row.flow_kind as WebAuthnFlowKind,
          challenge: row.challenge,
          expiresAt: row.expires_at,
        }
      : null;
  }

  async updateWebAuthnTicketChallenge(ticketId: string, challenge: string, expiresAt: string): Promise<void> {
    await this.connection.run(
      `update webauthn_ticket
       set challenge = $challenge,
           expires_at = $expiresAt
       where ticket_id = $ticketId and consumed_at is null`,
      {
        ticketId,
        challenge,
        expiresAt,
      },
    );
  }

  async consumeWebAuthnTicket(ticketId: string): Promise<void> {
    await this.connection.run(
      `update webauthn_ticket
       set consumed_at = $consumedAt
       where ticket_id = $ticketId`,
      {
        ticketId,
        consumedAt: nowIso(),
      },
    );
  }

  async putWebAuthnCredential(record: Omit<WebAuthnCredentialRecord, "createdAt" | "updatedAt">): Promise<void> {
    const timestamp = nowIso();
    await this.connection.run(
      `insert or replace into webauthn_credential(
         credential_id,
         profile_id,
         public_key,
         counter,
         transports_json,
         device_type,
         backed_up,
         created_at,
         updated_at
       )
       values (
         $credentialId,
         $profileId,
         $publicKey,
         $counter,
         json($transportsJson),
         $deviceType,
         $backedUp,
         coalesce((select created_at from webauthn_credential where credential_id = $credentialId), $createdAt),
         $updatedAt
       )`,
      {
        credentialId: record.credentialId,
        profileId: record.profileId,
        publicKey: blobValue(record.publicKey),
        counter: record.counter,
        transportsJson: JSON.stringify(record.transports),
        deviceType: record.deviceType,
        backedUp: record.backedUp,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    );
  }

  private mapWebAuthnCredential(row: WebAuthnCredentialRow): WebAuthnCredentialRecord {
    return {
      credentialId: row.credential_id,
      profileId: row.profile_id,
      publicKey: row.public_key instanceof Uint8Array ? row.public_key : new Uint8Array(),
      counter: Number(row.counter),
      transports: JSON.parse(row.transports_json) as string[],
      deviceType: row.device_type,
      backedUp: Boolean(row.backed_up),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listWebAuthnCredentials(profileId: string): Promise<WebAuthnCredentialRecord[]> {
    const rows = await this.readRows(
      `select credential_id, profile_id, public_key, counter, cast(transports_json as varchar) as transports_json, device_type, backed_up, created_at, updated_at
       from webauthn_credential
       where profile_id = $profileId
       order by created_at asc`,
      { profileId },
    );
    return rows.map((row) => this.mapWebAuthnCredential(row as unknown as WebAuthnCredentialRow));
  }

  async getWebAuthnCredential(credentialId: string): Promise<WebAuthnCredentialRecord | null> {
    const rows = await this.readRows(
      `select credential_id, profile_id, public_key, counter, cast(transports_json as varchar) as transports_json, device_type, backed_up, created_at, updated_at
       from webauthn_credential
       where credential_id = $credentialId
       limit 1`,
      { credentialId },
    );
    const row = rows[0] as unknown as WebAuthnCredentialRow | undefined;
    return row ? this.mapWebAuthnCredential(row) : null;
  }

  async updateWebAuthnCredentialCounter(input: {
    credentialId: string;
    counter: number;
    backedUp: boolean;
  }): Promise<void> {
    await this.connection.run(
      `update webauthn_credential
       set counter = $counter,
           backed_up = $backedUp,
           updated_at = $updatedAt
       where credential_id = $credentialId`,
      {
        credentialId: input.credentialId,
        counter: input.counter,
        backedUp: input.backedUp,
        updatedAt: nowIso(),
      },
    );
  }

  async issueAuthToken(profileId: string, ttlMs = 1000 * 60 * 60 * 24): Promise<string> {
    const token = crypto.randomUUID().replaceAll("-", "");
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    await this.connection.run(
      `insert into profile_auth_token(token, profile_id, expires_at, created_at)
       values ($token, $profileId, $expiresAt, $createdAt)`,
      { token, profileId, expiresAt, createdAt: nowIso() },
    );
    return token;
  }

  async getProfileIdForToken(token: string): Promise<string | null> {
    const rows = await this.readRows(
      `select profile_id, expires_at
       from profile_auth_token
       where token = $token
       limit 1`,
      { token },
    );
    const row = rows[0] as unknown as TokenRow | undefined;
    if (!row || row.expires_at < nowIso()) {
      return null;
    }
    return row.profile_id;
  }
}
