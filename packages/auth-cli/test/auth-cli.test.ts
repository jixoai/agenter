import { describe, expect, mock, test } from "bun:test";
import { runAuthCli, runProfileCli } from "../src/run-cli";

const withPatchedConsole = async (run: (logs: string[]) => Promise<void>) => {
  const originalLog = console.log;
  const logs: string[] = [];
  console.log = (...args: unknown[]) => {
    logs.push(args.join(" "));
  };
  try {
    await run(logs);
  } finally {
    console.log = originalLog;
  }
};

describe("Feature: auth-cli endpoint client", () => {
  test("Scenario: Given doctor command When the endpoint is healthy Then auth-cli reports auth-service connectivity", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = mock(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await withPatchedConsole(async (logs) => {
        await runAuthCli(["node", "auth-cli", "--endpoint", "http://localhost:4591", "doctor"]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(logs[0]).toBe("auth-service healthy at http://localhost:4591");
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Scenario: Given legacy profile-cli doctor When the endpoint is healthy Then it delegates to the auth CLI implementation", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = mock(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await withPatchedConsole(async (logs) => {
        await runProfileCli(["node", "profile-cli", "--endpoint", "http://localhost:4591", "doctor"]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(logs[0]).toBe("auth-service healthy at http://localhost:4591");
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Scenario: Given auth token env When a profile update is sent Then the CLI uses the canonical bearer token", async () => {
    const originalFetch = globalThis.fetch;
    const originalToken = process.env.AUTH_SERVICE_TOKEN;
    const fetchMock = mock(async () =>
      new Response(
        JSON.stringify({
          profileId: "profile-1",
          identifiers: [{ kind: "temp", value: "demo-user" }],
          metadata: { nickname: "Demo" },
          isVirtual: false,
          iconUrl: "/media/profiles/profile-1/icon",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env.AUTH_SERVICE_TOKEN = "token-1";

    try {
      await withPatchedConsole(async () => {
        await runAuthCli([
          "node",
          "auth-cli",
          "--endpoint",
          "http://localhost:4591",
          "profile-update",
          "demo-user",
          "--nickname",
          "Demo",
        ]);
      });
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer token-1");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalToken === undefined) {
        delete process.env.AUTH_SERVICE_TOKEN;
      } else {
        process.env.AUTH_SERVICE_TOKEN = originalToken;
      }
    }
  });

  test("Scenario: Given legacy profile token env When no auth token is set Then the CLI still accepts the compatibility token", async () => {
    const originalFetch = globalThis.fetch;
    const originalAuthToken = process.env.AUTH_SERVICE_TOKEN;
    const originalProfileToken = process.env.PROFILE_SERVICE_TOKEN;
    const fetchMock = mock(async () =>
      new Response(JSON.stringify({ profiles: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    delete process.env.AUTH_SERVICE_TOKEN;
    process.env.PROFILE_SERVICE_TOKEN = "legacy-token-1";

    try {
      await withPatchedConsole(async () => {
        await runAuthCli([
          "node",
          "auth-cli",
          "--endpoint",
          "http://localhost:4591",
          "profile-update",
          "demo-user",
          "--nickname",
          "Demo",
        ]);
      });
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer legacy-token-1");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalAuthToken === undefined) {
        delete process.env.AUTH_SERVICE_TOKEN;
      } else {
        process.env.AUTH_SERVICE_TOKEN = originalAuthToken;
      }
      if (originalProfileToken === undefined) {
        delete process.env.PROFILE_SERVICE_TOKEN;
      } else {
        process.env.PROFILE_SERVICE_TOKEN = originalProfileToken;
      }
    }
  });

  test("Scenario: Given profile get When the endpoint replies Then the CLI prints the projection", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = mock(async () =>
      new Response(
        JSON.stringify({
          profileId: null,
          identifiers: [{ kind: "temp", value: "demo-user" }],
          metadata: {},
          isVirtual: true,
          iconUrl: "/media/profiles/demo-user/icon",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await withPatchedConsole(async (logs) => {
        await runAuthCli(["node", "auth-cli", "--endpoint", "http://localhost:4591", "profile-get", "demo-user"]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(logs[0]).toContain("\"iconUrl\": \"/media/profiles/demo-user/icon\"");
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Scenario: Given email auth start When the endpoint replies Then the CLI prints the challenge projection", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = mock(async () =>
      new Response(
        JSON.stringify({
          challengeId: "challenge-1",
          delivery: "console",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await withPatchedConsole(async (logs) => {
        await runAuthCli([
          "node",
          "auth-cli",
          "--endpoint",
          "http://localhost:4591",
          "auth-email-start",
          "demo@example.com",
        ]);
        expect(logs[0]).toContain("\"challengeId\": \"challenge-1\"");
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("http://localhost:4591/auth/email/start");
      expect(init.method).toBe("POST");
      expect(String(init.body)).toContain("\"email\":\"demo@example.com\"");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Scenario: Given email auth verify When the endpoint replies Then the CLI prints the registration ticket instead of a bearer token", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = mock(async () =>
      new Response(
        JSON.stringify({
          profile: {
            profileId: "profile-1",
            identifiers: [{ kind: "email", value: "demo@example.com" }],
            metadata: {},
            iconUrl: "/media/profiles/profile-1/icon",
            isVirtual: false,
          },
          registrationTicket: "ticket-1",
          expiresAt: new Date(0).toISOString(),
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await withPatchedConsole(async (logs) => {
        await runAuthCli([
          "node",
          "auth-cli",
          "--endpoint",
          "http://localhost:4591",
          "auth-email-verify",
          "demo@example.com",
          "123456",
        ]);
        expect(logs[0]).toContain("\"registrationTicket\": \"ticket-1\"");
        expect(logs[0]).not.toContain("\"token\":");
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("http://localhost:4591/auth/email/verify");
      expect(init.method).toBe("POST");
      expect(String(init.body)).toContain("\"code\":\"123456\"");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
