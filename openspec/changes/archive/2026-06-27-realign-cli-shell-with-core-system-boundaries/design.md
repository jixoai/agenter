## Context

The user restated the boundary:

- Shell is TerminalSystem.
- Avatar prompt and prompt-source resolution are Core/AvatarRuntime concerns.
- Terminal authorization is TerminalSystem.
- Room is MessageSystem.
- cli-shell is a TUI program. Its job is to display and operate core communication through a TUI.
- cli-shell may use a carefully designed generic SDK over network transport, process IPC, or shared memory, but it must not own or redefine the kernel systems.

The current repo has two conflicting mistakes:

1. Long-term and legacy cli-shell specs still describe `terminal-1` / `terminal-2`, where TerminalSystem carries cli-shell app composition. That pollutes TerminalSystem with app chrome and app topology.
2. The tmux migration specs and `apps/cli-shell/SPEC.md` then say the visible terminal surface is extension-local tmux. That removes Shell truth from TerminalSystem and makes Avatar/tooling unable to see the actual TerminalSystem target.

The session-6/session-7 failure is a symptom of this boundary collapse. The Avatar still uses TerminalSystem tools and prompt laws, which is correct. But cli-shell's current tmux model created a visible shell pane that TerminalSystem does not know as the current shell resource. The Avatar then queried TerminalSystem, saw stale legacy terminals, and wrote to the wrong stopped/old terminal.

## Goals / Non-Goals

**Goals:**

- Restore the system ontology: TerminalSystem is Shell truth; cli-shell is a TUI projection/input app.
- Keep `apps/cli-shell` as the correct app ownership location.
- Define generic SDK laws app TUIs can reuse without cli-shell-specific core branches.
- Make the current cli-shell session bind to explicit TerminalSystem, MessageSystem, AvatarRuntime, and Attention resources.
- Make tmux/OpenTUI presentation choices subordinate to SDK-bound kernel truth.
- Make tests start from behavior: if Avatar is asked to operate the cli-shell session, it operates the TerminalSystem terminal bound to that session, not stale residue and not tmux-private state.
- Preserve "managed is attention" and "authorization is TerminalSystem".

**Non-Goals:**

- Do not implement the fix in this change.
- Do not add a cli-shell-specific direct model tool.
- Do not hard-code `if appId === "cli-shell"` inside TerminalSystem, MessageSystem, AvatarRuntime, or core prompt assembly.
- Do not restore `terminal-2` as app chrome truth.
- Do not make tmux a durable terminal database, authorization system, message store, or prompt source.
- Do not introduce "test Avatar" as a system concept.

## Decisions

### Decision 1: Define app TUI as projection plus input over core systems

cli-shell must model its first screen as a app view over a bound TerminalSystem terminal and a bound MessageSystem room. App state such as status bar layout, open Chat pane, and top-layer position can be local UI state. Terminal output, terminal input effects, terminal write approvals, room messages, Avatar prompt, and attention remain core-system facts.

Rejected alternative: tmux owns the current Shell.

Reason: That makes the Avatar's correct TerminalSystem mental model unable to target the visible terminal, producing the exact "shell-7 has no independent terminal" failure.

Rejected alternative: TerminalSystem owns cli-shell app chrome through `terminal-2`.

Reason: That makes TerminalSystem carry app topology and UI composition for one extension app.

### Decision 2: App binding must create or select one TerminalSystem terminal resource

For `bun agenter shell --session=7 --avatar=bangeel`, cli-shell must have a app binding that can answer:

- current app resource key: `shell-7`
- current TerminalSystem terminal id
- current MessageSystem room id
- current AvatarRuntime session/principal
- current attention hosting context id

The terminal id is a TerminalSystem id. The room id is a MessageSystem id. The AvatarRuntime session is a core runtime id. The TUI can expose them compactly or hide them, but it cannot replace them with tmux pane ids as system truth.

### Decision 3: Generic SDK comes before app implementation

If cli-shell cannot express a needed operation through SDK, the fix is to add a generic SDK capability, not a cli-shell-specific kernel path. The minimum SDK surfaces are:

- terminal catalog/binding/projection
- terminal input/write/read/await
- terminal permission request subscription and approve/deny
- room snapshot/send/focus
- Avatar runtime selection and current binding/session facts
- attention query/commit/settle/projection
- app lifecycle cleanup

The transport may be tRPC/WebSocket today and can later add process IPC or shared memory optimization. The law is semantic, not tied to a transport mechanism.

### Decision 3.1: A hypothetical Web host sharpens the SDK boundary instead of weakening it

One useful test for the boundary is to imagine there is another app named `cli-shell-web` that is completely separate from native `cli-shell` but wants to present the same core facts through a browser host. Under the corrected boundary, that thought experiment should feel boring:

- the Web app still consumes TerminalSystem for shell truth
- it still consumes MessageSystem for room truth
- it still consumes AvatarRuntime/Core for prompt truth
- it still consumes AttentionSystem for managed/heartbeat/progress truth
- it still consumes the same app binding identities and terminal/room/action APIs
- only the host framework changes from tmux/OpenTUI to browser runtime + DOM renderer

