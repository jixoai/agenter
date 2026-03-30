export interface AuthSuccessPayload {
  profile: { profileId: string | null };
  token: string;
}

export const AUTH_MESSAGE_SOURCE = "agenter-profile-service";

const resolveOpenerOrigin = (): string | null => {
  const openerOrigin = new URLSearchParams(window.location.search).get("openerOrigin")?.trim();
  if (openerOrigin) {
    return openerOrigin;
  }
  if (document.referrer) {
    try {
      return new URL(document.referrer).origin;
    } catch {
      return null;
    }
  }
  return null;
};

export const publishAuthSuccess = (payload: AuthSuccessPayload): void => {
  const openerOrigin = resolveOpenerOrigin();
  if (window.opener && openerOrigin) {
    window.opener.postMessage(
      {
        source: AUTH_MESSAGE_SOURCE,
        kind: "auth-success",
        token: payload.token,
        profileId: payload.profile.profileId,
      },
      openerOrigin,
    );
  }
};

export const readSearchParam = (key: string): string => {
  const value = new URLSearchParams(window.location.search).get(key)?.trim();
  return value && value.length > 0 ? value : "";
};

export const jsonFetch = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as T;
};
