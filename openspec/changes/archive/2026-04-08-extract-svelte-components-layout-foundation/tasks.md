## 1. Shared Package Foundation

- [x] 1.1 Create `@agenter/svelte-components` as the direct replacement for `@agenter/svelte-primitives`
- [x] 1.2 Move `ScrollView` and scaffold-family primitives into the new package with shared exports and internal utilities
- [x] 1.3 Add durable package documentation and package-level contract tests for the shared layout foundation

## 2. Consumer Migration

- [x] 2.1 Update `@agenter/webui` to consume `@agenter/svelte-components` and remove duplicated scaffold-family implementation from local source
- [x] 2.2 Update `@agenter/web-chat-view` to consume `@agenter/svelte-components` for transcript scrolling and shell structure
- [x] 2.3 Keep `@agenter/web-components` boundary explicit so Lit atoms do not absorb Svelte layout law

## 3. Verification

- [x] 3.1 Run package checks for `@agenter/svelte-components`
- [x] 3.2 Run `@agenter/web-chat-view` typecheck/tests after the migration
- [x] 3.3 Run `@agenter/webui` typecheck, DOM contract, layout contract, and targeted system-surface regressions after the migration

## 4. Web Chat Parity Recovery

- [x] 4.1 Rebuild `@agenter/web-chat-view` into a conversation-first surface that keeps the transcript as the dominant viewport even when optional header/footer slots are omitted
- [x] 4.2 Replace the current hand-rolled chat shell with package-local `shadcn-svelte` composition plus shared structural primitives, while preserving package independence from `@agenter/webui`
- [x] 4.3 Re-run `web-chat-view` unit/host verification and route-level walkthroughs so the shared room transcript matches the intended operator workflow instead of the current cut-down surface
