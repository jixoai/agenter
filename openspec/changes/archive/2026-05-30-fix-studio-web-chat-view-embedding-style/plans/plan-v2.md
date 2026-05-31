# Intent Document

## Current Round

- Round: 2
- Status: Intent reopened from live Studio route evidence
- Previous plan backup: `plans/plan-v1.md`

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
| 2 | User | Fix the problem that `web-chat-view` needs to be embedded into Studio. | The boundary is an embedding/style contract between `@agenter/web-chat-view` and `agenter-app-studio`. |
| 3 | User | The problem is especially styling, shown by Image #1. | The fix must be validated visually, not only by typecheck. |
| 4 | User | Use the new OpenSpec `vision-driven` workflow. | This change must preserve `plans/plan.md` as the intent SSOT, then derive specs, tasks, implementation, and self-review. |
| 5 | User | Live `bun agenter studio --dev` on current `main` still shows giant circular rings in the message transcript. | Round 1 did not cover the real route failure; reopen intent and add read-indicator geometry coverage. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| Image #1 | Studio embeds chat but transcript avatars/rendered circular assets become enormous, creating huge dead zones and unreadable transcript density. | This is the target visible failure. |
| `packages/studio/src/lib/features/messages/message-system-surface.svelte` | Studio mounts `WebChatViewHost` directly with `showHeader={false}` and `class="h-full"`. | Studio is using the shared component as an embedded transcript/composer surface. |
| `packages/web-chat-view/src/chat-avatar.svelte` | Avatar geometry currently depends on Tailwind utility classes such as `size-[1.625rem]`, `rounded-full`, `h-full`, and `object-cover`. | A reusable package cannot rely on the host app to generate those utilities. |
| `packages/web-chat-view/src/message-row.svelte` | Message rows pass class `avatar avatar-${tone}` to `ChatAvatar`, while actual geometry remains inside Tailwind utility strings. | The stable style hook exists, but the sizing law is not package-owned. |
| `packages/web-chat-view/src/ui/framework7-message.svelte` | Framework7 message wrapping is local, but it does not force avatar child geometry. | The fix should be inside the shared component, not a Studio route patch. |
| `openspec/specs/web-chat-view/spec.md` | The existing law says the shared package owns transcript/composer shell and canonical avatar rendering. | Extend this law: canonical avatar rendering must include package-owned geometry when embedded. |
| `openspec/specs/message-system-surface/spec.md` | The existing Studio surface law says the room transcript is rendered through the shared chat component. | Extend this law: Studio must not add route-local emergency style patches for shared transcript geometry. |
| `git status --short --branch` | Current `main` is ahead of `origin/main` and has a dirty `bun.lock` unrelated to this styling fix. | Do not revert or stage unrelated `bun.lock` changes. |
| User Image #1 in Round 2 | The giant dark circles appear as standalone read-progress rings under message rows, while message avatars are already normal-sized. | The remaining visible failure is `MessageReadIndicator`, not `ChatAvatar`. |
| `packages/web-chat-view/src/message-read-indicator.svelte` | The clickable read indicator uses Framework7 `Link` with class `message-read-indicator`, but the sizing CSS is component-scoped. Svelte scoped CSS does not reliably style a class forwarded to an external component root. | The trigger loses `width/height: 1.25rem`, and the child SVG ring can render at a huge default size inside Studio. |
| `packages/studio/src/lib/features/messages/message-system-surface.svelte` | Studio provides `resolveMessageReadProgress`, so real rooms can render discloseable read indicators with read/unread actors. | Storybook evidence must include read progress, not only actor avatar images. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Pending |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Pending |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Pending |
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
| Should Studio ultimately embed `web-chat-view` as iframe/custom element/direct Svelte component? | That is a larger isolation decision. | Not needed for this fix; direct Svelte component remains the current contract. |
| Should this visual fix also redesign the room page IA? | The screenshot shows visual breakage, not an IA change request. | Do not redesign the whole room page in this change. |

## Intent

### Surface Intent

