# Intent Document

## Current Round

- Round: 4
- Status: App-view iframe boundary implemented; final validation and commit hygiene pending
- Previous plan backups: `plans/plan-v1.md`, `plans/plan-v2.md`

## Workflow Command Surface

- Create change: `bun run openspec:vision -- new <change>`
- Check status: `bun run openspec:vision -- status <change>`
- Get artifact instructions: `bun run openspec:vision -- instructions <artifact> <change>`
- Strictly validate change files: `bun run openspec:vision -- validate <change>`
- Check commit evidence: `bun run openspec:vision -- commit-check <change> --phase <phase>`
- Rename after intent realignment: `bun run openspec:vision -- rename <old-change> <new-change>`
- Write abnormal-exit handoff: `bun run openspec:vision -- handoff <change>`
- Final workflow proof gate: `bun run openspec:vision -- check <change>`

## Original User Input

> 接下来你继续在main分支来工作，这个分支会有其它开发者一起工作，但没关系。
> 首先我要你修复的问题是，我们web-chat-view需要嵌入到studio中的问题。特别是样式方面 [Image #1]
>
> 使用全新的 openspec vision-driven 进行开发

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | Continue working directly on `main`; other developers may also work there. | Do not create a new feature worktree by default; protect unrelated dirty changes. |
| 2 | User | Fix the problem that `web-chat-view` needs to be embedded into Studio. | The boundary is an embedding/style contract between `@agenter/web-chat-view` and `agenter-ext-studio`. |
| 3 | User | The problem is especially styling, shown by Image #1. | The fix must be validated visually, not only by typecheck. |
| 4 | User | Use the new OpenSpec `vision-driven` workflow. | This change must preserve `plans/plan.md` as the intent SSOT, then derive specs, tasks, implementation, and self-review. |
| 5 | User | Live `bun agenter studio --dev` on current `main` still shows giant circular rings in the message transcript. | Round 1 did not cover the real route failure; reopen intent and add read-indicator geometry coverage. |
| 6 | User | The remaining Studio result is still wrong and may be an architecture or build issue rather than a CSS detail; the previously shown full-navigation `web-chat-view` looked correct. | Stop symptom CSS patching and compare the full Framework7 review shell against the Studio embedded route before more visual edits. |
| 7 | User | Determine whether Studio uses a different page/component or the same component losing Framework7 styling because of Framework7 architecture/compilation. | The next loop must prove component topology, CSS ownership, and Framework7 shell ownership. |
| 8 | User | If this is the cause, the previous two rounds may be harmful overwork. | Treat Round 1/2 fixes as suspect until proven compatible with the canonical full shell. |
| 9 | User | `web-chat-view/example` is no longer just an example; it is upgraded into `app-view`. Avoid `app-shell` because the name conflicts with existing project language. In `app-view` mode it can provide the complete standalone product capability or only a partial embedded capability, like Chrome can run as a full browser or expose Chrome WebView as an in-app browser. | Rename the product-facing boundary to `app-view`, keep Studio embedding iframe-based and URL-driven, and implement a partial room embed mode inside the same app-view product shell instead of making Studio reconstruct chat-view internals. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| Image #1 | Studio embeds chat but transcript avatars/rendered circular assets become enormous, creating huge dead zones and unreadable transcript density. | This is the target visible failure. |
| `packages/studio/src/lib/features/messages/message-system-surface.svelte` | Studio mounts `WebChatViewHost` directly with `showHeader={false}` and `class="h-full"`. | Studio is using the shared component as an embedded transcript/composer surface. |
| `packages/web-chat-view/src/chat-avatar.svelte` | Avatar geometry currently depends on Tailwind utility classes such as `size-[1.625rem]`, `rounded-full`, `h-full`, and `object-cover`. | A reusable package cannot rely on the host product to generate those utilities. |
| `packages/web-chat-view/src/message-row.svelte` | Message rows pass class `avatar avatar-${tone}` to `ChatAvatar`, while actual geometry remains inside Tailwind utility strings. | The stable style hook exists, but the sizing law is not package-owned. |
| `packages/web-chat-view/src/ui/framework7-message.svelte` | Framework7 message wrapping is local, but it does not force avatar child geometry. | The fix should be inside the shared component, not a Studio route patch. |
| `openspec/specs/web-chat-view/spec.md` | The existing law says the shared package owns transcript/composer shell and canonical avatar rendering. | Extend this law: canonical avatar rendering must include package-owned geometry when embedded. |
| `openspec/specs/message-system-surface/spec.md` | The existing Studio surface law says the room transcript is rendered through the shared chat component. | Extend this law: Studio must not add route-local emergency style patches for shared transcript geometry. |
| `git status --short --branch` | Current `main` is ahead of `origin/main` and has a dirty `bun.lock` unrelated to this styling fix. | Do not revert or stage unrelated `bun.lock` changes. |
| User Image #1 in Round 2 | The giant dark circles appear as standalone read-progress rings under message rows, while message avatars are already normal-sized. | The remaining visible failure is `MessageReadIndicator`, not `ChatAvatar`. |
| `packages/web-chat-view/src/message-read-indicator.svelte` | The clickable read indicator uses Framework7 `Link` with class `message-read-indicator`, but the sizing CSS is component-scoped. Svelte scoped CSS does not reliably style a class forwarded to an external component root. | The trigger loses `width/height: 1.25rem`, and the child SVG ring can render at a huge default size inside Studio. |
| `packages/studio/src/lib/features/messages/message-system-surface.svelte` | Studio provides read/unread contact projections, so real rooms can render discloseable read indicators. | Storybook evidence must include read progress, not only contact avatar images. |
| `packages/web-chat-view/example/src/routes/+page.svelte` | The historical `example` entrypoint is now the full `app-view` surface; it imports `framework7/css/bundle`, `framework7-icons/css/framework7-icons.css`, and `../app.css` before rendering `ReviewShellClient`. | The known-good product surface has a full Framework7 app stylesheet contract that Studio does not currently import. |
| `packages/web-chat-view/example/src/lib/review-shell-client.svelte` | The full app-view renders `App > View main.safe-areas > Page` and puts room chat inside `Page messagesContent`, with `WebChatViewHost` as the chat leaf. | The good version is not just `WebChatViewHost`; it is a Framework7 island/shell plus the leaf component. |
| `packages/studio/src/lib/features/messages/message-system-surface.svelte` | Studio renders `WebChatViewHost` directly inside `WorkbenchScaffold` with `showHeader={false}`. | Studio is using the same leaf component but not the same page/shell topology as the full review shell. |
| `packages/studio/src/routes/layout.css` | Studio imports Tailwind/shadcn/font styles but does not import Framework7 bundle CSS or web-chat review-shell app CSS. | Some Framework7 component styling is present only through injected/runtime/component CSS, while the full app-level CSS contract is absent. |
| `packages/web-chat-view/src/framework7-runtime.svelte` | `WebChatViewHost` creates a hidden zero-size Framework7 `App` only to make Framework7 runtime APIs available. | The hidden runtime is not a real visible `View/Page/messagesContent` topology and cannot substitute for the full shell. |
| `packages/web-chat-view/example/scripts/review-harness.ts` | The example harness had drifted from the old actor-named channel API to the current contact API and failed before entering the chat state. | The full version needed a non-visual API compatibility fix before it could be used as visual evidence on current `main`. |
| `packages/studio/src/lib/features/messages/message-system-surface.svelte`, `packages/web-chat-view/src/message-read-indicator.svelte`, `packages/web-chat-view/src/chat-avatar.svelte` | The migration from `Actor` to `Contact` still has naming residue in surface code, visible copy, and identity plumbing. | This residual should be cleaned inside the same change so the terminology law and the shell law land together. |
| `packages/web-chat-view/example/src/routes/+page.svelte`, `packages/web-chat-view/example/README.md` | The current product-mode name is `app-view`, even though the filesystem path still says `example`. | The change should record the product semantics separately from the legacy path name. |
| User Round 3 app-view clarification | The full product surface and the partial embedded surface are two modes of the same `app-view`, analogous to Chrome browser and Chrome WebView. | Studio should load app-view through a product boundary and select the partial room mode with URL facts, not build a second Studio-local chat shell. |
| Round 4 isolated live route | `bun agenter studio --dev --web-port 4174` started Studio at 4174 and app-view at 4293, with app-view proxying to daemon 4580. | This avoids mutating the user's already-running 4173/4292 process and proves the current code path. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before product-code work starts | Existing earlier change commits reviewed; Round 4 updates pending commit |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Round 4 code/BDD/evidence pending commit |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Round 4 self-review pending commit |
| Normal archive | Commit containing `openspec archive <change>` result | Pending |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Not needed yet |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `openspec/specs/web-chat-view/spec.md` | Shared chat owns transcript/composer and canonical avatar rendering. | Extend: package-owned CSS must bound avatar/icon geometry under host embedding. |
| `openspec/specs/message-system-surface/spec.md` | Studio message route renders room transcript through shared chat component. | Extend: Studio should consume shared component geometry rather than carrying host-local patches. |
| `openspec/specs/web-chat-view-framework7-visual-law/spec.md` | Framework7 visual law prefers official Messages/Messagebar topology. | Reuse: keep Framework7 message topology, do not replace it with ad hoc row markup. |
| `openspec/changes/fix-web-chat-view-review-shell-evidence` | Prior review-shell work captured screenshot/evidence flow for Framework7 chat surfaces. | Reuse: visual proof must include screenshots/evidence, not just unit tests. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `嵌入到studio中` | `web-chat-view` must behave as a reusable child surface inside Studio chrome. | The package should carry its own transcript styling contract. |
| `特别是样式方面` | The first-class defect is visible layout/styling, not message persistence. | Fix geometry, density, and style isolation first. |
| `使用全新的 openspec vision-driven` | Start from visible intent and reverse-infer specs/tasks. | Use `plans/plan.md` as SSOT and include visual self-review. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| None yet | N/A | N/A |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Should Studio ultimately embed `web-chat-view` as iframe/custom element/direct Svelte component? | That is a larger isolation decision. | Resolved: iframe app-view is the first implementation boundary. |
| Should this visual fix also redesign the room page IA? | The screenshot shows visual breakage, not an IA change request. | Do not redesign the whole room page in this change. |
| Should the lingering `Actor -> Contact` terminology be normalized in the same change? | It is a carry-over from the previous migration and can confuse the new shell-boundary work. | Yes, clean the residual terminology alongside the shell boundary rather than leaving it behind. |

## Intent

### Surface Intent

Studio should embed `web-chat-view` without losing the canonical Web Chat product shell. Avatars, message bubbles, read indicators, icons, and composer controls should retain sane chat-product proportions inside Studio, but the durable target is now stricter: Studio must either embed the same Framework7-backed Web Chat island used by the full review shell, or `web-chat-view` must expose an explicitly supported embedded Framework7 island variant. Round 3 stops local CSS patching until the shell/topology mismatch is resolved.

The product-facing name for that shell is `app-view`. `packages/web-chat-view/example` remains a historical filesystem path for now, but semantically it is the Web Chat app-view. App-view has two legal operating shapes: a standalone full product mode and a partial embedded room mode. The relationship is the same as a browser product that can either run as the complete Chrome app or expose a Chrome WebView inside another application.

### Underlying Drive

`@agenter/web-chat-view` is now a shared product atom, but the atom boundary was misread. `WebChatViewHost` is the transcript/composer leaf; the full product atom also includes Framework7 `App/View/Page/messagesContent` topology and app-level styles. A shared product atom cannot depend on host-local Workbench layout to impersonate a Framework7 page.

### Final Visible Effect

When the operator opens a Studio room:

- Studio shows the same Web Chat visual language as the full review shell, with Studio-only controls around it rather than inside its transcript shell.
- message avatars, read indicators, fallback icons, and row controls stay bounded by package-owned CSS.
- Framework7 chat primitives receive the correct visible `Page messagesContent` context or an explicitly modeled embedded-island equivalent.
- the transcript remains dominant and the composer stays attached to the bottom chat surface.
- desktop and iPhone 14 evidence compares the canonical full review shell against the Studio embedded route.

## Platform Diagnosis

- Current platform laws: Studio owns operator shell and superadmin controls; `web-chat-view` owns the Web Chat product surface; Framework7 owns chat/page/navigation topology.
- Round 1/2 diagnosis was incomplete: it fixed leaf geometry symptoms while leaving the product-shell mismatch intact.
- Does this fit as a regular atom: No. Directly mounting the leaf into `WorkbenchScaffold` is an architecture mismatch for Framework7.
- Recommended law upgrade: make the embed boundary the Web Chat app-view. Studio may choose app-view full mode or app-view partial room mode through URL facts, then layer Studio superadmin controls outside that iframe boundary.
- Breaking update stance: Still no message persistence/API break is required, but the Studio route composition may need to change.
- User confirmations resolved: the first implementation boundary is iframe app-view. The iframe is URL-driven; no resize bridge and no event bridge are part of this change because the backend is the shared source of truth.

## Reverse-Inferred Design

### Interaction / Visual Story

The operator enters Messages, opens a room, and sees a normal dense chat transcript inside Studio. The surrounding Studio chrome remains responsible for room tabs and actions. Inside the transcript, every avatar and icon is bounded by the shared chat component itself. The host does not need to know the internal class names to prevent layout collapse.

### Interface Shape

Round 3 treats `WebChatViewHost` as the leaf boundary, not the whole product boundary. Studio can still pass:

- room channel
- viewer identity
- initial messages
- contact presentation resolver
- composer capabilities
- send and visibility callbacks

The chosen boundary is:

- Studio builds an app-view URL with explicit `mode=room`, `url`, `token`, `viewer`, and room label facts.
- The iframe loads the Web Chat app-view partial room mode.
- The app-view connects to the same backend/room transport itself and authenticates from the URL.
- Studio keeps room tabs, assets, and superadmin management controls outside the iframe.
- No resize bridge or event bridge is introduced in this change; iframe sizing is normal CSS layout, and durable state synchronization flows through the backend.

### Data Shape

No durable data change is required. This is presentation ownership:

- facts: room/channel/message/contact presentation
- projection: chat row visual geometry
- forbidden confusion: natural avatar image dimensions are not durable identity facts and must not drive layout size

### Architecture Shape

- `@agenter/web-chat-view` owns package CSS for leaf geometry and its app-view owns Framework7 app/page topology.
- Studio owns operator routing, room tabs, search/assets/manage actions, and superadmin metadata; it should not rebuild the chat page interior by hand.
- Framework7 `App/View/Page/messagesContent/Messages/Messagebar` remain the canonical chat shell.
- The hidden `Framework7Runtime` remains acceptable for Framework7 APIs/popovers, but it is not a visible layout shell.
- Do not continue route-local Studio CSS patches unless they are only for Studio chrome outside the Web Chat island.
- Partial embedding is not a lesser widget API. It is an app-view mode with a narrower visible route, like an in-app browser loading a focused browser view.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Change embedding technology to iframe/custom element | This changes the product integration boundary and event/resize/auth contracts. | Resolved as iframe app-view; auth travels through URL facts, size stays CSS-owned, events stay backend-owned. |
| Remove Framework7 message primitive | This would reject the current visual law and prior review-shell direction. | Keep Framework7 message topology. |
| Revert Round 1/2 CSS fixes | User correctly flagged possible overwork; reverting could reintroduce proven unbounded geometry. | Do not revert blindly; first verify whether those fixes are compatible with the canonical full shell. |

## Intent-Driven Plan

- [x] 1. Research and align intent.
- [x] 2. Write specs from the intent.
- [x] 3. Write BDD tasks from specs.
- [x] 4. Implement tasks.
- [x] 5. Self-review against intent and decide whether to loop.
- [x] 6. Round 2: add read-indicator BDD/DOM coverage, fix Framework7 Link styling boundary, and retake live-route evidence.
- [x] 7. Round 3/4: prove full review shell vs Studio embed topology, stop symptom CSS patching, choose iframe app-view, and validate desktop/iPhone 14 live evidence.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should Studio embed the Web Chat island through iframe/custom element or direct Svelte Framework7 island first? | It affects style isolation, event bridge, auth token passing, and whether Studio can reuse the full review shell unchanged. | Resolved: iframe app-view, URL-driven auth/viewer facts, no resize/event bridge for normal transcript state. |
| Should Round 1/2 leaf geometry fixes be retained? | They may be valid package-owned guardrails, but they were not the full solution. | Resolved: retain as package-owned defensive geometry, but not as the architecture solution. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Patch only Studio route CSS | It hides the product-shell mismatch and breaks other hosts. |
| Remove Framework7 `Message` | The problem is style ownership, not the official chat primitive. |
| Depend on Studio Tailwind scanning `packages/web-chat-view` | A package atom should not require every host build pipeline to generate its internal utility classes. |
| Continue fixing individual visual artifacts before shell comparison | It risks creating more “画蛇添足” CSS and making the canonical full shell harder to preserve. |

## Exit Conditions

- Default max review iterations: 5
- Issue recurrence threshold: 2
- Custom exit condition from intent: Studio and full review-shell evidence show the same Web Chat shell/topology law on desktop and iPhone 14; BDD protects the chosen embed boundary; OpenSpec vision check passes.
