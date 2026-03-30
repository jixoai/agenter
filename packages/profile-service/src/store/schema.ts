export const PROFILE_SERVICE_SCHEMA_SQL = `
create table if not exists profile (
  profile_id varchar primary key,
  nickname varchar,
  display_name varchar,
  phone varchar,
  address varchar,
  metadata_json json not null default '{}',
  created_at varchar not null,
  updated_at varchar not null
);

create table if not exists profile_identifier (
  identifier_key varchar primary key,
  profile_id varchar not null,
  kind varchar not null,
  value varchar not null,
  created_at varchar not null
);

create table if not exists icon_asset (
  owner_kind varchar not null,
  owner_key varchar not null,
  mime_type varchar not null,
  asset_bytes blob not null,
  updated_at varchar not null,
  primary key (owner_kind, owner_key)
);

create table if not exists session_seed (
  session_id varchar primary key,
  workspace_path varchar not null,
  label varchar,
  updated_at varchar not null
);

create table if not exists email_challenge (
  challenge_id varchar primary key,
  email varchar not null,
  code varchar not null,
  expires_at varchar not null,
  consumed_at varchar,
  created_at varchar not null
);

create table if not exists wallet_challenge (
  challenge_id varchar primary key,
  identifier_key varchar not null,
  challenge_text varchar not null,
  expires_at varchar not null,
  consumed_at varchar,
  created_at varchar not null
);

create table if not exists webauthn_ticket (
  ticket_id varchar primary key,
  profile_id varchar not null,
  flow_kind varchar not null,
  challenge varchar not null,
  expires_at varchar not null,
  consumed_at varchar,
  created_at varchar not null
);

create table if not exists webauthn_credential (
  credential_id varchar primary key,
  profile_id varchar not null,
  public_key blob not null,
  counter bigint not null,
  transports_json json not null default '[]',
  device_type varchar not null,
  backed_up boolean not null,
  created_at varchar not null,
  updated_at varchar not null
);

create table if not exists profile_auth_token (
  token varchar primary key,
  profile_id varchar not null,
  expires_at varchar not null,
  created_at varchar not null
);
`;
