## Context

The current package has the correct kernel/shell direction, but its internal atoms are too large. `ChatViewController` still directly imports websocket and HTTP implementations, and the main widgets carry multiple responsibilities. This change upgrades the internal platform law without introducing new product behavior.

## Decisions

### Decision: controller becomes state kernel, adapters own IO

`ChatViewController` remains the public host-facing view-model, but websocket and asset upload IO move behind package-owned adapter interfaces. Default adapters preserve the current constructor ergonomics.

Alternatives considered:
- Keep direct `web_socket_channel` and `http` calls in the controller. This is simpler now but makes retry, native transport, and test doubles leak through the platform kernel.

### Decision: protocol codec is a first-class atom

Transport frame parsing and encoding stay protocol-compatible but move behind a codec module. The codec owns malformed-payload behavior, not widgets or host shells.

Alternatives considered:
- Leave parsing as static helpers in the model file. This keeps files small in count but prevents protocol evolution from being tested and reasoned about as its own law.

### Decision: split stage widgets by semantic responsibility

The public `FlutterChatView` remains the composition entrypoint. Internally it delegates transcript viewport, notices, composer surface, and message-row subparts to smaller primitives.

Alternatives considered:
- File-only splitting with no semantic boundary. This would reduce line counts but not coupling.

## Rollout

This is an internal refactor with compatibility tests. Existing public exports continue to work; new lower-level adapter interfaces may be exported only when needed by hosts/tests.

### Decision: Apple platform primitives replace iOS-version-branded glue

The product shell now treats Apple design as a platform law rather than an `ios26` styling layer. App-level surfaces use Apple semantic primitives for sidebar, content, inspector, tab bar, icon actions, and content-unavailable states. Version-branded compatibility shims were removed from the example shell so future code cannot keep importing a stale visual law.

Spacing and radius are now governed as one Apple rhythm system: compact viewports stay edge-to-edge under Cupertino bars, while regular/expanded viewports use edge-to-edge split-view panels, 1px system dividers, and role-specific contained radii from `ApplePlatformTokens`. This prevents feature widgets from tuning background, radius, and padding independently into a generic dashboard-card aesthetic.

Section rhythm is codified through `AppleSection`, `AppleSectionBody`, `AppleSectionLabel`, `ApplePanelGap`, and `AppleActionGroup`, so profile/detail/stage panels describe semantic content rather than inventing local padding. The AI review prompt in `DESIGN.md` is the durable handoff contract for future agents.

### Decision: chat rhythm is a package law

Chat content rhythm is governed by `ChatSurfaceTokens`, with styles and atoms split into `chat_surface_tokens.dart`, `chat_surface_styles.dart`, and `chat_meta_pill.dart`. Message bubbles, markdown blocks, attachments, read receipts, stage notices, return-to-latest, and composer controls share one token vocabulary instead of local padding/radius guesses.

Transcript and Web demo shell surfaces also avoid `SelectableRegion` / `HtmlElementView` / Flutter Web platform views. Copy is provided by stable message actions so virtualized scroll and return-to-latest cannot trigger platform-view post-frame layout assertions.

Alternatives considered:
- Continue tuning the existing white card layout. This preserves the current look but keeps the app in a web-dashboard aesthetic and does not create a reusable Flutter Apple design law.
- Keep `SelectableRegion` in the detail rail because it is non-virtualized. This still leaves Flutter Web platform views in the page and can reproduce `_PlatformViewPlaceholderBox` assertions during stage motion, so it was rejected.
