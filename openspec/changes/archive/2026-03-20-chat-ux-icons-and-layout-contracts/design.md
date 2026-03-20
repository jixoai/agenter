## Context

The workspace shell already separates Chat, Devtools, and Settings, but the Chat route still projects `messages + cycles` into the same transcript model and uses model capabilities to hard-disable image paste/drop. Session identity is also still mostly text-only, while avatar configuration only exists as a nickname resolved from settings layers. Layout regressions continue to appear because scroll ownership, clip ownership, and semantic background ownership are not encoded as reusable primitives beyond a small allowlist.

## Goals / Non-Goals

**Goals:**
- Make Chat read like a production chat app: bubbles, restrained timestamps, inline attachments, avatars, and expert actions hidden in context menus.
- Add a unified profile image backend contract with session icon and avatar icon upload/get flows plus deterministic fallback rendering.
- Introduce a global Settings route for user settings and avatar catalog management without breaking workspace-scoped settings editing.
- Tighten overflow, background, typography, and color contracts so major surfaces keep one explicit scroll owner and better default density.

**Non-Goals:**
- No backward compatibility migration for old Chat/Cycle UI assumptions.
- No generic video/file send redesign in this change; the attachment contract remains extensible, but v1 optimization focuses on images.
- No AI-generated icons in this change; only deterministic fallback generation and manual upload support are included.

## Decisions

### 1. Chat projection becomes message-first, with cycle metadata retained only as expert backlinks

`projectConversationRows` will stop treating cycles as primary transcript content. Persisted and optimistic/live messages stay the transcript truth, while cycle ids are preserved only as optional metadata used by per-message context menus to open Devtools. Time divider rows will be inserted during projection with these rules: hide gaps under 2 minutes, throttle repeated dividers to 30 minutes, and always show a date divider when the day changes.

Alternative considered: keep cycle-derived transient rows as first-class transcript rows. Rejected because it keeps cycle semantics visible in the default chat reading flow.

### 2. Attachment affordances stay on; model compatibility becomes validation feedback

The composer will always allow image pick/paste/drop/screenshot when the transport can upload session assets. The runtime/model capability will instead decide whether sending an image-bearing prompt is allowed, surfacing a clear notice before or during submit. This avoids the current bug where image input appears "broken" simply because the UI hid image affordances.

Alternative considered: keep hard gating in the UI and show a tooltip. Rejected because it hides a functioning upload pipeline and makes the bug hard to diagnose.

### 3. Session icons use server-rendered SVG fallback plus optional client-generated WebP upload

The backend will serve a deterministic session icon at a stable media URL. If a raster icon file exists, it serves that file; otherwise it returns a generated SVG that encodes stable seeded gradients/noise from workspace path and session id. The WebUI can rasterize the fallback SVG to WebP and upload it once, but rendering never depends on that upload having happened.

Alternative considered: keep the whole algorithm only in the frontend. Rejected because the server must provide a fallback for future non-WebUI clients and uploaded-vs-fallback behavior should remain transparent.

### 4. Avatar icons use the same storage core but stay avatar-semantic at the API boundary

Session icons and avatar icons share storage helpers, media routing, and fallback rendering helpers inside the app-server/avatar packages. The public APIs remain semantic (`session icon`, `avatar icon`) so feature code does not need a generic media abstraction. Avatar catalog management will be global, backed by the user-level `.agenter/avatar/*` roots plus explicit icon uploads.

Alternative considered: two fully separate implementations. Rejected because storage, media serving, and fallback rendering would duplicate logic.

### 5. Global settings becomes a dedicated route, not a sidebar primary item

Primary navigation remains `Quick Start` and `Workspaces` only. Global Settings becomes its own route, entered from global chrome, while workspace settings remains inside the workspace shell. This preserves the user's prior information architecture while still making user-level settings first-class.

Alternative considered: add Settings to the primary sidebar. Rejected because it breaks the fixed-primary-navigation contract already codified in specs.

### 6. Layout contract expands from "ban overflow-hidden" to "encode scroll/clip/background ownership"

We will add stronger layout primitives and tests so each page/panel has one explicit primary scroll surface, clip ownership is opt-in, and only semantic surfaces own background fills. We will also fix the global typography tokens so body text uses real sans fonts instead of a mono-first stack, then normalize Chat/Devtools/Cycles density through shared tokens.

Alternative considered: fix each broken panel ad hoc. Rejected because prior iterations already proved that local fixes regress elsewhere.

## Risks / Trade-offs

- [Session/avatar icon API surface grows] → Keep storage internals shared and public routes semantic to avoid accidental media-layer coupling.
- [Chat projection refactor can regress optimistic/streaming continuity] → Preserve optimistic/live message handling and add transcript-focused unit/DOM tests before relying on manual QA.
- [Global settings route can duplicate workspace settings semantics] → Keep global route limited to user settings + avatar catalog, and leave workspace layer editing in the workspace shell.
- [More explicit scroll ownership may require broader class churn] → Add contract tests and update the shared overflow primitives first so downstream surfaces migrate consistently.