If a future Web host would require new core branches just because it is Web, then the SDK boundary is still too app-shaped. The right answer is to widen the generic SDK surface, not to encode `cli-shell` or `cli-shell-web` behavior inside TerminalSystem, MessageSystem, AvatarRuntime, or AttentionSystem.

This also gives a concrete minimum-face test for the SDK:

- app binding must expose the current terminal id, room id, AvatarRuntime identity, and attention context ids
- terminal APIs must support projection, input/write, lifecycle, approval subscription, approve/deny, and later wait/cancel style action flow
- room APIs must support snapshot/read/send/focus
- runtime facts must expose current app/session binding without becoming a second prompt source
- cleanup must act on bound resources through their owning systems

If those surfaces are present, both native `cli-shell` and a hypothetical browser-hosted sibling can be built as ordinary products instead of as exceptions inside core.

### Decision 4: App runtime facts are not prompt ownership

cli-shell may provide current app facts to the selected Avatar: "this room is bound to terminal X and room Y". But `AGENTER.mdx` path resolution, Slot composition, prompt persistence, and prompt change detection remain Avatar/Core concerns.

The important boundary is this:

- `AGENTER.mdx` is the single trusted prompt source.
- current cli-shell binding facts are session/runtime facts
- session/runtime facts may be queryable or injectable as ordinary runtime context
- session/runtime facts are not a second hidden prompt source

Explicit `--avatar=bangeel` should receive the cli-shell binding facts for this session without creating a special "test Avatar" concept and without overwriting user-edited prompt files.

### Decision 5: TopLayer and managed mode are app UI over core facts

The authorization popup displays TerminalSystem approval requests and calls TerminalSystem approve/deny APIs. Its location, drawing, mouse hit testing, and keyboard handling are cli-shell UI. The approval request itself is not cli-shell state.

Managed/on/off commits and settles app-scoped attention. It may be projected in the status bar and may affect Avatar scheduling. It does not grant terminal write authority and does not become a TerminalSystem mode.

### Decision 6: Existing active changes must be rewritten before apply

`move-cli-shell-to-extension-tmux-host` contains one valid architectural move: cli-shell belongs under `apps/cli-shell`, and core must not import app implementation. But its "TerminalSystem is not a participant" statement is too strong and is superseded by this change.

`refine-cli-shell-tmux-app-shell` contains useful interaction stories for status, Chat, Help, and TopLayer. But its tmux-native app-shell wording is superseded and must be downgraded to "tmux/OpenTUI can host presentation for SDK-bound core resources."

## Risks / Trade-offs

- [Risk] The current code already moved far into the tmux-as-Shell implementation.
  -> Mitigation: this change is spec-first and explicitly stops implementation until the boundary is accepted.

- [Risk] Restoring TerminalSystem as Shell truth could be misread as restoring `terminal-2`.
  -> Mitigation: specs must distinguish "TerminalSystem owns Shell" from "TerminalSystem owns app chrome"; only the former is valid.

- [Risk] The generic SDK surface may become too broad or too app-shaped.
  -> Mitigation: every SDK method must be framed around core-system nouns and reusable app needs, not cli-shell UI nouns.

- [Risk] tmux remains useful for mixing panes, so future work may again drift toward tmux truth.
  -> Mitigation: tests must assert that tmux pane ids are never used as terminal authorization, terminal read/write, prompt, or room truth.

- [Risk] Developers may keep smuggling app context back into a second prompt source.
  -> Mitigation: this change treats `AGENTER.mdx` as the only prompt truth and requires cli-shell binding data to be modeled as runtime/session facts only.

- [Risk] Prompt context for arbitrary selected Avatars can accidentally overwrite user files.
  -> Mitigation: app context must be injected as session/context guidance or other runtime facts only; no forced rewrite.

## Migration Plan

1. Freeze new cli-shell implementation work.
2. Rewrite OpenSpec law through this change.
3. Revise or supersede the two active tmux changes so their tasks align with the corrected boundary.
4. Update `apps/cli-shell/SPEC.md` and durable specs before implementation resumes.
5. Implement SDK gaps with BDD tests at the app/core boundary.
6. Rework cli-shell bootstrap to bind TerminalSystem terminal + MessageSystem room + AvatarRuntime + attention context.
7. Rework TUI/tmux code to render and operate those SDK-bound resources.
8. Run real AI validation against fresh sessions and stale residue cases.

## Open Questions

- Should cli-shell's local presentation continue to use tmux as the outer container, or return to an OpenTUI-only host once the SDK-bound TerminalSystem projection is stable?
- What is the exact SDK shape for high-performance terminal frame transport in a TUI process: tRPC/WebSocket only first, or a same-process/direct data-plane optimization?
- Which runtime fact surface is the best minimal carrier for current cli-shell binding: runtime projection, room/system fact, attention projection, or another generic session-fact channel?
- Which cleanup resources are required for this change versus later migration cleanup?
