# add-cli-shell-app runtime progress

## Objective facts

- Group 0 and Group 1 are implemented and committed.
- `@agenter/cli-shell` currently launches as an external package through the descriptor-driven launcher.
- Current `cli-shell` attach path already performs:
  - launcher-provided daemon context consume
  - superadmin auto-login
  - avatar ensure
  - runtime ensure
  - terminal ensure
  - room ensure
  - prompt/memory seed-if-missing

## Remaining platform gaps

- `cli-shell` does not yet consume app attention and app delegation APIs in app code.
- Managed/takeover state is not yet projected from platform truth on reconnect.
- Managed/takeover enable/disable does not yet commit hosting attention or create/revoke app delegations.
- Real daemon integration coverage for repeated attach / `@default` / `--session=2` is still missing.
- TUI group is not started yet.

## Evidence and blockers

- Current targeted `cli-shell` and launcher tests are green.
- `openspec validate add-cli-shell-app --strict` is green.
- Package-level `bunx tsc --noEmit -p packages/cli/tsconfig.json` is still blocked by pre-existing drift in `packages/tui/src/run-tui.tsx` (`ChatMessageRole` includes `system` while the local consumer expects only `user | assistant`).

## Runtime tensions observed during managed/integration closure

- Real daemon room grants keep the bootstrap superadmin membership alongside the summoned Avatar grants. The durable contract for cli-shell is "selected Avatar grants are ensured", not "the room contains only cli-shell avatars".
- Global terminal and room catalog order is not a stable contract. Integration assertions should sort by durable keys (`terminalId`, `metadata.resourceKey`) instead of assuming creation order.
- The cli-shell package boundary stayed clean during managed-mode implementation: app code consumed `@agenter/client-sdk` and `@agenter/app-runtime` only. The remaining cross-package typecheck blocker lives in pre-existing `packages/tui/src/run-tui.tsx`, which should not be misattributed to cli-shell runtime work.

## TUI substrate notes

- The collapsed shell-terminal TUI can stay app-orthogonal by reading only runtime-store projections: `focusedTerminalId`, `terminalSnapshots`, `heartbeatGroups`, and `unreadBySession`. No `@agenter/tui` dashboard/session-list reuse is needed.
- This workspace needed an explicit `bun install` before `@opentui/core` and `@opentui/react` became resolvable in `packages/cli-shell`. The package declarations were correct, but the local install state was missing.
- `@opentui/react/test-utils` currently leaves a React `act(...)` warning on renderer teardown even though the collapsed TUI assertions pass. This is test-harness noise, not a app-contract failure, and should not be confused with a cli-shell runtime regression.

## Next steps

1. Add app-side managed runtime helpers around hosting attention and app delegation.
2. Add real daemon integration tests for repeated attach / avatar override / session isolation.
3. Use those helpers as the substrate for the bottom-only TUI instead of inventing local managed state.

## Interactive TUI closure facts

- The interactive TUI now routes app interaction through a controller layer instead of a renderer-heavy test harness. This was necessary because the Bun + OpenTUI test renderer teardown kept producing unstable behavior unrelated to cli-shell app contracts.
- The cli-shell frame now renders as a styled cell grid, including gray user-message rows and gray focused input rows, while preserving deterministic column accounting for CJK and emoji glyphs.
- Focused TUI tests now cover:
  - toolbar status / heartbeat summaries
  - action/unread projections
  - right/left/bottom/floating dialogue placements
  - date divider + short time rendering
  - dialogue placement shortcuts + cancel behavior
  - terminal input routing / chat input isolation
  - resize geometry projection

## Remaining gap after TUI closure

- Task 4.21 is intentionally still open. Cli-shell now creates and projects app delegations correctly, but the remaining acceptance requirement is stronger: confirm that autonomous terminal writes in managed execution use the Avatar actor identity and preserve delegation/lease provenance in the real write path, rather than only in cli-shell's own projection state.
- Real local walkthrough (`5.5`) and long-running real AI semantic validation (`5.7`-`5.11`) remain pending after the TUI task group.

## 2026-05-08 real walkthrough closure facts for 5.5

- Real walkthrough root: `/tmp/agenter-cli-shell-walkthrough.Nq3P6d`
- Real daemon: `HOME=/tmp/agenter-cli-shell-walkthrough.Nq3P6d/home bun /Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/cli/src/bin/agenter.ts daemon --host 127.0.0.1 --port 50667`
- TUI capture logs:
  - `/tmp/agenter-cli-shell-walkthrough.Nq3P6d/shell1.script`
  - `/tmp/agenter-cli-shell-walkthrough.Nq3P6d/shell1b.script`
  - `/tmp/agenter-cli-shell-walkthrough.Nq3P6d/shell2b.script`

