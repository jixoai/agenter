import {
  type AuthChallengeDescriptor,
  type AuthDescriptor,
  type AuthSessionProjection,
  buildProfileIconUrl,
  buildSessionIconUrl,
  type RootAuthPrivateKeyReveal,
  startProfileServiceServer,
  type ProfileMetadata,
  type ProfileProjection,
  type ProfileServiceHandle,
} from "@agenter/profile-service";

export interface ProfileServiceBridgeOptions {
  endpoint?: string;
  dataDir?: string;
  host?: string;
  port?: number;
  rootAuthPrivateKey?: string;
}

export interface ProfileServiceMedia {
  mimeType: string;
  bytes?: Uint8Array;
  svg?: string;
}

export interface EmailChallengeStartResult {
  challengeId: string;
  delivery: string;
  expiresAt: string;
}

export interface EmailChallengeVerifyResult {
  profile: ProfileProjection;
  registrationTicket: string;
  expiresAt: string;
  registrationUrl: string;
}

export interface AuthChallengeStartResult extends AuthChallengeDescriptor {}

export interface AuthChallengeVerifyResult extends AuthSessionProjection {}

export interface AuthServiceDescriptor extends AuthDescriptor {
  endpoint: string;
}

export type ProfileServiceDescriptor = AuthServiceDescriptor;
export type RootAuthPrivateKeyRevealResult = RootAuthPrivateKeyReveal;

const toOwnedArrayBuffer = (bytes: Uint8Array): ArrayBuffer => new Uint8Array(bytes).buffer;
const jsonHeaders = { "content-type": "application/json" };
const withBearerToken = (token: string | null | undefined, headers: HeadersInit = {}): HeadersInit =>
  token ? { ...headers, authorization: `Bearer ${token}` } : headers;
const withTrailingSlashTrimmed = (value: string): string => value.replace(/\/$/, "");

export class ProfileServiceBridge {
  private childHandle: ProfileServiceHandle | null = null;
  private childHandlePromise: Promise<ProfileServiceHandle> | null = null;

  constructor(private readonly options: ProfileServiceBridgeOptions = {}) {}

  protected async startChildHandle(): Promise<ProfileServiceHandle> {
    return await startProfileServiceServer({
      dataDir: this.options.dataDir,
      host: this.options.host,
      port: this.options.port ?? 0,
      rootAuthPrivateKey: this.options.rootAuthPrivateKey,
    });
  }

  private async ensureChildHandle(): Promise<ProfileServiceHandle> {
    if (this.childHandle) {
      return this.childHandle;
    }
    if (!this.childHandlePromise) {
      const launch = this.startChildHandle();
      this.childHandlePromise = launch;
      void launch.then((handle) => {
        if (this.childHandlePromise === launch) {
          this.childHandle = handle;
        }
      });
    }
    try {
      return await this.childHandlePromise;
    } finally {
      if (this.childHandlePromise) {
        this.childHandlePromise = null;
      }
    }
  }

  private async resolveBaseUrl(): Promise<string> {
    if (this.options.endpoint) {
      return this.options.endpoint.replace(/\/$/, "");
    }
    const handle = await this.ensureChildHandle();
    return `http://${handle.host}:${handle.port}`;
  }

  async stop(): Promise<void> {
    const activeHandle = this.childHandle;
    const pendingHandle = this.childHandlePromise;
    this.childHandle = null;
    this.childHandlePromise = null;
    if (activeHandle) {
      await activeHandle.stop();
      return;
    }
    if (!pendingHandle) {
      return;
    }
    const handle = await pendingHandle.catch(() => null);
    if (handle) {
      await handle.stop();
    }
  }

  async getBaseUrl(): Promise<string> {
    return await this.resolveBaseUrl();
  }

