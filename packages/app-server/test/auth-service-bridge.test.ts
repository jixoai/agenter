import type { AuthServiceHandle } from "@agenter/auth-service";
import { describe, expect, test } from "bun:test";
import type { AuthServiceDescriptor } from "../src/auth-service-bridge";
import { AuthServiceBridge } from "../src/auth-service-bridge";

class TestAuthServiceBridge extends AuthServiceBridge {
  startCount = 0;
  stopCount = 0;

  protected override async startChildHandle(): Promise<AuthServiceHandle> {
    this.startCount += 1;
    await Bun.sleep(20);
    return {
      host: "127.0.0.1",
      port: 4591,
      stop: async () => {
        this.stopCount += 1;
      },
    };
  }

}

describe("Feature: auth-service bridge startup", () => {
  test("Scenario: Given concurrent auth-service requests When the child runtime is still booting Then the bridge starts only one child handle", async () => {
    const bridge = new TestAuthServiceBridge();

    const [baseUrl, secondBaseUrl] = await Promise.all([
      bridge.getBaseUrl(),
      bridge.getBaseUrl(),
    ]);

    expect(baseUrl).toBe("http://127.0.0.1:4591");
    expect(secondBaseUrl).toBe("http://127.0.0.1:4591");
    expect(bridge.startCount).toBe(1);

    await bridge.stop();
    expect(bridge.stopCount).toBe(1);
  });

  test("Scenario: Given a local child auth service When the bridge describes and reveals bootstrap state Then managed-local flags and key reveal stay available", async () => {
    const bridge = new TestAuthServiceBridge();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/descriptor")) {
        return new Response(
          JSON.stringify({
            authMode: "wallet_challenge_jwt",
            rootAuthId: "wallet_evm:0x0000000000000000000000000000000000000001",
            rootIdentifier: {
              kind: "wallet_evm",
              value: "0x0000000000000000000000000000000000000001",
            },
            rootAuthKeyPath: "~/.agenter/auth-service/root-auth.key",
            jwtTtlSeconds: 3600,
            rootAuthBootstrapMode: "managed_local",
            canRevealRootAuthPrivateKey: true,
            hasManagedRootAuthPrivateKey: true,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/auth/root-key/reveal")) {
        return new Response(
          JSON.stringify({
            privateKey: "0x59c6995e998f97a5a0044966f094538c5f1b6f6db1d4c4a2a2d5f6b7c8d9e0f1",
            authId: "wallet_evm:0x0000000000000000000000000000000000000001",
            rootAuthKeyPath: "~/.agenter/auth-service/root-auth.key",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof globalThis.fetch;

    try {
      const descriptor = await bridge.describe();
      const revealed = await bridge.revealRootAuthPrivateKey();

      expect(descriptor).toMatchObject({
        endpoint: "http://127.0.0.1:4591",
        rootAuthBootstrapMode: "managed_local",
        canRevealRootAuthPrivateKey: true,
        hasManagedRootAuthPrivateKey: true,
      } satisfies Partial<AuthServiceDescriptor>);
      expect(revealed.privateKey).toBe("0x59c6995e998f97a5a0044966f094538c5f1b6f6db1d4c4a2a2d5f6b7c8d9e0f1");
    } finally {
      globalThis.fetch = originalFetch;
      await bridge.stop();
    }
  });

  test("Scenario: Given an external auth service endpoint When the bridge describes bootstrap state Then reveal is disabled and external flags are projected", async () => {
    const bridge = new AuthServiceBridge({
      endpoint: "http://auth.example.test",
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (!url.endsWith("/auth/descriptor")) {
        throw new Error(`unexpected fetch ${url}`);
      }
      return new Response(
        JSON.stringify({
          authMode: "wallet_challenge_jwt",
          rootAuthId: "wallet_evm:0x0000000000000000000000000000000000000001",
          rootIdentifier: {
            kind: "wallet_evm",
            value: "0x0000000000000000000000000000000000000001",
          },
          rootAuthKeyPath: "~/.agenter/auth-service/root-auth.key",
          jwtTtlSeconds: 3600,
          rootAuthBootstrapMode: "managed_local",
          canRevealRootAuthPrivateKey: true,
          hasManagedRootAuthPrivateKey: true,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof globalThis.fetch;

    try {
      const descriptor = await bridge.describe();
      expect(descriptor).toMatchObject({
        endpoint: "http://auth.example.test",
        rootAuthBootstrapMode: "external",
        canRevealRootAuthPrivateKey: false,
        hasManagedRootAuthPrivateKey: false,
      } satisfies Partial<AuthServiceDescriptor>);
      await expect(bridge.revealRootAuthPrivateKey()).rejects.toThrow(
        "managed root auth key reveal is unavailable for external auth service",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
