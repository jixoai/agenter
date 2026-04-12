## Context

The backend already has the core primitives needed for a small engineering-team style validation flow:
- distinct Avatar sessions can run concurrently,
- one global room can issue grants to multiple participants,
- each runtime can focus granted rooms and ingest them through message attention,
- global room assets can be uploaded and sent as durable attachments,
- shared workspaces can be reused across sessions by creating different Avatar sessions on the same project path.

The main missing piece is not room collaboration itself, but attachment authorship from an Avatar. The current `message_send` tool is text-only, so an Avatar cannot directly upload a design file into a room by itself. For backend validation, this must be bridged without inventing a second room truth.

The first real run also exposed a scenario bug: the frontend is currently free to guess the backend API payload in its `API-QUESTION:` message, and the scenario accepts the backend's first `API-ANSWER:` reply without verifying the required markers. That lets speculative contract text become durable room truth and weakens the validation.

Later real runs exposed two more sources of flakiness:
- the frontend sometimes burns cycles on terminal recovery or verbose planning instead of actually writing `design.svg` and `index.html` to disk;
- the backend sometimes reaches the delivery phase without producing a usable `server.js` + background service, so a pure “please send PROJECT-URL” reminder is too weak.
- the frontend can also claim success while `index.html` still drifts away from the exact marker contract, because loose file checks only prove “some html exists”, not that the agreed delivery text survived.

The harness must therefore remind the Avatars that terminals are not pre-mounted, that they must explicitly create or recover one by tool call, that existing workspace terminals should be re-focused when recovery prompts are issued, that frontend file checks must validate the full agreed marker set, and that backend recovery prompts must distinguish “service already up, just report URL” from “service still not healthy, repair and self-test first”.

## Goals / Non-Goals

**Goals:**
- Add one real-provider scenario for `user + backend Avatar + frontend Avatar + shared project room`.
- Prove both Avatars can read and reply in the same room while sharing one project workspace.
- Prove room attachments are durable inside the collaboration loop by posting a frontend-authored design artifact into the project room.
- Keep the product ask intentionally small so the test validates collaboration mechanics rather than application complexity.
- Preserve a single contract authority inside the shared room so the backend's API answer becomes the only durable truth for `/api/status`.

**Non-Goals:**
- Do not redesign room, message, or terminal architecture.
- Do not add WebUI/browser automation.
- Do not require a general-purpose “Avatar native attachment upload tool” in this change.

## Decisions

### 1. Use one shared project workspace and two distinct Avatar sessions
The scenario will create two sessions with different Avatar nicknames but the same `cwd`, so both Avatars collaborate on one project tree while keeping independent runtime state.

Alternative considered:
- separate workspaces with later artifact merge.

Why not:
- That would test artifact handoff, not shared project-room collaboration around one project.

### 2. Use one global project room as the single collaboration surface
The harness will create one global room, grant both Avatar runtime actors and one user actor access, then focus that room into both Avatar runtimes. Requirement discussion, interface negotiation, attachment handoff, and final acceptance will all happen in that same room.

Alternative considered:
- combine private primary rooms plus relay rooms.

Why not:
- The point of this scenario is shared-room collaboration, so hidden side channels would dilute the signal.

### 3. Prime Avatar roles privately, but keep project work in the shared room
Because the current system does not guarantee role specialization from nickname alone, each Avatar may receive one short private bootstrap instruction describing its responsibility (`backend` vs `frontend`). The actual project requirement and all coordination facts will still occur in the shared room.

Alternative considered:
- rely entirely on nickname-based self-identification.

Why not:
- Real-provider variance would make role separation flaky and convert product validation into prompt lottery.

### 4. Bridge frontend-authored design files into room attachments
The frontend Avatar will be instructed to create a deterministic design artifact file in the shared workspace and announce it in the room. The harness will then upload that file into the global room using the frontend Avatar’s room actor identity and send a matching room message with the attachment.

