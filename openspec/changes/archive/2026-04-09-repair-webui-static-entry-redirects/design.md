## Context

`@agenter/webui` runs with `ssr = false` and adapter-static fallback output, so the production CLI serves a static SPA shell plus prebuilt JS assets. Redirect-only entry routes currently live in `+page.server.ts`, which is a server-data contract. In a static fallback runtime, the client boot process requests `__data.json` for those redirects, but the CLI static server only has HTML fallback documents, so it returns `200.html` and the browser throws a JSON parse error before the workbench can render.

## Goals / Non-Goals

**Goals:**

- Make redirect-only entry routes compatible with static CSR delivery.
- Preserve the existing canonical destinations and operator-visible URLs.
- Add regression protection so redirect entries do not silently drift back to server-only implementations.

**Non-Goals:**

- Change the destination information architecture.
- Introduce a fake `__data.json` responder in CLI static serving.
- Rework the broader WebUI routing tree beyond the redirect-only entries.

## Decisions

### Decision: Redirect-only entry routes SHALL move to CSR route modules

The root entry, avatars entry, and runtime-entry redirect routes will use client-compatible route modules instead of `+page.server.ts`.

Why:

- The app is already `ssr = false`, so redirect decisions for these routes do not need a server contract.
- This removes the `__data.json` fetch path that static CLI delivery cannot satisfy.
- It keeps the redirect law inside WebUI routing rather than coupling CLI static serving to SvelteKit server-data internals.

Alternatives considered:

- Teach CLI static serving to synthesize `__data.json` responses.
  Rejected because it would hardcode SvelteKit private protocol into the CLI delivery layer.
- Keep server redirects and add special-case JSON fallback handling.
  Rejected because it preserves the same law mismatch under a more fragile workaround.

### Decision: Regression coverage SHALL forbid server redirect entry files in the static shell

The existing redirect contract test will flip from asserting `+page.server.ts` to asserting CSR route modules and canonical destinations.

Why:

- The failure came from a durable law mismatch, not from a one-off typo.
- A file-shape contract catches the architectural regression earlier than another opaque browser failure.

Alternatives considered:

- Only rely on manual walkthrough.
  Rejected because this bug survived until browser walkthrough specifically because no static-route law test existed.

## Risks / Trade-offs

- [CSR redirect briefly renders an empty shell before navigation] -> Keep redirect-only entries minimal and verify with browser walkthrough that no error surface appears.
- [Future contributors may reintroduce server redirect files] -> Update the redirect contract test to make the static CSR law explicit.
- [Nested runtime redirect could accidentally lose sessionId propagation] -> Preserve the exact canonical path construction in the new client route module and verify with a runtime walkthrough URL.

## Migration Plan

1. Replace the three redirect-only `+page.server.ts` files with CSR-compatible route modules.
2. Update redirect contract tests to assert the new law.
3. Rebuild WebUI, run targeted tests, and repeat default CLI desktop/mobile walkthrough.

## Open Questions

- None for this repair change.
