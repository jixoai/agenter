export interface AvatarIdentityPresentationInput {
  nickname?: string | null;
  displayName?: string | null;
  label?: string | null;
  avatarPrincipalId?: string | null;
  principalId?: string | null;
}

const readText = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const resolveAvatarDisplayName = (
  input: AvatarIdentityPresentationInput,
  fallback = 'Avatar',
): string => {
  return (
    readText(input.displayName) ??
    readText(input.label) ??
    readText(input.nickname) ??
    readText(input.avatarPrincipalId) ??
    readText(input.principalId) ??
    fallback
  );
};

export const resolveAvatarHandleValue = (
  input: AvatarIdentityPresentationInput,
): string | null => {
  return readText(input.avatarPrincipalId) ?? readText(input.principalId) ?? readText(input.nickname);
};

export const resolveAvatarHandle = (
  input: AvatarIdentityPresentationInput,
): string | null => {
  const handleValue = resolveAvatarHandleValue(input);
  return handleValue ? `@${handleValue}` : null;
};
