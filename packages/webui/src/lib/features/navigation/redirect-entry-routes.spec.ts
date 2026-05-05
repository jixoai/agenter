import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const routesRoot = resolve(import.meta.dirname, "../../../routes/(app)");

const readRoute = (relativePath: string): string => readFileSync(resolve(routesRoot, relativePath), "utf8");

describe("Feature: Redirect-only WebUI entry pages", () => {
  test("Scenario: Given redirect-only shell entries When reading the route sources Then they stay on CSR entry files with canonical destinations", () => {
    expect(existsSync(resolve(routesRoot, "+page.server.ts"))).toBe(false);
    expect(existsSync(resolve(routesRoot, "+page.ts"))).toBe(true);
    expect(readRoute("+page.ts")).toContain('throw redirect(307, "/avatars");');

    expect(existsSync(resolve(routesRoot, "avatars/+page.server.ts"))).toBe(false);
    expect(existsSync(resolve(routesRoot, "avatars/+page.ts"))).toBe(true);
    expect(readRoute("avatars/+page.ts")).toContain('throw redirect(307, "/avatars/catalog");');

    expect(existsSync(resolve(routesRoot, "avatars/runtime/[sessionId]/+page.server.ts"))).toBe(false);
    expect(existsSync(resolve(routesRoot, "avatars/runtime/[sessionId]/+page.ts"))).toBe(true);
    expect(readRoute("avatars/runtime/[sessionId]/+page.ts")).toContain(
      "throw redirect(307, `/avatars/runtime/${encodeURIComponent(params.sessionId)}/heartbeat`);",
    );
  });
});
