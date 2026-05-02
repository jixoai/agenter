import { Database } from "bun:sqlite";
import {
  decryptPrivateKeyAtRest,
  encryptPrivateKeyAtRest,
  generatePrincipalKeyPair,
  normalizePrincipalId,
  type EncryptedPrivateKeyRecord,
} from "@agenter/principal-crypto";
import type {
  CreateManagedPrincipalInput,
  IconAssetRecord,
  IconOwnerKind,
  ListManagedPrincipalsInput,
	ManagedPrincipalRecord,
	ProfileIdentifier,
	ProfileMetadata,
	ProfileProjection,
	PrincipalProjection,
	UpdateManagedPrincipalMetadataInput,
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
  backed_up: number | boolean;
  created_at: string;
  updated_at: string;
}

interface SessionSeedRow {
  session_id: string;
  workspace_path: string;
  label: string | null;
}

interface PrincipalRegistryRow {
  principal_id: string;
  kind: string;
  algorithm: string;
  public_key: string;
  owner_key: string | null;
  metadata_json: string;
  encrypted_private_key_json: string | null;
  created_at: string;
  updated_at: string;
}

type SqliteValue = string | number | bigint | boolean | Uint8Array | null;
type SqliteParams = Record<string, SqliteValue>;

const nowIso = (): string => new Date().toISOString();

const parseJson = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const asByteArray = (value: Uint8Array | null | undefined): Uint8Array => (value instanceof Uint8Array ? value : new Uint8Array());

const parseMetadata = (row: ProfileRow): ProfileMetadata => ({
  nickname: row.nickname ?? undefined,
  displayName: row.display_name ?? undefined,
  phone: row.phone ?? undefined,
  address: row.address ?? undefined,
  extra: parseJson(row.metadata_json, {}),
});

export class ProfileStore {
  constructor(
    private readonly connection: Database,
    private readonly publicBaseUrl: string,
    private readonly managedPrincipalSecret: string,
  ) {}

  async initialize(): Promise<void> {
    this.connection.exec(PROFILE_SERVICE_SCHEMA_SQL);
  }

  private readRows<T extends object>(sql: string, values?: SqliteParams): T[] {
    return values ? (this.connection.query(sql).all(values) as T[]) : (this.connection.query(sql).all() as T[]);
  }

  private readRow<T extends object>(sql: string, values?: SqliteParams): T | null {
    return values ? ((this.connection.query(sql).get(values) as T | null) ?? null) : ((this.connection.query(sql).get() as T | null) ?? null);
  }

  private run(sql: string, values?: SqliteParams): void {
    if (values) {
      this.connection.query(sql).run(values);
      return;
    }
    this.connection.query(sql).run();
  }

  private getProfileRow(profileId: string): ProfileRow | null {
    return this.readRow<ProfileRow>(
      `select profile_id, nickname, display_name, phone, address, metadata_json
       from profile
       where profile_id = $profileId
       limit 1`,
      { profileId },
    );
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
    const rows = this.readRows<ProfileRow>(
      `select profile_id, nickname, display_name, phone, address, metadata_json
       from profile
       order by updated_at desc`,
    );
    return await Promise.all(rows.map((row) => this.toProjection(row)));
  }

  async listIdentifiers(profileId: string): Promise<ProfileIdentifier[]> {
    const rows = this.readRows<{ kind: string; value: string }>(
      `select kind, value
       from profile_identifier
       where profile_id = $profileId
       order by created_at asc`,
      { profileId },
    );
    return rows.map((row) =>
      normalizeIdentifier({
        kind: row.kind as ProfileIdentifier["kind"],
        value: row.value,
      }),
    );
  }

  async getProfileById(profileId: string): Promise<ProfileProjection | null> {
    const row = this.getProfileRow(profileId);
    return row ? await this.toProjection(row) : null;
  }