- Non-TTY attach facts were re-verified against the live daemon:
  - default attach created `shell-1`, created the room, seeded `shell-assistant` prompt + memory, and reported `managed: off`
  - repeat attach to `agenter shell @default` reused `shell-1` and the same room without mutating `shell-assistant`
  - `agenter shell --session=2` created `shell-2` and its own room while reusing the same `shell-assistant` runtime identity

- Real network blocker from the previous walkthrough is closed:
  - root cause was `/trpc/message.globalSend` plain-body compatibility shims intercepting batched `httpBatchLink` mutation traffic
  - fix: batched `/trpc/*` requests now bypass the plain-body compatibility shim and fall through to the standard tRPC HTTP handler
  - regression proof now exists in `packages/cli/test/trpc-server.test.ts`

- Bun/PTTY attach blocker is closed:
  - root cause was `RuntimeStore.connect()` wiring browser offline listeners whenever `window` existed, even in Bun/non-browser TTY shims
  - fix: only wire browser listeners when `addEventListener/removeEventListener` actually exist
  - regression proof now exists in `packages/client-sdk/test/runtime-store.test.ts`

- Real TUI interaction facts were observed on `shell-1`:
  - one-line bottom toolbar rendered
  - `Meta+J` opened the dialogue panel on the right
  - `Meta+B` moved the dialogue panel to bottom placement
  - date divider row `2026-05-08` rendered in the dialogue
  - short time headers rendered (`03:28`, `03:29`, `03:31`)
  - dialogue send path showed `正在发送消息…` followed by `消息已发送`
  - sent message `ping from tui` landed in the real room snapshot
  - managed toggle showed `正在开启托管… -> 托管已开启` and `正在关闭托管… -> 托管已关闭`
  - non-TTY reconnect re-reported `managed: on` and later `managed: off` after the matching toggle

- Real unread projection gap was found and closed:
  - before fix, toolbar unread used `unreadBySession[sessionId]`, which does not reflect room-first unread truth for cli-shell dialogue
  - spec/design require unread room-message attention on the chat entry button
  - fix: cli-shell now computes unread from room snapshot truth (`senderActorId != avatarActorId`, `kind=text`, not recalled, `unreadActorIds` contains the summoned Avatar)
  - after the fix, the real toolbar showed `✉ 3 ⌘J` on `shell-1`
  - regression proof now exists in `packages/cli-shell/test/cli-shell-tui.test.tsx`

- Real terminal signal facts were observed:
  - `Ctrl+C` routed to the backend terminal and produced:
    - `bash-3.2$ sleep 30`
    - `^C`
    - `bash-3.2$`
  - this was read back through the live terminal authority compatibility endpoint `/trpc/terminal.globalRead`

- Real geometry facts were observed:
  - default TTY launch drove backend `shell-1` snapshot to `80x23`, matching the shell-terminal height minus the one-line toolbar
  - a second real PTY launched with `stty cols 100 rows 30` drove backend `shell-2` snapshot to `100x29`, again matching the one-line toolbar subtraction
  - in-place SIGWINCH injection is not available through the current exec tool, so live resize was evidenced by launching a second real PTY with different dimensions instead of mutating one already-running PTY

- Task `5.5` is now supportable by objective evidence:
  - repeat launch
  - explicit `@default`
  - detach/reconnect
  - one-line toolbar
  - status state transitions
  - Heartbeat streaming
  - managed toggle on/off
  - managed state reconnect
  - chat unread entry
  - dialogue panel open/close/placement
  - short time rendering
  - date divider rendering
  - dialogue input send/cancel
  - terminal `Ctrl+C`
  - real geometry path across distinct PTY sizes
  - `agenter shell --session=2`

## 2026-05-08 long-running semantic suite closure facts for 5.6-5.11

- No post-v8 IA change was introduced during implementation closure.
  - `design.md` and the accepted spec text already point only at the final v8 PNG/SVG/TXT reference set.
  - There was therefore no new reference refresh to perform for `5.6`; the closure fact is "accepted v8 set unchanged".

