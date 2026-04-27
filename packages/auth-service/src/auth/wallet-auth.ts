import bs58 from "bs58";
import nacl from "tweetnacl";
import { recoverMessageAddress, type Hex } from "viem";
import { normalizeIdentifier, parseIdentifierKey } from "../identifiers";
import type { ProfileIdentifier } from "../types";

const textEncoder = new TextEncoder();

export interface WalletVerificationInput {
  challengeText: string;
  identifier: ProfileIdentifier;
  signature: string;
}

export const verifyWalletSignature = async (input: WalletVerificationInput): Promise<boolean> => {
  const identifier = normalizeIdentifier(input.identifier);
  if (identifier.kind === "wallet_evm") {
    const recovered = await recoverMessageAddress({
      message: input.challengeText,
      signature: input.signature as Hex,
    });
    return recovered.toLowerCase() === identifier.value.toLowerCase();
  }
  if (identifier.kind === "wallet_solana") {
    const expected = bs58.decode(identifier.value);
    const signatureBytes = input.signature.startsWith("base58:")
      ? bs58.decode(input.signature.slice("base58:".length))
      : Uint8Array.from(Buffer.from(input.signature, "base64url"));
    const messageBytes = textEncoder.encode(input.challengeText);
    return expected.length === 32 && nacl.sign.detached.verify(messageBytes, signatureBytes, expected);
  }
  return false;
};

export const parseWalletIdentifier = (identifierKey: string): ProfileIdentifier => {
  const identifier = parseIdentifierKey(identifierKey);
  if (identifier.kind !== "wallet_evm" && identifier.kind !== "wallet_solana") {
    throw new Error(`wallet identifier required: ${identifierKey}`);
  }
  return identifier;
};
