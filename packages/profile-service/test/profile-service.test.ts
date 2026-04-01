import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { startProfileServiceServer } from "../src/server/start-server";

interface TestHandle {
  stop: () => Promise<void>;
}

const handles: TestHandle[] = [];

const EXPECTED_PROFILE_FALLBACK_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none"><defs><radialGradient id="bg" cx="27%" cy="46%" r="76%"><stop offset="0%" stop-color="#e0ebab" /><stop offset="100%" stop-color="#a3b83b" /></radialGradient><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="86" /><feComponentTransfer><feFuncA type="table" tableValues="0 0.12" /></feComponentTransfer></filter></defs><rect width="96" height="96" rx="48" fill="url(#bg)" /><circle cx="48" cy="34" r="17" fill="white" fill-opacity="0.18" /><path d="M20 76c2-14 13-24 28-24s26 10 28 24" stroke="white" stroke-opacity="0.24" stroke-width="10" stroke-linecap="round" /><rect width="96" height="96" rx="48" filter="url(#grain)" opacity="0.28" /><text x="48" y="50" text-anchor="middle" dominant-baseline="middle" font-family="ui-sans-serif, 'IBM Plex Sans', sans-serif" font-size="34" font-weight="700" fill="white">D</text></svg>`;

const EXPECTED_SESSION_FALLBACK_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none"><defs><radialGradient id="bg" cx="39%" cy="58%" r="58%"><stop offset="0%" stop-color="#c2f2b8" /><stop offset="48%" stop-color="#86e5f1" /><stop offset="100%" stop-color="#3c862d" /></radialGradient><radialGradient id="fg" cx="50%" cy="42%" r="58%"><stop offset="0%" stop-color="#c0f6bd" stop-opacity="0.98" /><stop offset="100%" stop-color="#368532" stop-opacity="0.9" /></radialGradient><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed="938" /><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncA type="table" tableValues="0 0.18" /></feComponentTransfer></filter></defs><rect width="96" height="96" rx="26" fill="url(#bg)" /><circle cx="79%" cy="32%" r="19" fill="#89e8f6" fill-opacity="0.42" /><rect x="0" y="0" width="96" height="96" rx="26" filter="url(#noise)" opacity="0.34" /><path d="M18 70c0-12 10-22 22-22h16c12 0 22 10 22 22v8H18z" fill="url(#fg)" fill-opacity="0.88" /><circle cx="48" cy="35" r="18" fill="url(#fg)" /><text x="48" y="55" text-anchor="middle" dominant-baseline="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="42" font-weight="700" fill="white">42</text></svg>`;

const ROOT_AUTH_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f094538c5f1b6f6db1d4c4a2a2d5f6b7c8d9e0f1";

const startServer = async (
  port: number,
  emailCodes = new Map<string, string>(),
  options: {
    rootAuthPrivateKey?: string;
  } = {},
) => {
  const handle = await startProfileServiceServer({
    dataDir: mkdtempSync(join(tmpdir(), "profile-service-test-")),
    onEmailChallengeIssued: async (event) => {
      emailCodes.set(event.email, event.code);
    },
    port,
    rootAuthPrivateKey: options.rootAuthPrivateKey,
  });
  handles.push(handle);
  return { emailCodes, handle };
};

afterEach(async () => {
  while (handles.length > 0) {
    await handles.pop()?.stop();
  }
});

