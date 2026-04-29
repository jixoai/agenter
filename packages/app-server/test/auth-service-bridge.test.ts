import type { AuthServiceHandle, AuthServiceRuntimeDescriptor } from "@agenter/auth-service";
import { describe, expect, test } from "bun:test";
import type { AuthServiceBridgeOptions, AuthServiceDescriptor } from "../src/auth-service-bridge";
import { AuthServiceBridge } from "../src/auth-service-bridge";

interface TestAuthServiceBridgeControls {
  descriptorHealth?: boolean;
  descriptorSequence?: Array<AuthServiceRuntimeDescriptor | null>;
  startError?: Error;
  startedHandle?: Pick<AuthServiceHandle, "host" | "port">;
}

const MANAGED_AUTH_DESCRIPTOR = {
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
} satisfies Omit<AuthServiceDescriptor, "endpoint">;

const ROOT_AUTH_PRIVATE_KEY_REVEAL = {
  privateKey: "0x59c6995e998f97a5a0044966f094538c5f1b6f6db1d4c4a2a2d5f6b7c8d9e0f1",
  authId: "wallet_evm:0x0000000000000000000000000000000000000001",
  rootAuthKeyPath: "~/.agenter/auth-service/root-auth.key",
};

class TestAuthServiceBridge extends AuthServiceBridge {
  startCount = 0;
  stopCount = 0;
  descriptorReadCount = 0;
  descriptorHealthCheckCount = 0;

  constructor(
    options: AuthServiceBridgeOptions = {},
    private readonly controls: TestAuthServiceBridgeControls = {},
  ) {
    super(options);
  }

  protected override readLocalRuntimeDescriptor(): AuthServiceRuntimeDescriptor | null {
    this.descriptorReadCount += 1;
    if (!this.controls.descriptorSequence || this.controls.descriptorSequence.length === 0) {
      return null;
    }
    return this.controls.descriptorSequence.shift() ?? null;
  }

  protected override async isReusableLocalDescriptorHealthy(
    _descriptor: AuthServiceRuntimeDescriptor,
  ): Promise<boolean> {
    this.descriptorHealthCheckCount += 1;
    return this.controls.descriptorHealth ?? false;
  }

  protected override async startChildHandle(): Promise<AuthServiceHandle> {
    this.startCount += 1;
    await Bun.sleep(20);
    if (this.controls.startError) {
      throw this.controls.startError;
    }
    const handle = this.controls.startedHandle ?? {
      host: "127.0.0.1",
      port: 4591,
    };
    return {
      host: handle.host,
      port: handle.port,
      stop: async () => {
        this.stopCount += 1;
      },
    };
  }
}

