## Context

The current WebUI already has the raw ingredients for Chat, Workspaces, Sessions, Devtools, and settings, but those flows are still assembled in a way that leaks implementation detail into the main application shell. `App.tsx` remains a high-pressure coordination point, the chat composer is still textarea-shaped, and there is no durable path for images to move from the browser into a session, back out to the UI, and onward to a multimodal model.

This change spans multiple packages and contracts: WebUI composition, client-side runtime state, app-server routes, session persistence, and model input shaping. It also has product-level constraints: Quick Start must be a first-class entry, Chat and Workspaces must feel like an application rather than a page, and image input must only appear when the resolved provider can actually consume it.

## Goals / Non-Goals

**Goals:**
- Establish a stable application structure around `Quick Start`, `Chat`, `Workspaces`, and `Settings`.
- Replace textarea-centric composition with one shared CodeMirror-based `AIInput` used by Quick Start and Chat.
- Add end-to-end image attachments for supported providers, including preview, upload, persistence, retrieval, and chat rendering.
- Standardize reusable `WorkspaceItem` and `SessionItem` interactions across desktop and mobile.
- Expose provider draft capabilities early enough for the UI to gate image affordances before a session exists.
- Reduce contract ambiguity by tightening runtime payloads such as terminal snapshot `tail`.

**Non-Goals:**
- Adding non-image attachments such as documents, audio, or video.
- Solving historical session ranking with a new `lastVisitedAt` data model in this change.
- Rewriting the full model/provider layer beyond the multimodal input path required for user messages.
- Changing attention-system, task-system, or LoopBus semantics beyond the attachment and message contracts they need to carry.

## Decisions

### 1. Use CodeMirror as the only editor core for AI input
We will implement `AIInput` directly on top of CodeMirror instead of preserving a textarea fallback. This keeps path completion, image paste/drag interception, selection-aware token replacement, and future editor behaviors in one place.

**Alternatives considered:**
- Keep textarea and add popovers/drag handlers around it: rejected because the interaction model becomes brittle and duplicates editor state management.
- Support both textarea and CodeMirror variants: rejected because it creates two behaviors for the same product surface.

### 2. Split image transport from tRPC and keep images session-scoped
Image bytes will travel through dedicated HTTP upload/media routes, while tRPC continues to carry typed metadata and chat commands. Uploaded files will live under the target `sessionRoot`, and persistence metadata will live in `@agenter/session-system`.

**Alternatives considered:**
- Send image data through tRPC JSON/base64: rejected because it inflates payloads and muddies typed RPC contracts.
- Store images in a global media pool unrelated to sessions: rejected because lifecycle, archive, and delete semantics become harder to reason about.

### 3. Resolve provider capabilities before session creation when Quick Start needs them
The server will expose a lightweight draft-resolution endpoint that returns the effective provider metadata and capabilities for a workspace/avatar combination. Quick Start will use that result to decide whether image UI is available before a session exists.

**Alternatives considered:**
- Always show image affordances and fail later: rejected because the user explicitly does not want silent downgrade behavior.
- Hide image support entirely from Quick Start: rejected because it would make the entry flow weaker than Chat.

### 4. Keep dynamic chat shortcuts as a local UI concern
The sidebar's dynamic session shortcuts will be derived from local `openSessionIds` state. Session metadata remains the server truth, while the fact that a tab is currently open in this WebUI instance remains a client concern.

**Alternatives considered:**
- Persist open sessions server-side: rejected because it introduces cross-client coupling for a presentational concern.
- Infer open sessions from runtime activity: rejected because activity and navigation are not the same thing.

### 5. Reuse one master-detail shell for Chat/Devtools and Workspaces/Sessions
`MasterDetailPage` will remain the single layout controller for auxiliary panels on desktop and mobile. The change is not to invent another shell, but to make Quick Start and the item components fit into the same application model.

**Alternatives considered:**
- Let each feature own its own responsive split logic: rejected because the project already suffers from layout drift.

### 6. Defer `lastVisitedAt`, but tighten other contracts now
Recent sessions in Quick Start will still use `updatedAt` as an approximation for this change, but we will still tighten other known loose contracts such as terminal snapshot `tail` becoming a single string.

**Alternatives considered:**
- Add `lastVisitedAt` now: rejected to keep the change focused on the new input/navigation/media path.
- Leave terminal snapshot payloads unchanged: rejected because the current array form keeps leaking UI formatting concerns into runtime contracts.

## Risks / Trade-offs

- [Provider capability drift] -> Capability detection could disagree with actual provider behavior. Mitigation: keep a single server-side capability resolver and reuse it for Quick Start and Chat.
- [Upload complexity increases server surface] -> New HTTP routes add operational surface area. Mitigation: keep them session-scoped, validate only `image/*`, and serve from a narrow path namespace.
- [CodeMirror refactor touches many UI tests] -> Existing composer tests may become obsolete. Mitigation: replace them with BDD scenarios around observable input behavior instead of implementation details.
- [Session asset lifecycle bugs] -> Archive/delete flows could orphan files. Mitigation: treat assets as session-owned records and cover archive/delete in integration tests.
- [`updatedAt` is only an approximation of recent access] -> Quick Start may not perfectly reflect user intent. Mitigation: document the approximation in this change and keep the contract narrow enough to upgrade later.

## Migration Plan

1. Add the new OpenSpec-backed contracts for navigation, AI input, and session image assets.
2. Introduce server-side capability resolution plus upload/media routes without yet switching the WebUI input surface.
3. Add session-system tables/records for assets and attachment links, then wire chat submission and chat listing to include attachments.
4. Replace Quick Start and Chat composers with `AIInput`, add dynamic session shortcuts, and switch the Chat/Workspace views to the shared item components.
5. Update rendering and runtime payload consumers, including the terminal snapshot `tail` contract.
6. Run targeted BDD/integration coverage before continuing with `/opsx:apply` implementation work.

Rollback is straightforward because the change is still pre-implementation: the proposal can be abandoned or revised before any archive step. Once implementation starts, image routes and asset persistence should be shipped behind the provider-capability gate so unsupported paths remain hidden.

## Open Questions

- None for the proposal phase. The current plan is decision-complete enough to move into implementation tasks.
