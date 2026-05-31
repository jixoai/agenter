# Vision-Driven Self Review

## Review State

- Change: `fix-studio-web-chat-view-embedding-style`
- Iteration: 4
- Recurring issue counts: `read-indicator-geometry` occurred once after Round 1; `framework7-shell-topology-mismatch` occurred once after Round 2; `stale-app-view-proxy` occurred once during Round 4 verification.
- Exit-condition judgment: pass for the current change scope after iframe app-view embedding, contact terminology cleanup, targeted typechecks, BDD contracts, and desktop/iPhone 14 live-route screenshots.
- Next loop action: do not add more Studio-local chat CSS. Future work should harden app polish around Studio mobile shell density and full e2e fixtures, but the app-view boundary law is now implemented.

## Intent Alignment

| Intent point | Evidence | Verdict |
| ------------ | -------- | ------- |
| Studio can embed `web-chat-view` without avatar/image explosion. | `review/evidence/desktop-embedded-avatar-bounds.png`, `review/evidence/iphone14-embedded-avatar-bounds.png`; Playwright measured first five message avatars as `26x26` on both viewports. | Pass |
| Shared package owns transcript avatar geometry instead of relying on Studio Tailwind scanning. | `packages/web-chat-view/src/chat-avatar.svelte` now uses scoped `.chat-avatar` / `.chat-avatar-image` CSS and the BDD source contract forbids `size-[1.625rem]` and `h-full w-full object-cover`. | Pass |
| Studio should consume the shared chat atom without route-local emergency CSS patches. | `packages/studio/src/lib/features/messages/web-chat-view-host.contract.stories.ts` adds an embedded large-avatar contract; no Studio route CSS patch was added. | Pass |
| Bottom-anchored transcript remains stable after compact avatar geometry becomes real. | Existing Storybook DOM scroll contract initially exposed `62px` anchor drift; `estimateMessageRowSize` was corrected and the full targeted contract now passes. | Pass |
| BDD is run before implementation. | First targeted unit run failed on `test/chat-avatar-embedded-style.test.ts` before the component fix. | Pass |
| Live Studio route read indicators stay bounded. | Round 2 BDD first failed with `300px` read indicators; after the fix, live `127.0.0.1:4173/messages/room/...` metrics report two indicators as `20x20`, with SVG rings also `20x20`. | Pass |
| Studio uses the same Web Chat app shell as the full review shell. | Studio now renders an iframe app-view boundary. Live 4174 evidence shows iframe URL `http://127.0.0.1:4293/?mode=room&...&viewer=...`, app-view page class `review-shell-room-page review-shell-embedded-room-page page`, `.messages` at `1184x846` desktop / `324x692` iPhone 14, and `.messagebar` at `1180x58` desktop / `321x56` iPhone 14. | Pass |
| App-view app language is contact-based. | URL contracts now emit `viewer=<contactId>`; README and visible setup copy say viewer contact; `viewerActorId` is no longer emitted by app-view query builders or Studio iframe URLs. | Pass |
| The current fix avoids symptom-only visual patching. | Round 1/2 package CSS bounds are retained as defensive leaf guardrails, but Round 4 moved the Studio integration to iframe app-view and removed outer route send/read-ack effects that belonged inside app-view/backend flow. | Pass |

## Deviations From Intent

1. Round 1 incorrectly treated the visible giant circular artifacts as avatar geometry only. The user-provided live route screenshot proved the remaining artifacts were discloseable `MessageReadIndicator` SVG rings.
2. Round 1 screenshots used the embedded Storybook contract story rather than a live Studio route. Round 2 corrected this by capturing the active `127.0.0.1:4173/messages/room/...` route on desktop and iPhone 14.
3. Storybook dev server emitted a Vite dependency pre-scan warning for Storybook/Svelte virtual module `DecoratorHandler.svelte`. Targeted DOM tests and live-route screenshots still succeeded; this remains a tooling warning, not a app failure in this change.
4. Round 3 initially deferred the iframe/custom-element decision and kept the direct Svelte component contract too long. The user clarified app-view should behave like Chrome/Chrome WebView, so Round 4 switched Studio to iframe app-view.
5. Round 3 found the previous boundary assumption was too small: `WebChatViewHost` is the leaf transcript/composer, while the previously good-looking version used a full Framework7 review shell.
6. The full review shell itself had drifted from the current message-system contact API. A small non-visual harness fix was needed to make it usable as evidence.
7. Round 4 first validated against the user's already-running `4173 -> 4292` setup and hit a stale app-view proxy: that 4292 server was the review harness app-view and proxied `/trpc` to `4600`, so partial room mode returned `not found`. I did not mutate that user process; I started an isolated `4174 -> 4293` Studio/app-view pair, with 4293 proxied to daemon `4580`, and validated the current code there.

