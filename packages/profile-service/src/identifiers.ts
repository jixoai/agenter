import type { ProfileIdentifier, ProfileIdentifierKind } from "./types";

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const normalizeEvm = (value: string): string => value.trim().toLowerCase();

const normalizeSolana = (value: string): string => value.trim();

const normalizeTemp = (value: string): string => value.trim();

export const normalizeIdentifierValue = (kind: ProfileIdentifierKind, value: string): string => {
  switch (kind) {
    case "email":
      return normalizeEmail(value);
    case "wallet_evm":
      return normalizeEvm(value);
    case "wallet_solana":
      return normalizeSolana(value);
    case "temp":
      return normalizeTemp(value);
  }
};

export const normalizeIdentifier = (input: ProfileIdentifier): ProfileIdentifier => ({
  kind: input.kind,
  value: normalizeIdentifierValue(input.kind, input.value),
});

export const toIdentifierKey = (input: ProfileIdentifier): string => {
  const normalized = normalizeIdentifier(input);
  return `${normalized.kind}:${normalized.value}`;
};

export const parseIdentifierKey = (input: string): ProfileIdentifier => {
  const separatorIndex = input.indexOf(":");
  if (separatorIndex <= 0) {
    return normalizeIdentifier({ kind: "temp", value: input });
  }
  const kind = input.slice(0, separatorIndex);
  const value = input.slice(separatorIndex + 1);
  if (kind === "email" || kind === "wallet_evm" || kind === "wallet_solana" || kind === "temp") {
    return normalizeIdentifier({ kind, value });
  }
  return normalizeIdentifier({ kind: "temp", value: input });
};

export const isDurableIdentifierKind = (kind: ProfileIdentifierKind): boolean => kind !== "temp";