- The real semantic suite code now exists under `packages/cli-shell/test-support/real-cli-shell-semantic-suite.ts` and `packages/cli-shell/test/real-cli-shell-semantic.integration.test.ts`.
  - It defines the required rubric dimensions:
    - `userFitLearning`
    - `memoryQuality`
    - `selfEvolutionDirection`
    - `orthogonality`
    - `hostingSeparation`
    - `programmableAttentionUsage`
    - `antiOverfit`
    - `totalScore`
  - It defines the required default threshold and retry policy:
    - `REAL_CLI_SHELL_SCORE_THRESHOLD = 0.8`
    - `REAL_CLI_SHELL_JUDGE_MAX_ATTEMPTS = 3`
  - It records long-script evidence for:
    - correction-driven memory updates
    - manual compact
    - reconnect continuity
    - later reuse of learned preference
    - model-response cache file observation

- The semantic suite input path was corrected to follow durable platform law.
  - Earlier assumption: cli-shell app room could be used as the conversational wake source.
  - Verified correction: self-evolution chat turns must use the session primary room path, not the app room metadata room.
  - Real fixture change:
    - attach the session primary room before chat sends
    - read back assistant-visible replies from the attached primary room rather than from optimistic chat-only projections

- Deterministic verification for the semantic suite scaffolding is green:
  - `bunx tsc --noEmit -p packages/cli-shell/tsconfig.json`
  - `bun test packages/cli-shell/test/cli-shell.test.ts packages/cli-shell/test/cli-shell.integration.test.ts packages/cli-shell/test/cli-shell-tui.test.tsx packages/cli-shell/test/package-boundary.test.ts packages/cli-shell/test/real-cli-shell-semantic.integration.test.ts`
  - `openspec validate add-cli-shell-app --strict`

- Real-provider acceptance remains objectively blocked on this machine as of 2026-05-08:
  - `glm` (`https://api.z.ai/api/anthropic`)
    - after tool use, provider rejects follow-up with:
      - `The messages parameter is illegal. Please check the documentation.`
  - `deepseek`
    - the assistant now reaches the correct durable room-delivery decision and begins `root_bash` / `message send` style work
    - provider then rejects the tool follow-up with:
      - `The reasoning_content in the thinking mode must be passed back to the API.`
    - inspection of the failing follow-up request shows the adapter/runtime path is not replaying a valid assistant/tool history shape for that provider family
  - `mimo`
    - provider returns:
      - `402 insufficient_balance`
  - `jixoai/agenter/test`
    - after a 120s probe, the latest model call was still `running`, no room delivery was produced, and the path is not a reliable acceptance provider for this change closure

- Because the long-running suite cannot complete a full real semantic pass with any currently available provider on this machine:
  - `5.7` and `5.8` are supportable as implemented suite capability
  - `5.9` and `5.11` remain blocked as real acceptance tasks, not as missing cli-shell app code

## 2026-05-08 semantic acceptance reopen and closure for 5.9 / 5.11

- The earlier "provider blocked" conclusion was no longer current after switching the suite to explicit `deepseek-chat` override:
  - `AGENTER_REAL_AI_API_STANDARD=openai-chat`
  - `AGENTER_REAL_AI_BASE_URL=https://api.deepseek.com/v1`
  - `AGENTER_REAL_AI_MODEL=deepseek-chat`
  - `AGENTER_REAL_AI_VENDOR=deepseek`

- Real acceptance failures after that switch were suite/fixture law mismatches, not missing cli-shell app behavior:
  - room-reply wait originally used chat timestamp ordering against primary-room durable messages; real runtime ordering is not guaranteed across those two surfaces
  - assistant-room detection originally required `senderActorId` only; real primary-room snapshots are more stable when `from` is also accepted as Avatar identity evidence
  - model-call wait originally used recent-array length, which is not durable because the debug list is a sliding window; stable `modelCall.id` is the correct anchor
  - per-turn hard wait for global attention convergence turned long semantic traces into false timeouts; for this suite, a short observation window is enough because final `hosting <= 0`, memory diffs, compact continuity, and judge evidence already capture the durable contract
  - reconnect originally closed only the client, not the connected runtime store; long scripts exposed websocket handshake noise until the fixture explicitly called `store.disconnect()` first
  - full-judge `maxTokens=400` was too small for the richer playful rubric output; the response was valid JSON content but truncated before the closing brace
  - some judge replies came back as a single-element JSON array instead of a bare object; the suite now normalizes that envelope without weakening the rubric itself
  - local auth-service bridge occasionally returned `auth-service principal list failed (502)` during bootstrap/reconnect; the fixture now applies a narrow bounded retry only for that specific bootstrap noise