## Plain-Language Deviation List

1. 前两轮把问题当成组件尺寸问题修，方向不完整；这些修复现在只保留为包内防御性边界，不再当主解法。
2. 真正的主解法是 `app-view` iframe 边界。Studio 不再假装自己能拼出 Framework7 chat page，只负责外围 superadmin/room 管理。
3. 第一次 live 验证连到了旧的 4292 app-view，它不是当前 `bun agenter studio --dev` 新拓扑，所以出现 `not found`。隔离启动 4174/4293 后验证通过。
4. WebChat 叶子包内部仍有 `viewerActorId` 这类既有 prop/type 名称，这是下层 API 的历史命名；本 change 已清理 app-view URL、文案和 Studio/app-view 边界，不在这一轮做跨包 public API 大迁移。

## Future Task List

1. 给 Studio Messages 增加稳定 e2e fixture，让 screenshot 验证不用依赖用户当前 daemon 里刚好有什么房间。
2. 后续单独评估 `@agenter/web-chat-view` public API 是否从 actor 命名迁到 contact 命名；这会影响 package consumers，应该另开 breaking change。
3. 继续打磨 Studio 移动端 Messages shell 密度；当前 iPhone 14 验证证明 iframe 可用，但 Studio 左侧 app rail 仍占 66px，这属于 Studio shell IA 任务，不属于 app-view 嵌入边界。
4. 如果需要生产构建验证，补一条 non-dev app-view URL 配置验收，确保静态 Studio host 也能通过 `PUBLIC_WEB_CHAT_VIEW_APP_VIEW_URL` 接入独立 app-view。

## Evidence