  async describe(): Promise<AuthServiceDescriptor> {
    const baseUrl = await this.resolveBaseUrl();
    const response = await fetch(`${baseUrl}/auth/descriptor`);
    if (!response.ok) {
      throw new Error(`profile-service auth descriptor failed (${response.status})`);
    }
    const descriptor = (await response.json()) as AuthDescriptor;
    const bootstrapDescriptor = this.options.endpoint
      ? {
          ...descriptor,
          rootAuthBootstrapMode: "external" as const,
          canRevealRootAuthPrivateKey: false,
          hasManagedRootAuthPrivateKey: false,
        }
      : descriptor;
    return {
      endpoint: baseUrl,
      ...bootstrapDescriptor,
    };
  }

  async revealRootAuthPrivateKey(): Promise<RootAuthPrivateKeyRevealResult> {
    if (this.options.endpoint) {
      throw new Error("managed root auth key reveal is unavailable for external auth service");
    }
    const response = await this.request("/auth/root-key/reveal", {
      method: "POST",
      headers: jsonHeaders,
    });
    if (!response.ok) {
      throw new Error(`profile-service root auth key reveal failed (${response.status})`);
    }
    return (await response.json()) as RootAuthPrivateKeyRevealResult;
  }

  private async buildAbsoluteUrl(pathname: string): Promise<string> {
    return `${withTrailingSlashTrimmed(await this.resolveBaseUrl())}${pathname}`;
  }

  async request(pathname: string, init?: RequestInit): Promise<Response> {
    const baseUrl = await this.resolveBaseUrl();
    return await fetch(`${baseUrl}${pathname}`, init);
  }

  async proxy(pathname: string, init?: RequestInit): Promise<Response> {
    return await this.request(pathname, init);
  }

  async listProfiles(): Promise<ProfileProjection[]> {
    const response = await this.request("/profiles");
    if (!response.ok) {
      throw new Error(`profile-service profile list failed (${response.status})`);
    }
    const payload = (await response.json()) as { profiles: ProfileProjection[] };
    return payload.profiles;
  }

  async getProfile(reference: string): Promise<ProfileProjection> {
    const response = await this.request(`/profiles/${encodeURIComponent(reference)}`);
    if (!response.ok) {
      throw new Error(`profile-service profile read failed (${response.status})`);
    }
    return (await response.json()) as ProfileProjection;
  }