Alternative considered:
- wait for the runtime to support direct Avatar attachment upload.

Why not:
- That would block the whole scenario on a tooling gap instead of validating the already existing room attachment law.

### 5. Verify collaboration by room truth and delivered app behavior
Success must require:
- both Avatars speaking in the shared room,
- a durable design attachment appearing in the room,
- backend/frontend interface discussion appearing in room messages,
- the shared app becoming reachable for the user,
- a final user acceptance round in the same room.

Alternative considered:
- assert only final filesystem output.

Why not:
- That would miss the actual collaborative behavior the scenario is supposed to prove.

### 6. Shared-room API contract must obey the single-source-of-truth law
The frontend may ask for the API contract, but it SHALL NOT publish a guessed payload example as if it were already agreed truth. The backend's `API-ANSWER:` reply is the authority for the final `/api/status` contract, and the scenario must validate that reply before moving to frontend implementation and backend delivery.

Alternative considered:
- leave prompts loose and just retry more when the room drifts.

Why not:
- That keeps false facts in the room transcript and turns validation into prompt lottery instead of enforcing the intended collaboration law.

### 7. Terminal acquisition and recovery must be explicit in the scenario prompts
The validation flow cannot rely on a pre-mounted terminal. When a participant needs shell access, the prompt must explicitly tell it to create or recover its own terminal, and reminder steps should re-focus any existing workspace terminal before waiting again for disk output or delivery evidence.

Alternative considered:
- silently assume the model will remember its prior terminal state.

Why not:
- The product law is explicit resource mounting plus recoverable terminal context. The scenario should exercise that law instead of sneaking in a hidden default terminal assumption.

### 8. Backend contract and delivery prompts must stay exact
The backend's `API-ANSWER:` must stay aligned with the eventual `server.js` template. The scenario should therefore reject extra payload fields such as `uptime`, and delivery reminders must tell the backend to repair `server.js`, relaunch the service in the background, and self-test before publishing `PROJECT-URL`.

Alternative considered:
- accept any payload that merely contains `TEAM-API-READY` / `PROJECT-COLLAB-V1` markers and rely on later prompts to converge.

Why not:
- That creates contradictory room truth. The backend then sees one contract in the room and a different contract in the delivery template, which increases real-provider drift exactly where the validation needs to be strict.

### 9. Frontend delivery checks must validate the whole HTML contract
The frontend step is not complete just because `index.html` exists. The harness must validate the full agreed marker set in `index.html` before allowing the scenario to proceed to room attachment handoff and backend delivery.

Alternative considered:
- treat the file as good once any single visible marker appears.

Why not:
- That lets a frontend drift away from the agreed delivery contract while still appearing “done”, which only gets discovered much later during final service probing.

### 10. Final acceptance is the durable close signal; explicit COMPLETE markers are optional
The shared-room validation should treat durable delivery evidence plus the user’s acceptance message as the hard success condition. `BACKEND-COMPLETE` / `FRONTEND-COMPLETE` may still appear, but they are not required for the scenario to pass.

Alternative considered:
- require completion marker messages from both Avatars before success.

Why not:
- Real providers vary too much on ceremonial wrap-up. The product behavior we need to prove is collaboration, durable handoff, delivery, and user acceptance, not ritual shutdown phrasing.

## Risks / Trade-offs

- [Both Avatars may still overstep their roles] → use short private role primers plus deterministic project-room prompts.
- [The shared room may get polluted by speculative contract guesses] → forbid frontend guess payloads, validate backend `API-ANSWER:` markers, and re-anchor later prompts to the same agreed contract.
- [Attachment bridge is not fully avatar-native] → keep the bridge explicit in docs and preserve actor identity in room truth when uploading/sending the asset.
- [Shared workspace can create edit races] → keep the app tiny and split ownership clearly between frontend file(s) and backend file(s).
- [Real-provider coordination can be slow or noisy] → keep the scenario small, marker-based, and richly instrumented on failure.
