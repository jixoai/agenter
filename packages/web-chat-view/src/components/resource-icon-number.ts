export type ResourceIconNumber = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "*";

const RESOURCE_ICON_NUMBER_PATTERN = /(\d+)(?=\D*$)/u;
const RESOURCE_ICON_EXTENSION_PATTERN = /\.([a-z0-9]{1,12})(?:[?#].*)?$/iu;

const normalizeSingleDigit = (value: number): ResourceIconNumber => {
  if (Number.isInteger(value) && value >= 1 && value <= 9) {
    return String(value) as ResourceIconNumber;
  }
  return "*";
};

export const normalizeResourceIconNumber = (
  value: string | number | null | undefined,
): ResourceIconNumber => {
  if (typeof value === "number") {
    return normalizeSingleDigit(value);
  }
  const source = value?.trim();
  if (!source) {
    return "*";
  }
  if (/^[1-9]$/u.test(source)) {
    return source as ResourceIconNumber;
  }
  const numericLabel = RESOURCE_ICON_NUMBER_PATTERN.exec(source)?.[1];
  if (!numericLabel) {
    return "*";
  }
  return normalizeSingleDigit(Number(numericLabel));
};

const resolveCandidateResourceIconNumber = (
  value: string | number | null | undefined,
): ResourceIconNumber | null => {
  if (typeof value === "number") {
    return normalizeSingleDigit(value);
  }
  const source = value?.trim();
  if (!source) {
    return null;
  }
  if (/^[1-9]$/u.test(source)) {
    return source as ResourceIconNumber;
  }
  const numericLabel = RESOURCE_ICON_NUMBER_PATTERN.exec(source)?.[1];
  if (!numericLabel) {
    return null;
  }
  return normalizeSingleDigit(Number(numericLabel));
};

export const resolveResourceIconNumber = (resource: {
  label?: string;
  tokenText?: string;
  id?: string;
}): ResourceIconNumber =>
  resolveCandidateResourceIconNumber(resource.label) ??
  resolveCandidateResourceIconNumber(resource.tokenText) ??
  resolveCandidateResourceIconNumber(resource.id) ??
  "*";

export const normalizeResourceIconExtension = (
  extension: string | null | undefined,
  fileName?: string | null | undefined,
): string => {
  const explicit = extension?.trim();
  const inferred = fileName?.trim().match(RESOURCE_ICON_EXTENSION_PATTERN)?.[1];
  const source = explicit || inferred || "FILE";
  return source.replace(/^[.]+/u, "").replace(/[^a-z0-9]+/giu, "").toUpperCase() || "FILE";
};

export const getResourceIconExtensionScale = (extension: string): number => {
  if (extension.length <= 4) {
    return 1;
  }
  return Math.max(0.54, 4 / extension.length);
};