- HTML report: `review/self-review.html`
- Screenshot paths:
- `review/evidence/desktop-embedded-avatar-bounds.png`
- `review/evidence/iphone14-embedded-avatar-bounds.png`
- `review/evidence/live-studio-route-read-indicator-bounds.png`
- `review/evidence/live-studio-route-read-indicator-bounds-iphone14.png`
- Round 3 full-shell screenshot paths:
- `packages/web-chat-view/.screenshot/architecture-check/full-review-shell-simple/desktop.png`
- `packages/web-chat-view/.screenshot/architecture-check/full-review-shell-simple/mobile.png`
- `packages/web-chat-view/.screenshot/architecture-check/full-review-shell-simple/mobile-room.png`
- Round 3 current Studio screenshot path:
- `packages/studio/.screenshot/architecture-check/studio-current/messages.png`
- Round 4 iframe app-view screenshot paths:
- `review/evidence/studio-app-view-iframe-desktop.png`
- `review/evidence/studio-app-view-iframe-iphone14.png`
- `review/evidence/studio-app-view-iframe-metrics.json`
- Round 4 working screenshot paths:
- `packages/studio/.screenshot/after/fix-studio-web-chat-view-embedding-style/desktop-studio-app-view-4174.png`
- `packages/studio/.screenshot/after/fix-studio-web-chat-view-embedding-style/iphone14-studio-app-view-4174.png`
- Round 3 topology metrics:
- full desktop detail page has `review-shell-desktop-detail page-master-detail review-shell-room-page page page-current`, `WebChatViewHost` at `808x884`, `.messages` at `808x825`, and `.messagebar` at `804x58`.
- full mobile room page has `.page[data-name="review-shell-child"].page-current` covering `390x664`, `WebChatViewHost` at `390x588`, `.messages` at `390x531`, `.messagebar` at `387x56`, and root tabbar hidden.
- Studio current route has `WebChatViewHost` at `1184x865`, `.messages` at `1184x747`, `.messagebar` at `1180x117`, no visible Framework7 `.page`, and only a hidden `.framework7-root` at `0x0`.
- Failing BDD proof before implementation: `bun run --filter '@agenter/web-chat-view' test:unit -- test/chat-avatar-embedded-style.test.ts` failed because `ChatAvatar` still used Tailwind utility geometry.
- Failing Round 2 BDD proof before implementation: `bun run --filter '@agenter/web-chat-view' test:unit -- test/message-read-disclosure-sizing.test.ts` failed because `MessageReadIndicator` had no package-global trigger sizing for the Framework7 `Link` root.
- Failing Round 2 DOM proof before implementation: `bun run --filter 'agenter-app-studio' test:dom -- test/storybook/web-chat-view-host.contract.stories.test.ts` failed because embedded read indicators measured `300px` wide.
- Passing Web Chat BDD: `bun run --filter '@agenter/web-chat-view' test:unit -- test/chat-avatar-embedded-style.test.ts test/message-utils.test.ts`
- Passing Round 2 Web Chat BDD: `bun run --filter '@agenter/web-chat-view' test:unit -- test/message-read-disclosure-sizing.test.ts test/chat-avatar-embedded-style.test.ts test/message-utils.test.ts`
- Passing Studio DOM contract: `bun run --filter 'agenter-app-studio' test:dom -- test/storybook/web-chat-view-host.contract.stories.test.ts`
- Passing typechecks: `bun run --filter '@agenter/web-chat-view' typecheck`; `bun run --filter 'agenter-app-studio' typecheck`
- Passing live route metrics: desktop and iPhone 14 both reported `indicatorCount: 2`, each indicator `20x20`, each SVG ring `20x20`.
- Passing Round 4 app-view BDD: `bun run --filter '@agenter/web-chat-view-example' test -- test/review-profile-query-contract.test.ts test/review-people-projection-contract.test.ts`
- Passing Round 4 Studio BDD: `bun run --filter 'agenter-app-studio' test:unit -- src/lib/features/messages/message-app-view-url.spec.ts src/lib/features/messages/message-room-route-contract.spec.ts`
- Passing Round 4 typechecks: `bun run --filter '@agenter/web-chat-view-example' typecheck`; `bun run --filter 'agenter-app-studio' typecheck`
- Passing Round 4 live route evidence: isolated `bun agenter studio --dev --web-port 4174` started app-view at `4293`, desktop and iPhone 14 iframe URLs used `mode=room` and `viewer=...`, and app-view rendered Framework7 room page + messagebar inside the iframe.
- Passing OpenSpec validation: `bun run openspec:vision -- validate fix-studio-web-chat-view-embedding-style`
- Svelte autofixer: no blocking issues for touched Svelte files. Existing large-component `$effect` and `Map -> SvelteMap` suggestions were not expanded into this change.
- Git commits reviewed:
- `ae923caa docs(spec): define studio web chat embedding style fix`
- `2a0cf8cf fix: bound embedded web chat avatar geometry`
- `557454c6 docs(spec): review studio web chat embedding fix`
- `92914e6a docs(spec): reopen web chat embedding read indicator fix`
- `8c9da0d6 fix: bound embedded web chat read indicators`
- Uncommitted paths, if any: `bun.lock` plus shell-next/terminal-system related files are dirty and unstaged; they are unrelated to this change and were not included in this change's commits.
- Task checkboxes updated by this working context: 7.6 through 7.12 were checked only after the matching BDD, typecheck, isolated live route screenshots, and self-review update ran in this context.

## HTML Review Report

See `review/self-review.html`.

## Exit Handling

- Normal exit is allowed after final `openspec:vision validate/check` and commit hygiene pass.
- This review does not require an abnormal handoff. The next agent should not continue app-view embedding by editing Studio-local transcript CSS; the app boundary is iframe app-view plus backend synchronization.
