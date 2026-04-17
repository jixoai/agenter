## 1. Shared Split-Detail Primitive

- [x] 1.1 Add the shared workbench split-detail primitive and ratio-source contract to `@agenter/svelte-components`
- [x] 1.2 Implement the default global ratio source with `idb + BroadcastChannel`
- [x] 1.3 Add primitive-level coverage for ratio persistence, LTR clamp math, and compact collapse behavior

## 2. Workbench Chrome Integration

- [x] 2.1 Extend shared workbench toolbar chrome with compact right-detail `close-only` takeover support
- [x] 2.2 Provide a route-facing API for opening and closing compact right detail without feature-local toolbar DOM hacks
- [x] 2.3 Add contract or DOM coverage for toolbar takeover and restoration

## 3. Route Adoption

- [x] 3.1 Migrate the current settings route off feature-local `detailMode + Sheet` logic onto the shared split-detail primitive
- [x] 3.2 Migrate workspace right-detail surfaces to keep toolbar view-centric and body actions in the `bottom-area`
- [x] 3.3 Remove superseded route-local width breakpoints and fixed right-drawer width patches where the shared primitive now owns the law

## 4. Verification and Durable Follow-Through

- [x] 4.1 Add or update story-driven desktop and compact regression coverage for the adopted split-detail routes
- [x] 4.2 Run targeted typecheck and relevant WebUI test suites for the new primitive and migrated routes
- [x] 4.3 Sync durable repository specs and design law (`SPEC.md` / `DESIGN.md` or package-level durable specs) before declaring the change ready to archive
