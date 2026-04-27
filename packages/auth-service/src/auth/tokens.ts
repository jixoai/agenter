export const readBearerToken = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  if (!normalized.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = normalized.slice("bearer ".length).trim();
  return token.length > 0 ? token : null;
};
