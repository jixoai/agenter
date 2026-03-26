## 1. Shared WebUI primitives

- [x] 1.1 Refine `AsyncSurface` so list and panel consumers can share first-load, empty, and refresh treatments without bespoke overlays
- [x] 1.2 Harden `AdaptiveIconButton` for icon-only padding, tooltip fallback, and stable accessibility semantics
- [x] 1.3 Add a reusable `SurfaceSignalDisclosure` primitive and extend `Tabs` so passive signal actions can live beside tab rails

## 2. Chat and shell adoption

- [x] 2.1 Migrate `MessageChannelSurface` to the shared async/loading and adaptive-affordance primitives
- [x] 2.2 Move chat-channel metadata into the shared signal disclosure and remove redundant desktop-only status chrome
- [x] 2.3 Promote the compact session status trigger model across Chat shell usage and update related route surfaces

## 3. Verification and best-practice capture

- [x] 3.1 Add Storybook stories and DOM contracts for the refined primitives before route-level assembly verification
- [x] 3.2 Update WebUI unit/e2e coverage for desktop and mobile chat-shell behavior
- [x] 3.3 Fold the resulting reuse rules back into repository best-practice docs or specs used by future WebUI work