  async resolveProfile(identifier: ProfileIdentifier): Promise<ProfileProjection> {
    const normalized = normalizeIdentifier(identifier);
    const identifierKey = toIdentifierKey(normalized);
    const row = this.readRow<ProfileRow>(
      `select p.profile_id, p.nickname, p.display_name, p.phone, p.address, p.metadata_json
       from profile_identifier i
       join profile p on p.profile_id = i.profile_id
       where i.identifier_key = $identifierKey
       limit 1`,
      { identifierKey },
    );
    if (!row) {
      return {
        profileId: null,
        identifiers: [normalized],
        metadata: {},
        isVirtual: true,
        iconUrl: `${this.publicBaseUrl}${buildProfileIconUrl(identifierKey)}`,
      };
    }
    return await this.toProjection(row);
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
    this.run(
      `insert into profile(profile_id, nickname, display_name, phone, address, metadata_json, created_at, updated_at)
       values ($profileId, $nickname, $displayName, null, null, $metadataJson, $createdAt, $createdAt)`,
      {
        profileId,
        nickname: normalized.value.slice(0, 48),
        displayName: normalized.value.slice(0, 48),
        metadataJson: "{}",
        createdAt,
      },
    );
    this.run(
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
    const existing = this.readRow<{ profile_id: string }>(
      `select profile_id
       from profile_identifier
       where identifier_key = $identifierKey
       limit 1`,
      { identifierKey },
    );
    const existingProfileId = existing?.profile_id ?? null;
    if (existingProfileId && existingProfileId !== profileId) {
      throw new Error(`identifier already bound: ${identifierKey}`);
    }
    if (!existingProfileId) {
      this.run(
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
    this.run(
      `update profile
       set nickname = $nickname,
           display_name = $displayName,
           phone = $phone,
           address = $address,
           metadata_json = $metadataJson,
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
    this.run(
      `insert or replace into icon_asset(owner_kind, owner_key, mime_type, asset_bytes, updated_at)
       values ($ownerKind, $ownerKey, $mimeType, $assetBytes, $updatedAt)`,
      {
        ownerKind: record.ownerKind,
        ownerKey: record.ownerKey,
        mimeType: record.mimeType,
        assetBytes: record.bytes,
        updatedAt: record.updatedAt,
      },
    );
  }

  async putSessionSeed(input: { sessionId: string; workspacePath: string; label?: string }): Promise<void> {
    this.run(
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
    const row = this.readRow<SessionSeedRow>(
      `select session_id, workspace_path, label
       from session_seed
       where session_id = $sessionId
       limit 1`,
      { sessionId },
    );
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
    const row = this.readRow<{ mime_type: string; asset_bytes: Uint8Array | null; updated_at: string }>(
      `select mime_type, asset_bytes, updated_at
       from icon_asset
       where owner_kind = $ownerKind and owner_key = $ownerKey
       limit 1`,
      { ownerKind, ownerKey },
    );
    if (!row) {
      return null;
    }
    return {
      ownerKind,
      ownerKey,
      mimeType: row.mime_type,
      bytes: asByteArray(row.asset_bytes),
      updatedAt: row.updated_at,
    };
  }

  async createEmailChallenge(email: string, code: string, expiresAt: string): Promise<string> {
    const challengeId = crypto.randomUUID();
    this.run(
      `insert into email_challenge(challenge_id, email, code, expires_at, consumed_at, created_at)
       values ($challengeId, $email, $code, $expiresAt, null, $createdAt)`,
      { challengeId, email, code, expiresAt, createdAt: nowIso() },
    );
    return challengeId;
  }

  async consumeEmailChallenge(email: string, code: string): Promise<boolean> {
    const row = this.readRow<{ challenge_id: string }>(
      `select challenge_id
       from email_challenge
       where email = $email and code = $code and consumed_at is null and expires_at >= $now
       order by created_at desc
       limit 1`,
      { email, code, now: nowIso() },
    );
    if (!row) {
      return false;
    }
    this.run(
      `update email_challenge
       set consumed_at = $consumedAt
       where challenge_id = $challengeId`,
      { challengeId: row.challenge_id, consumedAt: nowIso() },
    );
    return true;
  }

  async createWalletChallenge(identifierKey: string, challengeText: string, expiresAt: string): Promise<string> {
    const challengeId = crypto.randomUUID();
    this.run(
      `insert into wallet_challenge(challenge_id, identifier_key, challenge_text, expires_at, consumed_at, created_at)
       values ($challengeId, $identifierKey, $challengeText, $expiresAt, null, $createdAt)`,
      { challengeId, identifierKey, challengeText, expiresAt, createdAt: nowIso() },
    );
    return challengeId;
  }

  async getWalletChallenge(challengeId: string): Promise<{ identifierKey: string; challengeText: string } | null> {
    const row = this.readRow<{ identifier_key: string; challenge_text: string }>(
      `select identifier_key, challenge_text
       from wallet_challenge
       where challenge_id = $challengeId and consumed_at is null and expires_at >= $now
       limit 1`,
      { challengeId, now: nowIso() },
    );
    return row ? { identifierKey: row.identifier_key, challengeText: row.challenge_text } : null;
  }

  async consumeWalletChallenge(challengeId: string): Promise<void> {
    this.run(
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
    this.run(
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
    const row = this.readRow<WebAuthnTicketRow>(
      `select ticket_id, profile_id, flow_kind, challenge, expires_at
       from webauthn_ticket
       where ticket_id = $ticketId and consumed_at is null and expires_at >= $now
       limit 1`,
      { ticketId, now: nowIso() },
    );
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
    this.run(
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
    this.run(
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
    this.run(
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
         $transportsJson,
         $deviceType,
         $backedUp,
         coalesce((select created_at from webauthn_credential where credential_id = $credentialId), $createdAt),
         $updatedAt
       )`,
      {
        credentialId: record.credentialId,
        profileId: record.profileId,
        publicKey: record.publicKey,
        counter: record.counter,
        transportsJson: JSON.stringify(record.transports),
        deviceType: record.deviceType,
        backedUp: record.backedUp ? 1 : 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    );
  }

  private mapWebAuthnCredential(row: WebAuthnCredentialRow): WebAuthnCredentialRecord {
    return {
      credentialId: row.credential_id,
      profileId: row.profile_id,
      publicKey: asByteArray(row.public_key),
      counter: Number(row.counter),
      transports: parseJson(row.transports_json, []),
      deviceType: row.device_type,
      backedUp: Boolean(row.backed_up),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listWebAuthnCredentials(profileId: string): Promise<WebAuthnCredentialRecord[]> {
    const rows = this.readRows<WebAuthnCredentialRow>(
      `select credential_id, profile_id, public_key, counter, transports_json, device_type, backed_up, created_at, updated_at
       from webauthn_credential
       where profile_id = $profileId
       order by created_at asc`,
      { profileId },
    );
    return rows.map((row) => this.mapWebAuthnCredential(row));
  }

  async getWebAuthnCredential(credentialId: string): Promise<WebAuthnCredentialRecord | null> {
    const row = this.readRow<WebAuthnCredentialRow>(
      `select credential_id, profile_id, public_key, counter, transports_json, device_type, backed_up, created_at, updated_at
       from webauthn_credential
       where credential_id = $credentialId
       limit 1`,
      { credentialId },
    );
    return row ? this.mapWebAuthnCredential(row) : null;
  }

  async updateWebAuthnCredentialCounter(input: {
    credentialId: string;
    counter: number;
    backedUp: boolean;
  }): Promise<void> {
    this.run(
      `update webauthn_credential
       set counter = $counter,
           backed_up = $backedUp,
           updated_at = $updatedAt
       where credential_id = $credentialId`,
      {
        credentialId: input.credentialId,
        counter: input.counter,
        backedUp: input.backedUp ? 1 : 0,
        updatedAt: nowIso(),
      },
    );
  }

  async issueAuthToken(profileId: string, ttlMs = 1000 * 60 * 60 * 24): Promise<string> {
    const token = crypto.randomUUID().replaceAll("-", "");
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    this.run(
      `insert into profile_auth_token(token, profile_id, expires_at, created_at)
       values ($token, $profileId, $expiresAt, $createdAt)`,
      { token, profileId, expiresAt, createdAt: nowIso() },
    );
    return token;
  }

  async getProfileIdForToken(token: string): Promise<string | null> {
    const row = this.readRow<TokenRow>(
      `select profile_id, expires_at
       from profile_auth_token
       where token = $token
       limit 1`,
      { token },
    );
    if (!row || row.expires_at < nowIso()) {
      return null;
    }
    return row.profile_id;
  }

  private mapPrincipalProjection(row: PrincipalRegistryRow): PrincipalProjection {
    return {
      principalId: normalizePrincipalId(row.principal_id),
      kind: row.kind as PrincipalProjection["kind"],
      algorithm: row.algorithm as PrincipalProjection["algorithm"],
      publicKey: row.public_key as PrincipalProjection["publicKey"],
      ownerKey: row.owner_key ?? undefined,
      metadata: parseJson(row.metadata_json, {}),
      hasManagedPrivateKey: row.encrypted_private_key_json !== null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapManagedPrincipal(row: PrincipalRegistryRow): ManagedPrincipalRecord {
    if (!row.encrypted_private_key_json) {
      throw new Error(`managed principal private key missing: ${row.principal_id}`);
    }
    const projection = this.mapPrincipalProjection(row);
    return {
      ...projection,
      hasManagedPrivateKey: true,
      privateKey: decryptPrivateKeyAtRest({
        record: parseJson<EncryptedPrivateKeyRecord>(row.encrypted_private_key_json, {} as EncryptedPrivateKeyRecord),
        secret: this.managedPrincipalSecret,
      }),
    };
  }

  private readPrincipalRow(principalId: string): PrincipalRegistryRow | null {
    return this.readRow<PrincipalRegistryRow>(
      `select
         principal_id,
         kind,
         algorithm,
         public_key,
         owner_key,
         metadata_json,
         encrypted_private_key_json,
         created_at,
         updated_at
       from principal_registry
       where principal_id = $principalId
       limit 1`,
      { principalId: normalizePrincipalId(principalId) },
    );
  }

  async createManagedPrincipal(input: CreateManagedPrincipalInput): Promise<ManagedPrincipalRecord> {
    const principal = generatePrincipalKeyPair();
    const encryptedPrivateKey = encryptPrivateKeyAtRest({
      privateKey: principal.privateKey,
      secret: this.managedPrincipalSecret,
    });
    const timestamp = nowIso();
    this.run(
      `insert into principal_registry(
         principal_id,
         kind,
         algorithm,
         public_key,
         owner_key,
         metadata_json,
         encrypted_private_key_json,
         created_at,
         updated_at
       )
       values (
         $principalId,
         $kind,
         $algorithm,
         $publicKey,
         $ownerKey,
         $metadataJson,
         $encryptedPrivateKeyJson,
         $createdAt,
         $updatedAt
       )`,
      {
        principalId: principal.principalId,
        kind: input.kind,
        algorithm: principal.algorithm,
        publicKey: principal.publicKey,
        ownerKey: input.ownerKey ?? null,
        metadataJson: JSON.stringify(input.metadata ?? {}),
        encryptedPrivateKeyJson: JSON.stringify(encryptedPrivateKey),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    );
    const created = await this.getManagedPrincipal(principal.principalId);
    if (!created) {
      throw new Error(`failed to read managed principal: ${principal.principalId}`);
    }
    return created;
  }

  async updateManagedPrincipalMetadata(input: UpdateManagedPrincipalMetadataInput): Promise<ManagedPrincipalRecord | null> {
    const timestamp = nowIso();
    this.run(
      `update principal_registry
       set metadata_json = $metadataJson,
           updated_at = $updatedAt
       where principal_id = $principalId`,
      {
        principalId: normalizePrincipalId(input.principalId),
        metadataJson: JSON.stringify(input.metadata),
        updatedAt: timestamp,
      },
    );
    return await this.getManagedPrincipal(input.principalId);
  }

  async getPrincipal(principalId: string): Promise<PrincipalProjection | null> {
    const row = this.readPrincipalRow(principalId);
    return row ? this.mapPrincipalProjection(row) : null;
  }

  async getManagedPrincipal(principalId: string): Promise<ManagedPrincipalRecord | null> {
    const row = this.readPrincipalRow(principalId);
    return row ? this.mapManagedPrincipal(row) : null;
  }

  async listPrincipals(input: ListManagedPrincipalsInput = {}): Promise<PrincipalProjection[]> {
    const filters: string[] = [];
    const values: SqliteParams = {};
    if (input.kind) {
      filters.push("kind = $kind");
      values.kind = input.kind;
    }
    if (typeof input.ownerKey === "string" && input.ownerKey.trim().length > 0) {
      filters.push("owner_key = $ownerKey");
      values.ownerKey = input.ownerKey.trim();
    }
    const whereClause = filters.length > 0 ? `where ${filters.join(" and ")}` : "";
    const rows = this.readRows<PrincipalRegistryRow>(
      `select
         principal_id,
         kind,
         algorithm,
         public_key,
         owner_key,
         metadata_json,
         encrypted_private_key_json,
         created_at,
         updated_at
       from principal_registry
       ${whereClause}
       order by created_at asc, principal_id asc`,
      values,
    );
    return rows.map((row) => this.mapPrincipalProjection(row));
  }
}