Studio should embed `web-chat-view` without the chat content exploding visually. Avatars, message bubbles, read indicators, icons, and composer controls should retain sane chat-app proportions inside the Studio messages page. Round 2 explicitly includes discloseable read-progress rings, because the live Studio route proved they can explode even after avatar geometry is bounded.

### Underlying Drive

`@agenter/web-chat-view` is now a shared app atom. A shared atom cannot rely on whichever host happens to compile Tailwind utility classes. Its visible geometry must be self-contained and Framework7-aligned so Studio can mount it without emergency CSS patches.

### Final Visible Effect

When the operator opens a Studio room:

- message avatars stay around normal chat-avatar size instead of expanding to natural image size
- message read indicators stay around normal inline affordance size instead of becoming giant SVG rings
- fallback icons/images stay clipped inside the avatar circle
- bubbles remain compact and readable
- the transcript remains the dominant viewport
- the composer stays attached to the bottom without an extra broken visual band
- desktop and iPhone 14 views both look like a controlled embedded chat surface

## Platform Diagnosis

- Current platform laws: Studio owns app shell and toolbar; `web-chat-view` owns transcript/composer; Framework7 owns chat primitive topology.
- Does this fit as a regular atom: Yes.
- Does this require law upgrade: Small law upgrade only: package-owned embedded geometry is required for reusable Svelte chat atoms.
- Breaking update stance: No persistence or API break is needed.
- User confirmations still required: None for the first fix; iframe/custom-element migration is deferred.

## Reverse-Inferred Design

### Interaction / Visual Story

The operator enters Messages, opens a room, and sees a normal dense chat transcript inside Studio. The surrounding Studio chrome remains responsible for room tabs and actions. Inside the transcript, every avatar and icon is bounded by the shared chat component itself. The host does not need to know the internal class names to prevent layout collapse.

### Interface Shape

`WebChatViewHost` remains the Svelte component boundary. Studio continues passing:

- room channel
- viewer identity
- initial messages
- actor presentation resolver
- composer capabilities
- send and visibility callbacks

No new host prop is required for this first fix.

### Data Shape

No durable data change is required. This is presentation ownership:

- facts: room/channel/message/actor presentation
- projection: chat row visual geometry
- forbidden confusion: natural avatar image dimensions are not durable identity facts and must not drive layout size

### Architecture Shape

- `@agenter/web-chat-view` owns its component-local CSS for avatar geometry.
- `@agenter/web-chat-view` owns component-local or package-global CSS for classes passed through Framework7 component roots; scoped selectors alone are not enough when the DOM root is created by an external component.
- Framework7 `Message` remains the chat row primitive.
- Studio may tune composer density through public parts, but should not patch core transcript avatar sizing.
- Do not add a Studio-only `.message-avatar img { ... }` fix unless the shared component cannot express the law.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Change embedding technology to iframe/custom element | This changes the app integration boundary and event/resize/auth contracts. | Do not change embedding technology in this fix. |
| Remove Framework7 message primitive | This would reject the current visual law and prior review-shell direction. | Keep Framework7 message topology. |

## Intent-Driven Plan

- [x] 1. Research and align intent.
- [x] 2. Write specs from the intent.
- [x] 3. Write BDD tasks from specs.
- [x] 4. Implement tasks.
- [x] 5. Self-review against intent and decide whether to loop.
- [ ] 6. Round 2: add read-indicator BDD/DOM coverage, fix Framework7 Link styling boundary, and retake live-route evidence.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should future isolation use iframe/custom element? | It affects long-term style isolation and app boundaries. | Defer; direct Svelte host is current law. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Patch only Studio route CSS | It hides the package defect and breaks other hosts. |
| Remove Framework7 `Message` | The problem is style ownership, not the official chat primitive. |
| Depend on Studio Tailwind scanning `packages/web-chat-view` | A package atom should not require every host build pipeline to generate its internal utility classes. |

## Exit Conditions

- Default max review iterations: 5
- Issue recurrence threshold: 2
- Custom exit condition from intent: Studio story/browser evidence shows bounded embedded chat geometry on desktop and iPhone 14; BDD protects package-owned avatar sizing; OpenSpec vision check passes.