  async updateProfile(reference: string, patch: ProfileMetadata, token: string): Promise<ProfileProjection> {
    const response = await this.request(`/profiles/${encodeURIComponent(reference)}`, {
      method: "PATCH",
      headers: withBearerToken(token, jsonHeaders),
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      throw new Error(`profile-service profile update failed (${response.status})`);
    }
    return (await response.json()) as ProfileProjection;
  }

  async startEmailChallenge(email: string): Promise<EmailChallengeStartResult> {
    const response = await this.request("/auth/email/start", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      throw new Error(`profile-service email start failed (${response.status})`);
    }
    return (await response.json()) as EmailChallengeStartResult;
  }

  async verifyEmailChallenge(email: string, code: string, token?: string): Promise<EmailChallengeVerifyResult> {
    const response = await this.request("/auth/email/verify", {
      method: "POST",
      headers: withBearerToken(token, jsonHeaders),
      body: JSON.stringify({ email, code }),
    });
    if (!response.ok) {
      throw new Error(`profile-service email verify failed (${response.status})`);
    }
    return (await response.json()) as EmailChallengeVerifyResult;
  }

  async upsertSessionSeed(input: {
    sessionId: string;
    workspacePath: string;
    label?: string;
  }): Promise<{ ok: true; iconUrl: string }> {
    const response = await this.request(`/sessions/${encodeURIComponent(input.sessionId)}/seed`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify({
        workspacePath: input.workspacePath,
        ...(input.label ? { label: input.label } : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`profile-service session seed sync failed (${response.status})`);
    }
    const payload = (await response.json()) as { ok: true; iconUrl?: string };
    return {
      ok: true,
      iconUrl: payload.iconUrl ?? (await this.buildAbsoluteUrl(buildSessionIconUrl(input.sessionId))),
    };
  }

  async readSessionIcon(input: {
    sessionId: string;
    format?: "svg" | "png" | "jpeg";
    size?: number;
  }): Promise<ProfileServiceMedia | null> {
    const params = new URLSearchParams();
    if (input.format) {
      params.set("format", input.format);
    }
    if (input.size) {
      params.set("size", String(input.size));
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    const response = await this.request(`/media/sessions/${encodeURIComponent(input.sessionId)}/icon${suffix}`);
    return response.ok ? await this.readMediaResponse(response) : null;
  }

  async uploadSessionIcon(
    sessionId: string,
    file: { bytes: Uint8Array; mimeType: string },
  ): Promise<{ ok: true; iconUrl: string }> {
    const response = await this.request(`/sessions/${encodeURIComponent(sessionId)}/icon`, {
      method: "POST",
      headers: { "content-type": file.mimeType },
      body: new Blob([toOwnedArrayBuffer(file.bytes)], { type: file.mimeType }),
    });
    if (!response.ok) {
      throw new Error(`profile-service session icon upload failed (${response.status})`);
    }
    const payload = (await response.json()) as { ok: true; iconUrl?: string };
    return {
      ok: true,
      iconUrl: payload.iconUrl ?? (await this.buildAbsoluteUrl(buildSessionIconUrl(sessionId))),
    };
  }

  async uploadProfileIcon(
    reference: string,
    file: { bytes: Uint8Array; mimeType: string },
    token: string,
  ): Promise<{ ok: true; iconUrl: string; profileId: string }> {
    const response = await this.request(`/profiles/${encodeURIComponent(reference)}/icon`, {
      method: "POST",
      headers: withBearerToken(token, { "content-type": file.mimeType }),
      body: new Blob([toOwnedArrayBuffer(file.bytes)], { type: file.mimeType }),
    });
    if (!response.ok) {
      throw new Error(`profile-service profile icon upload failed (${response.status})`);
    }
    const payload = (await response.json()) as { ok: true; iconUrl?: string; profileId: string };
    return {
      ok: true,
      profileId: payload.profileId,
      iconUrl: payload.iconUrl ?? (await this.buildAbsoluteUrl(buildProfileIconUrl(payload.profileId))),
    };
  }

  async startAuthChallenge(authId: string): Promise<AuthChallengeDescriptor> {
    const response = await this.request("/auth/challenge", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ authId }),
    });
    if (!response.ok) {
      throw new Error(`profile-service auth challenge failed (${response.status})`);
    }
    return (await response.json()) as AuthChallengeDescriptor;
  }

  async verifyAuthChallenge(input: {
    challengeId: string;
    signature: string;
    token?: string;
  }): Promise<AuthSessionProjection> {
    const response = await this.request("/auth/verify", {
      method: "POST",
      headers: withBearerToken(input.token, jsonHeaders),
      body: JSON.stringify({
        challengeId: input.challengeId,
        signature: input.signature,
      }),
    });
    if (!response.ok) {
      throw new Error(`profile-service auth verify failed (${response.status})`);
    }
    return (await response.json()) as AuthSessionProjection;
  }

  async authenticateAuthToken(token: string): Promise<AuthSessionProjection | null> {
    const response = await this.request("/auth/session", {
      headers: withBearerToken(token),
    });
    if (response.status === 401) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`profile-service auth session failed (${response.status})`);
    }
    return (await response.json()) as AuthSessionProjection;
  }

  async readProfileIcon(
    reference: string,
    options?: { format?: "svg" | "png" | "jpeg"; size?: number },
  ): Promise<ProfileServiceMedia | null> {
    const params = new URLSearchParams();
    if (options?.format) {
      params.set("format", options.format);
    }
    if (options?.size) {
      params.set("size", String(options.size));
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    const response = await this.request(`/media/profiles/${encodeURIComponent(reference)}/icon${suffix}`);
    return response.ok ? await this.readMediaResponse(response) : null;
  }

  private async readMediaResponse(response: Response): Promise<ProfileServiceMedia> {
    const mimeType = response.headers.get("content-type") ?? "application/octet-stream";
    if (mimeType.includes("image/svg+xml")) {
      return {
        mimeType,
        svg: await response.text(),
      };
    }
    return {
      mimeType,
      bytes: new Uint8Array(await response.arrayBuffer()),
    };
  }
}
