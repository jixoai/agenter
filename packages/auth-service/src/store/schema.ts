export const PROFILE_SERVICE_SCHEMA_SQL = `
create table if not exists profile (
  profile_id text primary key,
  nickname text,
  display_name text,
  phone text,
  address text,
  metadata_json text not null default '{}',
  created_at text not null,
  updated_at text not null
);

create table if not exists profile_identifier (
  identifier_key text primary key,
  profile_id text not null,
  kind text not null,
  value text not null,
  created_at text not null
);

create table if not exists icon_asset (
  owner_kind text not null,
  owner_key text not null,
  mime_type text not null,
  asset_bytes blob not null,
  updated_at text not null,
  primary key (owner_kind, owner_key)
);

create table if not exists principal_registry (
  principal_id text primary key,
  kind text not null,
  algorithm text not null,
  public_key text not null,
  owner_key text,
  metadata_json text not null default '{}',
  encrypted_private_key_json text,
  created_at text not null,
  updated_at text not null
);

create table if not exists session_seed (
  session_id text primary key,
  workspace_path text not null,
  label text,
  updated_at text not null
);

create table if not exists email_challenge (
  challenge_id text primary key,
  email text not null,
  code text not null,
  expires_at text not null,
  consumed_at text,
  created_at text not null
);

create table if not exists wallet_challenge (
  challenge_id text primary key,
  identifier_key text not null,
  challenge_text text not null,
  expires_at text not null,
  consumed_at text,
  created_at text not null
);

create table if not exists webauthn_ticket (
  ticket_id text primary key,
  profile_id text not null,
  flow_kind text not null,
  challenge text not null,
  expires_at text not null,
  consumed_at text,
  created_at text not null
);

create table if not exists webauthn_credential (
  credential_id text primary key,
  profile_id text not null,
  public_key blob not null,
  counter integer not null,
  transports_json text not null default '[]',
  device_type text not null,
  backed_up integer not null,
  created_at text not null,
  updated_at text not null
);

create table if not exists profile_auth_token (
  token text primary key,
  profile_id text not null,
  expires_at text not null,
  created_at text not null
);
`;
