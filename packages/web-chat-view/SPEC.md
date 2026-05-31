# `@agenter/web-chat-view` SPEC

This document records the durable package-level law for `@agenter/web-chat-view`.

It does not record review-iteration screenshots or temporary convergence notes.

## 1. Package Role

`@agenter/web-chat-view` is the shared room-transcript and composer surface for message-system backed chat flows.

It owns:

- transport hydration into a room transcript surface
- chronological merge and latest-anchored transcript projection
- trigger/provider-based composer completion
- resource-first draft and sent-message projection
- host-neutral fallback behavior for runtime-heavy overlays

It does not own:

- app-level review shell chrome
- Messages / Contacts / Me people navigation
- contact list, contact detail, contact requests, or source management pages
- profile persistence
- URL import/share workflow
- host routing or app bootstrap

Those host concerns belong to `packages/web-chat-view/example` or another consumer host.

## 2. Framework7 Component Law

Visible UI in `@agenter/web-chat-view` follows a four-tier ownership model:

1. Tier A: direct official Framework7 atoms when the visible responsibility matches
2. Tier B: official Framework7 temporary views only under explicit Framework7 runtime ownership
3. Tier C: same-style custom atoms when Framework7 has no fitting atomic unit
4. Tier D: chat-domain composites assembled from Tier A/B/C pieces

The package must not regress into a private shell/card system on the critical mobile path when a canonical Framework7 atom already fits.

## 3. Transcript Law

The transcript remains a latest-anchored, chronological-storage surface.

Durable rules:

- storage and merge remain chronological truth
- reverse-flow or bottom-anchored behavior is confined to the shared timeline boundary
- sparse transcript underflow aligns to the start edge; latest anchoring does not bottom-float short histories
- start-edge underflow alignment must not rewrite the shared timeline's bottom-anchored coordinate system; `scrollTop=0` remains the latest edge after overflow, and the underflow choice only changes packing/alignment inside the shared primitive
- message row projection uses Framework7 `Message` law for grouping, tail, and sent/received semantics
- message action triggers are owned by the bubble/card coordinate system, not by the wider row or shell wrapper
- host-facing actor presentation stays human-readable on the primary row surface; raw actor ids are not a required visible transcript fact
- mobile is canonical; desktop is only a wider adaptation of the same system

## 4. Composer Law

The composer durable law is:

- trigger/provider completion for `@`, `^`, and `/`
- `@` can resolve both people and resources through one mixed provider
- help completion for `?` and `？` reuses the same trigger/provider surface
- completion popups preserve CodeMirror cursor anchoring on wide viewports and must not be globally pinned to the editor's inline-start edge
- whitespace-aware insertion
- messagebar-first structure
- composer chrome follows the Messagebar reading order: leading tools, editor, trailing send action
- aggregated pending resource shelf above the editor, scoped to the same messagebar stack
- pending uploads, drafted comments, transcript resources, and host resources merge into one live completion set
- help is invoked through `?` / `？` completion, not a persistent visible helper row in the normal composer state
- host-neutral editor implementation with real-browser CodeMirror behavior and fallback textarea path

The package may style host-neutral structure to match Framework7 `messagebar.css`, but it must not silently require a Framework7 app runtime just to render the basic composer.

## 5. Resource Law

The package uses one resource-first projection across draft and sent states.

Durable rules:

- message body remains lightweight through inline tokens
- inline resource tokens render the serialized token text, such as `[^Image 1]`, as a lightweight link rather than a chip or media badge
- pending resources aggregate in a composer rail
- sent resources aggregate in an in-bubble bottom shelf derived from the same source-Markdown projection as the visible message body
- both states use the same square-tile recognition law
- inline tokens and resource tiles resolve through one resource-id keyed preview contract
- comment resources reopen into a dedicated comment-detail stage inside the shared preview shell instead of the generic document stage
- reopened comment detail preserves selected-text anchor context and supports explicit `view` / `edit` modes in one shared contract
- Markdown footnotes remain an optional serialization carrier, not the primary UI metaphor

## 6. Runtime-Gated Temporary Views

The package may use official Framework7 `Popup`, `Sheet`, `Popover`, and `Actions` only when a real Framework7 runtime owns the surface.

Without that runtime:

- the package must remain functional
- host-neutral fallback surfaces remain mandatory
- runtime-gating must stay explicit, not hidden behind accidental global state

With that runtime:

- temporary views must be root-owned by official Framework7 modal families
- all resource kinds use one shared `Popup + View + Page + Navbar + PageContent` preview shell instead of local clipped overlays
- resource kind only changes the shell body stage: image/video use media stage, document/file use document stage, comment uses dedicated comment-detail stage with explicit `view` / `edit` continuity
- comment detail view/edit controls should compose with Framework7 segmented/button/block/list law when runtime-owned, while keeping same-style fallbacks for Storybook, tests, and non-Framework7 hosts
- source-comment and comment-detail edit sheets must keep action buttons and textarea content inside the visible safe area; a hidden or clipped textarea is a runtime-modal regression

## 7. Verification Contract

High-value package verification requires:

- `bun run --filter '@agenter/web-chat-view' typecheck`
- `bun run --filter '@agenter/web-chat-view' test`
- Storybook DOM contract coverage for unstable or interaction-heavy composites

Route-level screenshot review belongs to host shells such as `packages/web-chat-view/example`, not to the shared package alone.

For the canonical review flow, high-value host verification also includes a route-level proof artifact that demonstrates mixed completion, upload preview, comment-resource roundtrip, comment editor sheet geometry, bottom-anchored scroll-to-latest geometry, and wide-viewport message-action anchoring on a real review URL.

## 8. People Shell Boundary

`@agenter/web-chat-view` remains the room primitive inside a larger people-aware host shell.

Durable rules:

- durable contacts, contact requests, source subscriptions, current actor profile, and global app navigation are host-owned
- contact identity is source-scoped at the host layer; the room component does not merge contacts or read contact tables directly
- contact-backed mention suggestions enter through the existing host-provided completion/participant suggestion surface
- contact-detail start-chat flows are explicit host orchestration that resolves an authorized room transport URL before mounting the shared chat view
- the package must remain usable for a single room without forcing consumers to adopt the review example shell