describe("Feature: profile-service control plane", () => {
  test("Scenario: Given the service boots When health is requested Then it reports ok", async () => {
    const { handle } = await startServer(4599);
    const response = await fetch(`http://${handle.host}:${handle.port}/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  test("Scenario: Given auth service startup When the descriptor is requested Then wallet challenge JWT mode and root identity are exposed", async () => {
    const { handle } = await startServer(4598, new Map(), {
      rootAuthPrivateKey: ROOT_AUTH_PRIVATE_KEY,
    });
    const response = await fetch(`http://${handle.host}:${handle.port}/auth/descriptor`);
    expect(response.status).toBe(200);
    const descriptor = (await response.json()) as {
      authMode: string;
      rootAuthId: string;
      rootIdentifier: {
        kind: string;
        value: string;
      };
      rootAuthKeyPath: string;
      rootAuthBootstrapMode: string;
      canRevealRootAuthPrivateKey: boolean;
      hasManagedRootAuthPrivateKey: boolean;
    };
    expect(descriptor).toMatchObject({
      authMode: "wallet_challenge_jwt",
      rootAuthId: `wallet_evm:${privateKeyToAccount(ROOT_AUTH_PRIVATE_KEY).address.toLowerCase()}`,
      rootIdentifier: {
        kind: "wallet_evm",
        value: privateKeyToAccount(ROOT_AUTH_PRIVATE_KEY).address.toLowerCase(),
      },
      rootAuthBootstrapMode: "managed_local",
      canRevealRootAuthPrivateKey: true,
      hasManagedRootAuthPrivateKey: true,
    });
    expect(descriptor.rootAuthKeyPath.endsWith("/root-auth.key")).toBeTrue();
  });

  test("Scenario: Given a managed local root auth key When the reveal endpoint is requested Then the exact private key and auth identity are returned", async () => {
    const { handle } = await startServer(4606, new Map(), {
      rootAuthPrivateKey: ROOT_AUTH_PRIVATE_KEY,
    });
    const response = await fetch(`http://${handle.host}:${handle.port}/auth/root-key/reveal`, {
      method: "POST",
    });
    expect(response.status).toBe(200);
    const revealed = (await response.json()) as {
      privateKey: string;
      authId: string;
      rootAuthKeyPath: string;
    };
    expect(revealed).toMatchObject({
      privateKey: ROOT_AUTH_PRIVATE_KEY,
      authId: `wallet_evm:${privateKeyToAccount(ROOT_AUTH_PRIVATE_KEY).address.toLowerCase()}`,
    });
    expect(revealed.rootAuthKeyPath.endsWith("/root-auth.key")).toBeTrue();
  });

  test("Scenario: Given profile-service fresh start When the reveal endpoint is requested Then the generated managed key matches the published auth descriptor", async () => {
    const { handle } = await startServer(4607);
    const baseUrl = `http://${handle.host}:${handle.port}`;

    const descriptorResponse = await fetch(`${baseUrl}/auth/descriptor`);
    expect(descriptorResponse.status).toBe(200);
    const descriptor = (await descriptorResponse.json()) as {
      rootAuthId: string;
      rootAuthKeyPath: string;
      rootAuthBootstrapMode: string;
      canRevealRootAuthPrivateKey: boolean;
      hasManagedRootAuthPrivateKey: boolean;
    };

    const revealResponse = await fetch(`${baseUrl}/auth/root-key/reveal`, {
      method: "POST",
    });
    expect(revealResponse.status).toBe(200);
    const revealed = (await revealResponse.json()) as {
      privateKey: string;
      authId: string;
      rootAuthKeyPath: string;
    };

    expect(descriptor.rootAuthBootstrapMode).toBe("managed_local");
    expect(descriptor.canRevealRootAuthPrivateKey).toBeTrue();
    expect(descriptor.hasManagedRootAuthPrivateKey).toBeTrue();
    expect(revealed.privateKey).toMatch(/^0x[0-9a-f]{64}$/);
    expect(revealed.authId).toBe(descriptor.rootAuthId);
    expect(revealed.rootAuthKeyPath).toBe(descriptor.rootAuthKeyPath);
  });

  test("Scenario: Given wallet auth challenge When the signature is valid Then the auth service returns a JWT session and replays it from /auth/session", async () => {
    const { handle } = await startServer(4597);
    const baseUrl = `http://${handle.host}:${handle.port}`;

    const account = privateKeyToAccount(generatePrivateKey());
    const authId = `wallet_evm:${account.address}`;
    const startResponse = await fetch(`${baseUrl}/auth/challenge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ authId }),
    });
    expect(startResponse.status).toBe(200);
    const challenge = (await startResponse.json()) as {
      challengeId: string;
      challengeText: string;
      authId: string;
    };
    expect(challenge.authId).toBe(authId.toLowerCase());

    const signature = await account.signMessage({ message: challenge.challengeText });
    const verifyResponse = await fetch(`${baseUrl}/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        challengeId: challenge.challengeId,
        signature,
      }),
    });
    expect(verifyResponse.status).toBe(200);
    const session = (await verifyResponse.json()) as {
      token: string;
      claims: {
        authId: string;
        admin: boolean;
        superadmin: boolean;
      };
      profile: {
        profileId: string;
      };
    };
    expect(session.token).toBeTruthy();
    expect(session.claims.authId).toBe(authId.toLowerCase());
    expect(session.claims.admin).toBeTrue();
    expect(session.claims.superadmin).toBeFalse();
    expect(session.profile.profileId).toBeTruthy();

    const sessionResponse = await fetch(`${baseUrl}/auth/session`, {
      headers: {
        authorization: `Bearer ${session.token}`,
      },
    });
    expect(sessionResponse.status).toBe(200);
    await expect(sessionResponse.json()).resolves.toMatchObject({
      token: session.token,
      claims: {
        authId: authId.toLowerCase(),
      },
    });
  });

  test("Scenario: Given wallet auth challenge When the signature does not match Then the auth service rejects the verification", async () => {
    const { handle } = await startServer(4596);
    const baseUrl = `http://${handle.host}:${handle.port}`;

    const account = privateKeyToAccount(generatePrivateKey());
    const wrongAccount = privateKeyToAccount(generatePrivateKey());
    const authId = `wallet_evm:${account.address}`;
    const startResponse = await fetch(`${baseUrl}/auth/challenge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ authId }),
    });
    expect(startResponse.status).toBe(200);
    const challenge = (await startResponse.json()) as {
      challengeId: string;
      challengeText: string;
    };

    const wrongSignature = await wrongAccount.signMessage({ message: challenge.challengeText });
    const verifyResponse = await fetch(`${baseUrl}/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        challengeId: challenge.challengeId,
        signature: wrongSignature,
      }),
    });
    expect(verifyResponse.status).toBe(400);
    await expect(verifyResponse.json()).resolves.toMatchObject({
      error: "invalid wallet signature",
    });
  });

  test("Scenario: Given a temporary identifier When profile icon is requested Then the default response is rasterized png", async () => {
    const { handle } = await startServer(4600);
    const response = await fetch(`http://${handle.host}:${handle.port}/media/profiles/demo-user/icon`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([137, 80, 78, 71]);
  });

  test("Scenario: Given a temporary identifier When png output is requested Then the service rasterizes the deterministic svg", async () => {
    const { handle } = await startServer(4603);
    const response = await fetch(`http://${handle.host}:${handle.port}/media/profiles/demo-user/icon?format=png&size=64`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([137, 80, 78, 71]);
  });

  test("Scenario: Given a temporary identifier When svg output is requested Then the service returns the canonical Agenter profile fallback", async () => {
    const { handle } = await startServer(4605);
    const response = await fetch(`http://${handle.host}:${handle.port}/media/profiles/demo-user/icon?format=svg`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    const svg = await response.text();
    expect(svg.includes("oklch(")).toBeFalse();
    expect(svg).toBe(EXPECTED_PROFILE_FALLBACK_SVG);
  });

  test("Scenario: Given wallet auth When metadata is updated Then later reads return the canonical projection", async () => {
    const { handle } = await startServer(4601);
    const baseUrl = `http://${handle.host}:${handle.port}`;

    const account = privateKeyToAccount(generatePrivateKey());
    const walletIdentifier = `wallet_evm:${account.address}`;

    const walletStartResponse = await fetch(`${baseUrl}/auth/wallet/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: walletIdentifier }),
    });
    expect(walletStartResponse.status).toBe(200);
    const walletChallenge = (await walletStartResponse.json()) as {
      challengeId: string;
      challengeText: string;
    };
    const signature = await account.signMessage({ message: walletChallenge.challengeText });

    const verifyResponse = await fetch(`${baseUrl}/auth/wallet/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        challengeId: walletChallenge.challengeId,
        signature,
      }),
    });
    expect(verifyResponse.status).toBe(200);
    const verified = (await verifyResponse.json()) as {
      profile: { profileId: string; iconUrl: string };
      token: string;
    };
    expect(verified.profile.profileId).toBeTruthy();
    expect(verified.token).toBeTruthy();

    const patchResponse = await fetch(`${baseUrl}/profiles/${encodeURIComponent(verified.profile.profileId)}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${verified.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        displayName: "Demo User",
        phone: "+86-0000-0000",
        extra: { timezone: "Asia/Shanghai" },
      }),
    });
    expect(patchResponse.status).toBe(200);
    const patched = (await patchResponse.json()) as {
      metadata: {
        displayName?: string;
        phone?: string;
        extra?: Record<string, unknown>;
      };
    };
    expect(patched.metadata.displayName).toBe("Demo User");
    expect(patched.metadata.phone).toBe("+86-0000-0000");
    expect(patched.metadata.extra?.timezone).toBe("Asia/Shanghai");

    const readResponse = await fetch(`${baseUrl}/profiles/${encodeURIComponent(walletIdentifier)}`);
    expect(readResponse.status).toBe(200);
    const readProfile = (await readResponse.json()) as {
      profileId: string;
      metadata: {
        displayName?: string;
        phone?: string;
      };
    };
    expect(readProfile.profileId).toBe(verified.profile.profileId);
    expect(readProfile.metadata.displayName).toBe("Demo User");
    expect(readProfile.metadata.phone).toBe("+86-0000-0000");
  });

  test("Scenario: Given email bootstrap When OTP is verified Then the service returns a registration ticket instead of a durable token", async () => {
    const emailCodes = new Map<string, string>();
    const { handle } = await startServer(4602, emailCodes);
    const baseUrl = `http://${handle.host}:${handle.port}`;

    await fetch(`${baseUrl}/auth/email/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "link@example.com" }),
    });
    const emailCode = emailCodes.get("link@example.com");
    expect(emailCode).toBeDefined();

    const emailVerifyResponse = await fetch(`${baseUrl}/auth/email/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "link@example.com", code: emailCode }),
    });
    const emailVerified = (await emailVerifyResponse.json()) as {
      profile: { profileId: string };
      registrationTicket: string;
      registrationUrl: string;
    };
    expect(emailVerified.profile.profileId).toBeTruthy();
    expect(emailVerified.registrationTicket).toBeTruthy();
    expect(emailVerified.registrationUrl).toBe(
      `${baseUrl}/auth/webauthn/register?ticket=${encodeURIComponent(emailVerified.registrationTicket)}`,
    );

    const optionsResponse = await fetch(`${baseUrl}/auth/webauthn/register/options`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticketId: emailVerified.registrationTicket }),
    });
    expect(optionsResponse.status).toBe(200);
    const optionsPayload = (await optionsResponse.json()) as {
      ticketId: string;
      options: {
        challenge: string;
        rp: { id: string; name: string };
      };
    };
    expect(optionsPayload.ticketId).toBe(emailVerified.registrationTicket);
    expect(optionsPayload.options.challenge).toBeTruthy();
    expect(optionsPayload.options.rp.name).toContain("profile-service");
  });

  test("Scenario: Given wallet and email identifiers When email OTP is verified with a wallet bearer token Then both identifiers share one profile and icon", async () => {
    const emailCodes = new Map<string, string>();
    const { handle } = await startServer(4602, emailCodes);
    const baseUrl = `http://${handle.host}:${handle.port}`;

    const account = privateKeyToAccount(generatePrivateKey());
    const walletIdentifier = `wallet_evm:${account.address}`;
    const walletStartResponse = await fetch(`${baseUrl}/auth/wallet/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: walletIdentifier }),
    });
    expect(walletStartResponse.status).toBe(200);
    const walletChallenge = (await walletStartResponse.json()) as {
      challengeId: string;
      challengeText: string;
    };
    const signature = await account.signMessage({ message: walletChallenge.challengeText });

    const walletVerifyResponse = await fetch(`${baseUrl}/auth/wallet/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        challengeId: walletChallenge.challengeId,
        signature,
      }),
    });
    expect(walletVerifyResponse.status).toBe(200);
    const walletVerified = (await walletVerifyResponse.json()) as {
      profile: { profileId: string };
      token: string;
    };

    await fetch(`${baseUrl}/auth/email/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "link@example.com" }),
    });
    const emailCode = emailCodes.get("link@example.com");
    expect(emailCode).toBeDefined();

    const emailVerifyResponse = await fetch(`${baseUrl}/auth/email/verify`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${walletVerified.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "link@example.com", code: emailCode }),
    });
    expect(emailVerifyResponse.status).toBe(200);
    const emailVerified = (await emailVerifyResponse.json()) as {
      profile: { profileId: string };
      registrationTicket: string;
    };
    expect(emailVerified.profile.profileId).toBe(walletVerified.profile.profileId);

    const uploadedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><text x="0" y="10">linked</text></svg>`;
    const uploadResponse = await fetch(`${baseUrl}/profiles/${encodeURIComponent(walletVerified.profile.profileId)}/icon`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${walletVerified.token}`,
        "content-type": "image/svg+xml",
      },
      body: uploadedSvg,
    });
    expect(uploadResponse.status).toBe(200);

    const walletProfileResponse = await fetch(`${baseUrl}/profiles/${encodeURIComponent(walletIdentifier)}`);
    expect(walletProfileResponse.status).toBe(200);
    const walletProfile = (await walletProfileResponse.json()) as { profileId: string };
    expect(walletProfile.profileId).toBe(emailVerified.profile.profileId);

    const iconResponse = await fetch(`${baseUrl}/media/profiles/${encodeURIComponent(walletIdentifier)}/icon`);
    expect(iconResponse.status).toBe(200);
    expect(iconResponse.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await iconResponse.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([137, 80, 78, 71]);
  });

  test("Scenario: Given a synced session seed When session icon is requested Then the caller no longer needs workspace query params", async () => {
    const { handle } = await startServer(4604);
    const baseUrl = `http://${handle.host}:${handle.port}`;

    const syncResponse = await fetch(`${baseUrl}/sessions/session-1/seed`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspacePath: "/repo/demo",
        label: "42",
      }),
    });
    expect(syncResponse.status).toBe(200);

    const iconResponse = await fetch(`${baseUrl}/media/sessions/session-1/icon`);
    expect(iconResponse.status).toBe(200);
    expect(iconResponse.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await iconResponse.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([137, 80, 78, 71]);
  });

  test("Scenario: Given a synced session seed When svg output is requested Then the service returns the canonical random session avatar", async () => {
    const { handle } = await startServer(4606);
    const baseUrl = `http://${handle.host}:${handle.port}`;

    const seedPayload = {
      workspacePath: "/repo/demo",
      label: "42",
    };
    const syncResponse = await fetch(`${baseUrl}/sessions/session-1/seed`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(seedPayload),
    });
    expect(syncResponse.status).toBe(200);

    const iconResponse = await fetch(`${baseUrl}/media/sessions/session-1/icon?format=svg`);
    expect(iconResponse.status).toBe(200);
    expect(iconResponse.headers.get("content-type")).toBe("image/svg+xml");
    const svg = await iconResponse.text();
    expect(svg.includes("oklch(")).toBeFalse();
    expect(svg).toBe(EXPECTED_SESSION_FALLBACK_SVG);
  });
});
