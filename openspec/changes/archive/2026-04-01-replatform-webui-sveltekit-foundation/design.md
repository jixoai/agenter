## Context

`@agenter/webui` currently mixes React shell concerns, custom component wrappers, route state, and product-specific behavior in one package. The backend and SDK already expose the right system-oriented APIs for workspaces, global rooms, global terminals, auth actors, and profile assets. The frontend should switch frameworks without rewriting those contracts, while the CLI must continue serving the app as copied static assets.

## Goals / Non-Goals

**Goals:**
- Build a new `@agenter/webui` on SvelteKit 2 + Svelte 5 + shadcn-svelte.
- Preserve the static delivery model used by `agenter web`.
- Reframe navigation around orthogonal systems rather than old session-first routes.
- Keep the transport/runtime state layer in `@agenter/client-sdk`.

**Non-Goals:**
- Do not preserve React component compatibility.
- Do not preserve old route URLs or browser deep-link compatibility.
- Do not introduce TaskSystem UI in this change.
- Do not reimplement server APIs that already exist in `@agenter/client-sdk`.

## Decisions

### 1. Replace the React package in place, archive the old implementation beside it
The existing folder will move to `packages/webui-bak`, and its package name will change to avoid workspace collisions. A fresh `packages/webui` will become the active package.

Alternative considered:
- Keep editing the React package. Rejected because it preserves the wrong primitive stack and route model.

### 2. Keep static SPA delivery through the CLI
The new package will use `@sveltejs/adapter-static` and generate a fallback page for client-side routing. CLI static serving will return real assets when present and the fallback page for unknown paths.

Alternative considered:
- Switch to a Node adapter. Rejected because it would force a backend/delivery rewrite without solving the frontend platform problem.

### 3. Use official Svelte scaffolding plus the provided shadcn-svelte preset
The new package will be scaffolded from SvelteKit 2/Svelte 5, then initialized with `pnpm dlx shadcn-svelte init --preset b3GKuB255M`. If the latest CLI drifts, we pin to the compatible CLI version rather than approximating the theme manually.

Alternative considered:
- Hand-roll the SvelteKit shell and theme. Rejected because it weakens the user's registry/theme source of truth.

### 4. Reuse `RuntimeStore` and expose it through Svelte stores/context
The new UI will wrap `createAgenterClient` + `createRuntimeStore` in Svelte-friendly adapters. This keeps transport, snapshot hydration, auth/profile APIs, room APIs, and terminal APIs consistent with the backend.

Alternative considered:
- Rebuild state management directly around TRPC calls. Rejected because it duplicates transport logic and reconnect semantics already solved in the SDK.

### 5. Introduce a new shell contract instead of porting the old route tree
The shell will favor top-level system routes and local route layouts. Old React-only shell primitives and TanStack Router patterns will not be preserved.

Alternative considered:
- Mirror the existing route hierarchy in SvelteKit. Rejected because that would carry over the same session-first information architecture.

## Risks / Trade-offs

- **Static SPA fallback mismatch** → Update CLI static serving and verify both root and nested route refreshes.
- **Theme/init drift in upstream tooling** → Pin compatible `shadcn-svelte` CLI when the preset flow changes.
- **Framework migration leaves feature gaps** → Stage the work through dedicated changes for shell, message-system, and terminal-system, each with its own acceptance tests.
- **Workspace/package-manager mismatch** → Add `pnpm-workspace.yaml` so pnpm-based scaffolding tools run cleanly inside the monorepo.