- Closure evidence on the current suite revision:
  - `bunx tsc --noEmit -p packages/cli-shell/tsconfig.json`
  - `openspec validate add-cli-shell-app --strict`
  - `bun test packages/cli-shell/test/real-cli-shell-semantic.integration.test.ts --test-name-pattern "senior-led"`
    - pass in ~75s
  - `bun test packages/cli-shell/test/real-cli-shell-semantic.integration.test.ts --test-name-pattern "requirement-led"`
    - pass in ~138s
  - `bun test packages/cli-shell/test/real-cli-shell-semantic.integration.test.ts --test-name-pattern "playful"`
    - pass in ~113s

- These three passing real-AI traces now support `5.9`:
  - `senior-led`: result-first / terse preference learned from correction and reused after compact+reconnect
  - `requirement-led`: strict `result:` / `next:` format learned from evidence instead of role archetype
  - `playful`: relaxed companion-like tone learned without turning playfulness into a app mode or breaking engineering boundaries

- The same suite now supports `5.11` because each passing scenario includes the required long-script behaviors:
  - many-turn terminal-adjacent exchange
  - user correction
  - durable memory update
  - manual compact
  - reconnect continuity
  - later reuse of learned memory
  - cache-mode observation through the fixture result contract

- Final status change:
  - `5.9` is now supportable by objective real-provider evidence on this machine
  - `5.11` is now supportable by the same long-script real-provider evidence

## 2026-05-08 publish-surface closure facts

- The app implementation had already closed functionally; the remaining work was npm publish-surface hardening for `agenter` and `@agenter/cli-shell`.

- The `agenter` public wrapper now avoids loading daemon/runtime chunks for pure metadata flows:
  - `packages/cli/src/run-cli.ts` moved daemon/auth-service startup imports behind dynamic boundaries
  - descriptor-launched app metadata argv (`--help`, `--version`, `help`, `version`) now skip daemon bootstrap
  - objective effect: `agenter shell --help` no longer triggers daemon/runtime side effects just to print app help

- The bundled prompt/i18n asset blocker was closed without adding ad-hoc package-root file copying:
  - `packages/i18n-en/src/index.ts` and `packages/i18n-zh-Hans/src/index.ts` now use bundled JSON payloads as the non-workspace fallback while preserving live `prompts/` dir loading in the workspace
  - objective effect: bundled `agenter` runtime no longer crashes on missing `prompts.json` when loaded from the published dist surface

- The `@xterm/headless` publish blocker was closed at the terminal platform boundary instead of by leaking a patched runtime dependency to npm users:
  - `packages/terminal-system/src/xterm-headless-module.ts` now establishes the runtime shim and re-exports `Terminal`
  - `packages/terminal-system/src/xterm-bridge.ts` now uses that static module boundary instead of `createRequire("@xterm/headless")`
  - objective effect: `agenter` dist now carries the already-validated headless terminal implementation inside the bundle, so installed tarballs can start the daemon without missing-module failure

- The `@agenter/cli-shell` help/runtime blocker was closed in app code:
  - `packages/cli-shell/src/run-cli-shell.ts` now short-circuits metadata-only argv and lazy-loads the TUI runner only for real TTY attach flows
  - `packages/cli-shell/scripts/build.ts` now enables chunk splitting so the OpenTUI platform code stays out of help/non-TTY startup
  - objective effect: `agenter-cli-shell --help` and `agenter shell --help` both exit cleanly without resolving OpenTUI platform modules early

- Objective publish-surface verification now exists:
  - local workspace wrapper:
    - `bun packages/agenter/bin/agenter.js shell --help`
    - `bun packages/cli-shell/bin/agenter-cli-shell.js --help`
    - `bun packages/agenter/bin/agenter.js daemon --host 127.0.0.1 --port 4598`
    - `curl -sf http://127.0.0.1:4598/health -> {"ok":true,"port":4598}`
  - packed install surface:
    - `npm pack ./packages/agenter --pack-destination /tmp/agenter-pack.jPytmM`
    - `npm pack ./packages/cli-shell --pack-destination /tmp/agenter-pack.jPytmM`
    - `npm install ./agenter-0.0.0.tgz ./agenter-cli-shell-0.0.0.tgz` in `/tmp/agenter-pack.jPytmM`
    - `bun node_modules/.bin/agenter shell --help`
    - `bun node_modules/.bin/agenter-cli-shell --help`
    - `bun node_modules/.bin/agenter daemon --host 127.0.0.1 --port 4599`
    - `curl -sf http://127.0.0.1:4599/health -> {"ok":true,"port":4599}`

- Version management was added for the publishable surfaces:
  - `.changeset/cli-shell-publish-surface.md`
  - packages covered: `agenter`, `@agenter/cli-shell`, `@agenter/i18n-en`, `@agenter/i18n-zh-hans`
