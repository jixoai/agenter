## 1. Route Entry Law

- [x] 1.1 Replace redirect-only WebUI entry pages with the stable entry-route pattern for `/`, `/avatars`, and `/avatars/runtime/[sessionId]`
- [x] 1.2 Add focused regression coverage that asserts redirect-only entry routes resolve to their canonical destinations without feature-level glue

## 2. Verification

- [x] 2.1 Re-run real browser walkthroughs for `/`, `/avatars`, and one runtime session entry on desktop and mobile
- [x] 2.2 Run focused WebUI validation after the route-entry repair and record the proof