const withMockedFetch = async (
  handler: (url: string, init?: Parameters<typeof globalThis.fetch>[1]) => Promise<Response> | Response,
  run: () => Promise<void>,
): Promise<void> => {
  const originalFetch = globalThis.fetch;
  const mockedFetch = Object.assign(
    async (...args: Parameters<typeof globalThis.fetch>): ReturnType<typeof globalThis.fetch> =>
      await handler(String(args[0]), args[1]),
    originalFetch,
  ) satisfies typeof globalThis.fetch;
  globalThis.fetch = mockedFetch;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

describe("Feature: auth-service bridge startup", () => {
  test("Scenario: Given concurrent auth-service requests When the child runtime is still booting Then the bridge starts only one child handle", async () => {
    const bridge = new TestAuthServiceBridge();

    const [baseUrl, secondBaseUrl] = await Promise.all([bridge.getBaseUrl(), bridge.getBaseUrl()]);

    expect(baseUrl).toBe("http://127.0.0.1:4591");
    expect(secondBaseUrl).toBe("http://127.0.0.1:4591");
    expect(bridge.startCount).toBe(1);

    await bridge.stop();
    expect(bridge.stopCount).toBe(1);
  });

  test("Scenario: Given a local child auth service When the bridge describes and reveals bootstrap state Then managed-local flags and key reveal stay available", async () => {
    const bridge = new TestAuthServiceBridge();

    await withMockedFetch(async (url) => {
      if (url.endsWith("/auth/descriptor")) {
        return new Response(JSON.stringify(MANAGED_AUTH_DESCRIPTOR), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/auth/root-key/reveal")) {
        return new Response(JSON.stringify(ROOT_AUTH_PRIVATE_KEY_REVEAL), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }, async () => {
      const descriptor = await bridge.describe();
      const revealed = await bridge.revealRootAuthPrivateKey();

      expect(descriptor).toMatchObject({
        endpoint: "http://127.0.0.1:4591",
        rootAuthBootstrapMode: "managed_local",
        canRevealRootAuthPrivateKey: true,
        hasManagedRootAuthPrivateKey: true,
      } satisfies Partial<AuthServiceDescriptor>);
      expect(revealed.privateKey).toBe(ROOT_AUTH_PRIVATE_KEY_REVEAL.privateKey);
    });

    await bridge.stop();
  });

  test("Scenario: Given a healthy local runtime descriptor When the bridge boots without an explicit endpoint Then it reuses the existing authority and projects external-like bootstrap flags", async () => {
    const reusableDescriptor: AuthServiceRuntimeDescriptor = {
      pid: 30101,
      endpoint: "http://127.0.0.1:5591",
      dataDir: "/tmp/agenter-auth-service",
      rootAuthKeyPath: "/tmp/agenter-auth-service/root-auth.key",
      updatedAt: new Date().toISOString(),
    };
    const bridge = new TestAuthServiceBridge(
      {},
      {
        descriptorHealth: true,
        descriptorSequence: [reusableDescriptor],
      },
    );

    await withMockedFetch(async (url) => {
      if (url.endsWith("/auth/descriptor")) {
        return new Response(JSON.stringify(MANAGED_AUTH_DESCRIPTOR), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }, async () => {
      expect(await bridge.getBaseUrl()).toBe(reusableDescriptor.endpoint);

      const descriptor = await bridge.describe();
      expect(descriptor).toMatchObject({
        endpoint: reusableDescriptor.endpoint,
        rootAuthBootstrapMode: "external",
        canRevealRootAuthPrivateKey: false,
        hasManagedRootAuthPrivateKey: false,
      } satisfies Partial<AuthServiceDescriptor>);
      await expect(bridge.revealRootAuthPrivateKey()).rejects.toThrow(
        "managed root auth key reveal is unavailable for external auth service",
      );
    });

    expect(bridge.startCount).toBe(0);
    expect(bridge.stopCount).toBe(0);
    expect(bridge.descriptorReadCount).toBe(1);
    expect(bridge.descriptorHealthCheckCount).toBe(1);
    await bridge.stop();
    expect(bridge.stopCount).toBe(0);
  });

  test("Scenario: Given child startup loses an authority race When a healthy descriptor appears before boot finishes Then the bridge falls back to descriptor reuse instead of failing boot", async () => {
    const reusableDescriptor: AuthServiceRuntimeDescriptor = {
      pid: 30102,
      endpoint: "http://127.0.0.1:5592",
      dataDir: "/tmp/agenter-auth-service-race",
      rootAuthKeyPath: "/tmp/agenter-auth-service-race/root-auth.key",
      updatedAt: new Date().toISOString(),
    };
    const bridge = new TestAuthServiceBridge(
      {},
      {
        descriptorHealth: true,
        descriptorSequence: [null, reusableDescriptor],
        startError: new Error("startup lock conflict"),
      },
    );

    expect(await bridge.getBaseUrl()).toBe(reusableDescriptor.endpoint);
    expect(bridge.startCount).toBe(1);
    expect(bridge.stopCount).toBe(0);
    expect(bridge.descriptorReadCount).toBe(2);
    expect(bridge.descriptorHealthCheckCount).toBe(1);

    await bridge.stop();
    expect(bridge.stopCount).toBe(0);
  });

  test("Scenario: Given an external auth service endpoint When the bridge describes bootstrap state Then reveal is disabled and external flags are projected", async () => {
    const bridge = new AuthServiceBridge({
      endpoint: "http://auth.example.test",
    });

    await withMockedFetch(async (url) => {
      if (!url.endsWith("/auth/descriptor")) {
        throw new Error(`unexpected fetch ${url}`);
      }
      return new Response(JSON.stringify(MANAGED_AUTH_DESCRIPTOR), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }, async () => {
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
    });
  });
});
