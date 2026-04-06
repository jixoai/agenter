import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { toAuthId } from "../identifiers";
import type { ProfileIdentifier } from "../types";

export interface RootAuthMaterial {
  privateKey: Hex;
  identifier: ProfileIdentifier;
  authId: string;
}

const ROOT_AUTH_FILE_NAME = "root-auth.key";
const HEX_PRIVATE_KEY_PATTERN = /^0x[a-fA-F0-9]{64}$/;

const normalizeRootAuthPrivateKey = (value: string): Hex => {
  const normalized = value.trim();
  if (!HEX_PRIVATE_KEY_PATTERN.test(normalized)) {
    throw new Error("root auth private key must be a 0x-prefixed 32-byte hex string");
  }
  return normalized.toLowerCase() as Hex;
};

export const resolveRootAuthMaterial = (input: { dataDir: string; privateKey?: string }): RootAuthMaterial => {
  const filePath = join(input.dataDir, ROOT_AUTH_FILE_NAME);
  const privateKey = input.privateKey
    ? normalizeRootAuthPrivateKey(input.privateKey)
    : existsSync(filePath)
      ? normalizeRootAuthPrivateKey(readFileSync(filePath, "utf8"))
      : generatePrivateKey();

  if (!existsSync(filePath)) {
    writeFileSync(filePath, `${privateKey}\n`, { encoding: "utf8", mode: 0o600 });
  }

  const account = privateKeyToAccount(privateKey);
  const identifier: ProfileIdentifier = {
    kind: "wallet_evm",
    value: account.address,
  };
  return {
    privateKey,
    identifier,
    authId: toAuthId(identifier),
  };
};
